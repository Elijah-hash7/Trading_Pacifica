'use client';

import React from 'react';
import { FarcasterSolanaProvider } from '@farcaster/mini-app-solana';
import { ToastProvider } from '@/components/ToastProvider';

const SOLANA_ENDPOINT =
  process.env.NEXT_PUBLIC_SOL_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <FarcasterSolanaProvider endpoint={SOLANA_ENDPOINT}>
        {children}
      </FarcasterSolanaProvider>
    </ToastProvider>
  );
}
