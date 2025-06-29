//+------------------------------------------------------------------+
//|                                           SuperTrendBridge.mq5   |
//|                                  Copyright 2024, SuperTrend Pro |
//+------------------------------------------------------------------+
#property copyright "SuperTrend Pro"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

// Input parameters
input string WebSocketPort = "8765";
input bool EnableTicks = true;
input bool EnableOHLC = true;
input bool EnableDebug = true;

// Global variables
int socketHandle = INVALID_HANDLE;
string subscribedSymbols[];
bool isServerRunning = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    Print("=== SuperTrend Bridge Starting ===");
    
    // Initialize the bridge
    if(!InitializeBridge())
    {
        Print("ERROR: Failed to initialize SuperTrend Bridge");
        return INIT_FAILED;
    }
    
    Print("SuperTrend Bridge initialized successfully");
    Print("Listening for connections...");
    
    // Send initial account info
    SendAccountInfo();
    SendSymbolsList();
    
    return INIT_SUCCEEDED;
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
    // Send periodic updates
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
    // Set timer for periodic updates
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
    
    if(socketHandle != INVALID_HANDLE)
    {
        FileClose(socketHandle);
        socketHandle = INVALID_HANDLE;
    }
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
        WriteToFile("tick_data.json", json);
        
        if(EnableDebug)
        {
            Print("Tick sent for ", symbol, ": Bid=", tick.bid, " Ask=", tick.ask);
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
        WriteToFile("ohlc_data.json", json);
        
        if(EnableDebug)
        {
            Print("OHLC sent for ", symbol, ": O=", rates[0].open, " H=", rates[0].high, 
                  " L=", rates[0].low, " C=", rates[0].close);
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
        AccountInfoDouble(ACCOUNT_MARGIN_FREE), // Fixed: Use ACCOUNT_MARGIN_FREE instead of deprecated ACCOUNT_FREEMARGIN
        AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),
        (int)TimeCurrent()
    );
    
    WriteToFile("account_info.json", json);
    
    if(EnableDebug)
    {
        Print("Account info sent - Balance: ", AccountInfoDouble(ACCOUNT_BALANCE), 
              " Equity: ", AccountInfoDouble(ACCOUNT_EQUITY));
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
    
    for(int i = 0; i < totalSymbols && addedSymbols < 50; i++) // Limit to 50 symbols
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
    WriteToFile("symbols_list.json", symbolsJson);
    
    Print("Symbols list sent - Total symbols: ", addedSymbols);
}

//+------------------------------------------------------------------+
//| Handle symbol subscription                                       |
//+------------------------------------------------------------------+
void HandleSymbolSubscription(string message)
{
    // Simple parsing - look for symbol name in message
    // In a real implementation, you'd parse JSON properly
    
    if(StringFind(message, "EURUSD") >= 0) AddSymbolSubscription("EURUSD");
    else if(StringFind(message, "GBPUSD") >= 0) AddSymbolSubscription("GBPUSD");
    else if(StringFind(message, "USDJPY") >= 0) AddSymbolSubscription("USDJPY");
    else if(StringFind(message, "USDCHF") >= 0) AddSymbolSubscription("USDCHF");
    else if(StringFind(message, "AUDUSD") >= 0) AddSymbolSubscription("AUDUSD");
    else if(StringFind(message, "USDCAD") >= 0) AddSymbolSubscription("USDCAD");
    else if(StringFind(message, "NZDUSD") >= 0) AddSymbolSubscription("NZDUSD");
    else if(StringFind(message, "XAUUSD") >= 0) AddSymbolSubscription("XAUUSD");
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
//| Write data to file                                               |
//+------------------------------------------------------------------+
void WriteToFile(string filename, string data)
{
    int handle = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_COMMON);
    if(handle != INVALID_HANDLE)
    {
        FileWrite(handle, data);
        FileClose(handle);
    }
    else
    {
        Print("ERROR: Could not write to file: ", filename);
    }
}

//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
    // Handle chart events if needed
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
    }
}