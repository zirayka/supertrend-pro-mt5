import React, { useState, useEffect, useCallback } from 'react';
import { SuperTrendCalculator } from './utils/supertrend';
import { MT5ConnectionManager, DemoDataProvider } from './utils/mt5Connection';
import { TradingChart } from './components/TradingChart';
import { ParameterControls } from './components/ParameterControls';
import { TrendAnalysis } from './components/TrendAnalysis';
import { AlertPanel } from './components/AlertPanel';
import { PairSelector } from './components/PairSelector';
import { MT5Status } from './components/MT5Status';
import { MarketData, SuperTrendConfig, SuperTrendResult, TradingSignal, CurrencyPair, MT5Connection, MT5Tick } from './types/trading';
import { BarChart3, Play, Pause, RotateCcw, Settings } from 'lucide-react';

const defaultConfig: SuperTrendConfig = {
  periods: 20,
  multiplier: 2.0,
  changeATR: true,
  showSignals: true,
  highlighting: true,
  rsiLength: 14,
  rsiBuyThreshold: 50,
  rsiSellThreshold: 50,
  useRsiFilter: true,
  useVolatilityFilter: true,
  atrMaLength: 20,
  useHtfFilter: false,
  cooldownBars: 5,
  strongTrendThreshold: 50
};

function App() {
  const [config, setConfig] = useState<SuperTrendConfig>(defaultConfig);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [superTrend, setSuperTrend] = useState<SuperTrendResult | null>(null);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedPair, setSelectedPair] = useState('EURUSD');
  const [availablePairs, setAvailablePairs] = useState<CurrencyPair[]>([]);
  const [mt5Connection, setMT5Connection] = useState<MT5Connection>({ isConnected: false });
  const [currentTick, setCurrentTick] = useState<MT5Tick | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [calculator] = useState(() => new SuperTrendCalculator(config));
  const [mt5Manager] = useState(() => new MT5ConnectionManager());
  const [demoProvider] = useState(() => new DemoDataProvider());

  // Update calculator config when config changes
  useEffect(() => {
    calculator.updateConfig(config);
  }, [config, calculator]);

  // Set up MT5 connection listeners
  useEffect(() => {
    // Try MT5 connection first
    mt5Manager.subscribe('connection', (connection: MT5Connection) => {
      setMT5Connection(connection);
      if (connection.isConnected) {
        mt5Manager.getSymbols();
      } else {
        // Fallback to demo data
        setAvailablePairs(demoProvider.getAvailableSymbols());
        setMT5Connection(demoProvider.getConnectionStatus());
      }
    });

    mt5Manager.subscribe('symbols', (pairs: CurrencyPair[]) => {
      setAvailablePairs(pairs);
    });

    mt5Manager.subscribe('tick', (tick: MT5Tick) => {
      if (tick.symbol === selectedPair) {
        setCurrentTick(tick);
        
        // Convert tick to OHLC data (simplified for real-time)
        const ohlcData: MarketData = {
          timestamp: tick.time,
          open: tick.last,
          high: tick.last,
          low: tick.last,
          close: tick.last,
          volume: tick.volume,
          symbol: tick.symbol,
          bid: tick.bid,
          ask: tick.ask,
          spread: tick.ask - tick.bid
        };
        
        calculator.addData(ohlcData);
        setMarketData(prev => [...prev.slice(-99), ohlcData]);
      }
    });

    mt5Manager.subscribe('ohlc', (data: MarketData) => {
      if (data.symbol === selectedPair) {
        calculator.addData(data);
        setMarketData(prev => [...prev.slice(-99), data]);
      }
    });

    mt5Manager.subscribe('error', (error: any) => {
      console.error('MT5 Error:', error);
      // Fallback to demo mode
      if (availablePairs.length === 0) {
        setAvailablePairs(demoProvider.getAvailableSymbols());
        setMT5Connection(demoProvider.getConnectionStatus());
      }
    });

    // Initialize with demo data if MT5 not available
    setTimeout(() => {
      if (!mt5Connection.isConnected && availablePairs.length === 0) {
        setAvailablePairs(demoProvider.getAvailableSymbols());
        setMT5Connection(demoProvider.getConnectionStatus());
      }
    }, 3000);

    return () => {
      mt5Manager.disconnect();
    };
  }, [mt5Manager, demoProvider, selectedPair, mt5Connection.isConnected, availablePairs.length, calculator]);

  // Handle pair selection
  useEffect(() => {
    calculator.setSymbol(selectedPair);
    setMarketData([]);
    setSuperTrend(null);
    setCurrentTick(null);

    if (mt5Connection.isConnected) {
      // Unsubscribe from previous pair
      mt5Manager.unsubscribeFromSymbol(selectedPair);
      // Subscribe to new pair
      mt5Manager.subscribeToSymbol(selectedPair);
      // Get historical data
      mt5Manager.getHistoricalData(selectedPair, 'M1', 100);
    } else {
      // Use demo provider
      demoProvider.unsubscribeFromSymbol(selectedPair);
      demoProvider.subscribeToSymbol(selectedPair);
    }
  }, [selectedPair, mt5Connection.isConnected, mt5Manager, demoProvider, calculator]);

  // Set up demo data provider if MT5 not connected
  useEffect(() => {
    if (!mt5Connection.isConnected && availablePairs.length > 0) {
      demoProvider.subscribe('tick', (tick: MT5Tick) => {
        if (tick.symbol === selectedPair) {
          setCurrentTick(tick);
          
          const ohlcData: MarketData = {
            timestamp: tick.time,
            open: tick.last,
            high: tick.last,
            low: tick.last,
            close: tick.last,
            volume: tick.volume,
            symbol: tick.symbol,
            bid: tick.bid,
            ask: tick.ask,
            spread: tick.ask - tick.bid
          };
          
          calculator.addData(ohlcData);
          setMarketData(prev => [...prev.slice(-99), ohlcData]);
        }
      });

      demoProvider.subscribeToSymbol(selectedPair);
    }

    return () => {
      if (!mt5Connection.isConnected) {
        demoProvider.unsubscribeFromSymbol(selectedPair);
      }
    };
  }, [mt5Connection.isConnected, availablePairs.length, selectedPair, demoProvider, calculator]);

  // Calculate SuperTrend and generate signals
  useEffect(() => {
    if (marketData.length > 0) {
      const result = calculator.calculate();
      if (result) {
        setSuperTrend(result);
        
        // Generate signals
        if (result.buySignal || result.sellSignal) {
          const signal: TradingSignal = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: marketData[marketData.length - 1].timestamp,
            type: result.buySignal ? 'buy' : 'sell',
            price: marketData[marketData.length - 1].close,
            strength: result.trendStrength,
            confidence: result.strongSignal ? 90 : 70,
            symbol: selectedPair
          };
          
          setSignals(prev => [...prev.slice(-49), signal]);
        }
      }
    }
  }, [marketData, calculator, selectedPair]);

  const handleReset = () => {
    setMarketData([]);
    setSuperTrend(null);
    setSignals([]);
    setCurrentTick(null);
    calculator.setSymbol(selectedPair); // This will clear the calculator's data
  };

  const clearSignals = () => {
    setSignals([]);
  };

  const handleReconnect = () => {
    // Attempt to reconnect to MT5
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-emerald-400 mr-3" />
              <div>
                <h1 className="text-xl font-bold">SuperTrend Pro MT5</h1>
                <p className="text-sm text-gray-400">Live Trading Indicator Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showSettings ? 'bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isRunning 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              
              <button
                onClick={handleReset}
                className="flex items-center px-4 py-2 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Left Column - Chart and Analysis */}
          <div className="xl:col-span-3 space-y-8">
            <TradingChart 
              data={marketData} 
              superTrend={superTrend} 
              currentTick={currentTick}
              symbol={selectedPair}
            />
            <TrendAnalysis superTrend={superTrend} signals={signals} />
          </div>
          
          {/* Right Column - Controls and Status */}
          <div className="space-y-8">
            <PairSelector
              pairs={availablePairs}
              selectedPair={selectedPair}
              onPairSelect={setSelectedPair}
              isConnected={mt5Connection.isConnected}
            />
            
            <MT5Status 
              connection={mt5Connection}
              onReconnect={handleReconnect}
            />
            
            {showSettings && (
              <ParameterControls config={config} onConfigChange={setConfig} />
            )}
            
            <AlertPanel signals={signals} onClearSignals={clearSignals} />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            <span className="text-gray-400">
              Status: <span className={isRunning ? 'text-emerald-400' : 'text-red-400'}>
                {isRunning ? 'Live' : 'Paused'}
              </span>
            </span>
            <span className="text-gray-400">
              Pair: <span className="text-white font-medium">{selectedPair}</span>
            </span>
            <span className="text-gray-400">
              Data Points: <span className="text-white">{marketData.length}</span>
            </span>
            <span className="text-gray-400">
              Signals: <span className="text-white">{signals.length}</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {currentTick && (
              <>
                <span className="text-gray-400">
                  Spread: <span className="text-yellow-400">
                    {((currentTick.ask - currentTick.bid) * (selectedPair.includes('JPY') ? 100 : 100000)).toFixed(1)} pips
                  </span>
                </span>
                <span className="text-gray-400">
                  Last: <span className="text-white font-medium">
                    {selectedPair.includes('JPY') ? currentTick.last.toFixed(3) : 
                     selectedPair.includes('XAU') ? currentTick.last.toFixed(2) :
                     currentTick.last.toFixed(5)}
                  </span>
                </span>
              </>
            )}
            {superTrend && (
              <>
                <span className="text-gray-400">
                  ATR: <span className="text-white">{superTrend.atr.toFixed(selectedPair.includes('JPY') ? 3 : 5)}</span>
                </span>
                <span className="text-gray-400">
                  RSI: <span className={
                    superTrend.rsi > 70 ? 'text-red-400' :
                    superTrend.rsi < 30 ? 'text-emerald-400' : 'text-white'
                  }>{superTrend.rsi.toFixed(1)}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;