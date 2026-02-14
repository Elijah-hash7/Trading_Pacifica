'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePacificaWallet } from '@/hooks/usePacificaWallet';
import PositionsList from '@/components/PositionsList';

export default function PositionsPage() {
  const { linkedPacificaAddress } = usePacificaWallet();

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <header className="p-4 border-b border-zinc-800 flex items-center gap-4">
        <Link href="/menu" className="p-2 hover:bg-zinc-900 rounded-lg">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">Open Positions</h1>
      </header>

      <div className="p-4">
        <PositionsList walletAddress={linkedPacificaAddress} />
      </div>
    </div>
  );
}
