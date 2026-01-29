'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { sdk } from '@farcaster/miniapp-sdk';

export default function RootPage() {
  useEffect(() => {
    void sdk.actions.ready();
  }, []);

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#141726,_#06070d_60%)] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#14161e]/95 to-[#0d0f14]/95 p-6 text-center shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-[#0b0d13]">
          <img src="/icon.png" alt="Pacificast" className="h-10 w-10 rounded-xl object-contain" />
        </div>
        <h1 className="mb-2 text-lg font-semibold">Welcome to Pacificast!</h1>
        <p className="mb-5 text-sm text-zinc-400">
          Click below to open the app and connect your wallet.
        </p>
        <Link
          href="/Home"
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          Open Pacificast
        </Link>
      </div>
    </main>
  );
}
