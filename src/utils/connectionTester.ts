export class ConnectionTester {
  private testResults: Map<string, any> = new Map();

  // Test WebSocket connection manually
  async testWebSocketConnection(url: string, timeout: number = 10000): Promise<{
    success: boolean;
    message: string;
    latency?: number;
    error?: any;
  }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let ws: WebSocket | null = null;
      let resolved = false;
      
      const cleanup = () => {
        if (ws) {
          ws.close();
          ws = null;
        }
      };

      const resolveOnce = (result: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };

      // Set timeout
      const timeoutId = setTimeout(() => {
        resolveOnce({
          success: false,
          message: `Connection timeout after ${timeout}ms`,
          error: 'TIMEOUT'
        });
      }, timeout);

      try {
        console.log(`🔍 Testing WebSocket connection to: ${url}`);
        ws = new WebSocket(url);

        ws.onopen = () => {
          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;
          console.log(`✅ WebSocket connected in ${latency}ms`);
          
          // Send test ping
          ws?.send(JSON.stringify({ command: 'PING', timestamp: Date.now() }));
          
          resolveOnce({
            success: true,
            message: `Connected successfully in ${latency}ms`,
            latency
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Received message:', data);
          } catch (e) {
            console.log('📨 Received raw message:', event.data);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error('❌ WebSocket error:', error);
          resolveOnce({
            success: false,
            message: 'WebSocket connection failed',
            error: error
          });
        };

        ws.onclose = (event) => {
          clearTimeout(timeoutId);
          if (!resolved) {
            console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason}`);
            resolveOnce({
              success: false,
              message: `Connection closed: ${event.code} - ${event.reason || 'Unknown reason'}`,
              error: { code: event.code, reason: event.reason }
            });
          }
        };

      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Failed to create WebSocket:', error);
        resolveOnce({
          success: false,
          message: 'Failed to create WebSocket connection',
          error: error
        });
      }
    });
  }

  // Test multiple connection URLs
  async testMultipleConnections(urls: string[]): Promise<Map<string, any>> {
    const results = new Map();
    
    console.log(`🔍 Testing ${urls.length} connection URLs...`);
    
    for (const url of urls) {
      const result = await this.testWebSocketConnection(url);
      results.set(url, result);
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  // Test MT5 Terminal connection specifically
  async testMT5Connection(): Promise<{
    websocket: any;
    fileAccess: any;
    overall: boolean;
  }> {
    console.log('🔍 Testing MT5 Terminal connection...');
    
    // Test WebSocket connection
    const wsResult = await this.testWebSocketConnection('ws://localhost:8765');
    
    // Test file access (for file-based fallback)
    const fileResult = await this.testFileAccess();
    
    const overall = wsResult.success || fileResult.success;
    
    console.log('📊 MT5 Connection Test Results:');
    console.log('  WebSocket:', wsResult.success ? '✅' : '❌', wsResult.message);
    console.log('  File Access:', fileResult.success ? '✅' : '❌', fileResult.message);
    console.log('  Overall:', overall ? '✅ Connected' : '❌ Not Connected');
    
    return {
      websocket: wsResult,
      fileAccess: fileResult,
      overall
    };
  }

  // Test file-based connection
  async testFileAccess(): Promise<{
    success: boolean;
    message: string;
    files?: string[];
  }> {
    const testFiles = [
      '/api/mt5-files/tick_data.json',
      '/api/mt5-files/account_info.json',
      '/api/mt5-files/symbols_list.json'
    ];
    
    const accessibleFiles: string[] = [];
    
    for (const file of testFiles) {
      try {
        const response = await fetch(file, { method: 'HEAD' });
        if (response.ok) {
          accessibleFiles.push(file);
        }
      } catch (error) {
        // File not accessible
      }
    }
    
    const success = accessibleFiles.length > 0;
    
    return {
      success,
      message: success 
        ? `Found ${accessibleFiles.length} MT5 data files`
        : 'No MT5 data files accessible',
      files: accessibleFiles
    };
  }

  // Continuous connection monitoring
  startConnectionMonitoring(url: string, interval: number = 30000): {
    stop: () => void;
    getStats: () => any;
  } {
    let isRunning = true;
    let stats = {
      totalTests: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageLatency: 0,
      lastTest: null as any,
      uptime: 0
    };
    
    const startTime = Date.now();
    
    const runTest = async () => {
      if (!isRunning) return;
      
      const result = await this.testWebSocketConnection(url, 5000);
      stats.totalTests++;
      stats.lastTest = result;
      stats.uptime = ((Date.now() - startTime) / 1000 / 60).toFixed(1); // minutes
      
      if (result.success) {
        stats.successfulConnections++;
        if (result.latency) {
          stats.averageLatency = (stats.averageLatency + result.latency) / 2;
        }
        console.log(`✅ Connection test ${stats.totalTests}: OK (${result.latency}ms)`);
      } else {
        stats.failedConnections++;
        console.log(`❌ Connection test ${stats.totalTests}: FAILED - ${result.message}`);
      }
      
      // Schedule next test
      if (isRunning) {
        setTimeout(runTest, interval);
      }
    };
    
    // Start first test
    runTest();
    
    return {
      stop: () => {
        isRunning = false;
        console.log('🛑 Connection monitoring stopped');
      },
      getStats: () => ({ ...stats })
    };
  }

  // Network diagnostics
  async runNetworkDiagnostics(): Promise<{
    localhost: boolean;
    internetAccess: boolean;
    dnsResolution: boolean;
    portAccess: any[];
  }> {
    console.log('🔍 Running network diagnostics...');
    
    // Test localhost access
    const localhostTest = await this.testWebSocketConnection('ws://localhost:8080', 3000);
    
    // Test internet access (if available)
    let internetAccess = false;
    try {
      const response = await fetch('https://httpbin.org/get', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      internetAccess = response.ok;
    } catch (error) {
      internetAccess = false;
    }
    
    // Test DNS resolution
    let dnsResolution = false;
    try {
      const response = await fetch('https://google.com', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      dnsResolution = true;
    } catch (error) {
      dnsResolution = false;
    }
    
    // Test common MT5 ports
    const commonPorts = [8765, 8080, 3000, 9090];
    const portTests = [];
    
    for (const port of commonPorts) {
      const result = await this.testWebSocketConnection(`ws://localhost:${port}`, 2000);
      portTests.push({
        port,
        accessible: result.success,
        message: result.message
      });
    }
    
    const results = {
      localhost: localhostTest.success,
      internetAccess,
      dnsResolution,
      portAccess: portTests
    };
    
    console.log('📊 Network Diagnostics Results:');
    console.log('  Localhost:', results.localhost ? '✅' : '❌');
    console.log('  Internet:', results.internetAccess ? '✅' : '❌');
    console.log('  DNS:', results.dnsResolution ? '✅' : '❌');
    console.log('  Port Access:');
    portTests.forEach(test => {
      console.log(`    Port ${test.port}:`, test.accessible ? '✅' : '❌', test.message);
    });
    
    return results;
  }

  // Get connection recommendations
  getConnectionRecommendations(testResults: any): string[] {
    const recommendations: string[] = [];
    
    if (!testResults.websocket?.success) {
      recommendations.push('❌ WebSocket connection failed');
      recommendations.push('💡 Check if MT5 Terminal is running');
      recommendations.push('💡 Verify MT5 Expert Advisor is attached and active');
      recommendations.push('💡 Check Windows Firewall settings for port 8765');
      recommendations.push('💡 Try restarting MT5 Terminal');
    }
    
    if (!testResults.fileAccess?.success) {
      recommendations.push('❌ File-based connection not available');
      recommendations.push('💡 Check if MT5 Expert Advisor is writing data files');
      recommendations.push('💡 Verify file permissions in MT5 data directory');
    }
    
    if (!testResults.overall) {
      recommendations.push('🔄 Falling back to demo mode');
      recommendations.push('📖 See MT5 connection guide for setup instructions');
    } else {
      recommendations.push('✅ Connection established successfully');
    }
    
    return recommendations;
  }
}

// Browser-based testing utilities
export class BrowserConnectionTester {
  // Test from browser console
  static async quickTest(url: string = 'ws://localhost:8765'): Promise<void> {
    console.log(`%c🔍 Quick WebSocket Test`, 'color: blue; font-weight: bold');
    console.log(`Testing: ${url}`);
    
    const ws = new WebSocket(url);
    let connected = false;
    
    ws.onopen = () => {
      connected = true;
      console.log(`%c✅ Connected!`, 'color: green; font-weight: bold');
      ws.send(JSON.stringify({ command: 'PING', test: true }));
    };
    
    ws.onmessage = (event) => {
      console.log(`%c📨 Received:`, 'color: blue', event.data);
    };
    
    ws.onerror = (error) => {
      console.log(`%c❌ Error:`, 'color: red; font-weight: bold', error);
    };
    
    ws.onclose = (event) => {
      if (connected) {
        console.log(`%c🔌 Closed: ${event.code} - ${event.reason}`, 'color: orange');
      } else {
        console.log(`%c❌ Failed to connect: ${event.code} - ${event.reason}`, 'color: red; font-weight: bold');
      }
    };
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 10000);
  }
  
  // Detailed browser test
  static async detailedTest(): Promise<void> {
    console.log(`%c🔍 Detailed Connection Test`, 'color: blue; font-weight: bold');
    
    const tester = new ConnectionTester();
    
    // Test multiple URLs
    const urls = [
      'ws://localhost:8765',
      'ws://127.0.0.1:8765',
      'ws://localhost:8080',
      'ws://localhost:3000'
    ];
    
    const results = await tester.testMultipleConnections(urls);
    
    console.log(`%c📊 Test Results:`, 'color: blue; font-weight: bold');
    results.forEach((result, url) => {
      const status = result.success ? '✅' : '❌';
      const latency = result.latency ? ` (${result.latency}ms)` : '';
      console.log(`${status} ${url}${latency}: ${result.message}`);
    });
    
    // Run network diagnostics
    const diagnostics = await tester.runNetworkDiagnostics();
    console.log(`%c🔧 Network Diagnostics:`, 'color: blue; font-weight: bold');
    console.log('Localhost:', diagnostics.localhost ? '✅' : '❌');
    console.log('Internet:', diagnostics.internetAccess ? '✅' : '❌');
    console.log('DNS:', diagnostics.dnsResolution ? '✅' : '❌');
  }
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testMT5Connection = BrowserConnectionTester.quickTest;
  (window as any).detailedMT5Test = BrowserConnectionTester.detailedTest;
}