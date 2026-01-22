'use client';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Pair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price?: number;
  priceChange?: number;
}

const CACHE_KEY = 'pacifica.pairs.cache';

const tokenColors: Record<string, string> = {
  ETH: 'bg-blue-500',
  SOL: 'bg-gradient-to-br from-purple-500 to-teal-400',
  BTC: 'bg-orange-500',
  PUMP: 'bg-pink-500',
  XRP: 'bg-gray-600',
  HYPE: 'bg-cyan-500',
};

const FALLBACK_PAIRS: Pair[] = [
  { id: 'fallback-eth', symbol: 'ETH', baseAsset: 'ETH', quoteAsset: 'USD', price: 0, priceChange: 0 },
  { id: 'fallback-sol', symbol: 'SOL', baseAsset: 'SOL', quoteAsset: 'USD', price: 0, priceChange: 0 },
  { id: 'fallback-btc', symbol: 'BTC', baseAsset: 'BTC', quoteAsset: 'USD', price: 0, priceChange: 0 },
  { id: 'fallback-xrp', symbol: 'XRP', baseAsset: 'XRP', quoteAsset: 'USD', price: 0, priceChange: 0 },
  { id: 'fallback-hype', symbol: 'HYPE', baseAsset: 'HYPE', quoteAsset: 'USD', price: 0, priceChange: 0 },
  { id: 'fallback-pump', symbol: 'PUMP', baseAsset: 'PUMP', quoteAsset: 'USD', price: 0, priceChange: 0 },
];

export default function AllPairsPage() {
  const router = useRouter();
  const [pairs, setPairs] = useState<Pair[]>(FALLBACK_PAIRS);
  const [loading, setLoading] = useState(false);

  const loadCachedPairs = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed as Pair[];
    } catch {
      return null;
    }
  }, []);

  const saveCachedPairs = useCallback((nextPairs: Pair[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(nextPairs));
    } catch {
      return;
    }
  }, []);

  const fetchPairs = useCallback(async () => {
    try {
      const response = await fetch('/api/pairs');
      const data = await response.json();
      const pairsWithPrices = data.pairs || [];

      const cachedPairs = loadCachedPairs();
      const cachedBySymbol = new Map(
        (cachedPairs || []).map((pair) => [pair.symbol, pair])
      );

      // Instant render with cached/stable placeholder data
      const pairsWithPlaceholder = pairsWithPrices.map((p: Pair) => {
        const cached = cachedBySymbol.get(p.symbol);
        return {
          ...p,
          price: cached?.price ?? 0,
          priceChange: cached?.priceChange ?? 0,
        };
      });
      setPairs(pairsWithPlaceholder);
      saveCachedPairs(pairsWithPlaceholder);
      setLoading(false);

      // Fetch actual prices in background
      pairsWithPrices.forEach((pair: Pair, index: number) => {
        fetch(`/api/pairs/${pair.symbol}/price`)
          .then((res) => res.json())
          .then((priceData) => {
            setPairs((prev) => {
              const next = prev.map((p, i) => (i === index ? { ...p, price: priceData.price } : p));
              saveCachedPairs(next);
              return next;
            });
          })
          .catch((err) => console.error(`Error fetching price for ${pair.symbol}`, err));
      });
    } catch (err) {
      console.error('Error fetching pairs:', err);
      setLoading(false);
    }
  }, [loadCachedPairs, saveCachedPairs]);

  useEffect(() => {
    const cached = loadCachedPairs();
    if (cached?.length) {
      queueMicrotask(() => {
        setPairs(cached);
      });
    }
    queueMicrotask(() => {
      void fetchPairs();
    });
  }, [fetchPairs, loadCachedPairs]);

  if (loading && pairs.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }
  

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <header className="p-4 border-b border-white flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-500 rounded-lg">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">All Markets</h1>
      </header>
      

      <div className="p-4">
        <div className="space-y-2">
          {pairs.map((pair, index) => {
            const isPositive = (pair.priceChange || 0) >= 0;
            const bgColor = tokenColors[pair.symbol] || 'bg-zinc-700';
            const baseAsset = pair.baseAsset || pair.symbol?.split('-')[0] || pair.symbol;
            const iconSymbol = baseAsset.toLowerCase();
            
            return (
              <Link key={pair.id ?? pair.symbol} href={`/trade?pair=${pair.symbol}`}>
                <div className="bg-zinc-900/50 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors border border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="text-zinc-400 font-mono w-8">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>

                    <div className="relative w-10 h-10">
                      <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-sm font-bold`}>
                        {pair.symbol.slice(0, 2)}
                      </div>
                      <img
                        src={`https://assets.coincap.io/assets/icons/${iconSymbol}@2x.png`}
                        alt={pair.symbol}
                        className="absolute inset-0 w-10 h-10 rounded-full"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-bold">{pair.symbol}</div>
                      <div className="text-sm text-white">
                        {pair.baseAsset}{pair.quoteAsset}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-mono font-bold">
                        {pair.price ? `${pair.price.toLocaleString()}` : '-'}
                      </div>
                      <div className={`text-sm flex items-center gap-1 justify-end ${
                        isPositive ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{pair.priceChange?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
