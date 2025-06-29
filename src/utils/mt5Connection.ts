import { MarketData, MT5Connection, MT5Tick, CurrencyPair } from '../types/trading';
import { MT5TerminalConnection } from './mt5TerminalConnection';

export class MT5ConnectionManager {
  private terminalConnection: MT5TerminalConnection | null = null;
  private connectionStatus: MT5Connection = { isConnected: false };
  private subscribers: Map<string, (data: any) => void> = new Map();
  private isWebContainer = false;

  constructor(private serverUrl?: string) {
    // Detect if running in WebContainer environment
    this.isWebContainer = window.location.hostname.includes('webcontainer') || 
                         window.location.hostname.includes('local-credentialless') ||
                         window.location.hostname.includes('stackblitz');
    
    if (!this.isWebContainer) {
      this.initializeTerminalConnection();
    } else {
      console.log('WebContainer environment detected, MT5 Terminal connection disabled');
      this.connectionStatus.isConnected = false;
      this.notifySubscribers('connection', this.connectionStatus);
    }
  }

  private initializeTerminalConnection() {
    const url = this.serverUrl || 'ws://localhost:8765';
    console.log('Initializing MT5 Terminal connection...');
    
    this.terminalConnection = new MT5TerminalConnection(url);
    
    // Forward events from terminal connection
    this.terminalConnection.subscribe('connection', (status: MT5Connection) => {
      this.connectionStatus = status;
      this.notifySubscribers('connection', status);
      
      if (status.isConnected) {
        console.log('✅ MT5 Terminal connected successfully');
        console.log(`Account: ${status.account} | Server: ${status.server}`);
        console.log(`Balance: $${status.balance?.toFixed(2)} | Equity: $${status.equity?.toFixed(2)}`);
      }
    });

    this.terminalConnection.subscribe('tick', (tick: MT5Tick) => {
      this.notifySubscribers('tick', tick);
    });

    this.terminalConnection.subscribe('ohlc', (data: MarketData) => {
      this.notifySubscribers('ohlc', data);
    });

    this.terminalConnection.subscribe('symbols', (symbols: CurrencyPair[]) => {
      console.log(`Received ${symbols.length} symbols from MT5 Terminal`);
      this.notifySubscribers('symbols', symbols);
    });

    this.terminalConnection.subscribe('historical', (data: any) => {
      this.notifySubscribers('historical', data);
    });

    this.terminalConnection.subscribe('error', (error: any) => {
      console.error('MT5 Terminal error:', error);
      this.notifySubscribers('error', error);
    });
  }

  private notifySubscribers(event: string, data: any) {
    const callback = this.subscribers.get(event);
    if (callback) {
      callback(data);
    }
  }

  // Public methods
  subscribe(event: string, callback: (data: any) => void) {
    this.subscribers.set(event, callback);
  }

  unsubscribe(event: string) {
    this.subscribers.delete(event);
  }

  subscribeToSymbol(symbol: string, timeframe: string = 'M1') {
    if (this.terminalConnection && this.connectionStatus.isConnected) {
      console.log(`Subscribing to ${symbol} (${timeframe})`);
      this.terminalConnection.subscribeToSymbol(symbol, timeframe);
    }
  }

  unsubscribeFromSymbol(symbol: string) {
    if (this.terminalConnection && this.connectionStatus.isConnected) {
      console.log(`Unsubscribing from ${symbol}`);
      this.terminalConnection.unsubscribeFromSymbol(symbol);
    }
  }

  getSymbols() {
    if (this.terminalConnection && this.connectionStatus.isConnected) {
      this.terminalConnection.getSymbols();
    }
  }

  getHistoricalData(symbol: string, timeframe: string, count: number = 100) {
    if (this.terminalConnection && this.connectionStatus.isConnected) {
      console.log(`Requesting ${count} bars of ${symbol} ${timeframe} data`);
      this.terminalConnection.getHistoricalData(symbol, timeframe, count);
    }
  }

  getAccountInfo() {
    if (this.terminalConnection && this.connectionStatus.isConnected) {
      this.terminalConnection.getAccountInfo();
    }
  }

  getConnectionStatus(): MT5Connection {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.connectionStatus.isConnected && !this.isWebContainer;
  }

  isDemoMode(): boolean {
    return !this.connectionStatus.isConnected || this.isWebContainer;
  }

  async testConnection(): Promise<boolean> {
    if (this.isWebContainer) {
      return false;
    }
    
    if (this.terminalConnection) {
      return await this.terminalConnection.testConnection();
    }
    
    return false;
  }

  disconnect() {
    if (this.terminalConnection) {
      console.log('Disconnecting from MT5 Terminal');
      this.terminalConnection.disconnect();
      this.terminalConnection = null;
    }
    this.connectionStatus.isConnected = false;
  }

  // Reconnect method
  reconnect() {
    console.log('Attempting to reconnect to MT5 Terminal...');
    this.disconnect();
    setTimeout(() => {
      this.initializeTerminalConnection();
    }, 1000);
  }
}

// Keep the existing DemoDataProvider for fallback
export class DemoDataProvider {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Map<string, (data: any) => void> = new Map();
  private currentPrices: Map<string, number> = new Map();
  private isActive = false;

  constructor() {
    this.initializePrices();
  }

  private initializePrices() {
    const pairs = this.getAvailableSymbols();
    pairs.forEach(pair => {
      let basePrice = 1.0;
      
      // Set realistic base prices for different pairs
      switch (pair.symbol) {
        case 'EURUSD': basePrice = 1.0850; break;
        case 'GBPUSD': basePrice = 1.2650; break;
        case 'USDJPY': basePrice = 149.50; break;
        case 'USDCHF': basePrice = 0.8950; break;
        case 'AUDUSD': basePrice = 0.6750; break;
        case 'USDCAD': basePrice = 1.3650; break;
        case 'NZDUSD': basePrice = 0.6150; break;
        case 'XAUUSD': basePrice = 2050.00; break;
        case 'BTCUSD': basePrice = 43500.00; break;
        case 'US30': basePrice = 37800.00; break;
        default: basePrice = 1.0000;
      }
      
      this.currentPrices.set(pair.symbol, basePrice);
    });
  }

  subscribe(event: string, callback: (data: any) => void) {
    this.subscribers.set(event, callback);
  }

  subscribeToSymbol(symbol: string) {
    if (this.intervals.has(symbol)) return;

    console.log(`Starting demo data feed for ${symbol}`);
    this.isActive = true;

    const interval = setInterval(() => {
      if (this.isActive) {
        const tick = this.generateTick(symbol);
        const callback = this.subscribers.get('tick');
        if (callback) callback(tick);
      }
    }, 1000 + Math.random() * 2000); // Random interval between 1-3 seconds

    this.intervals.set(symbol, interval);
  }

  unsubscribeFromSymbol(symbol: string) {
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
      console.log(`Stopped demo data feed for ${symbol}`);
    }
  }

  private generateTick(symbol: string): MT5Tick {
    const currentPrice = this.currentPrices.get(symbol) || 1.0;
    const volatility = this.getVolatility(symbol);
    
    // Add some trend and momentum to make it more realistic
    const trend = Math.sin(Date.now() / 60000) * 0.3; // Slow trend component
    const momentum = (Math.random() - 0.5) * 2; // Random momentum
    const change = (trend + momentum) * volatility * currentPrice;
    
    const newPrice = Math.max(currentPrice + change, currentPrice * 0.95); // Prevent negative prices
    
    this.currentPrices.set(symbol, newPrice);
    
    const spread = this.getSpread(symbol);
    const bid = newPrice - spread / 2;
    const ask = newPrice + spread / 2;

    return {
      symbol,
      time: Date.now(),
      bid,
      ask,
      last: newPrice,
      volume: Math.floor(Math.random() * 1000) + 100,
      flags: 0
    };
  }

  private getVolatility(symbol: string): number {
    const volatilities: { [key: string]: number } = {
      'EURUSD': 0.0001,
      'GBPUSD': 0.0002,
      'USDJPY': 0.01,
      'USDCHF': 0.0001,
      'AUDUSD': 0.0002,
      'USDCAD': 0.0001,
      'NZDUSD': 0.0002,
      'XAUUSD': 0.5,
      'BTCUSD': 50.0,
      'US30': 5.0
    };
    return volatilities[symbol] || 0.0001;
  }

  private getSpread(symbol: string): number {
    const spreads: { [key: string]: number } = {
      'EURUSD': 0.00015,
      'GBPUSD': 0.0002,
      'USDJPY': 0.015,
      'USDCHF': 0.0002,
      'AUDUSD': 0.0002,
      'USDCAD': 0.0002,
      'NZDUSD': 0.0003,
      'XAUUSD': 0.3,
      'BTCUSD': 10.0,
      'US30': 2.0
    };
    return spreads[symbol] || 0.0002;
  }

  getAvailableSymbols(): CurrencyPair[] {
    return [
      // Major Pairs
      { symbol: 'EURUSD', name: 'Euro vs US Dollar', category: 'major', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'GBPUSD', name: 'British Pound vs US Dollar', category: 'major', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen', category: 'major', digits: 3, pointSize: 0.001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc', category: 'major', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'AUDUSD', name: 'Australian Dollar vs US Dollar', category: 'major', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'USDCAD', name: 'US Dollar vs Canadian Dollar', category: 'major', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'NZDUSD', name: 'New Zealand Dollar vs US Dollar', category: 'major', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      
      // Minor Pairs
      { symbol: 'EURGBP', name: 'Euro vs British Pound', category: 'minor', digits: 5, pointSize: 0.00001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'EURJPY', name: 'Euro vs Japanese Yen', category: 'minor', digits: 3, pointSize: 0.001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'GBPJPY', name: 'British Pound vs Japanese Yen', category: 'minor', digits: 3, pointSize: 0.001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      
      // Commodities
      { symbol: 'XAUUSD', name: 'Gold vs US Dollar', category: 'commodities', digits: 2, pointSize: 0.01, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'XAGUSD', name: 'Silver vs US Dollar', category: 'commodities', digits: 3, pointSize: 0.001, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      
      // Indices
      { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'indices', digits: 1, pointSize: 0.1, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      { symbol: 'SPX500', name: 'S&P 500', category: 'indices', digits: 1, pointSize: 0.1, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      
      // Crypto
      { symbol: 'BTCUSD', name: 'Bitcoin vs US Dollar', category: 'crypto', digits: 2, pointSize: 0.01, minLot: 0.01, maxLot: 10, lotStep: 0.01 },
      { symbol: 'ETHUSD', name: 'Ethereum vs US Dollar', category: 'crypto', digits: 2, pointSize: 0.01, minLot: 0.01, maxLot: 10, lotStep: 0.01 }
    ];
  }

  getConnectionStatus(): MT5Connection {
    return {
      isConnected: false, // Demo mode shows as disconnected from MT5
      server: 'Demo Mode',
      account: 12345678,
      balance: 10000.00,
      equity: 10000.00,
      margin: 0.00,
      freeMargin: 10000.00,
      marginLevel: 0.00,
      lastUpdate: Date.now()
    };
  }

  stop() {
    this.isActive = false;
    this.intervals.forEach((interval, symbol) => {
      clearInterval(interval);
    });
    this.intervals.clear();
  }
}