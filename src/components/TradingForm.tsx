'use client';

import React from "react"

import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Info, X, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

interface OrderPreview {
  estPrice: number;
  estFee: number;
  maxSlippage: number;
  position: string;
  estLiqPrice: number;
  marginUsage: number;
  accountLeverage: number;
}

export default function TradingForm({
  selectedPair,
  walletAddress
}: {
  selectedPair: { symbol?: string; mark?: string } | null;
  walletAddress: string;
}) {
  const { pushToast } = useToast();
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const currentPrice = parseFloat(selectedPair?.mark || '0');
  const sizeNum = parseFloat(size) || 0;
  const feeAmount = sizeNum * 0.0004;

  const orderPreview: OrderPreview = {
    estPrice: orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice,
    estFee: feeAmount,
    maxSlippage: 1.0,
    position: `${(sizeNum / currentPrice).toFixed(6)} ${selectedPair?.symbol || 'ETH'}-PERP`,
    estLiqPrice: side === 'long'
      ? currentPrice * (1 - 1 / leverage * 0.9)
      : currentPrice * (1 + 1 / leverage * 0.9),
    marginUsage: sizeNum > 0 ? (sizeNum / leverage / 1000 * 100) : 0,
    accountLeverage: leverage,
  };

  const isValidSolAddress = (addr: string) => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  const toBase64 = (bytes: Uint8Array) => {
    // browser-safe base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const { publicKey, signMessage } = useWallet();

  const signSolanaMessage = async (message: string) => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }
    if (!signMessage) {
      throw new Error('Wallet does not support message signing');
    }
    const encoded = new TextEncoder().encode(message);
    const sigBytes = await signMessage(encoded); // Uint8Array
    return toBase64(sigBytes);
  };

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    if (!selectedPair) {
      pushToast('Please select a trading pair', { variant: 'warning' });
      return;
    }

    // Use publicKey as source of truth
    const account = publicKey?.toBase58() || walletAddress;

    if (!account || !isValidSolAddress(account)) {
      pushToast('Connect a Solana wallet in Warpcast to place orders', { variant: 'warning' });
      return;
    }

    if (!size || parseFloat(size) < 10) {
      pushToast('Minimum order size is $10', { variant: 'warning' });
      return;
    }

    if (orderType === 'limit' && !limitPrice) {
      pushToast('Please enter a limit price', { variant: 'warning' });
      return;
    }

    setLoading(true);

    try {
      const timeStamp = new Date().toISOString();

      const payload = {
        account, // solana base58
        symbol: selectedPair.symbol,
        amount: size,
        side: side === 'long' ? 'bid' : 'ask',
        type: orderType,
        tick_level: orderType === 'limit' ? limitPrice : undefined,
        leverage,
        timeStamp,
      };

      const signatureMessage = [
        'Pacificast Order',
        `account:${payload.account}`,
        `symbol:${payload.symbol}`,
        `amount:${payload.amount}`,
        `side:${payload.side}`,
        `type:${payload.type}`,
        `timestamp:${payload.timeStamp}`,
        `tick:${payload.tick_level ?? ''}`,
      ].join('\n');

      
      const signature = await signSolanaMessage(signatureMessage);

      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, signature }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to place order');
      }

      pushToast(`${orderType === 'market' ? 'Market' : 'Limit'} order placed`, { variant: 'success' });

      setSize('');
      setLimitPrice('');
      setShowPreview(false);
    } catch (error) {
      console.error('Error placing order:', error);
      pushToast(error instanceof Error ? error.message : 'Failed to place order', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (!selectedPair) {
    return (
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800/50 p-6">
        <div className="text-center text-zinc-500 py-8">
          <Info size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a trading pair to start trading</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800/50">
          <h2 className="text-base font-semibold text-white">
            Trade {selectedPair.symbol}/USD
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Order Type Toggle */}
          <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl">
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${orderType === 'market'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
                }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderType('limit')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${orderType === 'limit'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
                }`}
            >
              Limit
            </button>
          </div>

          {/* Side Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide('long')}
              className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${side === 'long'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
            >
              <ArrowUpCircle size={18} />
              Long
            </button>
            <button
              type="button"
              onClick={() => setSide('short')}
              className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${side === 'short'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
            >
              <ArrowDownCircle size={18} />
              Short
            </button>
          </div>

          {/* Current Price */}
          <div className="bg-zinc-900 p-4 rounded-xl">
            <div className="text-xs text-zinc-500 mb-1">Current Price</div>
            <div className="text-xl font-semibold font-mono text-white">
              ${currentPrice.toLocaleString()}
            </div>
          </div>

          {/* Limit Price (only for limit orders) */}
          {orderType === 'limit' && (
            <div>
              <label className="block text-xs text-zinc-500 mb-2">
                Limit Price (USD)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={`e.g. ${currentPrice.toFixed(2)}`}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                />
              </div>
              <div className="text-xs text-zinc-600 mt-1.5">
                {side === 'long'
                  ? 'Buy when price drops to this level'
                  : 'Sell when price rises to this level'
                }
              </div>
            </div>
          )}

          {/* Size Input */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">
              Size (USD)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Min: $10"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-16 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-zinc-500"
              >
                USD <ChevronDown size={12} />
              </button>
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-500">Leverage</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLeverage(Math.max(1, leverage - 1))}
                  className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 flex items-center justify-center text-sm font-medium"
                >
                  -
                </button>
                <span className="w-12 text-center font-mono text-sm font-semibold text-white">{leverage}x</span>
                <button
                  type="button"
                  onClick={() => setLeverage(Math.min(50, leverage + 1))}
                  className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 flex items-center justify-center text-sm font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="range"
                min="1"
                max="50"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div
                className="absolute top-0 left-0 h-1.5 bg-emerald-600 rounded-full pointer-events-none"
                style={{ width: `${((leverage - 1) / 49) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-600 mt-1.5">
              <span>1x</span>
              <span>25x</span>
              <span>50x</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${side === 'long'
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-red-600 hover:bg-red-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Placing Order...' : `${side.toUpperCase()} ${selectedPair.symbol}`}
          </button>

          {/* Preview Order Button */}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={!size || parseFloat(size) < 10}
            className="w-full py-3 rounded-xl font-medium border border-zinc-800 text-zinc-300 hover:bg-zinc-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Preview Order details
          </button>

          {/* Fee Info */}
          <div className="flex justify-between items-center text-sm pt-2 border-t border-zinc-800/50 mb-2">
            <span className="text-zinc-500">Trading Fee (0.04%):</span>
            <span className="text-white font-mono">${feeAmount.toFixed(2)}</span>
          </div>
        </form>
      </div>

      {/* Order Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-base font-semibold text-white">Order details</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Est. Price</span>
                <span className="text-sm font-mono text-white">{orderPreview.estPrice.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Est. Fee</span>
                <span className="text-sm font-mono text-white">
                  {orderPreview.estFee.toFixed(2)} <span className="text-zinc-500">USDC</span>
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Max Slippage</span>
                <span className="text-sm font-mono text-emerald-400">{orderPreview.maxSlippage.toFixed(2)}%</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Position</span>
                <span className="text-sm font-mono text-white">{orderPreview.position}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Est. Liq Price</span>
                <span className="text-sm font-mono text-white">
                  {orderPreview.estLiqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Margin Usage</span>
                <span className="text-sm font-mono text-white">
                  {orderPreview.marginUsage.toFixed(2)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Account Leverage</span>
                <span className="text-sm font-mono text-white">{orderPreview.accountLeverage}x</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={(e) => {
                  void handleSubmit(e as unknown as React.FormEvent);
                }}
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all ${side === 'long'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-red-600 hover:bg-red-500'
                  } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Placing Order...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
