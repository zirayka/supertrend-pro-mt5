import React, { useState } from 'react';
import { TradingSignal } from '../types/trading';
import { Bell, BellRing, Volume2, VolumeX, AlertCircle, CheckCircle } from 'lucide-react';

interface AlertPanelProps {
  signals: TradingSignal[];
  onClearSignals: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ signals, onClearSignals }) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const recentSignals = signals.slice(-5).reverse();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getSignalIcon = (signal: TradingSignal) => {
    if (signal.strength > 75) return <AlertCircle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getSignalBadge = (signal: TradingSignal) => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    if (signal.type === 'buy') {
      return signal.strength > 75 
        ? `${baseClasses} bg-emerald-600 text-white`
        : `${baseClasses} bg-emerald-500/20 text-emerald-400`;
    } else {
      return signal.strength > 75
        ? `${baseClasses} bg-red-600 text-white`
        : `${baseClasses} bg-red-500/20 text-red-400`;
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Bell className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-bold text-white">Trading Alerts</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              alertsEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {alertsEnabled ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Alert Settings */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="text-white font-medium mb-3">Alert Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Sound Notifications</span>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-10 h-6 rounded-full transition-colors ${
                soundEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  soundEnabled ? 'translate-x-4' : ''
                }`} />
              </div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Visual Alerts</span>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-10 h-6 rounded-full transition-colors ${
                alertsEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  alertsEnabled ? 'translate-x-4' : ''
                }`} />
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Recent Signals */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Recent Signals</h3>
          {signals.length > 0 && (
            <button
              onClick={onClearSignals}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {recentSignals.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No signals yet</p>
            <p className="text-sm">Signals will appear here when conditions are met</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSignals.map((signal) => (
              <div key={signal.id} className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={signal.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                      {getSignalIcon(signal)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={getSignalBadge(signal)}>
                          {signal.type.toUpperCase()}
                        </span>
                        <span className="text-white font-medium">${signal.price.toFixed(2)}</span>
                      </div>
                      <div className="text-gray-400 text-sm">
                        Strength: {signal.strength.toFixed(1)}% | Confidence: {signal.confidence.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {formatTime(signal.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};