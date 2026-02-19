// src/lib/pacifica.ts
import axios from 'axios';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi/api/v1';
const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || '';
const PACIFICA_WITHDRAW_PATH = process.env.PACIFICA_WITHDRAW_PATH || '/account/withdraw';

const pacificaClient = axios.create({
    baseURL: PACIFICA_API_URL,
    timeout: 15000, // 15 second timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

pacificaClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (axios.isAxiosError(error)) {
            console.error('[pacifica-api error]', {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                data: error.response?.data,
            });
        }
        return Promise.reject(error);
    }
);

export const pacifica = {
    // PUBLIC ENDPOINTS
    getTradingPairs: async () => {
        try {
            const response = await pacificaClient.get('/info');
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
            const response = await pacificaClient.get('/info/prices', {
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
            const response = await pacificaClient.get('/positions', {
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
            const response = await pacificaClient.get('/orders', {
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
            const response = await pacificaClient.get('/orders/history', {
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
            const response = await pacificaClient.get('/orders/history_by_id', {
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
            const response = await pacificaClient.get('/info/orderbook', {
                params: { pair: pairId }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching orderbook:', error);
            return { asks: [], bids: [], spread: 0 };
        }
    },

    getAccountState: async (walletAddress: string) => {
        const response = await pacificaClient.get('/account-state', {
            params: { account: walletAddress }
        });
        return response.data;
    },

    // PRIVATE ENDPOINTS (Signature required)
    approveBuilderCode: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/account/builder_codes/approve',
            signedPayload
        );
        return response.data;
    },

    getAgentWallets: async (walletAddress: string) => {
        const response = await pacificaClient.get('/agent', {
            params: { account: walletAddress }
        });
        return response.data;
    },

    registerAgentWallet: async (signedPayload: unknown) => {
        const response = await pacificaClient.post('/agent', signedPayload);
        return response.data;
    },

    checkBuilderApproval: async (walletAddress: string) => {
        const response = await pacificaClient.get(
            '/account/builder_codes/approvals',
            { params: { account: walletAddress } }
        );
        return response.data;
    },

    revokeBuilderCode: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/account/builder_codes/revoke',
            signedPayload
        );
        return response.data;
    },

    placeMarketOrder: async (
        signedPayload: unknown,
        options?: { headers?: Record<string, string> }
    ) => {
        const response = await pacificaClient.post(
            '/orders/create_market',
            signedPayload,
            options
        );
        return response.data;
    },

    placeLimitOrder: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/orders/create',
            signedPayload
        );
        return response.data;
    },

    cancelOrder: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/orders/cancel',
            signedPayload
        );
        return response.data;
    },

    setTakeProfitStopLoss: async (signedPayload: unknown) => {
        const response = await pacificaClient.post(
            '/positions/tpsl',
            signedPayload
        );
        return response.data;
    },

    withdraw: async (
        signedPayload: unknown,
        options?: { headers?: Record<string, string> }
    ) => {
        const response = await pacificaClient.post(
            PACIFICA_WITHDRAW_PATH,
            signedPayload,
            options
        );
        return response.data;
    }
};

export const getBuilderCode = () => BUILDER_CODE;
export default pacifica;
