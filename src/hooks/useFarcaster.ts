// src/hooks/useFarcaster.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: string[];
}

// EIP-1193-ish provider shape
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (payload: unknown) => void) => void;
  removeListener?: (event: string, handler: (payload: unknown) => void) => void;
};

export function useFarcaster() {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // “Are we inside a Farcaster Mini App host (Warpcast etc.)?”
  // We infer this from SDK + provider availability, not window.ethereum.
  const [isFarcasterClient, setIsFarcasterClient] = useState(false);

  // Keep a stable provider ref once we find it
  const providerRef = useRef<Eip1193Provider | null>(null);

  useEffect(() => {
    initializeFarcaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const normalizeAddress = (addr: unknown) => {
    if (typeof addr !== 'string') return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
    return addr;
  };

  const buildUserFromContext = (context: unknown): FarcasterUser | null => {
    const ctx = context as { user?: unknown };
    const ctxUser = ctx?.user as
      | {
          fid: number;
          username?: string;
          displayName?: string;
          pfpUrl?: string;
        }
      | undefined;

    if (!ctxUser?.fid) return null;

    const farcasterUser: FarcasterUser = {
      fid: ctxUser.fid,
      username: ctxUser.username || `user${ctxUser.fid}`,
      displayName: ctxUser.displayName || ctxUser.username || 'Anonymous',
      pfpUrl: ctxUser.pfpUrl,
    };

    
    const userAny = ctxUser as unknown as { custody?: unknown; verifications?: unknown };
    if (typeof userAny.custody === 'string') farcasterUser.custody = userAny.custody;

    if (Array.isArray(userAny.verifications)) {
      farcasterUser.verifications = userAny.verifications.filter(
        (v): v is string => typeof v === 'string'
      );
    }

    return farcasterUser;
  };

  const syncUserToBackend = async (farcasterUser: FarcasterUser) => {
    try {
      let walletAddress = `fid_${farcasterUser.fid}`;
      if (farcasterUser.verifications?.length) walletAddress = farcasterUser.verifications[0];
      else if (farcasterUser.custody) walletAddress = farcasterUser.custody;

      await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: farcasterUser.fid,
          username: farcasterUser.username,
          walletAddress,
        }),
      });
    } catch (err) {
      console.error('Error syncing user:', err);
    }
  };

  const setUserFromContext = async (context: unknown) => {
    const farcasterUser = buildUserFromContext(context);
    if (!farcasterUser) return null;
    setUser(farcasterUser);
    await syncUserToBackend(farcasterUser);
    return farcasterUser;
  };

  /**
   * KEY CHANGE:
   * - Don’t use window.farcasterEthereum / window.ethereum for detection.
   * - Use SDK + sdk.wallet.getEthereumProvider() to detect miniapp + provider.
   */
  const getSdkProvider = async (): Promise<Eip1193Provider | null> => {
    try {
      if (providerRef.current) return providerRef.current;

      // Must be ready before calling wallet methods
      await sdk.actions.ready();

      // Prefer SDK wallet provider 
      const prov = await sdk.wallet.getEthereumProvider().catch(() => null);
      if (!prov) return null;

      
      const maybe = prov as unknown as { request?: unknown };
      if (typeof maybe.request !== 'function') return null;

      providerRef.current = prov as Eip1193Provider;
      return providerRef.current;
    } catch {
      return null;
    }
  };

  // Provider might not be ready immediately on first open → retry
  const waitForSdkProvider = async (opts?: { timeoutMs?: number; intervalMs?: number }) => {
    const timeoutMs = opts?.timeoutMs ?? 4000;
    const intervalMs = opts?.intervalMs ?? 200;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const p = await getSdkProvider();
      if (p) return p;
      await sleep(intervalMs);
    }
    return null;
  };

  const initializeFarcaster = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // This won’t crash in browser; if it does, we catch.
      await sdk.actions.ready();

      // Try reading context (may exist even before user)
      const context = await sdk.context.catch?.(() => null) ?? (await sdk.context);

      // If we can access context at all, we’re *likely* in a miniapp host
      // But the strongest signal is wallet provider availability:
      const provider = await getSdkProvider();
      const inClient = !!provider || !!context;

      setIsFarcasterClient(inClient);

      if (context) {
        await setUserFromContext(context);
      }
    } catch (err) {
      console.error('Farcaster init error:', err);
      setIsFarcasterClient(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getWalletAddress = () => {
    if (connectedAddress) return connectedAddress;
    if (user?.verifications?.length) return user.verifications[0];
    if (user?.custody) return user.custody;
    return '';
  };

  /**
   * KEY CHANGE:
   * - Connect uses sdk.wallet.getEthereumProvider() with retry.
   * - If provider not found => we throw “Open in Warpcast…”
   * - No window.ethereum fallback here (since your requirement is: browser => show toast)
   */
  const connectWallet = async () => {
    // Ensure we’re ready + we have some context if possible
    await sdk.actions.ready();

    // Try to refresh context/user quickly (helps on first load)
    try {
      const context = await sdk.context;
      if (context) {
        setIsFarcasterClient(true);
        await setUserFromContext(context);
      }
    } catch {
      // ignore
    }

    // Get provider (retry for “provider not ready” race)
    const provider = await waitForSdkProvider({ timeoutMs: 5000, intervalMs: 250 });
    if (!provider) {
      setIsFarcasterClient(false);
      throw new Error('Open in Warpcast to connect your Farcaster wallet.');
    }

    // Request accounts
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const first = Array.isArray(accounts) ? normalizeAddress(accounts[0]) : null;

    if (!first) {
      throw new Error('No EVM account returned from wallet provider');
    }

    setConnectedAddress(first);

    // Subscribe to account changes if supported
    try {
      if (typeof provider.on === 'function') {
        const handler = (accs: unknown) => {
          const next = Array.isArray(accs) ? normalizeAddress((accs as unknown[])[0]) : null;
          setConnectedAddress(next);
        };
        provider.on('accountsChanged', handler);
      }
    } catch {
      // ignore
    }

    return true;
  };

  const disconnectWallet = async () => {
    // No standard disconnect in EIP-1193; clear local state
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
