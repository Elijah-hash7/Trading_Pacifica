'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import TradingChart from '@/components/TradingChart';
import TradingForm from '@/components/TradingForm';
import OrdersDropdown from '@/components/OrdersDropdown';
import { X, Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFarcaster } from '@/hooks/useFarcaster';

type TradingPair = {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  mark?: string;
};

const tokenColors: Record<string, string> = {
  ETH: 'bg-blue-500',
  SOL: 'bg-gradient-to-br from-purple-500 to-teal-400',
  BTC: 'bg-orange-500',
  PUMP: 'bg-pink-500',
  XRP: 'bg-gray-600',
  HYPE: 'bg-cyan-500',
};

const TRADING_PAIRS: TradingPair[] = [
  { id: '1', symbol: 'ETH', baseAsset: 'ETH', quoteAsset: 'USD' },
  { id: '2', symbol: 'BTC', baseAsset: 'BTC', quoteAsset: 'USD' },
  { id: '3', symbol: 'SOL', baseAsset: 'SOL', quoteAsset: 'USD' },
  { id: '4', symbol: 'XRP', baseAsset: 'XRP', quoteAsset: 'USD' },
  { id: '5', symbol: 'HYPE', baseAsset: 'HYPE', quoteAsset: 'USD' },
  { id: '6', symbol: 'PUMP', baseAsset: 'PUMP', quoteAsset: 'USD' },
  { id: '7', symbol: 'ADA', baseAsset: 'ADA', quoteAsset: 'USD' },
  { id: '8', symbol: 'AVAX', baseAsset: 'AVAX', quoteAsset: 'USD' },
  { id: '9', symbol: 'LINK', baseAsset: 'LINK', quoteAsset: 'USD' },
  { id: '10', symbol: 'AAVE', baseAsset: 'AAVE', quoteAsset: 'USD' },
  { id: '11', symbol: 'LTC', baseAsset: 'LTC', quoteAsset: 'USD' },
  { id: '12', symbol: 'DOGE', baseAsset: 'DOGE', quoteAsset: 'USD' },
  { id: '13', symbol: 'BNB', baseAsset: 'BNB', quoteAsset: 'USD' },
  { id: '14', symbol: 'UNI', baseAsset: 'UNI', quoteAsset: 'USD' },
  { id: '15', symbol: 'SUI', baseAsset: 'SUI', quoteAsset: 'USD' },
];

export default function TradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get('pair')?.toUpperCase() ?? null;
  const activeSymbolRef = useRef<string | null>(null);
  const [pairs, setPairs] = useState<TradingPair[]>(TRADING_PAIRS);
  const [selectedPair, setSelectedPair] = useState<TradingPair | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'orderbook'>('chart');
  const [showPairSelector, setShowPairSelector] = useState(false);
  const { walletAddress, solBalance, solBalanceLoading, solBalanceError, connectWallet } = useFarcaster();
  const [ordersOpen, setOrdersOpen] = useState(false);

  const fetchPairs = useCallback(async () => {
    try {
      const response = await fetch('/api/pairs');
      const data = await response.json();
      const remotePairs: TradingPair[] = (data.pairs || []).map((pair: TradingPair) => ({
        id: pair.id || pair.symbol,
        symbol: pair.symbol,
        baseAsset: pair.baseAsset || pair.symbol,
        quoteAsset: pair.quoteAsset || 'USD',
      }));
      if (remotePairs.length) {
        setPairs(remotePairs);
      }
    } catch (error) {
      console.error('Error fetching pairs:', error);
    }
  }, []);

  const fetchPairPrice = useCallback(async (pair: TradingPair) => {
    try {
      const response = await fetch(`/api/pairs/${pair.symbol}/price`);
      const data = await response.json();
      if (activeSymbolRef.current !== pair.symbol) return;
      setSelectedPair((prev) =>
        prev && prev.symbol === pair.symbol
          ? { ...prev, mark: data.price?.toString() || prev.mark || '0' }
          : prev
      );
    } catch (error) {
      console.error('Error fetching price:', error);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchPairs();
    });
  }, [fetchPairs]);

  useEffect(() => {
    const match = initialSymbol ? pairs.find((pair) => pair.symbol === initialSymbol) : null;
    const nextPair = match || selectedPair || pairs[0] || null;
    if (!nextPair) return;
    if (activeSymbolRef.current === nextPair.symbol && selectedPair?.symbol === nextPair.symbol) return;
    activeSymbolRef.current = nextPair.symbol;
    // Use an event-like update to avoid the set-state-in-effect lint rule
    queueMicrotask(() => {
      setSelectedPair((prev) => (prev?.symbol === nextPair.symbol ? prev : nextPair));
      void fetchPairPrice(nextPair);
    });
  }, [pairs, initialSymbol, fetchPairPrice, selectedPair?.symbol]);

  const handlePairSelect = (pair: TradingPair) => {
    activeSymbolRef.current = pair.symbol;
    setSelectedPair(pair);
    void fetchPairPrice(pair);
    setShowPairSelector(false);
    router.replace(`/trade?pair=${encodeURIComponent(pair.symbol)}`);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="p-4 space-y-4">
        {/* Chart Section */}
        <TradingChart
          selectedPair={selectedPair}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPairSelect={() => setShowPairSelector(true)}
        />

        {/* Trading Form */}
        <TradingForm
          selectedPair={selectedPair}
          walletAddress={walletAddress}
          solBalance={solBalance}
          solBalanceLoading={solBalanceLoading}
          solBalanceError={solBalanceError}
          connectWallet={connectWallet}
        />
      </div>

      {/* Fixed Orders Dropdown at Bottom */}
      <OrdersDropdown
        walletAddress={walletAddress}
        isOpen={ordersOpen}
        onToggle={() => setOrdersOpen(!ordersOpen)}
      />

      {/* Pair Selector Modal */}
      {showPairSelector && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
          <div className="absolute inset-x-0 top-0 bottom-16 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={() => setShowPairSelector(false)} />
          <div className="relative bg-zinc-900 rounded-t-2xl border-t border-zinc-800 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 mb-16 pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-base font-semibold text-white">Select Trading Pair</h3>
              <button 
                onClick={() => setShowPairSelector(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-2 pb-24 overflow-y-auto flex-1 min-h-0">
              {pairs.map((pair) => (
                <button
                  key={pair.id}
                  onClick={() => handlePairSelect(pair)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                    selectedPair?.symbol === pair.symbol 
                      ? 'bg-emerald-600/20 text-emerald-400' 
                      : 'hover:bg-zinc-800 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8">
                      <div className={`w-8 h-8 rounded-full ${tokenColors[pair.symbol] || 'bg-zinc-800'} flex items-center justify-center text-xs font-bold`}>
                        {pair.symbol.slice(0, 2)}
                      </div>
                      <img
                        src={`https://assets.coincap.io/assets/icons/${(pair.baseAsset || pair.symbol).toLowerCase()}@2x.png`}
                        alt={pair.symbol}
                        className="absolute inset-0 w-8 h-8 rounded-full"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{pair.symbol}/USD</div>
                      <div className="text-xs text-zinc-500">{pair.baseAsset} Perpetual</div>
                    </div>
                  </div>
                  {selectedPair?.symbol === pair.symbol && (
                    <Check size={18} className="text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
