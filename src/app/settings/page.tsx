'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { usePacificaWallet } from '@/hooks/usePacificaWallet';
import { sdk } from '@farcaster/miniapp-sdk';

type AccountState = {
  balance: number;
  pending_balance: number;
  available_to_spend: number;
  account_equity: number;
  total_margin_used: number;
  total_pnl?: number;
};

type FlowState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
  signature?: string;
};

type DepositState = {
  status: 'not_funded' | 'pending' | 'funded' | 'timeout' | 'error';
  message?: string;
  balanceBefore: number | null;
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

export default function SettingsPage() {
  const { pushToast } = useToast();
  const {
    linkedPacificaAddress,
    linkedProvider,
    isPacificaLinked,
    connectLinkedWallet,
    signWithLinkedWallet,
    disconnectLinkedWallet,
  } = usePacificaWallet();

  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [stateInfo, setStateInfo] = useState<string | null>(null);
  const [stateAction, setStateAction] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<AccountState | null>(null);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<number | null>(null);
  const [depositState, setDepositState] = useState<DepositState>({
    status: 'not_funded',
    message: 'Not funded yet.',
    balanceBefore: null,
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawFlow, setWithdrawFlow] = useState<FlowState>({ status: 'idle' });
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [savedAgentPublicKey, setSavedAgentPublicKey] = useState('');
  const [pacificaAgentPublicKey, setPacificaAgentPublicKey] = useState('');
  const [agentReadyReason, setAgentReadyReason] = useState('');
  const [isAgentReady, setIsAgentReady] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  const displayAddr = useMemo(() => {
    if (!linkedPacificaAddress) return 'Not linked';
    return truncateMiddle(linkedPacificaAddress);
  }, [linkedPacificaAddress]);

  const agentWalletHint = useMemo(() => {
    if (!linkedProvider) return 'Not connected';
    return `${linkedProvider} linked`;
  }, [linkedProvider]);

  const fetchWalletUsdcBalance = useCallback(async () => {
    if (!linkedPacificaAddress) {
      setWalletUsdcBalance(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/wallet/usdc-balance?account=${encodeURIComponent(linkedPacificaAddress)}`,
        { cache: 'no-store' }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWalletUsdcBalance(null);
        return;
      }
      setWalletUsdcBalance(Number(body?.usdcBalance ?? 0));
    } catch {
      setWalletUsdcBalance(null);
    }
  }, [linkedPacificaAddress]);

  const fetchAccountState = useCallback(async () => {
    if (!linkedPacificaAddress) {
      setAccountState(null);
      setStateError(null);
      setStateAction(null);
      return;
    }

    setStateLoading(true);
    setStateError(null);
    setStateInfo(null);
    setStateAction(null);
    try {
      const response = await fetch(
        `/api/pacifica/account-state?account=${encodeURIComponent(linkedPacificaAddress)}`,
        { cache: 'no-store' }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404) {
          if (body?.action === 'CREATE_PACIFICA_ACCOUNT') {
            setAccountState({
              balance: 0,
              pending_balance: 0,
              available_to_spend: 0,
              account_equity: 0,
              total_margin_used: 0,
              total_pnl: 0,
            });
            setStateAction('CREATE_PACIFICA_ACCOUNT');
            setStateInfo('No Pacifica account found. You need to deposit USDC at app.pacifica.fi to activate your account.');
            return;
          }
        }
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to load account state');
      }
      const next = body?.accountState;
      setAccountState({
        balance: Number(next?.balance ?? 0),
        pending_balance: Number(next?.pending_balance ?? 0),
        available_to_spend: Number(next?.available_to_spend ?? 0),
        account_equity: Number(next?.account_equity ?? 0),
        total_margin_used: Number(next?.total_margin_used ?? 0),
        total_pnl: Number(next?.total_pnl ?? 0),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load account state';
      setStateError(message);
      setStateInfo(null);
      setAccountState(null);
    } finally {
      setStateLoading(false);
    }
  }, [linkedPacificaAddress]);

  const fetchSavedAgentKey = useCallback(async () => {
    if (!linkedPacificaAddress) {
      setSavedAgentPublicKey('');
      setPacificaAgentPublicKey('');
      setAgentReadyReason('');
      setIsAgentReady(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/pacifica/agent?account=${encodeURIComponent(linkedPacificaAddress)}`,
        { cache: 'no-store' }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSavedAgentPublicKey('');
        setPacificaAgentPublicKey('');
        setAgentReadyReason('');
        setIsAgentReady(false);
        return;
      }
      setSavedAgentPublicKey(typeof body?.savedAgentPublicKey === 'string' ? body.savedAgentPublicKey : '');
      setPacificaAgentPublicKey(typeof body?.pacificaAgentPublicKey === 'string' ? body.pacificaAgentPublicKey : '');
      setAgentReadyReason(typeof body?.readyReason === 'string' ? body.readyReason : '');
      setIsAgentReady(Boolean(body?.isAgentReady));
    } catch {
      setSavedAgentPublicKey('');
      setPacificaAgentPublicKey('');
      setAgentReadyReason('');
      setIsAgentReady(false);
    }
  }, [linkedPacificaAddress]);

  const pollPacificaAccount = useCallback(
    async (
      shouldStop: (state: AccountState) => { done: boolean; nextStatus?: DepositState['status']; message?: string }
    ) => {
      if (!linkedPacificaAddress) return { timeout: false };

      const startedAt = Date.now();
      const timeoutMs = 5 * 60 * 1000;
      let delayMs = 3000;

      while (Date.now() - startedAt < timeoutMs) {
        try {
          const response = await fetch(
            `/api/pacifica/account-state?account=${encodeURIComponent(linkedPacificaAddress)}`,
            { cache: 'no-store' }
          );
          const body = await response.json().catch(() => ({}));
          if (response.ok) {
            const next = body?.accountState ?? {};
            const current: AccountState = {
              balance: Number(next?.balance ?? 0),
              pending_balance: Number(next?.pending_balance ?? 0),
              available_to_spend: Number(next?.available_to_spend ?? 0),
              account_equity: Number(next?.account_equity ?? 0),
              total_margin_used: Number(next?.total_margin_used ?? 0),
              total_pnl: Number(next?.total_pnl ?? 0),
            };
            setAccountState(current);
            const out = shouldStop(current);
            if (out.nextStatus) {
              setDepositState((prev) => ({
                ...prev,
                status: out.nextStatus as DepositState['status'],
                message: out.message ?? prev.message,
              }));
            }
            if (out.done) return { timeout: false };
          }
        } catch {
          // keep retrying until timeout
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 2, 30000);
      }

      return { timeout: true };
    },
    [linkedPacificaAddress]
  );

  useEffect(() => {
    if (isPacificaLinked) {
      void fetchAccountState();
    }
  }, [isPacificaLinked, fetchAccountState]);

  useEffect(() => {
    if (isPacificaLinked) {
      void fetchSavedAgentKey();
      return;
    }
    setSavedAgentPublicKey('');
  }, [fetchSavedAgentKey, isPacificaLinked]);

  useEffect(() => {
    if (!isPacificaLinked) {
      setWalletUsdcBalance(null);
      return;
    }
    void fetchWalletUsdcBalance();
  }, [fetchWalletUsdcBalance, isPacificaLinked]);

  const onCopyAddress = useCallback(async () => {
    if (!linkedPacificaAddress) return;
    try {
      await navigator.clipboard.writeText(linkedPacificaAddress);
      pushToast('Pacifica wallet copied', { variant: 'success' });
    } catch {
      pushToast('Could not copy wallet address', { variant: 'error' });
    }
  }, [linkedPacificaAddress, pushToast]);

  const createAgentWallet = useCallback(async (account: string) => {
    setCreatingAgent(true);
    try {
      const initResponse = await fetch('/api/pacifica/agent/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      const initBody = await initResponse.json().catch(() => ({}));
      if (!initResponse.ok) {
        throw new Error(initBody?.details || initBody?.error || 'Failed to initialize agent creation');
      }

      const message = typeof initBody?.message === 'string' ? initBody.message : '';
      const challenge = typeof initBody?.challenge === 'string' ? initBody.challenge : '';
      const generatedAgentPublicKey = typeof initBody?.agentPublicKey === 'string' ? initBody.agentPublicKey : '';
      if (!message || !challenge || !generatedAgentPublicKey) {
        throw new Error('Invalid response from agent creation init');
      }

      const signature = await signWithLinkedWallet(message);

      const completeResponse = await fetch('/api/pacifica/agent/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          signature,
          challenge,
        }),
      });
      const completeBody = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok) {
        if (completeBody?.action === 'CREATE_PACIFICA_ACCOUNT') {
          setStateAction('CREATE_PACIFICA_ACCOUNT');
          setStateInfo('No Pacifica account found. Deposit USDC at app.pacifica.fi first.');
          pushToast('No Pacifica account found. Deposit USDC at app.pacifica.fi first!', { variant: 'error' });
          await sdk.actions.openUrl({ url: 'https://app.pacifica.fi/portfolio' });
          return;
        }
        throw new Error(completeBody?.details || completeBody?.error || 'Failed to register Pacifica agent wallet');
      }

      const finalPublicKey =
        typeof completeBody?.agentPublicKey === 'string' ? completeBody.agentPublicKey : generatedAgentPublicKey;
      setSavedAgentPublicKey(finalPublicKey);
      setPacificaAgentPublicKey(finalPublicKey);
      setIsAgentReady(true);
      setAgentReadyReason('agent_key_verified_and_saved');
      pushToast('Agent wallet created and registered.', { variant: 'success' });
    } finally {
      setCreatingAgent(false);
    }
  }, [pushToast, signWithLinkedWallet]);

  const onConnectPacifica = useCallback(async () => {
    try {
      const out = await connectLinkedWallet();
      const account = out.address;
      pushToast('Pacifica wallet linked.', { variant: 'success' });

      const statusResponse = await fetch(`/api/pacifica/agent?account=${encodeURIComponent(account)}`, {
        cache: 'no-store',
      });
      const statusBody = await statusResponse.json().catch(() => ({}));
      const alreadyReady = Boolean(statusResponse.ok && statusBody?.isAgentReady);
      if (!alreadyReady) {
        await createAgentWallet(account);
      }

      await Promise.all([fetchSavedAgentKey(), fetchAccountState()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link Pacifica wallet';
      pushToast(message, { variant: 'error' });
    }
  }, [connectLinkedWallet, createAgentWallet, fetchAccountState, fetchSavedAgentKey, pushToast]);

  const onCreateAgentWallet = useCallback(async () => {
    if (!linkedPacificaAddress) {
      await onConnectPacifica();
      return;
    }
    try {
      await createAgentWallet(linkedPacificaAddress);
      await fetchSavedAgentKey();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create agent wallet';
      pushToast(message, { variant: 'error' });
    }
  }, [createAgentWallet, fetchSavedAgentKey, linkedPacificaAddress, onConnectPacifica, pushToast]);

  const openExternalUrl = useCallback(
    async (url: string) => {
      try {
        await sdk.actions.openUrl({ url });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not open URL';
        pushToast(`Open failed: ${message}`, { variant: 'error' });
      }
    },
    [pushToast]
  );

  const onDeposit = useCallback(async () => {
    setDepositState({
      status: 'not_funded',
      message: 'Not funded yet.',
      balanceBefore: accountState?.balance ?? null,
    });
    setDepositOpen(true);
    if (linkedPacificaAddress) {
      await fetchWalletUsdcBalance();
    }
  }, [accountState?.balance, fetchWalletUsdcBalance, linkedPacificaAddress]);

  const startDepositFlow = useCallback(async () => {
    if (!linkedPacificaAddress) {
      setDepositState({ status: 'error', message: 'Link a Pacifica wallet first.', balanceBefore: null });
      return;
    }
    if (!walletUsdcBalance || walletUsdcBalance <= 0) {
      setDepositState({
        status: 'not_funded',
        message: 'No USDC in wallet. Get USDC first, then deposit.',
        balanceBefore: accountState?.balance ?? null,
      });
      return;
    }

    const balanceBefore = accountState?.balance ?? 0;
    setDepositState({
      status: 'pending',
      message: 'Waiting for Pacifica balance update…',
      balanceBefore,
    });
    setDepositLoading(true);

    try {
      await sdk.actions.openUrl({ url: 'https://app.pacifica.fi/portfolio' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open Pacifica';
      pushToast(`Open failed: ${message}`, { variant: 'error' });
      setDepositLoading(false);
      return;
    }

    const out = await pollPacificaAccount((current) => {
      if (current.pending_balance > 0) {
        return { done: false, nextStatus: 'pending', message: 'Deposit pending on Pacifica…' };
      }
      if (current.balance > balanceBefore) {
        return { done: true, nextStatus: 'funded', message: 'Funded on Pacifica.' };
      }
      return { done: false, nextStatus: 'not_funded', message: 'Not funded yet.' };
    });

    if (out.timeout) {
      setDepositState((prev) => ({
        ...prev,
        status: 'timeout',
        message: 'Timed out waiting for Pacifica balance update.',
      }));
      pushToast('Deposit check timed out. You can retry polling.', { variant: 'info' });
      setDepositLoading(false);
      return;
    }

    setDepositState((prev) => ({ ...prev, status: 'funded', message: 'Funded on Pacifica.' }));
    pushToast('Pacifica account funded.', { variant: 'success' });
    await fetchWalletUsdcBalance();
    setDepositLoading(false);
  }, [accountState?.balance, fetchWalletUsdcBalance, linkedPacificaAddress, pollPacificaAccount, pushToast, walletUsdcBalance]);

  const onWithdraw = useCallback(async () => {
    setWithdrawOpen(true);
  }, []);

  const onDisconnectPacifica = useCallback(async () => {
    await disconnectLinkedWallet();
    setAccountState(null);
    setStateError(null);
    setStateInfo(null);
    setStateAction(null);
    setSavedAgentPublicKey('');
    setPacificaAgentPublicKey('');
    setIsAgentReady(false);
    setAgentReadyReason('');
    pushToast('Pacifica wallet disconnected.', { variant: 'success' });
  }, [disconnectLinkedWallet, pushToast]);

  const closeDepositModal = useCallback(() => {
    setDepositOpen(false);
    setDepositLoading(false);
    setDepositState({ status: 'not_funded', message: 'Not funded yet.', balanceBefore: null });
    if (linkedPacificaAddress) {
      void fetchAccountState();
    }
  }, [fetchAccountState, linkedPacificaAddress]);

  const closeWithdrawModal = useCallback(() => {
    setWithdrawOpen(false);
    setWithdrawAmount('');
    setWithdrawFlow({ status: 'idle' });
  }, []);

  const submitWithdraw = useCallback(async () => {
    if (!linkedPacificaAddress) return;
    const amountNum = Number.parseFloat(withdrawAmount);
    const fee = 1;
    if (!Number.isFinite(amountNum) || amountNum < 1) {
      setWithdrawFlow({ status: 'error', message: 'Minimum withdraw amount is $1.' });
      return;
    }
    const balanceBefore = accountState?.balance ?? 0;
    const required = amountNum + fee;
    if (balanceBefore > 0 && balanceBefore < required) {
      setWithdrawFlow({ status: 'error', message: 'Insufficient balance for amount + $1 fee.' });
      return;
    }

    setWithdrawLoading(true);
    setWithdrawFlow({ status: 'pending', message: 'Submitting withdraw request…' });
    try {
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: linkedPacificaAddress, amount: amountNum.toString() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.action === 'OPEN_PACIFICA_UI_WITHDRAW') {
          pushToast('Withdraw via agent key is not allowed. Opening Pacifica withdraw UI.', { variant: 'info' });
          await openExternalUrl('https://app.pacifica.fi/portfolio');
          setWithdrawFlow({ status: 'error', message: 'Use Pacifica UI to complete this withdraw.' });
          return;
        }
        throw new Error(body?.message || body?.error || body?.details || 'Withdraw endpoint unavailable');
      }
      setWithdrawFlow({ status: 'pending', message: 'Withdraw submitted. Waiting for balance update…' });

      const out = await pollPacificaAccount((current) => {
        if (current.pending_balance > 0) {
          return { done: false, message: 'Withdraw pending on Pacifica…' };
        }
        if (current.balance < balanceBefore) {
          return { done: true, message: 'Withdraw completed.' };
        }
        return { done: false, message: 'Waiting for withdraw confirmation…' };
      });

      if (out.timeout) {
        setWithdrawFlow({ status: 'error', message: 'Timed out waiting for balance decrease.' });
        pushToast('Withdraw check timed out. Verify in Pacifica portfolio.', { variant: 'info' });
        return;
      }

      setWithdrawFlow({ status: 'success', message: 'Withdraw completed.' });
      pushToast('Withdraw success.', { variant: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Withdraw endpoint unavailable';
      setWithdrawFlow({ status: 'error', message });
      pushToast(message, { variant: 'error' });
    } finally {
      setWithdrawLoading(false);
    }
  }, [accountState?.balance, linkedPacificaAddress, openExternalUrl, pollPacificaAccount, pushToast, withdrawAmount]);

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
  const visibleMetrics = showAllMetrics ? metrics : metrics.slice(0, 2);

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
                <div className="text-xs text-zinc-500 mt-1">Master wallet for Pacifica account</div>
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

                <button
                  type="button"
                  onClick={() => void onDisconnectPacifica()}
                  disabled={!linkedPacificaAddress}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disconnect wallet
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

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <div className="text-sm font-semibold text-white">Pacifica Agent Wallet</div>
                <div className="text-xs text-zinc-500 mt-1">Created automatically on link. Private key is generated and stored server-side.</div>
              </div>

              <div className="p-4 space-y-3">
                {savedAgentPublicKey ? (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 text-xs text-zinc-400">
                    <div className="text-emerald-300 text-[11px] mb-1">Saved in Pacificast ✅</div>
                    Saved key:
                    <span className="ml-2 font-mono text-zinc-200">{truncateMiddle(savedAgentPublicKey)}</span>
                  </div>
                ) : null}

                {pacificaAgentPublicKey ? (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 text-xs text-zinc-400">
                    <div className="text-emerald-300 text-[11px] mb-1">Detected on Pacifica ✅</div>
                    Pacifica key:
                    <span className="ml-2 font-mono text-zinc-200">{truncateMiddle(pacificaAgentPublicKey)}</span>
                  </div>
                ) : null}

                {!isAgentReady && (agentReadyReason === 'saved_key_not_found_on_pacifica' || agentReadyReason === 'saved_key_not_visible_on_pacifica') ? (
                  <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-3 text-xs text-amber-200">
                    Stored key is not visible on Pacifica. Recreate agent wallet.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void onCreateAgentWallet()}
                  disabled={creatingAgent}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {creatingAgent ? 'Creating…' : isAgentReady ? 'Recreate agent wallet' : 'Create agent wallet'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="text-sm font-semibold text-white">Pacifica metrics</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {visibleMetrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                    <div className="text-[11px] text-zinc-500">{m.label}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{m.value}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{m.hint}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAllMetrics((prev) => !prev)}
                className="mt-3 w-full text-center text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
              {showAllMetrics ? 'View less' : 'View more'}
              </button>
              {stateLoading ? <div className="text-xs text-zinc-400 mt-3">Loading account state...</div> : null}
              {stateInfo ? <div className="text-xs text-zinc-400 mt-3">{stateInfo}</div> : null}
              {stateAction === 'CREATE_PACIFICA_ACCOUNT' ? (
                <button
                  type="button"
                  onClick={() => void openExternalUrl('https://app.pacifica.fi/portfolio')}
                  className="mt-3 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  Open Pacifica Deposit
                </button>
              ) : null}
              {stateError ? <div className="text-xs text-rose-300 mt-3">{stateError}</div> : null}
            </div>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="text-sm font-semibold text-white">Help</div>
              <div className="text-xs text-zinc-500 mt-1">How-to guides</div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                  <div className="text-xs font-semibold text-white">Linking your Pacifica wallet</div>
                  <div className="mt-1 text-xs text-zinc-500">Tap “Link Pacifica Wallet” and approve the wallet connect request.</div>
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
              <h3 className="text-sm font-semibold text-white">Deposit USDC</h3>
              <button
                type="button"
                onClick={closeDepositModal}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            {linkedPacificaAddress ? (
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4">
                  <div className="text-sm font-semibold text-white">Wallet to Pacifica</div>
                  <div className="text-xs text-zinc-500 mt-1">Deposit via Pacifica portfolio page, then auto-check funding.</div>

                  <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs text-zinc-400">
                    Wallet USDC balance:
                    <span className="ml-2 font-semibold text-white">
                      {walletUsdcBalance === null ? 'Loading…' : walletUsdcBalance.toFixed(4)}
                    </span>
                    {depositState.balanceBefore !== null ? (
                      <div className="mt-1 text-zinc-500">
                        Pacifica balance before: ${depositState.balanceBefore.toFixed(2)}
                      </div>
                    ) : null}
                  </div>

                  {walletUsdcBalance !== null && walletUsdcBalance <= 0 ? (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <div className="text-xs text-amber-200">No USDC detected in wallet.</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void openExternalUrl('https://app.jup.ag/swap/SOL-USDC')}
                          className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                        >
                          Swap to USDC
                        </button>
                        <button
                          type="button"
                          onClick={() => void openExternalUrl('https://www.moonpay.com/buy/usdc')}
                          className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                        >
                          Buy USDC
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {depositState.message ? (
                    <div
                      className={`mt-3 text-xs ${depositState.status === 'error' || depositState.status === 'timeout'
                          ? 'text-rose-300'
                          : depositState.status === 'funded'
                            ? 'text-emerald-300'
                            : 'text-zinc-400'
                        }`}
                    >
                      {depositState.message}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void startDepositFlow()}
                    disabled={depositLoading || (walletUsdcBalance !== null && walletUsdcBalance <= 0)}
                    className="mt-4 w-full py-3.5 rounded-xl font-semibold text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {depositLoading ? 'Opening Pacifica…' : 'Deposit to Pacifica'}
                  </button>
                </div>
              </div>
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
                  <div className="text-xs text-zinc-500 mt-1">Submitted through Pacifica API with agent wallet signature.</div>
                  <div className="mt-2 text-xs text-zinc-400">Fee: $1 (deducted from Pacifica balance)</div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-2">Amount (USDC)</label>
                      <input
                        type="number"
                        step="0.000001"
                        min="1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Min 1.00"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                      />
                    </div>
                    {Number.parseFloat(withdrawAmount) >= 1 ? (
                      <div className="text-xs text-zinc-500">
                        Estimated received: ${(Math.max(Number.parseFloat(withdrawAmount) - 1, 0)).toFixed(2)}
                      </div>
                    ) : null}

                    {withdrawFlow.message ? (
                      <div
                        className={`text-xs ${withdrawFlow.status === 'error'
                            ? 'text-rose-300'
                            : withdrawFlow.status === 'success'
                              ? 'text-emerald-300'
                              : 'text-zinc-400'
                          }`}
                      >
                        {withdrawFlow.message}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void submitWithdraw()}
                      disabled={withdrawLoading}
                      className="w-full py-3.5 rounded-xl font-semibold text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {withdrawLoading ? 'Submitting…' : 'Confirm withdraw'}
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
