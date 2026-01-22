'use client';
import { useState, useEffect } from 'react';
import { Clock, X, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { extractAddress } from '@/lib/extractAddress';


interface Order {
  id: string;
  pairSymbol: string;
  type: 'market' | 'limit';
  side: 'long' | 'short';
  size: number;
  leverage: number;
  limitPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  createdAt: string;
}

interface OrdersListProps {
  walletAddress: string | unknown;
}

export default function OrdersList({ walletAddress }: OrdersListProps) {
  const { pushToast } = useToast();
  // State for storing orders
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Track which order is being cancelled
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Fetch orders when component mounts or wallet changes
  useEffect(() => {
    if (walletAddress) {
      fetchOrders();
    }
  }, [walletAddress]);

  // Set up polling: Refresh orders every 15 seconds
  useEffect(() => {
    if (!walletAddress) return;
    
    // Poll every 15 seconds to check for filled orders
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, [walletAddress]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call your GET /api/orders endpoint
      // This returns all orders (you might want to filter for pending only)
      const accountString = extractAddress(walletAddress) ?? '';
      if (!accountString) {
        console.warn('OrdersList: missing wallet address, skipping fetch');
        setOrders([]);
        return;
      }

      const response = await fetch(`/api/orders?account=${encodeURIComponent(accountString)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      
      // Filter to show only pending orders (limit orders waiting to execute)
      const pendingOrders = (data.orders || []).filter(
        (order: Order) => order.status === 'pending'
      );
      
      setOrders(pendingOrders);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cancel a pending limit order
  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancellingId(orderId); // Show loading on this button
      
      // Call your DELETE /api/orders/[id]/cancel endpoint
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel order');
      }
      
      // Show success message
      pushToast('Order cancelled successfully', { variant: 'success' });
      
      // Refresh orders list
      await fetchOrders();
      
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to cancel order', { variant: 'error' });
      console.error('Error cancelling order:', err);
    } finally {
      setCancellingId(null);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date/time to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    
    // Show "X hours ago" if less than 24 hours
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    
    // Otherwise show date
    return date.toLocaleDateString();
  };

  // Show loading spinner on first load
  if (loading && orders.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Pending Orders</h2>
        </div>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Pending Orders</h2>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh orders"
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

      {/* Empty state - no pending orders */}
      {orders.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No pending orders</p>
          <p className="text-gray-500 text-sm mt-2">
            Your limit orders will appear here
          </p>
        </div>
      ) : (
        // List of pending orders
        <div className="space-y-3">
          {orders.map((order) => {
            const isLong = order.side === 'long';
            
            return (
              <div
                key={order.id}
                className="bg-gray-800 rounded-lg p-4 border-l-4"
                style={{
                  borderColor: isLong ? '#10b981' : '#ef4444'
                }}
              >
                {/* Order header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{order.pairSymbol}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          isLong ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                        }`}
                      >
                        {isLong ? 'LONG' : 'SHORT'} {order.leverage}x
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(order.createdAt)}
                    </div>
                  </div>

                  {/* Cancel button */}
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={cancellingId === order.id}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Cancel order"
                  >
                    {cancellingId === order.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Order details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Order Type</span>
                    <span className="font-medium uppercase">{order.type}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Size</span>
                    <span className="font-mono">{order.size} units</span>
                  </div>
                  
                  {/* Only show limit price for limit orders */}
                  {order.type === 'limit' && order.limitPrice && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Limit Price</span>
                      <span className="font-mono font-bold text-blue-400">
                        {formatCurrency(order.limitPrice)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                  <span className="text-gray-400">
                    Waiting for price to reach {formatCurrency(order.limitPrice || 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
