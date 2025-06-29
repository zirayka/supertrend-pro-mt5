import { MarketData, SuperTrendConfig, SuperTrendResult } from '../types/trading';

export class SuperTrendCalculator {
  private data: MarketData[] = [];
  private config: SuperTrendConfig;
  private currentSymbol: string = '';

  constructor(config: SuperTrendConfig) {
    this.config = config;
  }

  updateConfig(config: SuperTrendConfig) {
    this.config = config;
  }

  setSymbol(symbol: string) {
    if (symbol !== this.currentSymbol) {
      this.currentSymbol = symbol;
      this.data = []; // Clear data when switching symbols
    }
  }

  addData(candle: MarketData) {
    // Only add data for the current symbol
    if (candle.symbol !== this.currentSymbol) {
      return;
    }

    this.data.push(candle);
    if (this.data.length > 1000) {
      this.data = this.data.slice(-500); // Keep last 500 candles
    }
  }

  private calculateSMA(values: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  private calculateATR(data: MarketData[], period: number): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        trueRanges.push(data[i].high - data[i].low);
      } else {
        const tr1 = data[i].high - data[i].low;
        const tr2 = Math.abs(data[i].high - data[i - 1].close);
        const tr3 = Math.abs(data[i].low - data[i - 1].close);
        trueRanges.push(Math.max(tr1, tr2, tr3));
      }
    }

    return this.calculateSMA(trueRanges, period);
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        rsi.push(NaN);
      } else {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        
        if (avgLoss === 0) {
          rsi.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
      }
    }

    return [NaN, ...rsi]; // Add NaN for first price point
  }

  calculate(): SuperTrendResult | null {
    if (this.data.length < this.config.periods + 1) {
      return null;
    }

    const closes = this.data.map(d => d.close);
    const hl2 = this.data.map(d => (d.high + d.low) / 2);
    const atrValues = this.calculateATR(this.data, this.config.periods);
    const rsiValues = this.calculateRSI(closes, this.config.rsiLength);

    const currentIndex = this.data.length - 1;
    const currentATR = atrValues[currentIndex];
    const currentRSI = rsiValues[currentIndex];
    const currentPrice = this.data[currentIndex].close;
    const currentHL2 = hl2[currentIndex];

    if (isNaN(currentATR) || isNaN(currentRSI)) {
      return null;
    }

    // Calculate SuperTrend levels
    const basicUp = currentHL2 - (this.config.multiplier * currentATR);
    const basicDown = currentHL2 + (this.config.multiplier * currentATR);

    // Enhanced trend determination with previous values
    let trend = 1;
    let finalUp = basicUp;
    let finalDown = basicDown;

    if (currentIndex > 0) {
      const prevResult = this.calculatePreviousTrend(currentIndex - 1);
      if (prevResult) {
        // SuperTrend logic with trend continuation
        finalUp = basicUp > prevResult.up || closes[currentIndex - 1] <= prevResult.up ? basicUp : prevResult.up;
        finalDown = basicDown < prevResult.down || closes[currentIndex - 1] >= prevResult.down ? basicDown : prevResult.down;
        
        trend = prevResult.trend;
        if (trend === -1 && currentPrice > finalDown) {
          trend = 1;
        } else if (trend === 1 && currentPrice < finalUp) {
          trend = -1;
        }
      }
    }

    // Calculate trend strength
    const trendLevel = trend === 1 ? finalUp : finalDown;
    const trendStrength = Math.min(Math.abs(currentPrice - trendLevel) / currentATR * 100, 100);

    // Enhanced signal generation with filters
    const prevTrend = currentIndex > 0 ? this.calculatePreviousTrend(currentIndex - 1)?.trend || trend : trend;
    const trendChanged = trend !== prevTrend;
    
    let buySignal = false;
    let sellSignal = false;

    if (trendChanged) {
      if (trend === 1) {
        buySignal = true;
        // Apply RSI filter
        if (this.config.useRsiFilter && currentRSI <= this.config.rsiBuyThreshold) {
          buySignal = false;
        }
        // Apply volatility filter
        if (this.config.useVolatilityFilter) {
          const atrMA = this.calculateSMA(atrValues.slice(-this.config.atrMaLength), this.config.atrMaLength);
          const currentATRMA = atrMA[atrMA.length - 1];
          if (!isNaN(currentATRMA) && currentATR <= currentATRMA) {
            buySignal = false;
          }
        }
      } else {
        sellSignal = true;
        // Apply RSI filter
        if (this.config.useRsiFilter && currentRSI >= this.config.rsiSellThreshold) {
          sellSignal = false;
        }
        // Apply volatility filter
        if (this.config.useVolatilityFilter) {
          const atrMA = this.calculateSMA(atrValues.slice(-this.config.atrMaLength), this.config.atrMaLength);
          const currentATRMA = atrMA[atrMA.length - 1];
          if (!isNaN(currentATRMA) && currentATR <= currentATRMA) {
            sellSignal = false;
          }
        }
      }
    }

    const strongSignal = trendStrength > this.config.strongTrendThreshold;

    return {
      up: finalUp,
      down: finalDown,
      trend,
      atr: currentATR,
      rsi: currentRSI,
      trendStrength,
      buySignal,
      sellSignal,
      strongSignal
    };
  }

  private calculatePreviousTrend(index: number): SuperTrendResult | null {
    if (index < this.config.periods) return null;

    const closes = this.data.slice(0, index + 1).map(d => d.close);
    const hl2 = this.data.slice(0, index + 1).map(d => (d.high + d.low) / 2);
    const atrValues = this.calculateATR(this.data.slice(0, index + 1), this.config.periods);
    const rsiValues = this.calculateRSI(closes, this.config.rsiLength);

    const currentATR = atrValues[index];
    const currentRSI = rsiValues[index];
    const currentPrice = closes[index];
    const currentHL2 = hl2[index];

    if (isNaN(currentATR) || isNaN(currentRSI)) {
      return null;
    }

    const basicUp = currentHL2 - (this.config.multiplier * currentATR);
    const basicDown = currentHL2 + (this.config.multiplier * currentATR);

    let trend = currentPrice > basicUp ? 1 : -1;
    const trendStrength = Math.min(Math.abs(currentPrice - (trend === 1 ? basicUp : basicDown)) / currentATR * 100, 100);

    return {
      up: basicUp,
      down: basicDown,
      trend,
      atr: currentATR,
      rsi: currentRSI,
      trendStrength,
      buySignal: false,
      sellSignal: false,
      strongSignal: trendStrength > this.config.strongTrendThreshold
    };
  }

  getHistoricalData(): MarketData[] {
    return [...this.data];
  }

  getCurrentSymbol(): string {
    return this.currentSymbol;
  }
}