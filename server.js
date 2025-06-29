#!/usr/bin/env node
/**
 * SuperTrend Pro MT5 - Development Server
 * Node.js implementation for WebContainer compatibility
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '127.0.0.1';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'static')));

// Create necessary directories
const directories = ['logs', 'static/css', 'static/js', 'templates'];
directories.forEach(dir => {
  const fullPath = join(__dirname, dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
});

// Routes
app.get('/', (req, res) => {
  const dashboardPath = join(__dirname, 'templates', 'dashboard.html');
  if (existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SuperTrend Pro MT5 Dashboard</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 600px;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
            font-size: 2.5em;
          }
          .status {
            background: #e8f5e8;
            color: #2d5a2d;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #4caf50;
          }
          .info {
            background: #e3f2fd;
            color: #1565c0;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
          }
          .endpoint {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 SuperTrend Pro MT5</h1>
          <div class="status">
            ✅ Server is running successfully!
          </div>
          <div class="info">
            <h3>📊 Dashboard Status</h3>
            <p>The SuperTrend Pro MT5 Dashboard is now active and ready for trading analysis.</p>
          </div>
          <div class="info">
            <h3>🔗 Available Endpoints</h3>
            <div class="endpoint">GET /api/status - Server status</div>
            <div class="endpoint">GET /api/supertrend - SuperTrend calculations</div>
            <div class="endpoint">WebSocket /ws - Real-time data</div>
          </div>
          <div class="info">
            <h3>💡 Next Steps</h3>
            <p>• Ensure MT5 Terminal is running for live data</p>
            <p>• Check connection status via API endpoints</p>
            <p>• Monitor real-time data through WebSocket</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    server: 'SuperTrend Pro MT5 Dashboard',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/supertrend', (req, res) => {
  // Mock SuperTrend data for demonstration
  const mockData = {
    symbol: 'EURUSD',
    timeframe: 'M15',
    supertrend: {
      value: 1.0850,
      direction: 'bullish',
      atr: 0.0025,
      multiplier: 3.0
    },
    timestamp: new Date().toISOString(),
    status: 'calculated'
  };
  
  res.json(mockData);
});

app.get('/api/docs', (req, res) => {
  res.json({
    title: 'SuperTrend Pro MT5 API',
    version: '2.0.0',
    endpoints: {
      'GET /api/status': 'Get server status',
      'GET /api/supertrend': 'Get SuperTrend calculations',
      'WebSocket /ws': 'Real-time data stream'
    },
    documentation: 'Full API documentation available in docs/ folder'
  });
});

// Start HTTP server
const server = app.listen(PORT, HOST, () => {
  console.log('🚀 SuperTrend Pro MT5 - Node.js Trading Dashboard');
  console.log('=' .repeat(50));
  console.log(`✅ Server running at: http://${HOST}:${PORT}`);
  console.log(`📚 API documentation at: http://${HOST}:${PORT}/api/docs`);
  console.log(`📊 Dashboard available at: http://${HOST}:${PORT}`);
  console.log('');
  console.log('💡 Tips:');
  console.log('   - Server is now running with Node.js for WebContainer compatibility');
  console.log('   - API endpoints are available for integration');
  console.log('   - Press Ctrl+C to stop the server');
  console.log('=' .repeat(50));
});

// WebSocket server for real-time data
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📡 New WebSocket connection established');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to SuperTrend Pro MT5 Dashboard',
    timestamp: new Date().toISOString()
  }));
  
  // Send periodic updates (mock data)
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const mockUpdate = {
        type: 'supertrend_update',
        data: {
          symbol: 'EURUSD',
          price: (1.0800 + Math.random() * 0.0100).toFixed(5),
          supertrend: (1.0850 + Math.random() * 0.0050).toFixed(5),
          direction: Math.random() > 0.5 ? 'bullish' : 'bearish',
          timestamp: new Date().toISOString()
        }
      };
      ws.send(JSON.stringify(mockUpdate));
    }
  }, 5000);
  
  ws.on('close', () => {
    console.log('📡 WebSocket connection closed');
    clearInterval(interval);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(interval);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});