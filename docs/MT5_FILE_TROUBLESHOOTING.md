# MT5 File Creation Troubleshooting Guide

## Problem: EA Logs Show Data Sent But No Files Created

Your MT5 Expert Advisor logs show:
```
Symbols list sent - symbolsJson: {"type":"SYMBOLS","data":[...]}
Tick sent for BTCUSD: Bid=107652.56 Ask=107677.95
Account info sent - Balance: 100.0 Equity: 100.0
```

But no JSON files are being created. Here are the solutions:

## Solution 1: Check File Permissions

### Step 1: Run MT5 as Administrator
1. Close MetaTrader 5 completely
2. Right-click on MT5 Terminal64.exe
3. Select "Run as administrator"
4. Reattach the Expert Advisor

### Step 2: Check Windows File Permissions
1. Navigate to: `C:\Users\[YourUsername]\AppData\Roaming\MetaQuotes\Terminal\[TerminalID]\MQL5\Files\`
2. Right-click on the `Files` folder
3. Select "Properties" → "Security"
4. Ensure your user has "Full control"

## Solution 2: Updated Expert Advisor with Better Error Handling

Replace your current EA with this improved version:

```mql5
//+------------------------------------------------------------------+
//|                                           SuperTrendBridge.mq5   |
//|                                  Copyright 2024, SuperTrend Pro |
//+------------------------------------------------------------------+
#property copyright "SuperTrend Pro"
#property version   "1.01"
#property strict

#include <Trade\Trade.mqh>

// Input parameters
input string WebSocketPort = "8765";
input bool EnableTicks = true;
input bool EnableOHLC = true;
input bool EnableDebug = true;
input bool UseCommonFolder = true; // Use common folder for file access

// Global variables
string subscribedSymbols[];
bool isServerRunning = false;
string dataPath = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    Print("=== SuperTrend Bridge v1.01 Starting ===");
    
    // Determine file path
    if(UseCommonFolder)
    {
        dataPath = "Common\\Files\\";
        Print("Using COMMON folder for file storage");
    }
    else
    {
        dataPath = "";
        Print("Using MQL5\\Files folder for file storage");
    }
    
    // Test file writing capability
    if(!TestFileWriting())
    {
        Print("ERROR: Cannot write files! Check permissions.");
        Print("Try running MT5 as Administrator or enable 'Allow DLL imports'");
        return INIT_FAILED;
    }
    
    // Initialize the bridge
    if(!InitializeBridge())
    {
        Print("ERROR: Failed to initialize SuperTrend Bridge");
        return INIT_FAILED;
    }
    
    Print("SuperTrend Bridge initialized successfully");
    Print("File path: ", dataPath);
    
    // Send initial data
    SendAccountInfo();
    SendSymbolsList();
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Test file writing capability                                     |
//+------------------------------------------------------------------+
bool TestFileWriting()
{
    string testFile = "test_write.txt";
    int flags = FILE_WRITE|FILE_TXT;
    
    if(UseCommonFolder)
        flags |= FILE_COMMON;
    
    int handle = FileOpen(testFile, flags);
    if(handle == INVALID_HANDLE)
    {
        Print("ERROR: Cannot create test file. Error code: ", GetLastError());
        Print("Common folder path: ", TerminalInfoString(TERMINAL_COMMONDATA_PATH));
        Print("Data folder path: ", TerminalInfoString(TERMINAL_DATA_PATH));
        return false;
    }
    
    FileWrite(handle, "Test file creation successful");
    FileClose(handle);
    
    // Clean up test file
    FileDelete(testFile, UseCommonFolder ? FILE_COMMON : 0);
    
    Print("✅ File writing test successful");
    return true;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Print("SuperTrend Bridge shutting down...");
    CleanupBridge();
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    if(EnableTicks && isServerRunning)
    {
        SendTickData(_Symbol);
    }
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
    if(isServerRunning)
    {
        SendAccountInfo();
        
        // Send OHLC data for subscribed symbols
        for(int i = 0; i < ArraySize(subscribedSymbols); i++)
        {
            if(subscribedSymbols[i] != "")
            {
                SendOHLCData(subscribedSymbols[i], PERIOD_M1);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Initialize bridge                                                |
//+------------------------------------------------------------------+
bool InitializeBridge()
{
    EventSetTimer(5); // Update every 5 seconds
    isServerRunning = true;
    
    // Initialize subscribed symbols array
    ArrayResize(subscribedSymbols, 10);
    ArrayInitialize(subscribedSymbols, "");
    
    return true;
}

//+------------------------------------------------------------------+
//| Cleanup bridge                                                   |
//+------------------------------------------------------------------+
void CleanupBridge()
{
    EventKillTimer();
    isServerRunning = false;
}

//+------------------------------------------------------------------+
//| Send tick data                                                   |
//+------------------------------------------------------------------+
void SendTickData(string symbol)
{
    MqlTick tick;
    if(SymbolInfoTick(symbol, tick))
    {
        string json = CreateTickJSON(symbol, tick);
        bool success = WriteToFile("tick_data.json", json);
        
        if(EnableDebug)
        {
            Print("Tick sent for ", symbol, ": Bid=", tick.bid, " Ask=", tick.ask, 
                  " | File written: ", success ? "YES" : "NO");
        }
    }
}

//+------------------------------------------------------------------+
//| Send OHLC data                                                   |
//+------------------------------------------------------------------+
void SendOHLCData(string symbol, ENUM_TIMEFRAMES timeframe)
{
    MqlRates rates[1];
    if(CopyRates(symbol, timeframe, 0, 1, rates) > 0)
    {
        string json = CreateOHLCJSON(symbol, rates[0]);
        bool success = WriteToFile("ohlc_data.json", json);
        
        if(EnableDebug)
        {
            Print("OHLC sent for ", symbol, ": O=", rates[0].open, " H=", rates[0].high, 
                  " L=", rates[0].low, " C=", rates[0].close, " | File written: ", success ? "YES" : "NO");
        }
    }
}

//+------------------------------------------------------------------+
//| Send account information                                         |
//+------------------------------------------------------------------+
void SendAccountInfo()
{
    string json = StringFormat(
        "{\"type\":\"ACCOUNT_INFO\",\"data\":{\"account\":%d,\"server\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"freeMargin\":%.2f,\"marginLevel\":%.2f,\"timestamp\":%d}}",
        (int)AccountInfoInteger(ACCOUNT_LOGIN),
        AccountInfoString(ACCOUNT_SERVER),
        AccountInfoDouble(ACCOUNT_BALANCE),
        AccountInfoDouble(ACCOUNT_EQUITY),
        AccountInfoDouble(ACCOUNT_MARGIN),
        AccountInfoDouble(ACCOUNT_MARGIN_FREE),
        AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),
        (int)TimeCurrent()
    );
    
    bool success = WriteToFile("account_info.json", json);
    
    if(EnableDebug)
    {
        Print("Account info sent - Balance: ", AccountInfoDouble(ACCOUNT_BALANCE), 
              " Equity: ", AccountInfoDouble(ACCOUNT_EQUITY), " | File written: ", success ? "YES" : "NO");
    }
}

//+------------------------------------------------------------------+
//| Send symbols list                                                |
//+------------------------------------------------------------------+
void SendSymbolsList()
{
    string symbolsJson = "{\"type\":\"SYMBOLS\",\"data\":[";
    
    int totalSymbols = SymbolsTotal(true);
    int addedSymbols = 0;
    
    for(int i = 0; i < totalSymbols && addedSymbols < 50; i++)
    {
        string symbolName = SymbolName(i, true);
        if(symbolName != "")
        {
            if(addedSymbols > 0) symbolsJson += ",";
            
            symbolsJson += StringFormat(
                "{\"name\":\"%s\",\"description\":\"%s\",\"digits\":%d,\"volume_min\":%.2f,\"volume_max\":%.2f,\"volume_step\":%.2f,\"spread\":%d}",
                symbolName,
                SymbolInfoString(symbolName, SYMBOL_DESCRIPTION),
                (int)SymbolInfoInteger(symbolName, SYMBOL_DIGITS),
                SymbolInfoDouble(symbolName, SYMBOL_VOLUME_MIN),
                SymbolInfoDouble(symbolName, SYMBOL_VOLUME_MAX),
                SymbolInfoDouble(symbolName, SYMBOL_VOLUME_STEP),
                (int)SymbolInfoInteger(symbolName, SYMBOL_SPREAD)
            );
            
            addedSymbols++;
        }
    }
    
    symbolsJson += "]}";
    bool success = WriteToFile("symbols_list.json", symbolsJson);
    
    if(EnableDebug)
    {
        Print("Symbols list sent - Total symbols: ", addedSymbols, " | File written: ", success ? "YES" : "NO");
        Print("symbolsJson: ", symbolsJson);
    }
}

//+------------------------------------------------------------------+
//| Create tick JSON                                                 |
//+------------------------------------------------------------------+
string CreateTickJSON(string symbol, MqlTick &tick)
{
    return StringFormat(
        "{\"type\":\"TICK\",\"data\":{\"symbol\":\"%s\",\"time\":%d,\"bid\":%.5f,\"ask\":%.5f,\"last\":%.5f,\"volume\":%d,\"flags\":%d}}",
        symbol, 
        (int)tick.time, 
        tick.bid, 
        tick.ask, 
        tick.last, 
        (int)tick.volume, 
        (int)tick.flags
    );
}

//+------------------------------------------------------------------+
//| Create OHLC JSON                                                 |
//+------------------------------------------------------------------+
string CreateOHLCJSON(string symbol, MqlRates &rate)
{
    return StringFormat(
        "{\"type\":\"OHLC\",\"data\":{\"symbol\":\"%s\",\"timestamp\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}}",
        symbol, 
        (int)rate.time, 
        rate.open, 
        rate.high, 
        rate.low, 
        rate.close, 
        (int)rate.tick_volume
    );
}

//+------------------------------------------------------------------+
//| Write data to file with better error handling                   |
//+------------------------------------------------------------------+
bool WriteToFile(string filename, string data)
{
    int flags = FILE_WRITE|FILE_TXT;
    if(UseCommonFolder)
        flags |= FILE_COMMON;
    
    int handle = FileOpen(filename, flags);
    if(handle == INVALID_HANDLE)
    {
        int error = GetLastError();
        Print("ERROR: Could not open file: ", filename, " | Error code: ", error);
        
        // Print helpful error messages
        switch(error)
        {
            case 5002: Print("File not found or access denied"); break;
            case 5004: Print("Cannot open file for writing"); break;
            case 5018: Print("File operations not allowed"); break;
            default: Print("Unknown file error"); break;
        }
        return false;
    }
    
    int bytesWritten = FileWrite(handle, data);
    FileClose(handle);
    
    if(bytesWritten <= 0)
    {
        Print("ERROR: Failed to write data to file: ", filename);
        return false;
    }
    
    return true;
}

//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
    if(id == CHARTEVENT_KEYDOWN)
    {
        if(lparam == 'S') // Press 'S' to send symbols list
        {
            SendSymbolsList();
        }
        else if(lparam == 'A') // Press 'A' to send account info
        {
            SendAccountInfo();
        }
        else if(lparam == 'T') // Press 'T' to test file writing
        {
            TestFileWriting();
        }
        else if(lparam == 'P') // Press 'P' to print file paths
        {
            Print("=== File Path Information ===");
            Print("Common Data Path: ", TerminalInfoString(TERMINAL_COMMONDATA_PATH));
            Print("Data Path: ", TerminalInfoString(TERMINAL_DATA_PATH));
            Print("Using Common Folder: ", UseCommonFolder ? "YES" : "NO");
            Print("Current working directory: ", dataPath);
        }
    }
}
```

## Solution 3: Manual File Location Check

### Check These Locations:

1. **MQL5 Files folder:**
   ```
   C:\Users\[YourUsername]\AppData\Roaming\MetaQuotes\Terminal\[TerminalID]\MQL5\Files\
   ```

2. **Common Files folder:**
   ```
   C:\Users\[YourUsername]\AppData\Roaming\MetaQuotes\Terminal\Common\Files\
   ```

3. **Alternative location (if using different installation):**
   ```
   C:\Program Files\MetaTrader 5\MQL5\Files\
   ```

### Find Your Terminal ID:
1. In MT5, go to **File → Open Data Folder**
2. This opens the correct path for your installation
3. Navigate to `MQL5\Files\` folder

## Solution 4: Enable Required Settings

### In MT5 Terminal:
1. Go to **Tools → Options → Expert Advisors**
2. Enable these settings:
   - ✅ Allow automated trading
   - ✅ Allow DLL imports
   - ✅ Allow imports of external experts
   - ✅ Allow modification of Signals settings

### In MetaEditor:
1. When compiling, ensure no errors
2. Check the **Toolbox → Errors** tab for any warnings

## Solution 5: Test Commands

After updating the EA, test these keyboard shortcuts on the chart:

- **Press 'S'**: Manually send symbols list
- **Press 'A'**: Manually send account info  
- **Press 'T'**: Test file writing capability
- **Press 'P'**: Print file path information

## Expected Output

After fixing the issue, you should see:
```
✅ File writing test successful
Tick sent for BTCUSD: Bid=107652.56 Ask=107677.95 | File written: YES
Account info sent - Balance: 100.0 Equity: 100.0 | File written: YES
Symbols list sent - Total symbols: 1 | File written: YES
```

And these files should be created:
- `tick_data.json`
- `account_info.json` 
- `symbols_list.json`
- `ohlc_data.json`

## If Still Not Working

1. **Check Windows Event Viewer** for any access denied errors
2. **Temporarily disable antivirus** to test if it's blocking file creation
3. **Try a different MT5 installation** or reinstall MT5
4. **Contact your broker** if using a custom MT5 build with restrictions

The updated EA includes much better error reporting and will tell you exactly what's preventing file creation.