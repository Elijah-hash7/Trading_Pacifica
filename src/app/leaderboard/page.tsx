'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, DollarSign, BarChart3, RefreshCw } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

interface LeaderboardEntry {
  rank: number;
  username: string;
  walletAddress: string;
  fid: number;
  totalVolume: number;
  totalFees: number;
  tradeCount: number;
  potentialReward: number;
}

interface FeePool {
  totalFeesCollected: number;
  feePool: number;
  rewardDistribution: {
    first: number;
    second: number;
    third: number;
  };
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [feePool, setFeePool] = useState<FeePool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setFeePool(data.feePool || null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-zinc-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-400" />;
    return <span className="text-zinc-500 text-sm font-semibold">#{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/30';
    if (rank === 2) return 'bg-zinc-400/10 border-zinc-400/30';
    if (rank === 3) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-zinc-900 border-zinc-800';
  };

  if (loading && leaderboard.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white pb-20">
        <header className="px-4 py-4 border-b border-zinc-800/50">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Leaderboard
          </h1>
        </header>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-700 border-t-emerald-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <header className="px-4 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h1 className="text-lg font-bold">Leaderboard</h1>
        </div>
        <p className="text-zinc-500 text-xs mt-0.5">Ranked by trading volume</p>
      </header>

      <div className="p-4 space-y-4">
        {/* Fee Pool Card */}
        {feePool && (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl p-5 border border-zinc-800/50">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Fee Pool & Rewards
            </h2>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <div className="text-xs text-zinc-500 mb-0.5">Fees</div>
                <div className="text-base font-bold text-white">
                  {formatCurrency(feePool.totalFeesCollected)}
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <div className="text-xs text-zinc-500 mb-0.5">Rewards</div>
                <div className="text-base font-bold text-emerald-400">
                  {formatCurrency(feePool.feePool)}
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <div className="text-xs text-zinc-500 mb-0.5">Traders</div>
                <div className="text-base font-bold text-white">
                  {leaderboard.length}
                </div>
              </div>
            </div>

            {/* Top 3 Distribution */}
            <div className="bg-zinc-800/30 rounded-xl p-4">
              <div className="text-xs text-zinc-500 mb-3">Top 3 Rewards Distribution</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-yellow-400 text-xs font-semibold mb-1">1st Place</div>
                  <div className="text-white font-semibold text-sm">{formatCurrency(feePool.rewardDistribution.first)}</div>
                  <div className="text-zinc-600 text-xs">50%</div>
                </div>
                <div className="text-center">
                  <div className="text-zinc-300 text-xs font-semibold mb-1">2nd Place</div>
                  <div className="text-white font-semibold text-sm">{formatCurrency(feePool.rewardDistribution.second)}</div>
                  <div className="text-zinc-600 text-xs">30%</div>
                </div>
                <div className="text-center">
                  <div className="text-orange-400 text-xs font-semibold mb-1">3rd Place</div>
                  <div className="text-white font-semibold text-sm">{formatCurrency(feePool.rewardDistribution.third)}</div>
                  <div className="text-zinc-600 text-xs">20%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Rankings Card */}
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800/50">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-400" />
              Rankings
            </h2>
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Empty State */}
          {leaderboard.length === 0 && !loading ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-medium">No traders yet</p>
              <p className="text-zinc-600 text-sm mt-1">
                Start trading to appear on the leaderboard!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {leaderboard.map((entry) => (
                <div
                  key={entry.walletAddress}
                  className={`p-4 ${entry.rank <= 3 ? getRankStyle(entry.rank) : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center flex-shrink-0">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{entry.username}</span>
                        {entry.fid > 0 && (
                          <span className="text-xs bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded">
                            FID: {entry.fid}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 font-mono mt-0.5">
                        {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(entry.totalVolume)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {entry.tradeCount} trades
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
