export type OrderType = 'market' | 'limit';
export type OrderSide = 'long' | 'short';
export type OrderStatus = 'pending' | 'filled' | 'cancelled';
export type TradeStatus = 'open' | 'closed';



// Trading pair structure
export interface TradingPair {
    id: string;
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    isActive: boolean;
}



//Position Structure
export interface Position {
    id: string;
    pairId: string;
    pairSymbol: string;
    side: OrderSide;
    size: number;
    entryPrice: number;
    currentPrice: number;
    leverage: number;
    liquidaionPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    margin: number;
    createdAt: Date;

}


// Creating an order
export interface CreateOrderRequest {
    pairId: string;
    type: OrderType;
    side: OrderSide;
    size: number;
    leverage: number;
    limitPrice?: number;
}