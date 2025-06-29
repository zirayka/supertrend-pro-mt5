//+------------------------------------------------------------------+
//|                                           SuperTrendBridge.mq5   |
//|                                  Copyright 2024, SuperTrend Pro |
//|                                  Version 2.0 - File Creation Fix |
//+------------------------------------------------------------------+
#property copyright "SuperTrend Pro"
#property version   "2.00"
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
    Print("=== SuperTrend Bridge v2.0 Starting ===");
    Print("=== FILE CREATION FIX VERSION ===");
    
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
    
    // Print system information
    PrintSystemInfo();
    
    // Test file writing capability
    if(!TestFileWriting())
    {
        Print("ERROR: Cannot write files! Check permissions.");
        Print("SOLUTION 1: Run MT5 as Administrator");
        Print("SOLUTION 2: Enable 'Allow DLL imports' in Expert Advisors settings");
        Print("SOLUTION 3: Check Windows file permissions");
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
    Print("Press 'T' to test file writing");
    Print("Press 'P' to print file paths");
    Print("Press 'S' to send symbols list");
    Print("Press 'A' to send account info");
    
    // Send initial data
    SendAccountInfo();
    SendSymbolsList();
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Print system information                                         |
//+------------------------------------------------------------------+
void PrintSystemInfo()
{
    Print("=== SYSTEM INFORMATION ===");
    Print("Terminal Company: ", TerminalInfoString(TERMINAL_COMPANY));
    Print("Terminal Name: ", TerminalInfoString(TERMINAL_NAME));
    Print("Terminal Path: ", TerminalInfoString(TERMINAL_PATH));
    Print("Common Data Path: ", TerminalInfoString(TERMINAL_COMMONDATA_PATH));
    Print("Data Path: ", TerminalInfoString(TERMINAL_DATA_PATH));
    Print("Account Server: ", AccountInfoString(ACCOUNT_SERVER));
    Print("Account Number: ", AccountInfoInteger(ACCOUNT_LOGIN));
    Print("=== END SYSTEM INFO ===");
}

//+------------------------------------------------------------------+
//| Test file writing capability                                     |
//+------------------------------------------------------------------+
bool TestFileWriting()
{
    Print("=== TESTING FILE WRITING ===");
    
    string testFile = "test_write_" + IntegerToString(GetTickCount()) + ".txt";
    int flags = FILE_WRITE|FILE_TXT;
    
    if(UseCommonFolder)
        flags |= FILE_COMMON;
    
    Print("Test file: ", testFile);
    Print("Flags: ", flags);
    Print("UseCommonFolder: ", UseCommonFolder);
    
    int handle = FileOpen(testFile, flags);
    if(handle == INVALID_HANDLE)
    {
        int error = GetLastError();
        Print("ERROR: Cannot create test file. Error code: ", error);
        
        // Print detailed error information
        switch(error)
        {
            case 5002: Print("ERROR DETAILS: File not found or access denied"); break;
            case 5004: Print("ERROR DETAILS: Cannot open file for writing"); break;
            case 5018: Print("ERROR DETAILS: File operations not allowed"); break;
            case 4103: Print("ERROR DETAILS: Cannot open file"); break;
            case 4108: Print("ERROR DETAILS: Invalid file name"); break;
            default: Print("ERROR DETAILS: Unknown file error: ", error); break;
        }
        
        Print("TROUBLESHOOTING STEPS:");
        Print("1. Close MT5 completely");
        Print("2. Right-click MT5 Terminal64.exe");
        Print("3. Select 'Run as administrator'");
        Print("4. Reattach this Expert Advisor");
        Print("5. Check Tools->Options->Expert Advisors settings");
        
        return false;
    }
    
    string testData = "Test file creation successful at " + TimeToString(TimeCurrent());
    int bytesWritten = FileWrite(handle, testData);
    FileClose(handle);
    
    if(bytesWritten <= 0)
    {
        Print("ERROR: Failed to write data to test file");
        return false;
    }
    
    Print("✅ File writing test successful!");
    Print("✅ Bytes written: ", bytesWritten);
    Print("✅ Test data: ", testData);
    
    // Clean up test file
    if(FileDelete(testFile, UseCommonFolder ? FILE_COMMON : 0))
    {
        Print("✅ Test file cleaned up successfully");
    }
    else
    {
        Print("⚠️ Could not delete test file (not critical)");
    }
    
    Print("=== FILE WRITING TEST COMPLETE ===");
    return true;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Print("SuperTrend Bridge shutting down...");
    Print("Shutdown reason: ", reason);
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
    
    // Add current symbol to subscriptions
    AddSymbolSubscription(_Symbol);
    
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
            Print("Tick sent for ", symbol, ": Bid=", DoubleToString(tick.bid, 5), 
                  " Ask=", DoubleToString(tick.ask, 5), 
                  " | File written: ", success ? "YES" : "NO");
        }
    }
    else
    {
        if(EnableDebug)
            Print("Failed to get tick for symbol: ", symbol);
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
            Print("OHLC sent for ", symbol, ": O=", DoubleToString(rates[0].open, 5), 
                  " H=", DoubleToString(rates[0].high, 5), 
                  " L=", DoubleToString(rates[0].low, 5), 
                  " C=", DoubleToString(rates[0].close, 5), 
                  " | File written: ", success ? "YES" : "NO");
        }
    }
    else
    {
        if(EnableDebug)
            Print("Failed to get OHLC data for symbol: ", symbol);
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
        Print("Account info sent - Balance: ", DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2), 
              " Equity: ", DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2), 
              " | File written: ", success ? "YES" : "NO");
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
        if(success)
        {
            Print("✅ Symbols JSON created successfully");
        }
        else
        {
            Print("❌ Failed to create symbols JSON file");
        }
    }
}

//+------------------------------------------------------------------+
//| Add symbol subscription                                          |
//+------------------------------------------------------------------+
void AddSymbolSubscription(string symbol)
{
    // Find empty slot or replace existing
    for(int i = 0; i < ArraySize(subscribedSymbols); i++)
    {
        if(subscribedSymbols[i] == "" || subscribedSymbols[i] == symbol)
        {
            subscribedSymbols[i] = symbol;
            Print("Subscribed to symbol: ", symbol);
            return;
        }
    }
    
    Print("Warning: Could not add subscription for ", symbol, " - array full");
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
//| Write data to file with enhanced error handling                 |
//+------------------------------------------------------------------+
bool WriteToFile(string filename, string data)
{
    int flags = FILE_WRITE|FILE_TXT;
    if(UseCommonFolder)
        flags |= FILE_COMMON;
    
    // Add timestamp to make each write unique
    string timestampedData = data + "\n";
    
    int handle = FileOpen(filename, flags);
    if(handle == INVALID_HANDLE)
    {
        int error = GetLastError();
        Print("ERROR: Could not open file: ", filename, " | Error code: ", error);
        
        // Print helpful error messages
        switch(error)
        {
            case 5002: 
                Print("SOLUTION: File access denied - Run MT5 as Administrator"); 
                break;
            case 5004: 
                Print("SOLUTION: Cannot write to file - Check file permissions"); 
                break;
            case 5018: 
                Print("SOLUTION: File operations not allowed - Enable in Expert Advisors settings"); 
                break;
            case 4103:
                Print("SOLUTION: Cannot open file - Check if file is locked by another process");
                break;
            case 4108:
                Print("SOLUTION: Invalid file name - Check filename: ", filename);
                break;
            default: 
                Print("SOLUTION: Unknown error - Try restarting MT5 as Administrator"); 
                break;
        }
        
        // Print current paths for debugging
        Print("DEBUG: Attempting to write to path:");
        if(UseCommonFolder)
        {
            Print("DEBUG: Common folder: ", TerminalInfoString(TERMINAL_COMMONDATA_PATH), "\\Files\\", filename);
        }
        else
        {
            Print("DEBUG: Data folder: ", TerminalInfoString(TERMINAL_DATA_PATH), "\\MQL5\\Files\\", filename);
        }
        
        return false;
    }
    
    int bytesWritten = FileWrite(handle, timestampedData);
    FileClose(handle);
    
    if(bytesWritten <= 0)
    {
        Print("ERROR: Failed to write data to file: ", filename);
        Print("DEBUG: Data length: ", StringLen(data));
        return false;
    }
    
    // Success - only print in debug mode to avoid spam
    if(EnableDebug && filename == "symbols_list.json")
    {
        Print("✅ Successfully wrote ", bytesWritten, " bytes to ", filename);
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
        switch((int)lparam)
        {
            case 'S': // Press 'S' to send symbols list
                Print("=== MANUAL SYMBOLS LIST SEND ===");
                SendSymbolsList();
                break;
                
            case 'A': // Press 'A' to send account info
                Print("=== MANUAL ACCOUNT INFO SEND ===");
                SendAccountInfo();
                break;
                
            case 'T': // Press 'T' to test file writing
                Print("=== MANUAL FILE WRITING TEST ===");
                TestFileWriting();
                break;
                
            case 'P': // Press 'P' to print file paths
                Print("=== FILE PATH INFORMATION ===");
                PrintSystemInfo();
                Print("Using Common Folder: ", UseCommonFolder ? "YES" : "NO");
                Print("Current working directory: ", dataPath);
                if(UseCommonFolder)
                {
                    Print("Full path: ", TerminalInfoString(TERMINAL_COMMONDATA_PATH), "\\Files\\");
                }
                else
                {
                    Print("Full path: ", TerminalInfoString(TERMINAL_DATA_PATH), "\\MQL5\\Files\\");
                }
                break;
                
            case 'D': // Press 'D' to toggle debug mode
                EnableDebug = !EnableDebug;
                Print("Debug mode: ", EnableDebug ? "ENABLED" : "DISABLED");
                break;
                
            case 'H': // Press 'H' for help
                Print("=== KEYBOARD SHORTCUTS ===");
                Print("S = Send symbols list");
                Print("A = Send account info");
                Print("T = Test file writing");
                Print("P = Print file paths");
                Print("D = Toggle debug mode");
                Print("H = Show this help");
                break;
        }
    }
}