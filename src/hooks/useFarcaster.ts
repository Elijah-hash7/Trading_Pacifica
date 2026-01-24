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

  const initializeFarcaster = async () => {
    try {
      setIsLoading(true);
      let inClient = false;
      if (typeof window !== 'undefined') {
        inClient = Boolean((window as unknown as { farcasterEthereum?: unknown }).farcasterEthereum);
      }

      // In a normal browser, this can throw or never provide a user context.
      await sdk.actions.ready();
      inClient = true;

      // Get user context (it's async)
      const context = await sdk.context;

      // If context exists, we're definitely inside a Farcaster miniapp.
      if (context) {
        inClient = true;
      }

      setIsFarcasterClient(inClient);

      if (context?.user) {
        const farcasterUser: FarcasterUser = {
          fid: context.user.fid,
          username: context.user.username || `user${context.user.fid}`,
          displayName: context.user.displayName || context.user.username || 'Anonymous',
          pfpUrl: context.user.pfpUrl,
        };

        // Type cast to access custody/verifications
        const userAny = context.user as unknown as { custody?: unknown; verifications?: unknown };
        if (typeof userAny.custody === 'string') {
          farcasterUser.custody = userAny.custody;
        }

        if (Array.isArray(userAny.verifications)) {
          farcasterUser.verifications = userAny.verifications.filter((v): v is string => typeof v === 'string');
        }

        setUser(farcasterUser);

        // Sync user to backend
        await syncUserToBackend(farcasterUser);
      }

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
    const provider = (w.farcasterEthereum ?? w.ethereum ?? null) as unknown;
    if (!provider) return null;
    const maybe = provider as { request?: unknown; on?: unknown; removeListener?: unknown };
    if (typeof maybe.request !== 'function') return null;
    return maybe as {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, handler: (payload: unknown) => void) => void;
      removeListener?: (event: string, handler: (payload: unknown) => void) => void;
    };
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
    return user?.fid ? `fid_${user.fid}` : 'demo_wallet_123';
  };


  const connectWallet = async () => {
    // First ensure we have Farcaster user context. Outside of a Farcaster client,
    // sdk.context may not have a user and wallet connection is not possible.
    if (!user) {
      throw new Error('Farcaster user not available. Open this app inside a Farcaster client (e.g. Warpcast).');
    }

    const provider = getProvider();
    if (!provider) {
      throw new Error('Farcaster wallet provider not available in this client.');
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
