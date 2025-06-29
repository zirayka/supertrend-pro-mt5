import { MarketData } from '../types/trading';

export class MarketSimulator {
  private basePrice: number = 50000;
  private volatility: number = 0.02;
  private trend: number = 0.0001;
  private lastPrice: number;

  constructor(initialPrice: number = 50000) {
    this.basePrice = initialPrice;
    this.lastPrice = initialPrice;
  }

  generateCandle(timestamp: number): MarketData {
    // Generate realistic OHLC data with some volatility
    const randomChange = (Math.random() - 0.5) * this.volatility * this.lastPrice;
    const trendChange = this.trend * this.lastPrice;
    
    const open = this.lastPrice;
    const close = open + randomChange + trendChange;
    
    const high = Math.max(open, close) + Math.random() * 0.01 * this.lastPrice;
    const low = Math.min(open, close) - Math.random() * 0.01 * this.lastPrice;
    
    const volume = Math.floor(Math.random() * 1000000) + 100000;

    this.lastPrice = close;
    
    // Occasionally change trend direction
    if (Math.random() < 0.01) {
      this.trend *= -1;
    }

    return {
      timestamp,
      open,
      high,
      low,
      close,
      volume
    };
  }

  setVolatility(volatility: number) {
    this.volatility = Math.max(0.001, Math.min(0.1, volatility));
  }

  setTrend(trend: number) {
    this.trend = Math.max(-0.001, Math.min(0.001, trend));
  }
}