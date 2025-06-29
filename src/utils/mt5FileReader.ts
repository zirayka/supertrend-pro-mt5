import { MarketData, MT5Connection, MT5Tick, CurrencyPair } from '../types/trading';

export class MT5FileReader {
  private subscribers: Map<string, (data: any) => void> = new Map();
  private fileCheckInterval: NodeJS.Timeout | null = null;
  private lastFileModifications: Map<string, number> = new Map();
  private isActive = false;

  constructor(private checkInterval: number = 2000) {
    this.startFileMonitoring();
  }

  private startFileMonitoring() {
    this.isActive = true;
    console.log('Starting MT5 file monitoring...');
    
    this.fileCheckInterval = setInterval(() => {
      this.checkFiles();
    }, this.checkInterval);
  }

  private async checkFiles() {
    if (!this.isActive) return;

    try {
      // Check for tick data
      await this.checkTickData();
      
      // Check for OHLC data
      await this.checkOHLCData();
      
      // Check for account info
      await this.checkAccountInfo();
      
      // Check for symbols list
      await this.checkSymbolsList();
      
    } catch (error) {
      console.error('Error checking MT5 files:', error);
    }
  }

  private async checkTickData() {
    try {
      const response = await fetch('/api/mt5-files/tick_data.json');
      if (response.ok) {
        const lastModified = response.headers.get('last-modified');
        const fileKey = 'tick_data';
        
        if (this.hasFileChanged(fileKey, lastModified)) {
          const data = await response.json();
          if (data && data.type === 'TICK') {
            const tick: MT5Tick = {
              symbol: data.data.symbol,
              time: data.data.time * 1000, // Convert to milliseconds
              bid: data.data.bid,
              ask: data.data.ask,
              last: data.data.last,
              volume: data.data.volume,
              flags: data.data.flags
            };
            
            this.notifySubscribers('tick', tick);
          }
        }
      }
    } catch (error) {
      // File might not exist yet, ignore error
    }
  }

  private async checkOHLCData() {
    try {
      const response = await fetch('/api/mt5-files/ohlc_data.json');
      if (response.ok) {
        const lastModified = response.headers.get('last-modified');
        const fileKey = 'ohlc_data';
        
        if (this.hasFileChanged(fileKey, lastModified)) {
          const data = await response.json();
          if (data && data.type === 'OHLC') {
            const ohlc: MarketData = {
              timestamp: data.data.timestamp * 1000,
              open: data.data.open,
              high: data.data.high,
              low: data.data.low,
              close: data.data.close,
              volume: data.data.volume,
              symbol: data.data.symbol
            };
            
            this.notifySubscribers('ohlc', ohlc);
          }
        }
      }
    } catch (error) {
      // File might not exist yet, ignore error
    }
  }

  private async checkAccountInfo() {
    try {
      const response = await fetch('/api/mt5-files/account_info.json');
      if (response.ok) {
        const lastModified = response.headers.get('last-modified');
        const fileKey = 'account_info';
        
        if (this.hasFileChanged(fileKey, lastModified)) {
          const data = await response.json();
          if (data && data.type === 'ACCOUNT_INFO') {
            const connection: MT5Connection = {
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
            
            this.notifySubscribers('connection', connection);
          }
        }
      }
    } catch (error) {
      // File might not exist yet, ignore error
    }
  }

  private async checkSymbolsList() {
    try {
      const response = await fetch('/api/mt5-files/symbols_list.json');
      if (response.ok) {
        const lastModified = response.headers.get('last-modified');
        const fileKey = 'symbols_list';
        
        if (this.hasFileChanged(fileKey, lastModified)) {
          const data = await response.json();
          if (data && data.type === 'SYMBOLS') {
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
          }
        }
      }
    } catch (error) {
      // File might not exist yet, ignore error
    }
  }

  private hasFileChanged(fileKey: string, lastModified: string | null): boolean {
    if (!lastModified) return false;
    
    const modTime = new Date(lastModified).getTime();
    const lastKnownTime = this.lastFileModifications.get(fileKey) || 0;
    
    if (modTime > lastKnownTime) {
      this.lastFileModifications.set(fileKey, modTime);
      return true;
    }
    
    return false;
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

  stop() {
    this.isActive = false;
    if (this.fileCheckInterval) {
      clearInterval(this.fileCheckInterval);
      this.fileCheckInterval = null;
    }
    console.log('MT5 file monitoring stopped');
  }

  isRunning(): boolean {
    return this.isActive;
  }
}