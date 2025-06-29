import React, { useState, useEffect } from 'react';
import { ConnectionTester } from '../utils/connectionTester';
import { Wifi, WifiOff, Play, Square, RefreshCw, CheckCircle, XCircle, AlertCircle, Monitor } from 'lucide-react';

export const ConnectionTester: React.FC = () => {
  const [tester] = useState(() => new ConnectionTester());
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [monitoringStats, setMonitoringStats] = useState<any>(null);

  const runQuickTest = async () => {
    setIsRunning(true);
    try {
      const results = await tester.testMT5Connection();
      setTestResults(results);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const startMonitoring = () => {
    if (monitoring) {
      monitoring.stop();
      setMonitoring(null);
      setMonitoringStats(null);
      return;
    }

    const monitor = tester.startConnectionMonitoring('ws://localhost:8765', 10000);
    setMonitoring(monitor);

    // Update stats every 5 seconds
    const statsInterval = setInterval(() => {
      setMonitoringStats(monitor.getStats());
    }, 5000);

    // Cleanup on unmount
    return () => {
      monitor.stop();
      clearInterval(statsInterval);
    };
  };

  const runNetworkDiagnostics = async () => {
    setIsRunning(true);
    try {
      const diagnostics = await tester.runNetworkDiagnostics();
      setTestResults({ ...testResults, diagnostics });
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean | undefined) => {
    if (success === undefined) return <AlertCircle className="w-5 h-5 text-gray-400" />;
    return success ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />;
  };

  const getStatusColor = (success: boolean | undefined) => {
    if (success === undefined) return 'text-gray-400';
    return success ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Monitor className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-bold text-white">Connection Tester</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={runQuickTest}
            disabled={isRunning}
            className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {isRunning ? 'Testing...' : 'Quick Test'}
          </button>
          <button
            onClick={startMonitoring}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              monitoring 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {monitoring ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {monitoring ? 'Stop Monitor' : 'Start Monitor'}
          </button>
        </div>
      </div>

      {/* Quick Test Results */}
      {testResults && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-white font-medium mb-4">Connection Test Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <span className="text-gray-300">WebSocket Connection</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(testResults.websocket?.success)}
                <span className={getStatusColor(testResults.websocket?.success)}>
                  {testResults.websocket?.success ? 'Connected' : 'Failed'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <span className="text-gray-300">File Access</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(testResults.fileAccess?.success)}
                <span className={getStatusColor(testResults.fileAccess?.success)}>
                  {testResults.fileAccess?.success ? 'Available' : 'Not Available'}
                </span>
              </div>
            </div>
          </div>

          {testResults.websocket?.latency && (
            <div className="text-sm text-gray-400 mb-2">
              Connection latency: {testResults.websocket.latency}ms
            </div>
          )}

          <div className={`text-sm font-medium ${getStatusColor(testResults.overall)}`}>
            Overall Status: {testResults.overall ? '✅ Connected' : '❌ Not Connected'}
          </div>

          {/* Recommendations */}
          {testResults && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <h4 className="text-white font-medium mb-2">Recommendations:</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                {tester.getConnectionRecommendations(testResults).map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Monitoring Stats */}
      {monitoringStats && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-white font-medium mb-4">Live Monitoring</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{monitoringStats.totalTests}</div>
              <div className="text-gray-400 text-sm">Total Tests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{monitoringStats.successfulConnections}</div>
              <div className="text-gray-400 text-sm">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{monitoringStats.failedConnections}</div>
              <div className="text-gray-400 text-sm">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{monitoringStats.averageLatency.toFixed(0)}ms</div>
              <div className="text-gray-400 text-sm">Avg Latency</div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            Uptime: {monitoringStats.uptime} minutes
          </div>

          {monitoringStats.lastTest && (
            <div className="mt-2 text-sm">
              <span className="text-gray-400">Last test: </span>
              <span className={getStatusColor(monitoringStats.lastTest.success)}>
                {monitoringStats.lastTest.message}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Network Diagnostics */}
      {testResults?.diagnostics && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-4">Network Diagnostics</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Localhost Access</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(testResults.diagnostics.localhost)}
                <span className={getStatusColor(testResults.diagnostics.localhost)}>
                  {testResults.diagnostics.localhost ? 'Working' : 'Failed'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Internet Access</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(testResults.diagnostics.internetAccess)}
                <span className={getStatusColor(testResults.diagnostics.internetAccess)}>
                  {testResults.diagnostics.internetAccess ? 'Available' : 'Limited'}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-white font-medium mb-2">Port Accessibility</h4>
              <div className="space-y-2">
                {testResults.diagnostics.portAccess.map((port: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Port {port.port}</span>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(port.accessible)}
                      <span className={getStatusColor(port.accessible)}>
                        {port.accessible ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Testing Instructions */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-white font-medium mb-3">Manual Testing</h3>
        <div className="text-sm text-gray-300 space-y-2">
          <p><strong>Browser Console:</strong></p>
          <code className="block bg-gray-900 p-2 rounded text-emerald-400">
            testMT5Connection('ws://localhost:8765')
          </code>
          <p><strong>Detailed Test:</strong></p>
          <code className="block bg-gray-900 p-2 rounded text-emerald-400">
            detailedMT5Test()
          </code>
          <p className="text-gray-400 text-xs mt-2">
            Open browser developer tools (F12) and run these commands in the console.
          </p>
        </div>
      </div>
    </div>
  );
};