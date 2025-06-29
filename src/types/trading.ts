export interface MarketData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  bid?: number;
  ask?: number;
  spread?: number;
}

export interface SuperTrendConfig {
  periods: number;
  multiplier: number;
  changeATR: boolean;
  showSignals: boolean;
  highlighting: boolean;
  rsiLength: number;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;
  useRsiFilter: boolean;
  useVolatilityFilter: boolean;
  atrMaLength: number;
  useHtfFilter: boolean;
  cooldownBars: number;
  strongTrendThreshold: number;
}

export interface SuperTrendResult {
  up: number;
  down: number;
  trend: number;
  atr: number;
  rsi: number;
  trendStrength: number;
  buySignal: boolean;
  sellSignal: boolean;
  strongSignal: boolean;
}

export interface TradingSignal {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  strength: number;
  confidence: number;
  symbol: string;
}

export interface CurrencyPair {
  symbol: string;
  name: string;
  category: 'major' | 'minor' | 'exotic' | 'crypto' | 'indices' | 'commodities';
  digits: number;
  pointSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  spread?: number;
  swapLong?: number;
  swapShort?: number;
}

export interface MT5Connection {
  isConnected: boolean;
  server?: string;
  account?: number;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  lastUpdate?: number;
}

export interface MT5Tick {
  symbol: string;
  time: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  flags: number;
}