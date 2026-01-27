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
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request?: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function withTimeout<T>(p: Promise<T>, ms = 2500): Promise<T> {
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

const SOL_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  // keep demo last (least reliable)
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const initializeFarcaster = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // ready can hang outside Warpcast — keep timeout
      try {
        await withTimeout(sdk.actions.ready(), 2500);
      } catch {
        // ignore
      }

      // fetch both context + capabilities (either can be the "signal")
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

      const inMini =
        Boolean(context?.user?.fid) || caps.includes('wallet.getSolanaProvider');
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

  const getSolanaProvider = async (): Promise<SolanaProvider | null> => {
    if (!supportsSolana) return null;

    try {
      const sdkWithWallet = sdk as unknown as SdkWithSolanaWallet;
      const getProvider = sdkWithWallet.wallet?.getSolanaProvider;
      if (!getProvider) return null;

      const provider = (await getProvider()) as SolanaProvider | null;
      if (!provider) return null;

      // accept either connect/disconnect OR request-based providers
      if (provider.connect || provider.request) return provider;
      return null;
    } catch {
      return null;
    }
  };

  const waitForSolAddress = async (provider: SolanaProvider, tries = 10) => {
    for (let i = 0; i < tries; i++) {
      const addr = provider.publicKey?.toBase58?.();
      if (addr) return addr;
      await sleep(120);
    }
    return null;
  };

  const connectWallet = async (): Promise<string> => {
    await sdk.actions.ready();

    if (!isFarcasterClient) {
      throw new Error('Open in Warpcast to connect your wallet.');
    }
    if (!supportsSolana) {
      throw new Error('This host does not support Solana wallet connections.');
    }

    const provider = await getSolanaProvider();
    if (!provider) {
      throw new Error('Solana wallet provider not ready. Reopen the miniapp and try again.');
    }

    // connect (both styles)
    if (provider.connect) await provider.connect();
    else if (provider.request) await provider.request({ method: 'connect' });

    const addr = (await waitForSolAddress(provider)) ?? provider.publicKey?.toBase58?.();
    if (!addr) throw new Error('No Solana public key returned from provider');

    setSolAddress(addr);
    return addr;
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
  };


  const fetchSolBalance = useCallback(async (address: string) => {
    for (const rpcUrl of SOL_RPC_URLS) {
      try {
        // per-RPC timeout so mobile doesn't hang forever
        const res = await withTimeout(
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getBalance',
              params: [address],
            }),
            cache: 'no-store',
          }),
          3500
        );

        if (!res.ok) continue;

        const json = await res.json().catch(() => null);
        const lamports = json?.result?.value;
        if (typeof lamports !== 'number') continue;

        return { ok: true as const, sol: lamports / 1e9, rpcUrl };
      } catch {
        continue;
      }
    }
    return { ok: false as const };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!solAddress) {
      setSolBalance(null);
      setSolBalanceError(null);
      setSolBalanceLoading(false);
      return;
    }

    const run = async () => {
      try {
        setSolBalanceLoading(true);
        setSolBalanceError(null);

        const out = await fetchSolBalance(solAddress);
        if (cancelled) return;

        if (!out.ok) {
          setSolBalance(null);
          setSolBalanceError('SOL balance unavailable (RPC failed)');
          return;
        }

        setSolBalance(out.sol);
      } catch (e) {
        if (cancelled) return;
        setSolBalance(null);
        setSolBalanceError(e instanceof Error ? e.message : 'SOL balance unavailable');
      } finally {
        if (!cancelled) setSolBalanceLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [solAddress, fetchSolBalance]);

  const logout = async () => {
    setSolAddress(null);
    setSolBalance(null);
    setUser(null);
    setError(null);
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

    connectWallet,
    disconnectWallet,
    logout,

    wallet: {
      isConnected: Boolean(solAddress),
      address: solAddress ?? '',
    },
  };
}
