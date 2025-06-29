# Fixed MT5 Expert Advisor Installation Guide

## Compilation Errors Fixed

The following errors have been resolved in the updated Expert Advisor:

1. ✅ **Missing Json.mqh**: Removed dependency on external JSON library
2. ✅ **Undeclared identifiers**: All functions properly declared
3. ✅ **Expression expected**: Fixed string formatting syntax
4. ✅ **ACCOUNT_FREEMARGIN deprecated**: Updated to use `ACCOUNT_MARGIN_FREE`
5. ✅ **Operator expected**: Fixed message parsing syntax

## Installation Steps

### Step 1: Create the Expert Advisor
1. Open MetaTrader 5 Terminal64.exe
2. Press **F4** to open MetaEditor
3. Click **File → New → Expert Advisor (template)**
4. Name it: `SuperTrendBridge`
5. Replace all code with the fixed version above
6. Press **F7** to compile

### Step 2: Configure MT5 Settings
1. Go to **Tools → Options → Expert Advisors**
2. Check these options:
   - ✅ Allow automated trading
   - ✅ Allow DLL imports
   - ✅ Allow imports of external experts
   - ✅ Allow modification of Signals settings

### Step 3: Attach Expert Advisor
1. Open any chart (EURUSD recommended)
2. Drag `SuperTrendBridge` from Navigator to the chart
3. In the settings dialog:
   - **Common tab**: Check "Allow live trading"
   - **Inputs tab**: Configure parameters:
     - `WebSocketPort`: "8765"
     - `EnableTicks`: true
     - `EnableOHLC`: true
     - `EnableDebug`: true
4. Click **OK**

### Step 4: Verify Operation
1. Check the **Expert** tab for messages:
   ```
   SuperTrend Bridge Starting
   SuperTrend Bridge initialized successfully
   Symbols list sent - Total symbols: XX
   Account info sent - Balance: XXXX
   ```

2. Check the **Files** folder in MT5 data directory:
   - `tick_data.json` - Real-time tick data
   - `ohlc_data.json` - OHLC candle data  
   - `account_info.json` - Account information
   - `symbols_list.json` - Available symbols

### Step 5: File Locations
The EA writes data files to:
```
C:\Users\[Username]\AppData\Roaming\MetaQuotes\Terminal\[TerminalID]\MQL5\Files\
```

## How It Works

### File-Based Communication
Since WebSocket setup can be complex, this EA uses file-based communication:

1. **Tick Data**: Updates `tick_data.json` on every tick
2. **OHLC Data**: Updates `ohlc_data.json` every 5 seconds
3. **Account Info**: Updates `account_info.json` every 5 seconds
4. **Symbols**: Creates `symbols_list.json` on startup

### Manual Controls
Press these keys on the chart:
- **S**: Manually send symbols list
- **A**: Manually send account info

### Debug Information
When `EnableDebug = true`, you'll see detailed logs in the Expert tab.

## Troubleshooting

### If Compilation Still Fails:
1. **Check MQL5 Version**: Ensure you have MT5 build 3280 or later
2. **Clean Compile**: Delete `.ex5` files and recompile
3. **Check Permissions**: Run MT5 as administrator if needed

### If EA Doesn't Start:
1. **Check Expert Tab**: Look for error messages
2. **Verify Settings**: Ensure "Allow automated trading" is enabled
3. **Chart Requirements**: EA must be attached to a chart

### If No Data Files Created:
1. **Check File Permissions**: Ensure MT5 can write to Files folder
2. **Verify EA is Running**: Look for smiley face icon on chart
3. **Check Common Folder**: Files are written to Common folder

## Next Steps

1. ✅ Compile and run the fixed EA
2. ✅ Verify data files are being created
3. ✅ Test with the web application
4. 🔄 Optionally upgrade to WebSocket version later

The web application will automatically detect and use the file-based data when MT5 Terminal connection is available.