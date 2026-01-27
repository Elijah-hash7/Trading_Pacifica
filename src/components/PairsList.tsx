'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface Pair {
  symbol: string;
  mark: string;
  mid: string;
  volume_24h: string;
  funding: string;
}

export default function PairsList({ 
  onSelectPair, 
  selectedPair 
}: { 
  onSelectPair: (pair: Pair) => void;
  selectedPair: Pair | null;
}) {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      // API route present in the project is GET /api/pairs which returns { success: true, pairs: [...] }
      const response = await fetch('/api/pairs');
      if (!response.ok) {
        // Try to read text for better debugging (might be HTML 404)
        const txt = await response.text().catch(() => '');
        throw new Error(`Failed to fetch pairs: ${response.status} ${response.statusText} ${txt.slice(0,200)}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const body = await response.text().catch(() => '');
        throw new Error('Expected JSON response from /api/pairs but got: ' + body.slice(0,200));
      }

      const data = await response.json();

      // Accept either { success: true, pairs } or { data } for compatibility
      const items = (data.pairs ?? data.data ?? []);
      if (Array.isArray(items)) {
        // Normalize items to ensure numeric fields are present and safe
        const normalized = items.map((it: unknown) => {
          const obj = (it ?? {}) as Record<string, unknown>;
          const markVal = Number(obj.mark ?? obj.price ?? obj.mid);
          const midVal = Number(obj.mid ?? obj.mark ?? obj.price);
          const volume = Number(obj.volume_24h ?? obj.volume ?? 0);
          const funding = Number(obj.funding ?? 0);

          return {
            ...obj,
            symbol: (obj.symbol ?? obj.pair ?? obj.name) as string,
            mark: Number.isFinite(markVal) ? String(markVal) : '0',
            mid: Number.isFinite(midVal) ? String(midVal) : '0',
            volume_24h: Number.isFinite(volume) ? String(volume) : '0',
            funding: Number.isFinite(funding) ? String(funding) : '0',
          } as Pair;
        });

        setPairs(normalized);
        setLastUpdate(new Date());

        // If nothing selected yet, auto-select the first pair to populate the Trade form
        try {
          if (!selectedPair && normalized.length > 0) {
            onSelectPair(normalized[0]);
          }
        } catch {
          // ignore
        }
      } else {
        console.warn('fetchPrices: unexpected response shape', data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching prices:', error);
      setLoading(false);
    }
  }, [onSelectPair, selectedPair]);
  
  // Fetch on mount and every 10 seconds
  useEffect(() => {
    void fetchPrices();
    const interval = setInterval(() => {
      void fetchPrices();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPrices]);
  
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Markets</h2>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-800 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Markets</h2>
        <button 
          onClick={fetchPrices}
          className="text-gray-400 hover:text-white transition"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="text-xs text-gray-500 mb-3">
        Updated: {lastUpdate.toLocaleTimeString()}
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {pairs.map((pair) => {
          const isSelected = selectedPair?.symbol === pair.symbol;
          const markNum = Number(pair.mark) || Number(pair.mid) || 0;
          const volumeNum = Number(pair.volume_24h) || 0;
          const fundingRate = (Number(pair.funding) || 0) * 100;
          const isPositiveFunding = fundingRate >= 0;
          
          return (
            <button
              key={pair.symbol}
              onClick={() => onSelectPair(pair)}
              className={`
                w-full p-3 rounded-lg text-left transition
                ${isSelected 
                  ? 'bg-blue-600' 
                  : 'bg-gray-800 hover:bg-gray-700'
                }
              `}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{pair.symbol}/USD</div>
                  <div className="text-xs text-gray-400">
                    24h Vol: ${volumeNum.toLocaleString()}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-mono font-semibold">
                    ${markNum.toLocaleString()}
                  </div>
                  <div className={`
                    text-xs flex items-center justify-end gap-1
                    ${isPositiveFunding ? 'text-green-400' : 'text-red-400'}
                  `}>
                    {isPositiveFunding ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(fundingRate).toFixed(4)}%
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}