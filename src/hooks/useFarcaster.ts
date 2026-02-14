'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: string[];
}

type FarcasterContextUser = {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: unknown;
};

type FarcasterMiniappContext = {
  user?: FarcasterContextUser;
};

type SdkWithSolanaWallet = typeof sdk & {
  wallet?: {
    getSolanaProvider?: () => Promise<unknown>;
  };
};

type SolanaProvider = {
  publicKey?: { toBase58: () => string };
  connect?: () => Promise<unknown>;
  disconnect?: () => Promise<void>;
  request?: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function withTimeout<T>(p: Promise<T>, ms = 9000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

const SOL_RPC_URLS = [process.env.NEXT_PUBLIC_SOL_RPC_URL, 'https://api.mainnet-beta.solana.com'].filter(
  (url, index, list): url is string =>
    typeof url === 'string' && url.length > 0 && list.indexOf(url) === index
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SOL_ADDRESS_STORAGE_KEY = 'pacificast_sol_address';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function cleanSolAddress(address: string) {
  // trims whitespace and strips accidental <...>
  return address.trim().replace(/^<|>$/g, '');
}

export function useFarcaster() {
  const [user, setUser] = useState<FarcasterUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFarcasterClient, setIsFarcasterClient] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>([]);

  const supportsSolana = useMemo(
    () => capabilities.includes('wallet.getSolanaProvider'),
    [capabilities]
  );

  const [solAddress, setSolAddress] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solBalanceLoading, setSolBalanceLoading] = useState(false);
  const [solBalanceError, setSolBalanceError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [usdcBalanceLoading, setUsdcBalanceLoading] = useState(false);
  const [usdcBalanceError, setUsdcBalanceError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(SOL_ADDRESS_STORAGE_KEY);
      if (cached) setSolAddress(cached);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (solAddress) window.localStorage.setItem(SOL_ADDRESS_STORAGE_KEY, solAddress);
      else window.localStorage.removeItem(SOL_ADDRESS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [solAddress]);

  const buildUserFromContext = (context: FarcasterMiniappContext | null): FarcasterUser | null => {
    const ctxUser = context?.user;
    if (!ctxUser?.fid) return null;

    const farcasterUser: FarcasterUser = {
      fid: ctxUser.fid,
      username: ctxUser.username || `user${ctxUser.fid}`,
      displayName: ctxUser.displayName || ctxUser.username || 'Anonymous',
      pfpUrl: ctxUser.pfpUrl,
    };

    if (typeof ctxUser?.custody === 'string') farcasterUser.custody = ctxUser.custody;
    if (Array.isArray(ctxUser?.verifications)) {
      farcasterUser.verifications = ctxUser.verifications.filter(
        (v): v is string => typeof v === 'string'
      );
    }

    return farcasterUser;
  };

  const fetchSolBalance = useCallback(async (address: string) => {
    const clean = cleanSolAddress(address);

    for (const rpcUrl of SOL_RPC_URLS) {
      try {
        const res = await withTimeout(
          fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getBalance',
              params: [clean],
            }),
            cache: 'no-store',
          }),
          9000
        );

        const raw = await res.text().catch(() => '');

        if (!res.ok) {
          console.log('[SOL RPC non-200]', rpcUrl, res.status, raw.slice(0, 160));
          continue;
        }

        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {
          console.log('[SOL RPC invalid JSON]', rpcUrl, raw.slice(0, 160));
          continue;
        }

        if (json?.error) {
          console.log('[SOL RPC error]', rpcUrl, json.error);
          continue;
        }

        const lamports = json?.result?.value;
        if (typeof lamports !== 'number') {
          console.log('[SOL RPC unexpected shape]', rpcUrl, json);
          continue;
        }

        return { ok: true as const, sol: lamports / 1e9, rpcUrl };
      } catch (e) {
        console.log('[SOL RPC exception]', rpcUrl, String(e));
        continue;
      }
    }

    return { ok: false as const };
  }, []);

  const fetchUsdcBalance = useCallback(async (address: string) => {
    const clean = cleanSolAddress(address);

    for (const rpcUrl of SOL_RPC_URLS) {
      try {
        const res = await withTimeout(
          fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getTokenAccountsByOwner',
              params: [
                clean,
                { mint: USDC_MINT },
                { encoding: 'jsonParsed' },
              ],
            }),
            cache: 'no-store',
          }),
          9000
        );

        const raw = await res.text().catch(() => '');
        if (!res.ok) {
          console.log('[USDC RPC non-200]', rpcUrl, res.status, raw.slice(0, 160));
          continue;
        }

        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {
          console.log('[USDC RPC invalid JSON]', rpcUrl, raw.slice(0, 160));
          continue;
        }

        if (json?.error) {
          console.log('[USDC RPC error]', rpcUrl, json.error);
          continue;
        }

        const accounts = json?.result?.value;
        if (!Array.isArray(accounts)) {
          console.log('[USDC RPC unexpected shape]', rpcUrl, json);
          continue;
        }

        let total = 0;
        for (const acc of accounts) {
          const tokenAmount = acc?.account?.data?.parsed?.info?.tokenAmount;
          const uiAmount = tokenAmount?.uiAmount;
          if (typeof uiAmount === 'number') {
            total += uiAmount;
            continue;
          }
          const uiAmountString = tokenAmount?.uiAmountString;
          if (typeof uiAmountString === 'string') {
            const parsed = Number.parseFloat(uiAmountString);
            if (Number.isFinite(parsed)) total += parsed;
          }
        }

        return { ok: true as const, usdc: total, rpcUrl };
      } catch (e) {
        console.log('[USDC RPC exception]', rpcUrl, String(e));
        continue;
      }
    }

    return { ok: false as const };
  }, []);
  const initializeFarcaster = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      try {
        await withTimeout(sdk.actions.ready(), 2500);
      } catch {
        // ignore
      }

      let context: FarcasterMiniappContext | null = null;
      try {
        context = (await withTimeout(Promise.resolve(sdk.context), 2500)) as FarcasterMiniappContext;
      } catch {
        context = null;
      }

      let caps: string[] = [];
      try {
        const got = await withTimeout(sdk.getCapabilities(), 2500);
        caps = Array.isArray(got) ? got : [];
      } catch {
        caps = [];
      }
      setCapabilities(caps);

      const inMini = Boolean(context?.user?.fid) || caps.includes('wallet.getSolanaProvider');
      setIsFarcasterClient(inMini);

      if (context) {
        const u = buildUserFromContext(context);
        if (u) setUser(u);
      }
    } catch {
      setIsFarcasterClient(false);
      setCapabilities([]);
      setError('Failed to initialize Farcaster');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void initializeFarcaster();
  }, [initializeFarcaster]);

  const getSolanaProvider = useCallback(async (): Promise<SolanaProvider | null> => {
    if (!supportsSolana) return null;

    try {
      const sdkWithWallet = sdk as unknown as SdkWithSolanaWallet;
      const getProvider = sdkWithWallet.wallet?.getSolanaProvider;
      if (!getProvider) return null;

      const provider = (await getProvider()) as SolanaProvider | null;
      if (!provider) return null;

      if (provider.connect || provider.request) return provider;
      return null;
    } catch {
      return null;
    }
  }, [supportsSolana]);

  // ✅ SINGLE balance fetch effect (removed duplicate)
  useEffect(() => {
    let cancelled = false;

    if (!solAddress) {
      setSolBalance(null);
      setSolBalanceError(null);
      setSolBalanceLoading(false);
      setUsdcBalance(null);
      setUsdcBalanceError(null);
      setUsdcBalanceLoading(false);
      return;
    }

    const run = async () => {
      try {
        setSolBalanceLoading(true);
        setSolBalanceError(null);
        setUsdcBalanceLoading(true);
        setUsdcBalanceError(null);

        const [solOut, usdcOut] = await Promise.all([
          fetchSolBalance(solAddress),
          fetchUsdcBalance(solAddress),
        ]);
        if (cancelled) return;

        if (!solOut.ok) {
          setSolBalance(null);
          setSolBalanceError('SOL balance unavailable (RPC failed)');
        } else {
          // IMPORTANT: 0 is valid
          setSolBalance(solOut.sol);
        }

        if (!usdcOut.ok) {
          setUsdcBalance(null);
          setUsdcBalanceError('USDC balance unavailable (RPC failed)');
        } else {
          setUsdcBalance(usdcOut.usdc);
        }
      } catch (e) {
        if (cancelled) return;
        setSolBalance(null);
        setSolBalanceError(e instanceof Error ? e.message : 'SOL balance unavailable');
        setUsdcBalance(null);
        setUsdcBalanceError(e instanceof Error ? e.message : 'USDC balance unavailable');
      } finally {
        if (!cancelled) {
          setSolBalanceLoading(false);
          setUsdcBalanceLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [solAddress, fetchSolBalance]);

  const waitForSolAddress = async (provider: SolanaProvider, tries = 10) => {
    for (let i = 0; i < tries; i++) {
      const addr = provider.publicKey?.toBase58?.();
      if (addr) return addr;
      await sleep(120);
    }
    return null;
  };

  const extractSignatureBase64 = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;

    if (value instanceof Uint8Array) return toBase64(value);

    if (Array.isArray(value)) {
      for (const v of value) {
        const out = extractSignatureBase64(v);
        if (out) return out;
      }
      return null;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      const sig = obj.signature;
      if (typeof sig === 'string') return sig;
      if (sig instanceof Uint8Array) return toBase64(sig);

      const data = obj.data;
      if (typeof data === 'string') return data;
      if (data instanceof Uint8Array) return toBase64(data);

      const result = obj.result;
      const nested = extractSignatureBase64(result);
      if (nested) return nested;
    }

    return null;
  };

  const signSolanaMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!isFarcasterClient) throw new Error('Open in Warpcast to sign.');
      if (!supportsSolana) throw new Error('Solana signing not supported by host.');

      const provider = await getSolanaProvider();
      if (!provider?.request) throw new Error('Solana provider does not support signing.');

      let result: unknown;
      try {
        result = await provider.request({
          method: 'signMessage',
          params: { message },
        });
      } catch {
        result = await provider.request({
          method: 'signMessage',
          params: [message],
        });
      }

      const sig = extractSignatureBase64(result);
      if (!sig) throw new Error('No signature returned from provider');
      return sig;
    },
    [getSolanaProvider, isFarcasterClient, supportsSolana]
  );

  const extractSolAddress = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
      for (const v of value) {
        const out = extractSolAddress(v);
        if (out) return out;
      }
      return null;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      const pk = obj.publicKey;
      if (typeof pk === 'string') return pk;
      if (pk && typeof pk === 'object') {
        const maybeToBase58 = (pk as { toBase58?: unknown }).toBase58;
        if (typeof maybeToBase58 === 'function') {
          try {
            const addr = (pk as { toBase58: () => string }).toBase58();
            if (typeof addr === 'string') return addr;
          } catch {
            // ignore
          }
        }
      }

      const addr = obj.address;
      if (typeof addr === 'string') return addr;

      const accounts = obj.accounts;
      if (typeof accounts === 'string') return accounts;
      if (Array.isArray(accounts) && typeof accounts[0] === 'string') return accounts[0];
    }

    return null;
  };

  const connectWallet = async (): Promise<string> => {
    await sdk.actions.ready();

    if (!isFarcasterClient) {
      throw new Error('Open in Warpcast to connect your wallet.');
    }
    if (!supportsSolana) {
      throw new Error('Warpcast does not report Solana support for this miniapp yet.');
    }

    const provider = await getSolanaProvider();
    if (!provider) {
      throw new Error('Solana wallet provider not ready. Reopen the miniapp and try again.');
    }

    let connectResult: unknown = null;
    if (provider.connect) connectResult = await provider.connect();
    else if (provider.request) connectResult = await provider.request({ method: 'connect' });

    const addr =
      extractSolAddress(connectResult) ??
      (await waitForSolAddress(provider, 30)) ??
      provider.publicKey?.toBase58?.();

    if (!addr) throw new Error('No Solana public key returned from provider');

    const clean = cleanSolAddress(addr);
    if (clean.startsWith('0x')) throw new Error('Detected EVM address. Solana wallet required.');

    setSolAddress(clean);
    try {
      window.localStorage.setItem(SOL_ADDRESS_STORAGE_KEY, clean);
    } catch {
      // ignore
    }
    return clean;
  };

  const disconnectWallet = async () => {
    try {
      const provider = await getSolanaProvider();
      if (provider?.disconnect) await provider.disconnect();
      else if (provider?.request) await provider.request({ method: 'disconnect' });
    } catch {
      // ignore
    }
    setSolAddress(null);
    setSolBalance(null);
    try {
      window.localStorage.removeItem(SOL_ADDRESS_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    setSolAddress(null);
    setSolBalance(null);
    setUser(null);
    setError(null);
    try {
      window.localStorage.removeItem(SOL_ADDRESS_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return {
    user,

    isLoading,
    error,

    isFarcasterClient,
    supportsSolana,

    walletAddress: solAddress ?? '',
    solAddress,
    solBalance,
    solBalanceLoading,
    solBalanceError,
    usdcBalance,
    usdcBalanceLoading,
    usdcBalanceError,

    connectWallet,
    disconnectWallet,
    signSolanaMessage,
    logout,

    wallet: {
      isConnected: Boolean(solAddress),
      address: solAddress ?? '',
    },
  };
}
