'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { ChevronDown, BarChart3, BookOpen } from 'lucide-react';

interface TradingChartProps {
  selectedPair: TradingPair | null;
  viewMode: 'chart' | 'orderbook';
  onViewModeChange: (mode: 'chart' | 'orderbook') => void;
  onPairSelect?: () => void;
}

type TradingPair = {
  id?: string;
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
};

type BookLevel = {
  p: string;
  a: string;
  n: number;
};

type Kline = {
  t: number;
  o: number | string;
  h: number | string;
  l: number | string;
  c: number | string;
};

type OrderbookLevel = {
  price: number;
  amount: number;
  count: number;
};

type Orderbook = {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number | null;
};

export default function TradingChart({ 
  selectedPair, 
  viewMode, 
  onViewModeChange,
  onPairSelect 
}: TradingChartProps) {
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [orderbookLoading, setOrderbookLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const toUTCTimestamp = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const fetchOrderbook = useCallback(async () => {
    if (!selectedPair?.symbol) return;

    try {
      setOrderbookLoading(true);
      const response = await fetch(`https://api.pacifica.fi/api/v1/book?symbol=${selectedPair.symbol}`);
      const data: { success?: boolean; data?: { l?: BookLevel[][] }; error?: string } = await response.json();
      if (!data?.success || !data?.data?.l) {
        throw new Error(data?.error || 'Unable to load orderbook');
      }

      const [bidsRaw = [], asksRaw = []] = data.data.l;
      const bids: OrderbookLevel[] = bidsRaw.map((level) => ({
        price: parseFloat(level.p),
        amount: parseFloat(level.a),
        count: Number(level.n || 0),
      }));
      const asks: OrderbookLevel[] = asksRaw.map((level) => ({
        price: parseFloat(level.p),
        amount: parseFloat(level.a),
        count: Number(level.n || 0),
      }));

      const topBid = bids[0]?.price;
      const topAsk = asks[0]?.price;
      const spread = topAsk && topBid ? topAsk - topBid : null;

      setOrderbook({ bids, asks, spread });
    } catch (err) {
      console.error('Error fetching orderbook:', err);
      setOrderbook(null);
    } finally {
      setOrderbookLoading(false);
    }
  }, [selectedPair?.symbol]);

  useEffect(() => {
    if (selectedPair && viewMode === 'orderbook') {
      fetchOrderbook();
    }
  }, [selectedPair, viewMode, fetchOrderbook]);

  useEffect(() => {
    if (!selectedPair || viewMode !== 'chart') {
      return;
    }

    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth || 0,
      height: chartContainerRef.current.clientHeight || 320,
      layout: {
        textColor: '#a1a1aa',
        background: { type: ColorType.Solid, color: '#09090b' },
        fontFamily: 'system-ui, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#27272a',
      },
      rightPriceScale: {
        borderColor: '#27272a',
      },
      crosshair: {
        mode: 0,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    fetchChartData(selectedPair.symbol);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [selectedPair, viewMode]);

  const fetchChartData = async (symbol: string) => {
    setChartLoading(true);
    setChartError(null);

    const now = Date.now();
    const lookback = 1000 * 60 * 60 * 24;

    try {
      const response = await fetch(
        `https://api.pacifica.fi/api/v1/kline?symbol=${symbol}&interval=1m&start_time=${now - lookback}&end_time=${now}`
      );

      const json: { success?: boolean; data?: Kline[]; error?: string } = await response.json();
      if (!json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || 'Unable to load chart data');
      }

      const candles: CandlestickData<UTCTimestamp>[] = json.data.map((c) => ({
        time: toUTCTimestamp(Number(c.t)),
        open: Number(c.o),
        high: Number(c.h),
        low: Number(c.l),
        close: Number(c.c),
      }));

      candleSeriesRef.current?.setData(candles);
      chartRef.current?.timeScale().fitContent();
    } catch (error) {
      console.error('Error fetching chart data:', error);
      const message = error instanceof Error ? error.message : 'Failed to load chart';
      setChartError(message);
    } finally {
      setChartLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white">Trade</h2>
          <button
            onClick={onPairSelect}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <span>{selectedPair?.symbol || 'ETH'}</span>
            <ChevronDown size={14} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {/* View Toggle Tabs */}
      <div className="flex p-2 gap-1 border-b border-zinc-800/50">
        <button
          onClick={() => onViewModeChange('chart')}
          className={`flex items-center justify-center gap-2 flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'chart'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <BarChart3 size={16} />
          Chart
        </button>
        <button
          onClick={() => onViewModeChange('orderbook')}
          className={`flex items-center justify-center gap-2 flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'orderbook'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <BookOpen size={16} />
          Orderbook
        </button>
      </div>

      {!selectedPair ? (
        <div className="h-80 flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Select a trading pair to view {viewMode}</p>
        </div>
      ) : viewMode === 'chart' ? (
        <div className="p-4">
          {/* Chart Title */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">{selectedPair.symbol} Price</h3>
            <span className="text-xs text-zinc-500">Pacifica OHLC</span>
          </div>

          {chartError && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
              {chartError}
            </div>
          )}

          {/* Chart Container */}
          <div className="relative h-80 w-full rounded-lg overflow-hidden bg-zinc-950">
            {chartLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-700 border-t-emerald-500" />
              </div>
            )}
            <div ref={chartContainerRef} className="h-full w-full" />
          </div>
        </div>
      ) : (
        /* Orderbook View */
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">{selectedPair.symbol} Orderbook</h3>
          </div>

          {orderbookLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-700 border-t-emerald-500" />
            </div>
          ) : (
            <div className="h-80 overflow-hidden">
              {/* Spread */}
              {typeof orderbook?.spread === 'number' && (
                <div className="text-center py-2 bg-zinc-900 rounded-lg mb-3">
                  <div className="text-xs text-zinc-500">Spread</div>
                  <div className="font-mono font-semibold text-white">${orderbook.spread.toFixed(2)}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 h-[calc(100%-3.5rem)] overflow-y-auto">
                {/* Asks */}
                <div>
                  <div className="text-xs text-zinc-500 mb-2 font-medium flex justify-between px-2">
                    <span>Price</span>
                    <span>Size</span>
                  </div>
                  <div className="space-y-0.5">
                    {orderbook?.asks?.length ? (
                      orderbook.asks.slice(0, 20).map((ask, i) => (
                        <div key={i} className="flex justify-between text-xs px-2 py-1 hover:bg-zinc-800/50 rounded">
                          <span className="text-red-400 font-mono">${ask.price.toFixed(2)}</span>
                          <span className="text-zinc-500 font-mono">{ask.amount.toFixed(4)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-600 text-xs px-2">No asks</p>
                    )}
                  </div>
                </div>

                {/* Bids */}
                <div>
                  <div className="text-xs text-zinc-500 mb-2 font-medium flex justify-between px-2">
                    <span>Price</span>
                    <span>Size</span>
                  </div>
                  <div className="space-y-0.5">
                    {orderbook?.bids?.length ? (
                      orderbook.bids.slice(0, 20).map((bid, i) => (
                        <div key={i} className="flex justify-between text-xs px-2 py-1 hover:bg-zinc-800/50 rounded">
                          <span className="text-emerald-400 font-mono">${bid.price.toFixed(2)}</span>
                          <span className="text-zinc-500 font-mono">{bid.amount.toFixed(4)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-600 text-xs px-2">No bids</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
