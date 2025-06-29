import React from 'react';
import { SuperTrendConfig } from '../types/trading';
import { Settings, Filter, TrendingUp } from 'lucide-react';

interface ParameterControlsProps {
  config: SuperTrendConfig;
  onConfigChange: (config: SuperTrendConfig) => void;
}

export const ParameterControls: React.FC<ParameterControlsProps> = ({ config, onConfigChange }) => {
  const updateConfig = (key: keyof SuperTrendConfig, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center mb-6">
        <Settings className="w-5 h-5 text-emerald-400 mr-2" />
        <h2 className="text-xl font-bold text-white">SuperTrend Parameters</h2>
      </div>

      <div className="space-y-6">
        {/* Core Parameters */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="flex items-center text-white font-medium mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400 mr-2" />
            Core Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">ATR Period</label>
              <input
                type="range"
                min="5"
                max="50"
                value={config.periods}
                onChange={(e) => updateConfig('periods', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-white text-sm mt-1">{config.periods}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Multiplier</label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={config.multiplier}
                onChange={(e) => updateConfig('multiplier', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-white text-sm mt-1">{config.multiplier.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* RSI Filter */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center text-white font-medium">
              <Filter className="w-4 h-4 text-blue-400 mr-2" />
              RSI Filter
            </h3>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.useRsiFilter}
                onChange={(e) => updateConfig('useRsiFilter', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-10 h-6 rounded-full transition-colors ${
                config.useRsiFilter ? 'bg-emerald-500' : 'bg-gray-600'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  config.useRsiFilter ? 'translate-x-4' : ''
                }`} />
              </div>
            </label>
          </div>
          
          {config.useRsiFilter && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">RSI Period</label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={config.rsiLength}
                  onChange={(e) => updateConfig('rsiLength', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="text-white text-sm mt-1">{config.rsiLength}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Buy Threshold</label>
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={config.rsiBuyThreshold}
                  onChange={(e) => updateConfig('rsiBuyThreshold', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="text-white text-sm mt-1">{config.rsiBuyThreshold}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Sell Threshold</label>
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={config.rsiSellThreshold}
                  onChange={(e) => updateConfig('rsiSellThreshold', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="text-white text-sm mt-1">{config.rsiSellThreshold}</div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Filters */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-4">Additional Filters</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Volatility Filter</span>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useVolatilityFilter}
                  onChange={(e) => updateConfig('useVolatilityFilter', e.target.checked)}
                  className="sr-only"
                />
                <div className={`relative w-10 h-6 rounded-full transition-colors ${
                  config.useVolatilityFilter ? 'bg-emerald-500' : 'bg-gray-600'
                }`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.useVolatilityFilter ? 'translate-x-4' : ''
                  }`} />
                </div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Higher Timeframe Filter</span>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useHtfFilter}
                  onChange={(e) => updateConfig('useHtfFilter', e.target.checked)}
                  className="sr-only"
                />
                <div className={`relative w-10 h-6 rounded-full transition-colors ${
                  config.useHtfFilter ? 'bg-emerald-500' : 'bg-gray-600'
                }`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.useHtfFilter ? 'translate-x-4' : ''
                  }`} />
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Strong Trend Threshold (%)</label>
              <input
                type="range"
                min="10"
                max="100"
                value={config.strongTrendThreshold}
                onChange={(e) => updateConfig('strongTrendThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="text-white text-sm mt-1">{config.strongTrendThreshold}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};