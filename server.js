import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: false
}));

// Path to MT5 Common Files folder
const MT5_FILES_PATH = path.join(
  process.env.APPDATA || process.env.HOME, 
  'MetaQuotes', 
  'Terminal', 
  'Common', 
  'Files'
);

console.log('🔍 MT5 Files Path:', MT5_FILES_PATH);

// Check if MT5 files directory exists
if (!fs.existsSync(MT5_FILES_PATH)) {
  console.log('⚠️  MT5 files directory not found. Creating...');
  try {
    fs.mkdirSync(MT5_FILES_PATH, { recursive: true });
    console.log('✅ Created MT5 files directory');
  } catch (error) {
    console.error('❌ Failed to create MT5 files directory:', error.message);
  }
} else {
  console.log('✅ MT5 files directory found');
}

// Middleware to add no-cache headers
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, Expires'
  });
  next();
});

// Serve MT5 files with multiple route patterns
const serveFile = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(MT5_FILES_PATH, filename);
  
  console.log(`📁 Request for: ${filename}`);
  console.log(`📂 Looking in: ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      console.log(`✅ File found: ${filename} (${stats.size} bytes, modified: ${stats.mtime})`);
      
      // Set last-modified header for change detection
      res.set('Last-Modified', stats.mtime.toUTCString());
      res.set('Content-Type', 'application/json');
      
      res.send(fileContent);
    } catch (error) {
      console.error(`❌ Error reading file ${filename}:`, error.message);
      res.status(500).json({ error: 'Failed to read file', details: error.message });
    }
  } else {
    console.log(`❌ File not found: ${filename}`);
    res.status(404).json({ 
      error: 'File not found', 
      filename: filename,
      searchPath: filePath,
      availableFiles: getAvailableFiles()
    });
  }
};

// Helper function to get available files
const getAvailableFiles = () => {
  try {
    return fs.readdirSync(MT5_FILES_PATH)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(MT5_FILES_PATH, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime
        };
      });
  } catch (error) {
    return [];
  }
};

// Multiple route patterns for flexibility
app.get('/api/mt5-files/:filename', serveFile);
app.get('/mt5-files/:filename', serveFile);
app.get('/files/:filename', serveFile);
app.get('/:filename', (req, res, next) => {
  // Only serve .json files on root path
  if (req.params.filename.endsWith('.json')) {
    serveFile(req, res);
  } else {
    next();
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  const availableFiles = getAvailableFiles();
  const status = {
    server: 'MT5 File Server',
    version: '1.0.0',
    mt5FilesPath: MT5_FILES_PATH,
    pathExists: fs.existsSync(MT5_FILES_PATH),
    availableFiles: availableFiles,
    totalFiles: availableFiles.length,
    timestamp: new Date().toISOString()
  };
  
  console.log('📊 Status request:', status);
  res.json(status);
});

// List all available files
app.get('/list', (req, res) => {
  const availableFiles = getAvailableFiles();
  res.json({
    files: availableFiles,
    count: availableFiles.length,
    path: MT5_FILES_PATH
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint with instructions
app.get('/', (req, res) => {
  res.json({
    message: 'MT5 File Server is running',
    endpoints: {
      status: '/status',
      list: '/list',
      health: '/health',
      files: [
        '/api/mt5-files/{filename}',
        '/mt5-files/{filename}',
        '/files/{filename}',
        '/{filename}.json'
      ]
    },
    mt5Files: getAvailableFiles()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 MT5 File Server started successfully!');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${MT5_FILES_PATH}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   Status: http://localhost:${PORT}/status`);
  console.log(`   List files: http://localhost:${PORT}/list`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('🔗 File access patterns:');
  console.log(`   http://localhost:${PORT}/api/mt5-files/tick_data.json`);
  console.log(`   http://localhost:${PORT}/files/account_info.json`);
  console.log(`   http://localhost:${PORT}/symbols_list.json`);
  console.log('');
  
  // Check for existing files
  const availableFiles = getAvailableFiles();
  if (availableFiles.length > 0) {
    console.log('✅ Found existing MT5 files:');
    availableFiles.forEach(file => {
      console.log(`   📄 ${file.name} (${file.size} bytes)`);
    });
  } else {
    console.log('⏳ No MT5 files found yet. Waiting for MT5 Expert Advisor to create them...');
    console.log('💡 Make sure your MT5 Expert Advisor is running and attached to a chart.');
  }
  
  console.log('');
  console.log('🎯 Next steps:');
  console.log('1. Ensure MT5 Terminal is running with SuperTrend Expert Advisor');
  console.log('2. Open your web application');
  console.log('3. Click the Connection Tester to verify file access');
  console.log('4. Enjoy live MT5 data in your dashboard!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MT5 File Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MT5 File Server...');
  process.exit(0);
});