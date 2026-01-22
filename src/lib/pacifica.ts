// src/lib/pacifica.ts
import axios from 'axios';

const PACIFICA_API_URL = 'https://api.pacifica.fi';
const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || '';

const pacificaClient = axios.create({
    baseURL: PACIFICA_API_URL,
    timeout: 15000, // 15 second timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

export const pacifica = {
    // PUBLIC ENDPOINTS
    getTradingPairs: async () => {
        try {
            const response = await pacificaClient.get('/api/v1/info');
            return response.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error fetching pairs:', message);
            // Fallback mock data if API fails.
            return {
                success: true,
                data: [
                    { id: 'BTC-USDC', symbol: 'BTC-USDC', baseAsset: 'BTC', quoteAsset: 'USDC', active: true },
                    { id: 'ETH-USDC', symbol: 'ETH-USDC', baseAsset: 'ETH', quoteAsset: 'USDC', active: true },
                    { id: 'SOL-USDC', symbol: 'SOL-USDC', baseAsset: 'SOL', quoteAsset: 'USDC', active: true },
                ]
            };
        }
    },

    getPrice: async (symbol: string) => {
        try {
            const response = await pacificaClient.get('/api/v1/info/prices', {
                params: { symbol }
            });
            return response.data;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error fetching price for ${symbol}:`, message);
            return {
                success: false,
                data: [],
                error: 'Price unavailable'
            };
        }
    },

    getPositions: async (walletAddress: string) => {
        try {
            const response = await pacificaClient.get('/api/v1/positions', {
                params: { account: walletAddress }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching positions:', error);
            return { positions: [] };
        }
    },

    getOpenOrders: async (walletAddress: string) => {
        try {
            const response = await pacificaClient.get('/api/v1/orders', {
                params: { account: walletAddress }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching orders:', error);
            return { orders: [] };
        }
    },

    getOrderHistory: async (walletAddress: string) => {
        try {
            const response = await pacificaClient.get('/api/v1/orders/history', {
                params: { account: walletAddress }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching order history:', error);
            return { orders: [] };
        }
    },

    getOrderById: async (orderId: string) => {
        try {
            const response = await pacificaClient.get('/api/v1/orders/history_by_id', {
                params: { order_id: orderId }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching order by ID:', error);
            throw error;
        }
    },

    getOrderbook: async (pairId: string) => {
        try {
            const response = await pacificaClient.get('/api/v1/info/orderbook', {
                params: { pair: pairId }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching orderbook:', error);
            return { asks: [], bids: [], spread: 0 };
        }
    },

    // PRIVATE ENDPOINTS (Signature required)
    approveBuilderCode: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/api/v1/account/builder_codes/approve',
            signedPayload
        );
        return response.data;
    },

    checkBuilderApproval: async (walletAddress: string) => {
        const response = await pacificaClient.get(
            '/api/v1/account/builder_codes/approvals',
            { params: { account: walletAddress } }
        );
        return response.data;
    },

    revokeBuilderCode: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/api/v1/account/builder_codes/revoke', 
            signedPayload
        );
        return response.data;
    },

    placeMarketOrder: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/api/v1/orders/create_market',
            signedPayload
        );
        return response.data;
    },

    placeLimitOrder: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/api/v1/orders/create',
            signedPayload
        );
        return response.data;
    },

    cancelOrder: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/api/v1/orders/cancel',
            signedPayload
        );
        return response.data;
    },

    setTakeProfitStopLoss: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/api/v1/positions/tpsl',
            signedPayload
        );
        return response.data;
    }
};

export const getBuilderCode = () => BUILDER_CODE;
export default pacifica;
