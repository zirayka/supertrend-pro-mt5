# MT5 File Access Setup Guide

## Problem Solved ✅

Your MT5 Expert Advisor is now writing files to:
```
C:\Users\[Username]\AppData\Roaming\MetaQuotes\Terminal\Common\Files\
```

The web application has been updated to read from this location.

## How It Works

### 1. MT5 Expert Advisor (File Writer)
- Writes JSON files every few seconds
- Files: `tick_data.json`, `account_info.json`, `symbols_list.json`, `ohlc_data.json`
- Location: `Common\Files` folder (accessible to web apps)

### 2. Web Application (File Reader)
- Checks for file updates every 2 seconds
- Tries multiple file paths automatically
- Displays live data from MT5 Terminal

## File Locations Checked

The web app automatically tries these paths:
1. `/api/mt5-files/[filename].json`
2. `/mt5-files/[filename].json` 
3. `/files/[filename].json`
4. `/[filename].json`

## Setting Up File Access

### Option 1: Local Web Server (Recommended)

Create a simple file server to serve MT5 files:

```javascript
// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Path to MT5 Common Files folder
const MT5_FILES_PATH = path.join(
  process.env.APPDATA, 
  'MetaQuotes', 
  'Terminal', 
  'Common', 
  'Files'
);

// Serve MT5 files
app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(MT5_FILES_PATH, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.listen(3001, () => {
  console.log('MT5 File Server running on http://localhost:3001');
  console.log('Serving files from:', MT5_FILES_PATH);
});
```

Run with: `node server.js`

### Option 2: Copy Files to Web Directory

Create a batch script to copy files:

```batch
@echo off
set SOURCE="%APPDATA%\MetaQuotes\Terminal\Common\Files"
set DEST="C:\path\to\your\web\project\public\files"

:loop
copy "%SOURCE%\*.json" "%DEST%\" >nul 2>&1
timeout /t 2 >nul
goto loop
```

### Option 3: Symbolic Link (Advanced)

Create a symbolic link in your web project:

```cmd
mklink /D "C:\path\to\web\project\public\files" "%APPDATA%\MetaQuotes\Terminal\Common\Files"
```

## Testing the Connection

### 1. Check MT5 Files
Navigate to: `%APPDATA%\MetaQuotes\Terminal\Common\Files\`

You should see these files updating:
- ✅ `tick_data.json` - Updates every tick
- ✅ `account_info.json` - Updates every 5 seconds  
- ✅ `symbols_list.json` - Created on startup
- ✅ `ohlc_data.json` - Updates every 5 seconds

### 2. Test File Content
Open `tick_data.json` - should contain:
```json
{"type":"TICK","data":{"symbol":"BTCUSD","time":1703123456,"bid":107652.56,"ask":107677.95,"last":107665.25,"volume":100,"flags":0}}
```

### 3. Test Web Application
1. Open the SuperTrend dashboard
2. Click the "Connection Tester" button (test tube icon)
3. Click "Quick Test"
4. Should show: ✅ File Access: Available

## Connection Status

The web application will show:
- **Mode**: "MT5 Live" (when files are accessible)
- **Status**: Green indicator
- **Data**: Real-time updates from your MT5 Terminal

## Troubleshooting

### Files Not Found
1. **Check MT5 EA is running**: Look for log messages in MT5 Expert tab
2. **Verify file path**: Press 'P' on MT5 chart to see file paths
3. **Check permissions**: Run MT5 as Administrator
4. **Test file writing**: Press 'T' on MT5 chart

### Web App Not Updating
1. **Check browser console**: Look for fetch errors
2. **Verify file server**: Ensure files are accessible via HTTP
3. **Check CORS**: Enable cross-origin requests
4. **Test manually**: Try accessing `http://localhost:3001/files/tick_data.json`

### Performance Issues
1. **Reduce update frequency**: Change `checkInterval` in MT5FileReader
2. **Limit file size**: MT5 EA overwrites files (doesn't append)
3. **Use WebSocket**: For high-frequency trading, WebSocket is better

## Next Steps

1. ✅ **Files are being created** - Your MT5 EA is working
2. ✅ **Web app updated** - Now reads from Common\Files folder  
3. 🔄 **Set up file access** - Choose one of the options above
4. 🎯 **Test connection** - Use the Connection Tester
5. 📊 **Enjoy live data** - SuperTrend dashboard with real MT5 data!

The file-based approach is perfect for local development and provides a reliable fallback when WebSocket connections aren't available.