# MT5 File Server Setup - Option A

## Quick Start

### 1. Install Dependencies
```bash
npm install express cors
```

### 2. Start the MT5 File Server
```bash
npm run mt5-server
```
Or double-click: `start-mt5-server.bat`

### 3. Start Your Web Application
```bash
npm run dev
```

## How It Works

### MT5 Expert Advisor → File Server → Web App

1. **MT5 EA writes files** to: `%APPDATA%\MetaQuotes\Terminal\Common\Files\`
2. **File server serves files** from: `http://localhost:3001/files/`
3. **Web app reads files** via HTTP requests every 2 seconds

## File Server Features

✅ **Auto-discovery**: Finds MT5 files automatically  
✅ **CORS enabled**: Works with web applications  
✅ **No caching**: Always serves fresh data  
✅ **Multiple routes**: Flexible file access patterns  
✅ **Error handling**: Detailed error messages  
✅ **Status monitoring**: Check server health  

## Available Endpoints

- **Status**: `http://localhost:3001/status`
- **List files**: `http://localhost:3001/list`
- **Health check**: `http://localhost:3001/health`

### File Access Patterns:
- `http://localhost:3001/api/mt5-files/tick_data.json`
- `http://localhost:3001/files/account_info.json`
- `http://localhost:3001/symbols_list.json`

## Testing the Setup

### 1. Check MT5 Files
Navigate to: `%APPDATA%\MetaQuotes\Terminal\Common\Files\`

Should see:
- ✅ `tick_data.json`
- ✅ `account_info.json`
- ✅ `symbols_list.json`
- ✅ `ohlc_data.json`

### 2. Test File Server
Open: `http://localhost:3001/status`

Should show:
```json
{
  "server": "MT5 File Server",
  "pathExists": true,
  "availableFiles": [...],
  "totalFiles": 4
}
```

### 3. Test Web Application
1. Open SuperTrend dashboard
2. Click "Connection Tester" (test tube icon)
3. Click "Quick Test"
4. Should show: ✅ File Access: Available

## Troubleshooting

### Server Won't Start
```bash
# Check if port 3001 is in use
netstat -an | findstr :3001

# Kill process using port 3001
taskkill /f /pid [PID]
```

### Files Not Found
1. **Check MT5 EA logs**: Look for "File written: YES"
2. **Verify file path**: Press 'P' on MT5 chart
3. **Run as admin**: Start MT5 as Administrator
4. **Check permissions**: Ensure write access to Common\Files

### CORS Issues
- File server has CORS enabled by default
- If issues persist, check browser console for errors

### Connection Failed
1. **Restart file server**: Stop with Ctrl+C, restart
2. **Check firewall**: Allow Node.js through Windows Firewall
3. **Try different port**: Change PORT in server.js

## Production Notes

- **Security**: This server is for local development only
- **Performance**: Suitable for real-time trading data
- **Scalability**: For multiple users, consider WebSocket approach
- **Monitoring**: Check `/health` endpoint for uptime monitoring

## Next Steps

1. ✅ **Start file server**: `npm run mt5-server`
2. ✅ **Start web app**: `npm run dev`
3. 🎯 **Test connection**: Use Connection Tester
4. 📊 **Enjoy live data**: Real MT5 data in your dashboard!

The file server provides a reliable bridge between your MT5 Terminal and the web application, ensuring you get real-time market data for your SuperTrend analysis.