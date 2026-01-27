'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { extractAddress } from '@/lib/extractAddress';

interface OrdersDropdownProps {
  walletAddress: string | unknown;
  isOpen: boolean;
  onToggle: () => void;
}

type PositionSummary = {
  id: string;
  pairSymbol: string;
  side: 'long' | 'short';
  leverage: number;
  pnl?: number;
  size?: number;
  entryPrice?: number;
};

type OrderSummary = {
  id: string;
  pairSymbol: string;
  side: 'long' | 'short';
  leverage: number;
  limitPrice?: number;
  size?: number;
  createdAt: string;
  status?: string;
};

export default function OrdersDropdown({ walletAddress, isOpen, onToggle }: OrdersDropdownProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const account = extractAddress(walletAddress);
    if (!account) return;
    setLoading(true);
    try {
      if (activeTab === 'positions') {
        const res = await fetch(`/api/positions?account=${encodeURIComponent(account)}`);
        const data: { positions?: unknown } = await res.json();
        setPositions(Array.isArray(data.positions) ? (data.positions as PositionSummary[]) : []);
      } else {
        const res = await fetch(`/api/orders?account=${encodeURIComponent(account)}`);
        const data: { orders?: unknown } = await res.json();
        const next = Array.isArray(data.orders) ? (data.orders as OrderSummary[]) : [];
        setOrders(next.filter((o) => o.status === 'pending'));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, walletAddress]);

  useEffect(() => {
    if (isOpen && walletAddress) {
      void fetchData();
    }
  }, [isOpen, walletAddress, fetchData]);

  return (
    <div 
      className={`fixed bottom-16 left-0 right-0 bg-black border-t border-gray-800 transition-transform duration-300 z-40 ${
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'
      }`}
      style={{ height: '47vh' }}
    >
      {/* Handle */}
      <button
        onClick={onToggle}
        className="w-full py-3 flex items-center justify-center gap-2 border-b border-gray-800 hover:bg-gray-800 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        <span className="font-medium">
          {activeTab === 'positions' ? 'Open Positions' : 'Open Orders'} ({activeTab === 'positions' ? positions.length : orders.length})
        </span>
      </button>

      {/* Content */}
      <div className="overflow-hidden h-[calc(100%-3rem)]">
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex-1 py-3 font-medium transition-colors ${
              activeTab === 'positions' 
                ? 'text-white border-b-2 border-zinc-500' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-3 font-medium transition-colors ${
              activeTab === 'orders' 
                ? 'text-white border-b-2 border-zinc-500' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Orders ({orders.length})
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto h-[calc(100%-3rem)] p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : activeTab === 'positions' ? (
            positions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No open positions
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((pos) => (
                  <div key={pos.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold">{pos.pairSymbol}</div>
                        <div className={`text-xs ${pos.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.side.toUpperCase()} {pos.leverage}x
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">PnL</div>
                        <div className={`font-bold ${(pos.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(pos.pnl ?? 0) >= 0 ? '+' : ''}${(pos.pnl ?? 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <div>Size: {pos.size}</div>
                      <div>Entry: ${pos.entryPrice}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2">
                <Clock className="w-12 h-12 text-gray-600" />
                No pending orders
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">{order.pairSymbol}</div>
                        <div className={`text-xs ${order.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                          {order.side.toUpperCase()} {order.leverage}x • LIMIT
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Limit</div>
                        <div className="font-mono font-bold text-blue-400">
                          ${order.limitPrice}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Size: {order.size} • {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
