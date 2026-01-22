export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value)
}


export function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function calculatePnL(
    entryPrice: number,
    currentPrice: number,
    size: number,
    side: 'long' | 'short',
    leverage: number
): number {
    const priceChange = side === 'long'
    ? currentPrice - entryPrice : entryPrice - currentPrice;

    const percentChange = (priceChange / entryPrice) * 100;
    const pnl = (percentChange * leverage * size) / 100;

    return pnl;
}
