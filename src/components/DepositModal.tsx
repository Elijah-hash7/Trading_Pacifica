'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function DepositModal({
  open,
  onClose,
  pacificaEmbed,
}: {
  open: boolean;
  onClose: () => void;
  pacificaEmbed?: React.ReactNode;
}) {
  const [tab, setTab] = useState<'pacifica' | 'send'>('pacifica');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div
        className="absolute inset-x-0 top-0 bottom-16 bg-black/70 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      <div
        className="relative bg-zinc-900 rounded-t-2xl border-t border-zinc-800 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 mb-16 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-white">Deposit</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800/60">
            <button
              type="button"
              onClick={() => setTab('pacifica')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'pacifica' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Deposit via Pacifica
            </button>
            <button
              type="button"
              onClick={() => setTab('send')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'send' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Send USDC
            </button>
          </div>
        </div>

        <div className="p-4 pb-24 overflow-y-auto flex-1 min-h-0">
          {tab === 'pacifica' ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/60">
                  <div className="text-sm font-semibold text-white">Pacifica deposit</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Embedded deposit container (logic later)
                  </div>
                </div>
                <div className="h-[440px]">
                  {pacificaEmbed ? (
                    pacificaEmbed
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm text-zinc-500">
                      Embed slot
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4 h-[440px] flex flex-col">
                <div className="text-sm font-semibold text-white">Send USDC</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Simple form UI (no logic)
                </div>

                <div className="mt-4 space-y-3 flex-1">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">Recipient address</label>
                    <input
                      type="text"
                      placeholder="0x… or Solana…"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">Amount (USDC)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                    />
                  </div>

                  <button
                    type="button"
                    className="w-full py-3.5 rounded-xl font-semibold text-white transition-all bg-emerald-600 hover:bg-emerald-500"
                  >
                    Continue
                  </button>
                </div>
              </div>

              <div className="text-xs text-zinc-500 px-1">
                Network selection, fees, and submission logic will be added later.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
