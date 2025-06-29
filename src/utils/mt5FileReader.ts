import { MarketData, MT5Connection, MT5Tick, CurrencyPair } from '../types/trading';

export class MT5FileReader {
  private subscribers: Map<string, (data: any) => void> = new Map();
  private fileCheckInterval: NodeJS.Timeout | null = null;
  private lastFileModifications: Map<string, number> = new Map();
  private isActive = false;
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 5;

  constructor(private checkInterval: number = 2000) {
    // Detect if running in WebContainer environment
    const isWebContainer = (
      typeof window !== 'undefined' && (
        window.location.hostname.includes('webcontainer-api.io') ||
        window.location.hostname.includes('.local-credentialless.') ||
        window.location.hostname.includes('stackblitz') ||
        (window as any).__webcontainer__ === true
      )
    );

    if (isWebContainer) {
      console.log('ℹ️ WebContainer detected - MT5 file reading disabled');
      return;
    }

    this.startFileMonitoring();
  }

  private startFileMonitoring() {
    this.isActive = true;
    console.log('🔍 Starting MT5 file monitoring...');
    console.log('📁 Looking for files in Common\\Files folder');
    
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
      
      // Reset error counter on successful check
      this.consecutiveErrors = 0;
      
    } catch (error) {
      this.consecutiveErrors++;
      console.error(`Error checking MT5 files (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error);
      
      // Stop monitoring if too many consecutive errors
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.warn('🛑 Too many consecutive errors, stopping file monitoring');
        this.stop();
      }
    }
  }

  private async checkTickData() {
    const filePaths = [
      'http://localhost:3001/api/mt5-files/tick_data.json',
      'http://localhost:3001/files/tick_data.json',
      'http://localhost:3001/tick_data.json'
    ];

    for (const filePath of filePaths) {
      try {
        const response = await fetch(filePath, { 
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn(`⚠️ Expected JSON but got ${contentType} from ${filePath}`);
            continue;
          }

          const lastModified = response.headers.get('last-modified') || response.headers.get('etag') || Date.now().toString();
          const fileKey = 'tick_data';
          
          if (this.hasFileChanged(fileKey, lastModified)) {
            const text = await response.text();
            
            if (!text || text.trim().length === 0) {
              console.warn('⚠️ Received empty tick data file');
              continue;
            }
            
            // Handle both single JSON object and newline-separated JSON
            const lines = text.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            
            try {
              const data = JSON.parse(lastLine);
              if (data && data.type === 'TICK' && data.data) {
                const tick: MT5Tick = {
                  symbol: data.data.symbol,
                  time: data.data.time * 1000, // Convert to milliseconds
                  bid: data.data.bid,
                  ask: data.data.ask,
                  last: data.data.last,
                  volume: data.data.volume,
                  flags: data.data.flags || 0
                };
                
                console.log(`📊 Tick data received for ${tick.symbol}: ${tick.last}`);
                this.notifySubscribers('tick', tick);
              }
            } catch (parseError) {
              console.warn('Failed to parse tick data JSON:', parseError);
              console.warn('Raw data:', lastLine.substring(0, 100) + '...');
            }
          }
          break; // Found working path
        }
      } catch (error) {
        // Try next path
        continue;
      }
    }
  }

  private async checkOHLCData() {
    const filePaths = [
      'http://localhost:3001/api/mt5-files/ohlc_data.json',
      'http://localhost:3001/files/ohlc_data.json',
      'http://localhost:3001/ohlc_data.json'
    ];

    for (const filePath of filePaths) {
      try {
        const response = await fetch(filePath, { 
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            continue;
          }

          const lastModified = response.headers.get('last-modified') || response.headers.get('etag') || Date.now().toString();
          const fileKey = 'ohlc_data';
          
          if (this.hasFileChanged(fileKey, lastModified)) {
            const text = await response.text();
            
            if (!text || text.trim().length === 0) {
              continue;
            }
            
            const lines = text.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            
            try {
              const data = JSON.parse(lastLine);
              if (data && data.type === 'OHLC' && data.data) {
                const ohlc: MarketData = {
                  timestamp: data.data.timestamp * 1000,
                  open: data.data.open,
                  high: data.data.high,
                  low: data.data.low,
                  close: data.data.close,
                  volume: data.data.volume,
                  symbol: data.data.symbol
                };
                
                console.log(`📈 OHLC data received for ${ohlc.symbol}: ${ohlc.close}`);
                this.notifySubscribers('ohlc', ohlc);
              }
            } catch (parseError) {
              console.warn('Failed to parse OHLC data JSON:', parseError);
            }
          }
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }

  private async checkAccountInfo() {
    const filePaths = [
      'http://localhost:3001/api/mt5-files/account_info.json',
      'http://localhost:3001/files/account_info.json',
      'http://localhost:3001/account_info.json'
    ];

    for (const filePath of filePaths) {
      try {
        const response = await fetch(filePath, { 
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            continue;
          }

          const lastModified = response.headers.get('last-modified') || response.headers.get('etag') || Date.now().toString();
          const fileKey = 'account_info';
          
          if (this.hasFileChanged(fileKey, lastModified)) {
            const text = await response.text();
            
            if (!text || text.trim().length === 0) {
              continue;
            }
            
            const lines = text.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            
            try {
              const data = JSON.parse(lastLine);
              if (data && data.type === 'ACCOUNT_INFO' && data.data) {
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
                
                console.log(`💰 Account info received: Balance $${connection.balance}`);
                this.notifySubscribers('connection', connection);
              }
            } catch (parseError) {
              console.warn('Failed to parse account info JSON:', parseError);
            }
          }
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }

  private async checkSymbolsList() {
    const filePaths = [
      'http://localhost:3001/api/mt5-files/symbols_list.json',
      'http://localhost:3001/files/symbols_list.json',
      'http://localhost:3001/symbols_list.json'
    ];

    for (const filePath of filePaths) {
      try {
        const response = await fetch(filePath, { 
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            continue;
          }

          const lastModified = response.headers.get('last-modified') || response.headers.get('etag') || Date.now().toString();
          const fileKey = 'symbols_list';
          
          if (this.hasFileChanged(fileKey, lastModified)) {
            const text = await response.text();
            
            if (!text || text.trim().length === 0) {
              continue;
            }
            
            const lines = text.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            
            try {
              const data = JSON.parse(lastLine);
              if (data && data.type === 'SYMBOLS' && data.data) {
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
                
                console.log(`📋 Symbols list received: ${symbols.length} symbols`);
                this.notifySubscribers('symbols', symbols);
              }
            } catch (parseError) {
              console.warn('Failed to parse symbols list JSON:', parseError);
            }
          }
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }

  private hasFileChanged(fileKey: string, lastModified: string): boolean {
    const modTime = new Date(lastModified).getTime() || Date.now();
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
    console.log('🛑 MT5 file monitoring stopped');
  }

  isRunning(): boolean {
    return this.isActive;
  }

  // Test file access
  async testFileAccess(): Promise<{
    success: boolean;
    message: string;
    foundFiles: string[];
  }> {
    const testFiles = [
      'tick_data.json',
      'account_info.json', 
      'symbols_list.json',
      'ohlc_data.json'
    ];
    
    const foundFiles: string[] = [];
    
    for (const fileName of testFiles) {
      const filePaths = [
        `http://localhost:3001/api/mt5-files/${fileName}`,
        `http://localhost:3001/files/${fileName}`,
        `http://localhost:3001/${fileName}`
      ];
      
      for (const filePath of filePaths) {
        try {
          const response = await fetch(filePath, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
          });
          if (response.ok) {
            foundFiles.push(filePath);
            break;
          }
        } catch (error) {
          // Continue to next path
        }
      }
    }
    
    const success = foundFiles.length > 0;
    
    return {
      success,
      message: success 
        ? `Found ${foundFiles.length} MT5 data files`
        : 'No MT5 data files accessible. Make sure the MT5 file server is running on port 3001.',
      foundFiles
    };
  }
}