import { MarketData, MT5Connection, MT5Tick, CurrencyPair } from '../types/trading';

export class MT5TerminalConnection {
  private ws: WebSocket | null = null;
  private connectionStatus: MT5Connection = { isConnected: false };
  private subscribers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private serverUrl: string = 'ws://localhost:8765') {
    this.connect();
  }

  private connect() {
    try {
      console.log(`Connecting to MT5 Terminal at ${this.serverUrl}`);
      this.ws = new WebSocket(this.serverUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.log('MT5 Terminal connection timeout');
          this.ws.close();
        }
      }, 10000); // 10 second timeout

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Connected to MT5 Terminal');
        this.connectionStatus.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifySubscribers('connection', this.connectionStatus);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Request initial data
        this.sendCommand('GET_ACCOUNT_INFO');
        this.sendCommand('GET_SYMBOLS');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing MT5 Terminal message:', error);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`MT5 Terminal connection closed: ${event.code} - ${event.reason}`);
        this.connectionStatus.isConnected = false;
        this.stopHeartbeat();
        this.notifySubscribers('connection', this.connectionStatus);
        
        if (event.code !== 1000) { // Not a normal closure
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('MT5 Terminal WebSocket error:', error);
        this.connectionStatus.isConnected = false;
        this.notifySubscribers('error', {
          message: 'Connection to MT5 Terminal failed',
          error: error
        });
      };

    } catch (error) {
      console.error('Failed to create MT5 Terminal connection:', error);
      this.attemptReconnect();
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendCommand('PING');
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect to MT5 Terminal (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached for MT5 Terminal');
      this.notifySubscribers('error', { 
        message: 'Could not connect to MT5 Terminal. Please check if the bridge is running.',
        code: 'MAX_RECONNECT_ATTEMPTS'
      });
    }
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'PONG':
        // Heartbeat response
        break;

      case 'ACCOUNT_INFO':
        this.connectionStatus = {
          ...this.connectionStatus,
          isConnected: true,
          server: data.data.server,
          account: data.data.account,
          balance: data.data.balance,
          equity: data.data.equity,
          margin: data.data.margin,
          freeMargin: data.data.freeMargin,
          marginLevel: data.data.marginLevel,
          lastUpdate: Date.now()
        };
        this.notifySubscribers('connection', this.connectionStatus);
        break;

      case 'TICK':
        const tick: MT5Tick = {
          symbol: data.data.symbol,
          time: data.data.time * 1000, // Convert to milliseconds
          bid: data.data.bid,
          ask: data.data.ask,
          last: data.data.last,
          volume: data.data.volume,
          flags: data.data.flags || 0
        };
        this.notifySubscribers('tick', tick);
        break;

      case 'OHLC':
        const ohlc: MarketData = {
          timestamp: data.data.timestamp * 1000, // Convert to milliseconds
          open: data.data.open,
          high: data.data.high,
          low: data.data.low,
          close: data.data.close,
          volume: data.data.volume,
          symbol: data.data.symbol
        };
        this.notifySubscribers('ohlc', ohlc);
        break;

      case 'SYMBOLS':
        const symbols: CurrencyPair[] = data.data.map((symbol: any) => ({
          symbol: symbol.name,
          name: symbol.description || symbol.name,
          category: this.categorizeSymbol(symbol.name),
          digits: symbol.digits,
          pointSize: Math.pow(10, -symbol.digits),
          minLot: symbol.volume_min,
          maxLot: symbol.volume_max,
          lotStep: symbol.volume_step,
          spread: symbol.spread
        }));
        this.notifySubscribers('symbols', symbols);
        break;

      case 'HISTORICAL_DATA':
        const historicalData: MarketData[] = data.data.map((bar: any) => ({
          timestamp: bar.time * 1000,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.tick_volume,
          symbol: data.symbol
        }));
        this.notifySubscribers('historical', { symbol: data.symbol, data: historicalData });
        break;

      case 'ERROR':
        console.error('MT5 Terminal Error:', data.message);
        this.notifySubscribers('error', data);
        break;

      default:
        console.log('Unknown MT5 Terminal message type:', data.type);
    }
  }

  private categorizeSymbol(symbol: string): 'major' | 'minor' | 'exotic' | 'crypto' | 'indices' | 'commodities' {
    const majorPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
    const minorPairs = ['EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'GBPCHF', 'GBPAUD'];
    const commodities = ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL'];
    const indices = ['US30', 'SPX500', 'NAS100', 'UK100', 'GER30', 'FRA40', 'JPN225'];
    const crypto = ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD'];

    if (majorPairs.includes(symbol)) return 'major';
    if (minorPairs.includes(symbol)) return 'minor';
    if (commodities.some(c => symbol.includes(c.replace('USD', '')))) return 'commodities';
    if (indices.some(i => symbol.includes(i))) return 'indices';
    if (crypto.some(c => symbol.includes(c.replace('USD', '')))) return 'crypto';
    return 'exotic';
  }

  private sendCommand(command: string, params?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ command, params, timestamp: Date.now() });
      this.ws.send(message);
    } else {
      console.warn('MT5 Terminal WebSocket not connected, command ignored:', command);
    }
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
    this.sendCommand('SUBSCRIBE_SYMBOL', { symbol, timeframe });
  }

  unsubscribeFromSymbol(symbol: string) {
    this.sendCommand('UNSUBSCRIBE_SYMBOL', { symbol });
  }

  getSymbols() {
    this.sendCommand('GET_SYMBOLS');
  }

  getHistoricalData(symbol: string, timeframe: string, count: number = 100) {
    this.sendCommand('GET_HISTORICAL_DATA', { symbol, timeframe, count });
  }

  getAccountInfo() {
    this.sendCommand('GET_ACCOUNT_INFO');
  }

  getConnectionStatus(): MT5Connection {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.connectionStatus.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connectionStatus.isConnected = false;
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        this.unsubscribe('connection_test');
        resolve(false);
      }, 5000);

      this.subscribe('connection_test', (status: MT5Connection) => {
        clearTimeout(timeout);
        this.unsubscribe('connection_test');
        resolve(status.isConnected);
      });

      this.connect();
    });
  }
}

// File-based fallback for when WebSocket is not available
export class MT5FileConnection {
  private fileWatcher: NodeJS.Timeout | null = null;
  private subscribers: Map<string, (data: any) => void> = new Map();
  private isActive = false;

  constructor(private dataDirectory: string = './MT5Data') {
    this.startFileWatcher();
  }

  private startFileWatcher() {
    this.isActive = true;
    this.fileWatcher = setInterval(() => {
      this.checkForUpdates();
    }, 1000);
  }

  private async checkForUpdates() {
    if (!this.isActive) return;

    try {
      // Check for tick data files
      const tickFiles = await this.getTickFiles();
      for (const file of tickFiles) {
        const data = await this.readTickFile(file);
        if (data) {
          this.notifySubscribers('tick', data);
        }
      }
    } catch (error) {
      console.error('Error reading MT5 files:', error);
    }
  }

  private async getTickFiles(): Promise<string[]> {
    // Implementation would depend on file system access
    // This is a placeholder for the file-based approach
    return [];
  }

  private async readTickFile(filename: string): Promise<MT5Tick | null> {
    // Implementation would read and parse the JSON file
    // This is a placeholder for the file-based approach
    return null;
  }

  private notifySubscribers(event: string, data: any) {
    const callback = this.subscribers.get(event);
    if (callback) {
      callback(data);
    }
  }

  subscribe(event: string, callback: (data: any) => void) {
    this.subscribers.set(event, callback);
  }

  stop() {
    this.isActive = false;
    if (this.fileWatcher) {
      clearInterval(this.fileWatcher);
      this.fileWatcher = null;
    }
  }
}