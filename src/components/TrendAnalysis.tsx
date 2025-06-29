import React from 'react';
import { SuperTrendResult, TradingSignal } from '../types/trading';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Zap } from 'lucide-react';

interface TrendAnalysisProps {
  superTrend: SuperTrendResult | null;
  signals: TradingSignal[];
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ superTrend, signals }) => {
  if (!superTrend) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="text-center text-gray-400">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Waiting for market data...</p>
        </div>
      </div>
    );
  }

  const latestSignal = signals[signals.length - 1];
  const bullishSignals = signals.filter(s => s.type === 'buy').length;
  const bearishSignals = signals.filter(s => s.type === 'sell').length;

  const getTrendStrengthColor = (strength: number) => {
    if (strength > 75) return 'text-emerald-400';
    if (strength > 50) return 'text-yellow-400';
    if (strength > 25) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTrendStrengthLabel = (strength: number) => {
    if (strength > 75) return 'Very Strong';
    if (strength > 50) return 'Strong';
    if (strength > 25) return 'Moderate';
    return 'Weak';
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center mb-6">
        <Activity className="w-5 h-5 text-blue-400 mr-2" />
        <h2 className="text-xl font-bold text-white">Trend Analysis</h2>
      </div>

      {/* Current Trend Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Current Trend</h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            superTrend.trend === 1 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {superTrend.trend === 1 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            {superTrend.trend === 1 ? 'BULLISH' : 'BEARISH'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-400 text-sm">Trend Strength</span>
            <div className={`text-lg font-bold ${getTrendStrengthColor(superTrend.trendStrength)}`}>
              {superTrend.trendStrength.toFixed(1)}% - {getTrendStrengthLabel(superTrend.trendStrength)}
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-sm">ATR</span>
            <div className="text-white text-lg font-bold">{superTrend.atr.toFixed(2)}</div>
          </div>
        </div>

        {/* Trend Strength Bar */}
        <div className="mt-4">
          <div className="bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                superTrend.trendStrength > 75 ? 'bg-emerald-400' :
                superTrend.trendStrength > 50 ? 'bg-yellow-400' :
                superTrend.trendStrength > 25 ? 'bg-orange-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(superTrend.trendStrength, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* RSI Analysis */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="text-white font-medium mb-3">RSI Analysis</h3>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Current RSI</span>
          <div className={`font-bold ${
            superTrend.rsi > 70 ? 'text-red-400' :
            superTrend.rsi < 30 ? 'text-emerald-400' : 'text-white'
          }`}>
            {superTrend.rsi.toFixed(1)}
          </div>
        </div>
        
        <div className="mt-3 bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${
              superTrend.rsi > 70 ? 'bg-red-400' :
              superTrend.rsi < 30 ? 'bg-emerald-400' : 'bg-blue-400'
            }`}
            style={{ width: `${superTrend.rsi}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Oversold (30)</span>
          <span>Neutral (50)</span>
          <span>Overbought (70)</span>
        </div>
      </div>

      {/* Signal Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="text-white font-medium mb-3">Signal Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Buy Signal</span>
            <div className="flex items-center">
              {superTrend.buySignal ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Sell Signal</span>
            <div className="flex items-center">
              {superTrend.sellSignal ? (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Strong Signal</span>
            <div className="flex items-center">
              {superTrend.strongSignal ? (
                <Zap className="w-5 h-5 text-yellow-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signal History Summary */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">Signal History</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{signals.length}</div>
            <div className="text-gray-400 text-sm">Total Signals</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">{bullishSignals}</div>
            <div className="text-gray-400 text-sm">Buy Signals</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{bearishSignals}</div>
            <div className="text-gray-400 text-sm">Sell Signals</div>
          </div>
        </div>
        
        {latestSignal && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Latest Signal</span>
              <div className={`flex items-center ${
                latestSignal.type === 'buy' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {latestSignal.type === 'buy' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                <span className="font-medium">{latestSignal.type.toUpperCase()}</span>
                <span className="ml-2 text-sm">@${latestSignal.price.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};