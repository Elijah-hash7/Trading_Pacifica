'use client';

import React, { useEffect, useState } from 'react';
import { FarcasterSolanaProvider } from '@farcaster/mini-app-solana';
import { sdk } from '@farcaster/miniapp-sdk';
import { ToastProvider } from '@/components/ToastProvider';

const SOLANA_ENDPOINT =
  process.env.NEXT_PUBLIC_SOL_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [isFarcasterHost, setIsFarcasterHost] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const detectHost = async () => {
      try {
        const [contextResult, capsResult] = await Promise.allSettled([
          Promise.resolve(sdk.context),
          sdk.getCapabilities(),
        ]);

        const context =
          contextResult.status === 'fulfilled' && contextResult.value && typeof contextResult.value === 'object'
            ? (contextResult.value as { user?: { fid?: number } })
            : null;
        const capabilities =
          capsResult.status === 'fulfilled' && Array.isArray(capsResult.value) ? capsResult.value : [];

        const inMini = Boolean(context?.user?.fid) || capabilities.includes('wallet.getSolanaProvider');
        if (!cancelled) setIsFarcasterHost(inMini);
      } catch {
        if (!cancelled) setIsFarcasterHost(false);
      }
    };

    void detectHost();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ToastProvider>
      {isFarcasterHost ? (
        <FarcasterSolanaProvider endpoint={SOLANA_ENDPOINT}>
          {children}
        </FarcasterSolanaProvider>
      ) : (
        children
      )}
    </ToastProvider>
  );
}
