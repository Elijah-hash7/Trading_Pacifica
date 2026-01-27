// src/components/PositionsList.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, X, RefreshCw, Share2 } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { extractAddress } from '@/lib/extractAddress';

// Define what a Position object looks like
// This matches what your Pacifica API returns
interface Position {
  id: string;
  pairSymbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  fee: number;
  status: 'open' | 'closed';
  createdAt: string;
}

interface PositionsListProps {
  // walletAddress might be a string or an object (Farcaster SDK)
  walletAddress: string | unknown;
}

export default function PositionsList({ walletAddress }: PositionsListProps) {
  const { pushToast } = useToast();
  // State for storing positions fetched from API
  const [positions, setPositions] = useState<Position[]>([]);
  
  // Loading state - shows spinner while fetching
  const [loading, setLoading] = useState(true);
  
  // Track which position is being closed (to show loading on that button)
  const [closingId, setClosingId] = useState<string | null>(null);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Fetch open positions from your API
  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call your GET /api/positions endpoint
      // This endpoint fetches from Pacifica and also checks your DB
      const accountString = extractAddress(walletAddress) ?? '';
      if (!accountString) {
        console.warn('PositionsList: missing wallet address, skipping fetch');
        setPositions([]);
        return;
      }

      const response = await fetch(`/api/positions?account=${encodeURIComponent(accountString)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }

      const data = await response.json();

      // Update state with fetched positions
      setPositions(data.positions || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching positions:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Fetch positions when component mounts or wallet changes
  useEffect(() => {
    if (walletAddress) {
      void fetchPositions();
    }
  }, [walletAddress, fetchPositions]);

  // Set up polling: Refresh positions every 10 seconds
  useEffect(() => {
    if (!walletAddress) return;
    
    // Poll every 10 seconds to update PnL in real-time
    const interval = setInterval(() => {
      void fetchPositions();
    }, 10000);
    
    // Cleanup when component unmounts
    return () => clearInterval(interval);
  }, [walletAddress, fetchPositions]);

  // Close a position (sell if long, buy if short)
  const handleClosePosition = async (positionId: string) => {
    try {
      setClosingId(positionId); // Show loading on this specific button
      const accountString = extractAddress(walletAddress);
      if (!accountString) {
        pushToast('Missing wallet address', { variant: 'warning' });
        setClosingId(null);
        return;
      }
      
      // Call your POST /api/positions/[id]/close endpoint
      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: accountString,
          // You'll need to pass the signed payload here
          // For now, we're just showing the structure
        }),
      });
      
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof errorData?.error === 'string' ? errorData.error : 'Failed to close position');
      }
      
      const data = await response.json();
      
      // Show success message (you can add a toast notification here)
      pushToast(
        `Position closed! PnL: ${data.pnl > 0 ? '+' : ''}${data.pnl.toFixed(2)}`,
        { variant: 'success' }
      );
      
      // Refresh positions list
      await fetchPositions();
      
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to close position', { variant: 'error' });
      console.error('Error closing position:', err);
    } finally {
      setClosingId(null); // Hide loading
    }
  };

  // Share PnL on Farcaster
  const handleSharePnL = async (position: Position) => {
    try {
      const shareAsImage = window.confirm('Share as picture?\n\nOK = Picture (meme)\nCancel = Farcaster post');

      const { sdk } = await import('@farcaster/miniapp-sdk');
      const context = await sdk.context;
      if (!context?.user) {
        pushToast('Open in Warpcast to share on Farcaster.', { variant: 'warning' });
        return;
      }

      const actions = sdk.actions as unknown as {
        createCast: (input: { text: string; embeds?: Array<{ url: string }> }) => Promise<unknown>;
      };

      if (shareAsImage) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const pnlPercent = typeof position.pnlPercent === 'number' ? position.pnlPercent : 0;
        const imageUrl = `${origin}/api/share/pnl/image?pair=${encodeURIComponent(position.pairSymbol)}&side=${encodeURIComponent(position.side)}&pnlPercent=${encodeURIComponent(String(pnlPercent))}`;
        const sign = pnlPercent >= 0 ? '+' : '';
        const text = `PnL: ${sign}${pnlPercent.toFixed(2)}% · ${position.pairSymbol} ${position.side.toUpperCase()}\n\nTrade on Pacificast`;

        await actions.createCast({
          text,
          embeds: [{ url: imageUrl }],
        });

        pushToast('Shared image on Farcaster!', { variant: 'success' });
        return;
      }

      // Get message from API
      const response = await fetch('/api/share/pnl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairSymbol: position.pairSymbol,
          side: position.side,
          pnl: position.pnl,
          pnlPercent: position.pnlPercent,
          entryPrice: position.entryPrice,
          exitPrice: position.currentPrice, // Use currentPrice as exit price
        }),
      });

      if (response.ok) {
        const data = await response.json();

        await actions.createCast({
          text: data.message,
        });
        
        pushToast('Shared on Farcaster! 🎉', { variant: 'success' });
      }
    } catch (err) {
      console.error('Error sharing PnL:', err);
      pushToast('Failed to share. Make sure you\'re in Farcaster!', { variant: 'error' });
    }
  };

  // Format currency with $ and commas
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format percentage with + or - sign
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Show loading spinner on first load
  if (loading && positions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Open Positions</h2>
        </div>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Open Positions</h2>
        <button
          onClick={fetchPositions}
          disabled={loading}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh positions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Empty state - no positions */}
      {positions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No open positions</p>
          <p className="text-gray-500 text-sm mt-2">
            Place your first trade to see positions here
          </p>
        </div>
      ) : (
        // List of positions
        <div className="space-y-3">
          {positions.map((position) => {
            const isLong = position.side === 'long';
            const pnl = position.pnl || 0;
            const isProfitable = pnl >= 0;
            
            return (
              <div
                key={position.id}
                className="bg-gray-800 rounded-lg p-4 border-l-4"
                style={{
                  borderColor: isLong ? '#10b981' : '#ef4444'
                }}
              >
                {/* Position header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{position.pairSymbol}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          isLong ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                        }`}
                      >
                        {isLong ? 'LONG' : 'SHORT'} {position.leverage}x
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      Size: {position.size} units
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSharePnL(position)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Share on Farcaster"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleClosePosition(position.id)}
                      disabled={closingId === position.id}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Close position"
                    >
                      {closingId === position.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Position details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">Entry Price</div>
                    <div className="font-mono">{formatCurrency(position.entryPrice)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Current Price</div>
                    <div className="font-mono">
                      {position.currentPrice ? formatCurrency(position.currentPrice) : '-'}
                    </div>
                  </div>
                </div>

                {/* PnL display */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <div className="text-gray-400 text-sm">Unrealized PnL</div>
                    <div className={`font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                      <div className="flex items-center gap-1">
                        {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span>{formatCurrency(Math.abs(pnl))}</span>
                      </div>
                      {position.pnlPercent && (
                        <div className="text-xs text-right">{formatPercent(position.pnlPercent)}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fee info */}
                <div className="mt-2 text-xs text-gray-500">
                  Fee paid: {formatCurrency(position.fee)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
