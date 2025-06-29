import React from 'react';
import { MT5Connection } from '../types/trading';
import { Wifi, WifiOff, Server, User, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface MT5StatusProps {
  connection: MT5Connection;
  onReconnect?: () => void;
}

export const MT5Status: React.FC<MT5StatusProps> = ({ connection, onReconnect }) => {
  const formatCurrency = (value: number | undefined) => {
    return value ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
  };

  const formatPercentage = (value: number | undefined) => {
    return value ? `${value.toFixed(2)}%` : 'N/A';
  };

  const getMarginLevelColor = (level: number | undefined) => {
    if (!level) return 'text-gray-400';
    if (level < 100) return 'text-red-400';
    if (level < 200) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Server className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-bold text-white">MT5 Connection</h2>
        </div>
        <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
          connection.isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {connection.isConnected ? <Wifi className="w-4 h-4 mr-2" /> : <WifiOff className="w-4 h-4 mr-2" />}
          {connection.isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {connection.isConnected ? (
        <div className="space-y-6">
          {/* Account Information */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="flex items-center text-white font-medium mb-4">
              <User className="w-4 h-4 text-blue-400 mr-2" />
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Server</span>
                <div className="text-white font-medium">{connection.server || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-gray-400">Account</span>
                <div className="text-white font-medium">{connection.account || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Balance Information */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="flex items-center text-white font-medium mb-4">
              <DollarSign className="w-4 h-4 text-emerald-400 mr-2" />
              Balance & Equity
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Balance</span>
                <div className="text-emerald-400 font-bold text-lg">{formatCurrency(connection.balance)}</div>
              </div>
              <div>
                <span className="text-gray-400">Equity</span>
                <div className="text-white font-bold text-lg">{formatCurrency(connection.equity)}</div>
              </div>
              <div>
                <span className="text-gray-400">Free Margin</span>
                <div className="text-blue-400 font-medium">{formatCurrency(connection.freeMargin)}</div>
              </div>
              <div>
                <span className="text-gray-400">Used Margin</span>
                <div className="text-orange-400 font-medium">{formatCurrency(connection.margin)}</div>
              </div>
            </div>
          </div>

          {/* Margin Level */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="flex items-center text-white font-medium mb-4">
              <TrendingUp className="w-4 h-4 text-yellow-400 mr-2" />
              Margin Level
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Current Level</span>
              <div className={`font-bold text-xl ${getMarginLevelColor(connection.marginLevel)}`}>
                {formatPercentage(connection.marginLevel)}
              </div>
            </div>
            
            {connection.marginLevel && connection.marginLevel < 200 && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center text-yellow-400 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {connection.marginLevel < 100 ? 'Margin Call Warning!' : 'Low Margin Level'}
                </div>
              </div>
            )}

            {/* Margin Level Bar */}
            <div className="mt-4">
              <div className="bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    (connection.marginLevel || 0) < 100 ? 'bg-red-400' :
                    (connection.marginLevel || 0) < 200 ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min((connection.marginLevel || 0) / 5, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>100%</span>
                <span>500%+</span>
              </div>
            </div>
          </div>

          {/* Last Update */}
          {connection.lastUpdate && (
            <div className="text-center text-gray-400 text-sm">
              Last updated: {new Date(connection.lastUpdate).toLocaleTimeString()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <WifiOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">Not Connected to MT5</h3>
          <p className="text-gray-400 mb-6">
            Connect to MetaTrader 5 to access live market data and account information.
          </p>
          
          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <h4 className="text-white font-medium mb-3">Connection Instructions:</h4>
            <ol className="text-gray-300 text-sm space-y-2">
              <li>1. Install MT5 WebSocket Bridge</li>
              <li>2. Enable WebSocket server in MT5</li>
              <li>3. Configure connection settings</li>
              <li>4. Restart the application</li>
            </ol>
          </div>

          {onReconnect && (
            <button
              onClick={onReconnect}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Try Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
};