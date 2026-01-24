// src/hooks/useFarcaster.ts
'use client';
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: string[];
}

export function useFarcaster() {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFarcasterClient, setIsFarcasterClient] = useState(false);

  useEffect(() => {
    initializeFarcaster();
  }, []);

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

    // Type cast to access custody/verifications
    const userAny = ctxUser as unknown as { custody?: unknown; verifications?: unknown };
    if (typeof userAny.custody === 'string') {
      farcasterUser.custody = userAny.custody;
    }

    if (Array.isArray(userAny.verifications)) {
      farcasterUser.verifications = userAny.verifications.filter((v): v is string => typeof v === 'string');
    }

    return farcasterUser;
  };

  const setUserFromContext = async (context: unknown) => {
    const farcasterUser = buildUserFromContext(context);
    if (!farcasterUser) return null;
    setUser(farcasterUser);
    await syncUserToBackend(farcasterUser);
    return farcasterUser;
  };

  const initializeFarcaster = async () => {
    try {
      setIsLoading(true);
      let inClient = false;
      if (typeof window !== 'undefined') {
        inClient = Boolean((window as unknown as { farcasterEthereum?: unknown }).farcasterEthereum);
      }

      // In a normal browser, ready/context may be unavailable or provide no user.
      // Do NOT treat "ready" success alone as proof of being in a Farcaster client.
      await sdk.actions.ready();

      // Get user context (it's async)
      const context = await sdk.context;

      // Only treat this as a Farcaster miniapp if we have concrete signals.
      // - injected farcaster provider (window.farcasterEthereum)
      // - a user context from the SDK
      if (context?.user?.fid) {
        inClient = true;
      }

      // Some Farcaster clients may provide context before provider/user is ready.
      // A non-null context is still a strong signal that we're inside a Farcaster miniapp.
      if (context) {
        inClient = true;
      }

      setIsFarcasterClient(inClient);

      await setUserFromContext(context);

    } catch (err) {
      console.error('Farcaster init error:', err);
      setError('Failed to connect to Farcaster');
      setIsFarcasterClient(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getProvider = () => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { ethereum?: unknown; farcasterEthereum?: unknown };
    // Prefer Farcaster's injected provider to avoid bouncing out of the miniapp.
    // If we're inside a Farcaster client, only use farcasterEthereum to ensure
    // the inbuilt Warpcast wallet popup is triggered (not an external wallet).
    const provider = (isFarcasterClient ? w.farcasterEthereum : (w.farcasterEthereum ?? w.ethereum)) as unknown;
    if (!provider) return null;
    const maybe = provider as { request?: unknown; on?: unknown; removeListener?: unknown };
    if (typeof maybe.request !== 'function') return null;
    return maybe as {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, handler: (payload: unknown) => void) => void;
      removeListener?: (event: string, handler: (payload: unknown) => void) => void;
    };
  };

  const waitForProvider = async (opts?: { timeoutMs?: number; intervalMs?: number }) => {
    const timeoutMs = opts?.timeoutMs ?? 2500;
    const intervalMs = opts?.intervalMs ?? 125;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const provider = getProvider();
      if (provider) return provider;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
  };

  const normalizeAddress = (addr: unknown) => {
    if (typeof addr !== 'string') return null;
    if (!addr.startsWith('0x')) return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
    return addr;
  };

  const syncUserToBackend = async (farcasterUser: FarcasterUser) => {
    try {
      // Extract first verification address if it's an array, otherwise use custody
      let walletAddress = 'demo_wallet_123';

      if (farcasterUser.verifications && Array.isArray(farcasterUser.verifications) && farcasterUser.verifications.length > 0) {
        walletAddress = farcasterUser.verifications[0];
      } else if (farcasterUser.custody && typeof farcasterUser.custody === 'string') {
        walletAddress = farcasterUser.custody;
      } else {
        walletAddress = `fid_${farcasterUser.fid}`;
      }

      await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: farcasterUser.fid,
          username: farcasterUser.username,
          walletAddress: walletAddress,
        })
      });
    } catch (err) {
      console.error('Error syncing user:', err);
    }
  };

  const getWalletAddress = (): string => {
    if (connectedAddress) return connectedAddress;
    if (user?.verifications && Array.isArray(user.verifications) && user.verifications.length > 0) {
      return user.verifications[0];
    }
    if (user?.custody && typeof user.custody === 'string') {
      return user.custody;
    }
    return '';
  };


  const connectWallet = async () => {
    // Ensure we have Farcaster user context. On first load inside Farcaster,
    // `user` can be null briefly; retry fetching sdk.context before failing.
    let effectiveUser = user;
    if (!effectiveUser) {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        if (context) {
          setIsFarcasterClient(true);
        }
        effectiveUser = (await setUserFromContext(context)) ?? null;
      } catch {
        // ignore
      }
    }

    if (!effectiveUser) {
      throw new Error('Farcaster user not available. Open this app inside a Farcaster client (e.g. Warpcast).');
    }

    const provider = (await waitForProvider()) ?? getProvider();
    if (!provider) {
      throw new Error('Farcaster wallet provider not ready. Reopen the miniapp or update Warpcast and try again.');
    }

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const first = Array.isArray(accounts) ? normalizeAddress((accounts as unknown[])[0]) : null;
    if (!first) {
      throw new Error('No EVM account returned from wallet provider');
    }

    setConnectedAddress(first);

    // Subscribe to account changes if supported
    try {
      if (typeof provider.on === 'function') {
        provider.on('accountsChanged', (accs: unknown) => {
          const next = Array.isArray(accs) ? normalizeAddress((accs as unknown[])[0]) : null;
          setConnectedAddress(next);
        });
      }
    } catch (e) {
      // ignore
    }

    return true;
  };

  const disconnectWallet = async () => {
    // EIP-1193 doesn't have a standard "disconnect". We clear local session state.
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
    wallet
  };
}
