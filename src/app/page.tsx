'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFarcaster } from '@/hooks/useFarcaster';
import { TrendingUp, TrendingDown, Send, ArrowLeftRight, Search, X, ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { useRouter } from 'next/navigation';
import Loading from './loading';
import SlideToConfirm from '@/components/slide-to-confirm';

interface Pair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price?: number;
  priceChange?: number;
}

const FALLBACK_TOKEN: Pair = {
  id: 'fallback-eth',
  symbol: 'ETH',
  baseAsset: 'ETH',
  quoteAsset: 'USD',
};

const CACHE_KEY = 'pacifica.pairs.cache';

// Token colors for avatar backgrounds
const tokenColors: Record<string, string> = {
  ETH: 'bg-blue-500',
  SOL: 'bg-gradient-to-br from-purple-500 to-teal-400',
  BTC: 'bg-orange-500',
  PUMP: 'bg-pink-500',
  XRP: 'bg-gray-600',
  HYPE: 'bg-cyan-500',
};

export default function HomePage() {
  const { user, wallet, walletAddress, isLoading, isFarcasterClient, connectWallet, disconnectWallet, logout } = useFarcaster();
  const inFarcasterClient = isFarcasterClient;
  const { pushToast } = useToast();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [connectWalletError, setConnectWalletError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSwap, setShowSwap] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [tokenPickerTarget, setTokenPickerTarget] = useState<'swapFrom' | 'swapTo' | 'send'>('swapFrom');
  const [tokenPickerQuery, setTokenPickerQuery] = useState('');
  const [swapFromToken, setSwapFromToken] = useState<Pair | null>(null);
  const [swapToToken, setSwapToToken] = useState<Pair | null>(null);
  const [sendToken, setSendToken] = useState<Pair | null>(null);
  const [swapAmount, setSwapAmount] = useState('1');
  const [swapQuote, setSwapQuote] = useState<{
    rateLabel: string;
    priceImpact?: string | null;
  } | null>(null);
  const [swapQuoteError, setSwapQuoteError] = useState<string | null>(null);
  const [swapQuoteLoading, setSwapQuoteLoading] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendFee, setSendFee] = useState<string | null>(null);
  const [sendFeeLoading, setSendFeeLoading] = useState(false);
  const [sendFeeError, setSendFeeError] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const router = useRouter();
  const {
    solBalance,
    solBalanceLoading,
    solBalanceError
  } = useFarcaster();

  const getErrMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      // many wallet libs throw { message, code }
      const anyErr = err as { message?: unknown };
      if (typeof anyErr.message === "string") return anyErr.message;
      try {
        return JSON.stringify(err);
      } catch {
        return "Failed to connect wallet";
      }
    }
    return "Failed to connect wallet";
  };

  const fetchPairs = useCallback(async () => {
    let timeoutId: number | undefined;
    const controller = new AbortController();
    try {
      timeoutId = window.setTimeout(() => controller.abort(), 8000);
      const response = await fetch('/api/pairs', { signal: controller.signal });
      const data = await response.json();
      const pairsWithPrices = data.pairs || [];

      const cachedPairs = loadCachedPairs();
      const cachedBySymbol = new Map(
        (cachedPairs || []).map((pair) => [pair.symbol, pair])
      );

      const stablePairs = pairsWithPrices.map((p: Pair) => ({
        ...p,
        price: cachedBySymbol.get(p.symbol)?.price ?? 0,
        priceChange: cachedBySymbol.get(p.symbol)?.priceChange ?? 0
      }));
      setPairs(stablePairs);
      saveCachedPairs(stablePairs);
      setLoading(false);

      stablePairs.forEach((pair: Pair, index: number) => {
        fetch(`/api/pairs/${pair.symbol}/price`)
          .then(res => res.json())
          .then(priceData => {
            setPairs(prev => {
              const next = prev.map((p, i) =>
                i === index ? { ...p, price: priceData.price } : p
              );
              saveCachedPairs(next);
              return next;
            });
          })
          .catch(() => console.error(`Error fetching price for ${pair.symbol}`));
      });
    } catch (err) {
      console.error('Error fetching pairs:', err);
      setLoading(false);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }, []);

  const handleConnectWallet = async () => {
    try {
      setConnectingWallet(true);
      setConnectWalletError(null);

      if (!inFarcasterClient) {
        setConnectWalletError("Open in Warpcast to connect your Farcaster wallet.");
        return;
      }

      if (wallet?.isConnected) {
        await disconnectWallet();
        pushToast("Disconnected.", { variant: "info" });
        return;
      }

      await connectWallet();
      pushToast("Wallet connected!", { variant: "success" });
    } catch (err) {
      const message = getErrMessage(err);
      if (/Warpcast|Farcaster|miniapp/i.test(message)) {
        setConnectWalletError("Open in Warpcast to connect your Farcaster wallet.");
        pushToast("Open in Warpcast to connect wallet.", { variant: "info" });
      } else {
        pushToast(message, { variant: "error" });
      }
    } finally {
      setConnectingWallet(false);
    }
  };







  useEffect(() => {
    const cached = loadCachedPairs();
    if (cached?.length) {
      setPairs(cached);
      setLoading(false);
    }
    queueMicrotask(() => {
      void fetchPairs();
    });
  }, [fetchPairs]);

  useEffect(() => {
    if (!connectWalletError) return;
    const timeout = window.setTimeout(() => {
      setConnectWalletError(null);
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [connectWalletError]);

  useEffect(() => {
    if (!pairs.length) return;
    setSwapFromToken((prev) => prev || pairs[0]);
    setSwapToToken((prev) => prev || pairs[1] || pairs[0]);
    setSendToken((prev) => prev || pairs[0]);
  }, [pairs]);

  const currentSwapFrom = swapFromToken || pairs[0] || FALLBACK_TOKEN;
  const currentSwapTo = swapToToken || pairs[1] || pairs[0] || FALLBACK_TOKEN;
  const currentSendToken = sendToken || pairs[0] || FALLBACK_TOKEN;

  useEffect(() => {
    if (!showSwap || !currentSwapFrom || !currentSwapTo) return;
    const amount = Number.parseFloat(swapAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        setSwapQuoteLoading(true);
        setSwapQuoteError(null);
        const params = new URLSearchParams({
          from: currentSwapFrom.symbol,
          to: currentSwapTo.symbol,
        });
        const res = await fetch(`/api/rate?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Rate unavailable');
        }
        const data = await res.json();
        setSwapQuote({
          rateLabel: data.rateLabel || `${currentSwapFrom.symbol} → ${currentSwapTo.symbol}`,
          priceImpact: null,
        });
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setSwapQuote(null);
        setSwapQuoteError(err instanceof Error ? err.message : 'Rate unavailable');
      } finally {
        setSwapQuoteLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [showSwap, currentSwapFrom, currentSwapTo, swapAmount]);

  useEffect(() => {
    if (!showSend || !currentSendToken) return;
    if (!sendTo || !sendAmount) {
      setSendFee(null);
      setSendFeeError(null);
      return;
    }

    const amount = Number.parseFloat(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSendFee(null);
      setSendFeeError('Enter a valid amount');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(sendTo.trim())) {
      setSendFee(null);
      setSendFeeError('Enter a valid address');
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      try {
        setSendFeeLoading(true);
        setSendFeeError(null);
        const params = new URLSearchParams({
          token: currentSendToken.symbol,
          to: sendTo.trim(),
          amount: String(amount),
          from: walletAddress || '',
        });
        const res = await fetch(`/api/gas/estimate?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Unable to estimate gas');
        }
        const data = await res.json();
        setSendFee(data.feeLabel || null);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setSendFee(null);
        setSendFeeError(err instanceof Error ? err.message : 'Unable to estimate gas');
      } finally {
        setSendFeeLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [showSend, currentSendToken, sendTo, sendAmount, walletAddress]);
  const loadCachedPairs = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed as Pair[];
    } catch {
      return null;
    }
  };

  const saveCachedPairs = (nextPairs: Pair[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(nextPairs));
    } catch {
      return;
    }
  };









  const displayPairs = pairs.slice(0, 7);
  const filteredTokenOptions = useMemo(() => {
    const q = tokenPickerQuery.trim().toLowerCase();
    const source = pairs.length ? pairs : [FALLBACK_TOKEN];
    if (!q) return source;
    return source.filter((p) => {
      const symbol = (p.symbol || '').toLowerCase();
      const base = (p.baseAsset || '').toLowerCase();
      const quote = (p.quoteAsset || '').toLowerCase();
      return symbol.includes(q) || base.includes(q) || quote.includes(q);
    });
  }, [pairs, tokenPickerQuery]);

  const isValidAmount = (value: string) => {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) && numeric > 0;
  };

  const isValidAddress = (value: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
  };

  const swapDisabled =
    !showSwap ||
    !isValidAmount(swapAmount) ||
    swapQuoteLoading ||
    !!swapQuoteError;

  const sendDisabled =
    !showSend ||
    !isValidAmount(sendAmount) ||
    !isValidAddress(sendTo) ||
    sendFeeLoading ||
    !!sendFeeError;

  const truncateAddress = (addr?: string | null) => {
    if (!addr) return '';
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const filteredPairs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter((p) => {
      const symbol = (p.symbol || '').toLowerCase();
      const base = (p.baseAsset || '').toLowerCase();
      const quote = (p.quoteAsset || '').toLowerCase();
      return symbol.includes(q) || base.includes(q) || quote.includes(q);
    });
  }, [pairs, searchQuery]);

  if (isLoading || loading) return <Loading />;


  const handleTokenPick = (pair: Pair) => {
    if (tokenPickerTarget === 'swapFrom') {
      setSwapFromToken(pair);
    } else if (tokenPickerTarget === 'swapTo') {
      setSwapToToken(pair);
    } else {
      setSendToken(pair);
    }
    setShowTokenPicker(false);
  };

  const openTokenPicker = (target: 'swapFrom' | 'swapTo' | 'send') => {
    setTokenPickerTarget(target);
    setTokenPickerQuery('');
    setShowTokenPicker(true);
  };

  const balanceLabel = () => {
    if (!wallet?.isConnected) return 'Connect wallet';
    if (solBalanceLoading) return 'Loading…';
    if (solBalanceError) return 'Balance unavailable';
    if (typeof solBalance === 'number') return `${solBalance.toFixed(4)} SOL`;
    return '—';
  };

  return (
    <>
      <div className="min-h-screen bg-black text-white pb-32">
        {/* Header */}
        <header className="px-5 pt-4 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowProfile(true)} className="rounded-full">
              {user?.pfpUrl ? (
                <img
                  src={user.pfpUrl || "/placeholder.svg"}
                  alt={user.username}
                  className="w-9 h-9 rounded-full ring-2 ring-zinc-800"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-medium">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearch(true);
              }}
              className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center hover:cursor-pointer"
            >
              <Search className="w-5 h-5 text-zinc-400" />
            </button>
            <button
              onClick={handleConnectWallet}
              disabled={connectingWallet || (isLoading && isFarcasterClient)}
              className="h-9 px-3 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-60 hover:cursor-pointer"
            >
              {wallet?.isConnected ? truncateAddress(walletAddress) : 'Connect wallet'}
            </button>
          </div>
        </header>

        {connectWalletError && (
          <div className="fixed inset-x-0 bottom-24 z-50 px-4">
            <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900/95 text-zinc-100 shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-3 px-3 py-3">
                <span className="text-xs leading-snug text-zinc-100/90 pr-1">
                  {connectWalletError}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {!inFarcasterClient && (
                    <a
                      href="https://warpcast.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Warpcast
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setConnectWalletError(null)}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/60 p-1.5 text-zinc-100 hover:bg-zinc-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Volume Stats Card */}
        <div className="px-5 py-3">
          <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-800/50">
            <div className="flex justify-between items-start mb-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Wallet Balance</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-emerald-400/80">
                  Solana
                </span>
              </div>
              <span className="text-xs text-zinc-500">LIVE</span>
            </div>
            <div className="text-3xl font-bold tracking-tight mb-2">{balanceLabel()}</div>
            {solBalanceError && (
              <div className="mt-2 text-xs text-zinc-500">
                Balance fetch failed. Please retry shortly.
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3">
          <div className="flex gap-3">
            <button
              onClick={() => setShowSend(true)}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors border border-zinc-800"
            >
              <Send className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Send</span>
            </button>
            <button
              onClick={() => setShowSwap(true)}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors border border-zinc-800"
            >
              <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Swap</span>
            </button>
          </div>
        </div>



        {/* Token List */}
        <div className="px-5">
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden">
            {displayPairs.map((pair, index) => {
              const isPositive = (pair.priceChange || 0) >= 0;
              const bgColor = tokenColors[pair.symbol] || 'bg-zinc-700';
              const baseAsset = pair.baseAsset || pair.symbol?.split('-')[0] || pair.symbol;
              const iconSymbol = baseAsset.toLowerCase();

              return (
                <Link key={pair.id ?? pair.symbol} href={`/trade?pair=${pair.symbol}`}>
                  <div className={`flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors ${index !== displayPairs.length - 1 ? 'border-b border-zinc-800/50' : ''
                    }`}>
                    <div className="flex items-center gap-3">
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
                      <span className="font-semibold text-white">{pair.symbol}</span>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-white">
                        ${typeof pair.price === 'number'
                          ? pair.price.toFixed(3)
                          : pair.price
                            ? Number(pair.price).toFixed(3)
                            : '0.001011'}
                      </div>
                      <div className={`text-xs flex items-center gap-1 justify-end ${isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPositive ? '+' : ''}{pair.priceChange?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* See All Link */}
        <div className="px-5 py-4">
          <Link href="/pairs" className="text-sm text-zinc-500 hover:text-zinc-400 flex items-center justify-center gap-1">
            See All Markets →
          </Link>
        </div>
      </div>

      {/* Swap Modal*/}
      {showSwap && (
        <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 bottom-16 bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={() => setShowSwap(false)}
          />
          <div
            className="relative bg-zinc-900 w-full rounded-t-3xl p-6 mb-16 border-t border-zinc-800 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Swap Tokens</h2>
              <button
                onClick={() => setShowSwap(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* From Token */}
            <div className="space-y-4 mb-6">
              <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">From</span>
                  <span className="text-xs text-zinc-500">Balance: 0.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-2xl font-bold w-full outline-none placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => openTokenPicker('swapFrom')}
                    className="flex items-center gap-2 bg-zinc-700 rounded-full px-3 py-2"
                  >
                    <div className="relative w-6 h-6">
                      <div className={`w-6 h-6 rounded-full ${tokenColors[currentSwapFrom.symbol] || 'bg-zinc-600'} flex items-center justify-center text-xs font-bold`}>
                        {currentSwapFrom.symbol.slice(0, 1)}
                      </div>
                      <img
                        src={`https://assets.coincap.io/assets/icons/${(currentSwapFrom.baseAsset || currentSwapFrom.symbol).toLowerCase()}@2x.png`}
                        alt={currentSwapFrom.symbol}
                        className="absolute inset-0 w-6 h-6 rounded-full"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{currentSwapFrom.symbol}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Swap direction indicator */}
              <div className="flex justify-center -my-2 relative z-10">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border-4 border-zinc-900 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4 text-zinc-400 rotate-90" />
                </div>
              </div>

              {/* To Token */}
              <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">To</span>
                  <span className="text-xs text-zinc-500">Balance: 0.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="0.00"
                    className="bg-transparent text-2xl font-bold w-full outline-none placeholder:text-zinc-600"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => openTokenPicker('swapTo')}
                    className="flex items-center gap-2 bg-zinc-700 rounded-full px-3 py-2"
                  >
                    <div className="relative w-6 h-6">
                      <div className={`w-6 h-6 rounded-full ${tokenColors[currentSwapTo.symbol] || 'bg-zinc-600'} flex items-center justify-center text-xs font-bold`}>
                        {currentSwapTo.symbol.slice(0, 1)}
                      </div>
                      <img
                        src={`https://assets.coincap.io/assets/icons/${(currentSwapTo.baseAsset || currentSwapTo.symbol).toLowerCase()}@2x.png`}
                        alt={currentSwapTo.symbol}
                        className="absolute inset-0 w-6 h-6 rounded-full"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{currentSwapTo.symbol}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Swap Info */}
            <div className="bg-zinc-800/30 rounded-xl p-3 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Rate</span>
                <span className="text-zinc-300">
                  {swapQuoteLoading
                    ? 'Loading...'
                    : swapQuote?.rateLabel ||
                    (swapQuoteError === 'Unsupported token pair'
                      ? 'Pair not supported'
                      : swapQuoteError || 'Unavailable')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Price Impact</span>
                <span className="text-zinc-300">
                  {swapQuoteLoading ? '—' : swapQuote?.priceImpact ?? '—'}
                </span>
              </div>
            </div>

            {/* Slide to Swap */}
            <SlideToConfirm
              label="Slide to Swap"
              variant="default"
              disabled={swapDisabled}
              onConfirm={() => {
                if (swapDisabled) {
                  pushToast('Enter a valid amount and select a supported pair', { variant: 'warning' });
                  return;
                }
                pushToast('Swap confirmed!', { variant: 'success' });
                setShowSwap(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Send Bottom Sheet */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 bottom-16 bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={() => setShowSend(false)}
          />
          <div
            className="relative bg-zinc-900 w-full rounded-t-3xl p-6 mb-16 border-t border-zinc-800 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Send Tokens</h2>
              <button
                onClick={() => setShowSend(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Select Token */}
            <div className="space-y-4 mb-6">
              <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">Token</span>
                  <span className="text-xs text-zinc-500">Balance: 0.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-2xl font-bold w-full outline-none placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => openTokenPicker('send')}
                    className="flex items-center gap-2 bg-zinc-700 rounded-full px-3 py-2"
                  >
                    <div className="relative w-6 h-6">
                      <div className={`w-6 h-6 rounded-full ${tokenColors[currentSendToken.symbol] || 'bg-zinc-600'} flex items-center justify-center text-xs font-bold`}>
                        {currentSendToken.symbol.slice(0, 1)}
                      </div>
                      <img
                        src={`https://assets.coincap.io/assets/icons/${(currentSendToken.baseAsset || currentSendToken.symbol).toLowerCase()}@2x.png`}
                        alt={currentSendToken.symbol}
                        className="absolute inset-0 w-6 h-6 rounded-full"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{currentSendToken.symbol}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Recipient Address */}
              <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
                <span className="text-xs text-zinc-500 block mb-2">Recipient Address</span>
                <input
                  type="text"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="0x... or ENS name"
                  className="bg-transparent text-base w-full outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="bg-zinc-800/30 rounded-xl p-3 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Gas Fee</span>
                <span className="text-zinc-300">
                  {sendFeeLoading
                    ? 'Loading...'
                    : sendFee || sendFeeError || '—'}
                </span>
              </div>
            </div>

            <SlideToConfirm
              label="Slide to Send"
              variant="success"
              disabled={sendDisabled}
              onConfirm={() => {
                if (sendDisabled) {
                  pushToast('Enter a valid amount and recipient address', { variant: 'warning' });
                  return;
                }
                pushToast('Send confirmed!', { variant: 'success' });
                setShowSend(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Profile Bottom Sheet */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 bottom-16 bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={() => setShowProfile(false)}
          />
          <div
            className="relative bg-zinc-900 w-full rounded-t-3xl p-6 mb-16 border-t border-zinc-800 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setShowProfile(false);
                }}
                className="h-9 px-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors text-xs font-medium text-zinc-200"
              >
                Log out
              </button>
              <h2 className="text-lg font-bold">Profile</h2>
              <button
                onClick={() => setShowProfile(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="bg-zinc-800/40 rounded-2xl p-4 border border-zinc-700/40">
              <div className="flex items-center gap-3">
                {user?.pfpUrl ? (
                  <img
                    src={user.pfpUrl || "/placeholder.svg"}
                    alt={user.username}
                    className="w-12 h-12 rounded-full ring-2 ring-zinc-800"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-medium">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{user?.displayName || 'Anonymous'}</div>
                  <div className="text-sm text-zinc-400 truncate">@{user?.username || 'unknown'}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Wallet</span>
                  <span className="font-mono text-zinc-200">{walletAddress ? truncateAddress(walletAddress) : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">FID</span>
                  <span className="text-zinc-200">{user?.fid ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Balance</span>
                  <span className="text-zinc-200">{balanceLabel()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 bottom-16 bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={() => setShowSearch(false)}
          />
          <div
            className="relative bg-zinc-900 w-full rounded-t-3xl p-6 mb-16 border-t border-zinc-800 max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Search Pairs</h2>
              <button
                onClick={() => setShowSearch(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="mb-4">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by symbol (e.g. ETH)"
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              <div className="space-y-2">
                {filteredPairs.slice(0, 50).map((pair) => {
                  const iconSymbol = (pair.baseAsset || pair.symbol).toLowerCase();
                  const displayPrice =
                    typeof pair.price === 'number'
                      ? pair.price
                      : pair.price
                        ? Number(pair.price)
                        : 0;
                  return (
                    <button
                      key={pair.id ?? pair.symbol}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 transition-colors"
                      onClick={() => {
                        setShowSearch(false);
                        router.push(`/trade?pair=${encodeURIComponent(pair.symbol)}`);
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-9 h-9">
                          <div className={`w-9 h-9 rounded-full ${tokenColors[pair.symbol] || 'bg-zinc-700'} flex items-center justify-center text-xs font-bold`}>
                            {pair.symbol.slice(0, 2)}
                          </div>
                          <img
                            src={`https://assets.coincap.io/assets/icons/${iconSymbol}@2x.png`}
                            alt={pair.symbol}
                            className="absolute inset-0 w-9 h-9 rounded-full"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="font-semibold text-white">{pair.symbol}</div>
                          <div className="text-xs text-zinc-500">{pair.baseAsset}{pair.quoteAsset}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-sm font-semibold text-zinc-300 shrink-0 min-w-[72px]">
                        ${displayPrice.toFixed(3)}
                      </div>
                    </button>
                  );
                })}
                {filteredPairs.length === 0 && (
                  <div className="text-center py-10 text-zinc-500 text-sm">No pairs found</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Picker */}
      {showTokenPicker && (
        <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 bottom-16 bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={() => setShowTokenPicker(false)}
          />
          <div
            className="relative bg-zinc-900 w-full rounded-t-3xl p-6 mb-16 border-t border-zinc-800 max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Select Token</h2>
              <button
                onClick={() => setShowTokenPicker(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="mb-4">
              <input
                value={tokenPickerQuery}
                onChange={(e) => setTokenPickerQuery(e.target.value)}
                placeholder="Search token (e.g. ETH)"
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 space-y-2">
              {filteredTokenOptions.slice(0, 50).map((pair) => {
                const iconSymbol = (pair.baseAsset || pair.symbol).toLowerCase();
                return (
                  <button
                    key={pair.id ?? pair.symbol}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 transition-colors"
                    onClick={() => handleTokenPick(pair)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9">
                        <div className={`w-9 h-9 rounded-full ${tokenColors[pair.symbol] || 'bg-zinc-700'} flex items-center justify-center text-xs font-bold`}>
                          {pair.symbol.slice(0, 2)}
                        </div>
                        <img
                          src={`https://assets.coincap.io/assets/icons/${iconSymbol}@2x.png`}
                          alt={pair.symbol}
                          className="absolute inset-0 w-9 h-9 rounded-full"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">{pair.symbol}</div>
                        <div className="text-xs text-zinc-500">{pair.baseAsset}</div>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">{pair.quoteAsset}</div>
                  </button>
                );
              })}
              {filteredTokenOptions.length === 0 && (
                <div className="text-center py-10 text-zinc-500 text-sm">No tokens found</div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
