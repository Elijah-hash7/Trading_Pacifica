// src/hooks/useFarcaster.ts
'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: string[];
}

// small helper: timeout so loading doesn't hang forever
function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

export function useFarcaster() {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFarcasterClient, setIsFarcasterClient] = useState(false);

  useEffect(() => {
    initializeFarcaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildUserFromContext = (context: any): FarcasterUser | null => {
    const ctxUser = context?.user;
    if (!ctxUser?.fid) return null;

    const farcasterUser: FarcasterUser = {
      fid: ctxUser.fid,
      username: ctxUser.username || `user${ctxUser.fid}`,
      displayName: ctxUser.displayName || ctxUser.username || 'Anonymous',
      pfpUrl: ctxUser.pfpUrl,
    };

    if (typeof ctxUser?.custody === 'string') {
      farcasterUser.custody = ctxUser.custody;
    }
    if (Array.isArray(ctxUser?.verifications)) {
      farcasterUser.verifications = ctxUser.verifications.filter((v: any) => typeof v === 'string');
    }

    return farcasterUser;
  };

  const initializeFarcaster = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // IMPORTANT: ready can hang/fail outside Warpcast.
      // So we guard it with a timeout.
      try {
        await withTimeout(sdk.actions.ready(), 2500);
      } catch {
        // not inside warpcast, or warpcast didn't respond quickly
      }

      // context is the best signal you're in a mini app
      let context: any = null;
      try {
        context = await withTimeout(Promise.resolve(sdk.context), 2500);
      } catch {
        context = null;
      }

      const inMiniApp = Boolean(context);
      setIsFarcasterClient(inMiniApp);

      const farcasterUser = buildUserFromContext(context);
      if (farcasterUser) setUser(farcasterUser);
    } catch (e) {
      setIsFarcasterClient(false);
      setError('Failed to initialize Farcaster');
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeAddress = (addr: unknown) => {
    if (typeof addr !== 'string') return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
    return addr;
  };

  const getWalletAddress = (): string => {
    if (connectedAddress) return connectedAddress;
    if (user?.verifications?.[0]) return user.verifications[0];
    if (user?.custody) return user.custody;
    return '';
  };

  // THIS is the important part: use sdk.wallet.getEthereumProvider()
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const getMiniAppProvider = async (opts?: { timeoutMs?: number; intervalMs?: number }) => {
    const timeoutMs = opts?.timeoutMs ?? 4000;
    const intervalMs = opts?.intervalMs ?? 150;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      // 1) Warpcast injected provider (most common)
      const w = window as any;
      const injected = w?.farcasterEthereum;

      if (injected?.request) return injected;

      // 2) Some environments: miniapp sdk may expose provider (depends on sdk version)
      // If your sdk has this, keep it; if not, remove.
      try {
        const maybe = (sdk as any)?.wallet?.getEthereumProvider
          ? await (sdk as any).wallet.getEthereumProvider()
          : null;

        if (maybe?.request) return maybe;
      } catch {
        // ignore until timeout
      }

      await sleep(intervalMs);
    }

    return null;
  };

  const connectWallet = async (): Promise<string> => {
    // Always call ready again in case user tapped fast
    await sdk.actions.ready();

    const provider = await getMiniAppProvider();
    if (!provider) {
      // At this point we *likely* aren’t in Warpcast OR provider didn’t inject yet
      throw new Error("Reopen the miniapp and try again.");
    }

    // if provider exists, you're effectively in a farcaster-capable client
    setIsFarcasterClient(true);

    let accounts: unknown;
    try {
      accounts = await provider.request({ method: "eth_requestAccounts" });
    } catch (err) {
      // Normalize provider errors properly (some throw objects)
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : (err && typeof err === "object" && "message" in err && typeof (err as any).message === "string")
              ? (err as any).message
              : "Wallet request failed";

      throw new Error(msg);
    }

    const first = Array.isArray(accounts) ? normalizeAddress((accounts as any[])[0]) : null;
    if (!first) throw new Error("No EVM account returned from wallet provider");

    setConnectedAddress(first);

    try {
      provider.on?.("accountsChanged", (accs: unknown) => {
        const next = Array.isArray(accs) ? normalizeAddress((accs as any[])[0]) : null;
        setConnectedAddress(next);
      });
    } catch { }

    return first;
  };


  const disconnectWallet = async () => {
    setConnectedAddress(null);
  };

  const logout = async () => {
    setConnectedAddress(null);
    setUser(null);
    setError(null);
  };

  const wallet = {
    isConnected: !!connectedAddress,
    address: getWalletAddress(),
  };

  return {
    user,
    walletAddress: getWalletAddress(),
    isLoading,
    error,
    isFarcasterClient,
    connectWallet,
    disconnectWallet,
    logout,
    wallet,
  };
}
