'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { usePacificaWallet } from '@/hooks/usePacificaWallet';

type AccountState = {
  balance: number;
  available_to_spend: number;
  account_equity: number;
  total_margin_used: number;
  total_pnl?: number;
};

function truncateMiddle(value: string, left = 6, right = 4) {
  if (!value) return '';
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function fmtUsd(value: number | undefined) {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(safe);
}

function buildAgentSetupMessage(account: string, timestamp: string) {
  return [
    'Pacificast Agent Setup',
    `account:${account}`,
    `timestamp:${timestamp}`,
  ].join('\n');
}

export default function SettingsPage() {
  const { pushToast } = useToast();
  const {
    linkedPacificaAddress,
    linkedProvider,
    isPacificaLinked,
    connectLinkedWallet,
    signWithLinkedWallet,
  } = usePacificaWallet();

  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<AccountState | null>(null);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositEmbedUrl, setDepositEmbedUrl] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const displayAddr = useMemo(() => {
    if (!linkedPacificaAddress) return 'Not linked';
    return truncateMiddle(linkedPacificaAddress);
  }, [linkedPacificaAddress]);

  const agentWalletHint = useMemo(() => {
    if (!linkedProvider) return 'Not connected';
    return `${linkedProvider} linked`;
  }, [linkedProvider]);

  const fetchAccountState = useCallback(async () => {
    if (!linkedPacificaAddress) {
      setAccountState(null);
      setStateError(null);
      return;
    }

    setStateLoading(true);
    setStateError(null);
    try {
      const response = await fetch(
        `/api/pacifica/account-state?account=${encodeURIComponent(linkedPacificaAddress)}`,
        { cache: 'no-store' }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to load account state');
      }
      const next = body?.accountState;
      setAccountState({
        balance: Number(next?.balance ?? 0),
        available_to_spend: Number(next?.available_to_spend ?? 0),
        account_equity: Number(next?.account_equity ?? 0),
        total_margin_used: Number(next?.total_margin_used ?? 0),
        total_pnl: Number(next?.total_pnl ?? 0),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load account state';
      setStateError(message);
      setAccountState(null);
    } finally {
      setStateLoading(false);
    }
  }, [linkedPacificaAddress]);

  useEffect(() => {
    if (isPacificaLinked) {
      void fetchAccountState();
    }
  }, [isPacificaLinked, fetchAccountState]);

  const onCopyAddress = useCallback(async () => {
    if (!linkedPacificaAddress) return;
    try {
      await navigator.clipboard.writeText(linkedPacificaAddress);
      pushToast('Pacifica wallet copied', { variant: 'success' });
    } catch {
      pushToast('Could not copy wallet address', { variant: 'error' });
    }
  }, [linkedPacificaAddress, pushToast]);

  const onConnectPacifica = useCallback(async () => {
    try {
      const { address } = await connectLinkedWallet();
      const timeStamp = new Date().toISOString();
      const setupMessage = buildAgentSetupMessage(address, timeStamp);
      const signature = await signWithLinkedWallet(setupMessage);

      const response = await fetch('/api/pacifica/agent/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: address,
          signature,
          signatureEncoding: 'base64',
          timeStamp,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.details || body?.error || 'Failed to set up Pacifica agent wallet');
      }

      pushToast('Pacifica wallet linked and agent wallet ready.', { variant: 'success' });
      await fetchAccountState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link Pacifica wallet';
      pushToast(message, { variant: 'error' });
    }
  }, [connectLinkedWallet, fetchAccountState, pushToast, signWithLinkedWallet]);

  const onDeposit = useCallback(async () => {
    if (!linkedPacificaAddress) {
      setDepositEmbedUrl(null);
      setDepositOpen(true);
      return;
    }

    setDepositLoading(true);
    try {
      const response = await fetch('/api/pacifica/deposit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: linkedPacificaAddress }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body?.embedUrl !== 'string') {
        throw new Error(body?.error || 'Unable to start deposit flow');
      }
      setDepositEmbedUrl(body.embedUrl);
      setDepositOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start deposit flow';
      pushToast(message, { variant: 'error' });
    } finally {
      setDepositLoading(false);
    }
  }, [linkedPacificaAddress, pushToast]);

  const onWithdraw = useCallback(async () => {
    setWithdrawOpen(true);
  }, []);

  const closeDepositModal = useCallback(() => {
    setDepositOpen(false);
    setDepositEmbedUrl(null);
    if (linkedPacificaAddress) {
      void fetchAccountState();
    }
  }, [fetchAccountState, linkedPacificaAddress]);

  const closeWithdrawModal = useCallback(() => {
    setWithdrawOpen(false);
  }, []);

  const submitWithdraw = useCallback(async () => {
    if (!linkedPacificaAddress) return;
    setWithdrawLoading(true);
    try {
      const response = await fetch('/api/pacifica/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: linkedPacificaAddress }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || body?.error || 'Withdraw endpoint unavailable');
      }
      pushToast('Withdraw submitted.', { variant: 'success' });
      closeWithdrawModal();
      void fetchAccountState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Withdraw endpoint unavailable';
      pushToast(message, { variant: 'info' });
    } finally {
      setWithdrawLoading(false);
    }
  }, [closeWithdrawModal, fetchAccountState, linkedPacificaAddress, pushToast]);

  const metrics = [
    { label: 'Balance', value: fmtUsd(accountState?.balance), hint: 'Collateral' },
    {
      label: 'Available',
      value: fmtUsd(accountState?.available_to_spend),
      hint: 'Primary trade capacity',
    },
    { label: 'Equity', value: fmtUsd(accountState?.account_equity), hint: 'Account equity' },
    { label: 'Margin used', value: fmtUsd(accountState?.total_margin_used), hint: 'Locked margin' },
    { label: 'PnL', value: fmtUsd(accountState?.total_pnl), hint: 'Unrealized + realized' },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="p-4 space-y-4">
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/50">
            <h1 className="text-base font-semibold text-white">Settings</h1>
            <div className="text-xs text-zinc-500 mt-1">Pacifica account controls</div>
          </div>

          <div className="p-4 space-y-4">
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <div className="text-sm font-semibold text-white">Linked Pacifica wallet</div>
                <div className="text-xs text-zinc-500 mt-1">Master wallet for Pacifica account + agent keys</div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500">Address</div>
                    <div className="mt-1 font-mono text-sm text-white truncate">{displayAddr}</div>
                    <div className="mt-1 text-xs text-zinc-500">{agentWalletHint}</div>
                  </div>

                  <button
                    type="button"
                    onClick={onCopyAddress}
                    disabled={!linkedPacificaAddress}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy className="h-4 w-4 text-zinc-400" />
                    Copy
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onConnectPacifica}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-medium text-white transition-colors"
                >
                  {isPacificaLinked ? 'Relink Pacifica wallet' : 'Link Pacifica Wallet'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void onDeposit()}
                    disabled={depositLoading}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => void onWithdraw()}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="text-sm font-semibold text-white">Pacifica metrics</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                    <div className="text-[11px] text-zinc-500">{m.label}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{m.value}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{m.hint}</div>
                  </div>
                ))}
              </div>
              {stateLoading ? <div className="text-xs text-zinc-400 mt-3">Loading account state...</div> : null}
              {stateError ? <div className="text-xs text-rose-300 mt-3">{stateError}</div> : null}
            </div>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="text-sm font-semibold text-white">Help</div>
              <div className="text-xs text-zinc-500 mt-1">How-to guides</div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                  <div className="text-xs font-semibold text-white">Linking your Pacifica wallet</div>
                  <div className="mt-1 text-xs text-zinc-500">Tap “Link Pacifica Wallet” and approve the signature request.</div>
                </div>
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                  <div className="text-xs font-semibold text-white">Depositing collateral</div>
                  <div className="mt-1 text-xs text-zinc-500">Tap “Deposit” to open the Pacifica deposit flow in-app.</div>
                </div>
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                  <div className="text-xs font-semibold text-white">Withdrawing</div>
                  <div className="mt-1 text-xs text-zinc-500">Tap “Withdraw” and follow the prompts.</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="text-sm font-semibold text-white">Support</div>
              <div className="text-xs text-zinc-500 mt-1">Contact and FAQs</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                >
                  FAQs
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                >
                  Contact
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                >
                  Discord
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                >
                  Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {depositOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/70 pointer-events-auto" onClick={closeDepositModal} />
          <div className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-800 rounded-t-2xl mb-16 h-[78vh] pointer-events-auto flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Pacifica deposit</h3>
              <button
                type="button"
                onClick={closeDepositModal}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            {linkedPacificaAddress ? (
              depositEmbedUrl ? (
                <iframe title="Pacifica Deposit" src={depositEmbedUrl} className="h-full w-full border-0" />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-zinc-500">Loading deposit page...</div>
              )
            ) : (
              <div className="h-full p-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="text-base font-semibold text-white">Link a Pacifica wallet to deposit</div>
                <div className="text-sm text-zinc-500">You’ll be prompted to connect and sign.</div>
                <button
                  type="button"
                  onClick={onConnectPacifica}
                  className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Link Pacifica Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {withdrawOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/70 pointer-events-auto" onClick={closeWithdrawModal} />
          <div className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-800 rounded-t-2xl mb-16 h-[78vh] pointer-events-auto flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Withdraw</h3>
              <button
                type="button"
                onClick={closeWithdrawModal}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {linkedPacificaAddress ? (
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4">
                  <div className="text-sm font-semibold text-white">Withdraw USDC</div>
                  <div className="text-xs text-zinc-500 mt-1">UI only — logic will be improved later</div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-2">Destination address</label>
                      <input
                        type="text"
                        placeholder="0x… or Solana…"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-2">Amount (USDC)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void submitWithdraw()}
                      disabled={withdrawLoading}
                      className="w-full py-3.5 rounded-xl font-semibold text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {withdrawLoading ? 'Submitting…' : 'Continue'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full p-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="text-base font-semibold text-white">Link a Pacifica wallet to withdraw</div>
                <div className="text-sm text-zinc-500">Connect first, then you can withdraw collateral.</div>
                <button
                  type="button"
                  onClick={onConnectPacifica}
                  className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Link Pacifica Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
