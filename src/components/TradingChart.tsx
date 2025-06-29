import React from 'react';
import { MarketData, SuperTrendResult, MT5Tick } from '../types/trading';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface TradingChartProps {
  data: MarketData[];
  superTrend: SuperTrendResult | null;
  currentTick?: MT5Tick | null;
  symbol: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ 
  data, 
  superTrend, 
  currentTick, 
  symbol 
}) => {
  if (data.length === 0 && !currentTick) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="text-center text-gray-400 py-12">
          <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Waiting for market data...</p>
          <p className="text-sm">Selected pair: {symbol}</p>
        </div>
      </div>
    );
  }

  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const currentPrice = currentTick?.last || latestData?.close || 0;
  const bidPrice = currentTick?.bid || currentPrice;
  const askPrice = currentTick?.ask || currentPrice;
  const spread = askPrice - bidPrice;

  const priceChange = data.length > 1 ? currentPrice - data[data.length - 2].close : 0;
  const priceChangePercent = data.length > 1 ? (priceChange / data[data.length - 2].close) * 100 : 0;

  const formatPrice = (price: number) => {
    // Format based on symbol type
    if (symbol.includes('JPY')) {
      return price.toFixed(3);
    } else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
      return price.toFixed(2);
    } else if (symbol.includes('BTC') || symbol.includes('ETH')) {
      return price.toFixed(2);
    } else if (symbol.includes('US30') || symbol.includes('SPX')) {
      return price.toFixed(1);
    } else {
      return price.toFixed(5);
    }
  };

  const formatSpread = (spread: number) => {
    if (symbol.includes('JPY')) {
      return (spread * 100).toFixed(1);
    } else {
      return (spread * 100000).toFixed(1);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Activity className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-bold text-white">Live Market Data - {symbol}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {formatPrice(currentPrice)}
            </div>
            <div className={`flex items-center ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span>{priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Prices */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Bid</span>
            <div className="text-red-400 font-bold text-lg">{formatPrice(bidPrice)}</div>
          </div>
          <div>
            <span className="text-gray-400">Ask</span>
            <div className="text-emerald-400 font-bold text-lg">{formatPrice(askPrice)}</div>
          </div>
          <div>
            <span className="text-gray-400">Spread</span>
            <div className="text-yellow-400 font-medium">{formatSpread(spread)} pips</div>
          </div>
          <div>
            <span className="text-gray-400">Volume</span>
            <div className="text-white font-medium">
              {currentTick?.volume ? (currentTick.volume / 1000).toFixed(0) + 'K' : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* OHLC Data */}
      {latestData && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-white font-medium mb-3">Current Candle (M1)</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Open</span>
              <div className="text-white font-medium">{formatPrice(latestData.open)}</div>
            </div>
            <div>
              <span className="text-gray-400">High</span>
              <div className="text-emerald-400 font-medium">{formatPrice(latestData.high)}</div>
            </div>
            <div>
              <span className="text-gray-400">Low</span>
              <div className="text-red-400 font-medium">{formatPrice(latestData.low)}</div>
            </div>
            <div>
              <span className="text-gray-400">Close</span>
              <div className="text-white font-medium">{formatPrice(latestData.close)}</div>
            </div>
          </div>
        </div>
      )}

      {/* SuperTrend Levels */}
      {superTrend && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3">SuperTrend Levels</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-400">Support Level</span>
              <div className="text-emerald-400 font-medium">{formatPrice(superTrend.up)}</div>
            </div>
            <div>
              <span className="text-gray-400">Resistance Level</span>
              <div className="text-red-400 font-medium">{formatPrice(superTrend.down)}</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              superTrend.trend === 1 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {superTrend.trend === 1 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {superTrend.trend === 1 ? 'BULLISH TREND' : 'BEARISH TREND'}
            </div>
            
            <div className="text-right">
              <div className="text-gray-400 text-xs">Distance to Trend</div>
              <div className="text-white font-medium">
                {formatPrice(Math.abs(currentPrice - (superTrend.trend === 1 ? superTrend.up : superTrend.down)))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Update Indicator */}
      <div className="flex items-center justify-center mt-4">
        <div className="flex items-center text-xs text-gray-400">
          <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
          Live data updating every second
        </div>
      </div>
    </div>
  );
};