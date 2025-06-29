import { MarketData, MT5Connection, MT5Tick, CurrencyPair } from '../types/trading';
import { MT5TerminalConnection } from './mt5TerminalConnection';
import { MT5FileReader } from './mt5FileReader';

export class MT5ConnectionManager {
  private terminalConnection: MT5TerminalConnection | null = null;
  private fileReader: MT5FileReader | null = null;
  private connectionStatus: MT5Connection = { isConnected: false };
  private subscribers: Map<string, (data: any) => void> = new Map();
  private isWebContainer = false;
  private connectionMode: 'websocket' | 'file' | 'demo' = 'demo';
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;

  constructor(private serverUrl?: string) {
    // Detect if running in WebContainer environment
    this.isWebContainer = window.location.hostname.includes('webcontainer') || 
                         window.location.hostname.includes('local-credentialless') ||
                         window.location.hostname.includes('stackblitz');
    
    if (!this.isWebContainer) {
      this.initializeConnections();
    } else {
      console.log('ℹ️ WebContainer environment detected, MT5 Terminal connection disabled');
      this.connectionStatus.isConnected = false;
      this.notifySubscribers('connection', this.connectionStatus);
    }
  }

  private async initializeConnections() {
    console.log('🔍 Initializing MT5 connections...');
    
    // Try WebSocket connection first (but don't wait too long)
    const wsConnected = await this.tryWebSocketConnection();
    
    // If WebSocket fails, try file-based connection
    if (!wsConnected) {
      const fileConnected = await this.tryFileConnection();
      
      if (!fileConnected) {
        console.log('⚠️ No MT5 connection available, staying in demo mode');
        this.connectionMode = 'demo';
      }
    }
  }

  private async tryWebSocketConnection(): Promise<boolean> {
    try {
      console.log('🔌 Attempting WebSocket connection to MT5 Terminal...');
      const url = this.serverUrl || 'ws://localhost:8765';
      
      this.terminalConnection = new MT5TerminalConnection(url);
      
      // Set up event forwarding
      this.setupTerminalConnectionEvents();
      
      // Test connection with shorter timeout for faster fallback
      const connected = await Promise.race([
        this.terminalConnection.testConnection(),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3000)) // 3 second timeout
      ]);
      
      if (connected) {
        console.log('✅ WebSocket connection to MT5 Terminal successful');
        this.connectionMode = 'websocket';
        return true;
      } else {
        console.log('❌ WebSocket connection to MT5 Terminal failed');
        if (this.terminalConnection) {
          this.terminalConnection.disconnect();
          this.terminalConnection = null;
        }
        return false;
      }
    } catch (error) {
      console.log('❌ WebSocket connection error:', error);
      if (this.terminalConnection) {
        this.terminalConnection.disconnect();
        this.terminalConnection = null;
      }
      return false;
    }
  }

  private async tryFileConnection(): Promise<boolean> {
    try {
      console.log('📁 Attempting file-based connection to MT5...');
      
      // First check if file server is running
      const serverCheck = await this.checkFileServer();
      if (!serverCheck) {
        console.log('❌ MT5 file server not running on port 3001');
        console.log('💡 Start the file server with: npm run mt5-server');
        return false;
      }
      
      this.fileReader = new MT5FileReader(2000); // Check every 2 seconds
      
      // Test if files are accessible
      const testResult = await this.fileReader.testFileAccess();
      
      if (testResult.success) {
        console.log('✅ File-based connection to MT5 successful');
        console.log(`📄 Found files: ${testResult.foundFiles.join(', ')}`);
        
        this.connectionMode = 'file';
        this.setupFileReaderEvents();
        
        // Set initial connection status
        this.connectionStatus = {
          isConnected: true,
          server: 'File-based Connection',
          lastUpdate: Date.now()
        };
        this.notifySubscribers('connection', this.connectionStatus);
        
        return true;
      } else {
        console.log('❌ File-based connection failed:', testResult.message);
        if (this.fileReader) {
          this.fileReader.stop();
          this.fileReader = null;
        }
        return false;
      }
    } catch (error) {
      console.log('❌ File-based connection error:', error);
      if (this.fileReader) {
        this.fileReader.stop();
        this.fileReader = null;
      }
      return false;
    }
  }

  private async checkFileServer(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3001/health', {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private setupTerminalConnectionEvents() {
    if (!this.terminalConnection) return;

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

  private setupFileReaderEvents() {
    if (!this.fileReader) return;

    this.fileReader.subscribe('connection', (connection: MT5Connection) => {
      this.connectionStatus = { ...this.connectionStatus, ...connection };
      this.notifySubscribers('connection', this.connectionStatus);
    });

    this.fileReader.subscribe('tick', (tick: MT5Tick) => {
      this.notifySubscribers('tick', tick);
    });

    this.fileReader.subscribe('ohlc', (data: MarketData) => {
      this.notifySubscribers('ohlc', data);
    });

    this.fileReader.subscribe('symbols', (symbols: CurrencyPair[]) => {
      console.log(`Received ${symbols.length} symbols from MT5 files`);
      this.notifySubscribers('symbols', symbols);
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
    if (this.connectionMode === 'websocket' && this.terminalConnection && this.connectionStatus.isConnected) {
      console.log(`Subscribing to ${symbol} (${timeframe}) via WebSocket`);
      this.terminalConnection.subscribeToSymbol(symbol, timeframe);
    } else if (this.connectionMode === 'file') {
      console.log(`Monitoring ${symbol} via file-based connection`);
      // File-based connection automatically monitors all symbols
    }
  }

  unsubscribeFromSymbol(symbol: string) {
    if (this.connectionMode === 'websocket' && this.terminalConnection && this.connectionStatus.isConnected) {
      console.log(`Unsubscribing from ${symbol} via WebSocket`);
      this.terminalConnection.unsubscribeFromSymbol(symbol);
    }
    // File-based connection doesn't need explicit unsubscription
  }

  getSymbols() {
    if (this.connectionMode === 'websocket' && this.terminalConnection && this.connectionStatus.isConnected) {
      this.terminalConnection.getSymbols();
    }
    // File-based connection gets symbols automatically when symbols_list.json is updated
  }

  getHistoricalData(symbol: string, timeframe: string, count: number = 100) {
    if (this.connectionMode === 'websocket' && this.terminalConnection && this.connectionStatus.isConnected) {
      console.log(`Requesting ${count} bars of ${symbol} ${timeframe} data via WebSocket`);
      this.terminalConnection.getHistoricalData(symbol, timeframe, count);
    }
    // File-based connection doesn't support historical data requests
  }

  getAccountInfo() {
    if (this.connectionMode === 'websocket' && this.terminalConnection && this.connectionStatus.isConnected) {
      this.terminalConnection.getAccountInfo();
    }
    // File-based connection gets account info automatically when account_info.json is updated
  }

  getConnectionStatus(): MT5Connection {
    return this.connectionStatus;
  }

  getConnectionMode(): string {
    return this.connectionMode;
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
    
    if (this.connectionMode === 'websocket' && this.terminalConnection) {
      return await this.terminalConnection.testConnection();
    } else if (this.connectionMode === 'file' && this.fileReader) {
      const testResult = await this.fileReader.testFileAccess();
      return testResult.success;
    }
    
    return false;
  }

  disconnect() {
    console.log('Disconnecting from MT5...');
    
    if (this.terminalConnection) {
      this.terminalConnection.disconnect();
      this.terminalConnection = null;
    }
    
    if (this.fileReader) {
      this.fileReader.stop();
      this.fileReader = null;
    }
    
    this.connectionStatus.isConnected = false;
    this.connectionMode = 'demo';
  }

  // Reconnect method
  async reconnect() {
    console.log('Attempting to reconnect to MT5...');
    this.disconnect();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!this.isWebContainer) {
      await this.initializeConnections();
    }
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