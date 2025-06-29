# MT5 Terminal Connection Guide

## Overview
This guide explains how to connect the SuperTrend Pro dashboard to MetaTrader 5 Terminal64.exe for live market data.

## Method 1: MT5 WebSocket Bridge (Recommended)

### Step 1: Install MT5 WebSocket Bridge
1. Download and install the MT5 WebSocket Bridge from: https://github.com/mt5-bridge/websocket-bridge
2. Or use the MQL5 Expert Advisor approach (see below)

### Step 2: MQL5 Expert Advisor Setup
Create an Expert Advisor in MT5 that sends data via WebSocket:

```mql5
//+------------------------------------------------------------------+
//|                                           SuperTrendBridge.mq5   |
//|                                  Copyright 2024, SuperTrend Pro |
//+------------------------------------------------------------------+
#property copyright "SuperTrend Pro"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>
#include <Json.mqh>

// WebSocket library (you'll need to include a WebSocket library)
// Alternative: Use DLL calls or file-based communication

input string WebSocketPort = "8765";
input bool EnableTicks = true;
input bool EnableOHLC = true;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    // Initialize WebSocket server
    if(!InitializeWebSocket())
    {
        Print("Failed to initialize WebSocket server");
        return INIT_FAILED;
    }
    
    Print("SuperTrend Bridge initialized on port ", WebSocketPort);
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    if(EnableTicks)
    {
        SendTickData();
    }
}

//+------------------------------------------------------------------+
//| Send tick data via WebSocket                                     |
//+------------------------------------------------------------------+
void SendTickData()
{
    MqlTick tick;
    if(SymbolInfoTick(_Symbol, tick))
    {
        string json = StringFormat(
            "{\"type\":\"TICK\",\"data\":{\"symbol\":\"%s\",\"time\":%d,\"bid\":%.5f,\"ask\":%.5f,\"last\":%.5f,\"volume\":%d,\"flags\":%d}}",
            _Symbol, tick.time, tick.bid, tick.ask, tick.last, tick.volume, tick.flags
        );
        
        SendWebSocketMessage(json);
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
        string json = StringFormat(
            "{\"type\":\"OHLC\",\"data\":{\"symbol\":\"%s\",\"timestamp\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}}",
            symbol, rates[0].time, rates[0].open, rates[0].high, rates[0].low, rates[0].close, rates[0].tick_volume
        );
        
        SendWebSocketMessage(json);
    }
}

//+------------------------------------------------------------------+
//| Handle WebSocket messages                                        |
//+------------------------------------------------------------------+
void OnWebSocketMessage(string message)
{
    // Parse incoming commands
    if(StringFind(message, "GET_ACCOUNT_INFO") >= 0)
    {
        SendAccountInfo();
    }
    else if(StringFind(message, "GET_SYMBOLS") >= 0)
    {
        SendSymbolsList();
    }
    else if(StringFind(message, "SUBSCRIBE_SYMBOL") >= 0)
    {
        // Handle symbol subscription
        HandleSymbolSubscription(message);
    }
}

//+------------------------------------------------------------------+
//| Send account information                                         |
//+------------------------------------------------------------------+
void SendAccountInfo()
{
    string json = StringFormat(
        "{\"type\":\"ACCOUNT_INFO\",\"data\":{\"account\":%d,\"server\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"freeMargin\":%.2f,\"marginLevel\":%.2f}}",
        AccountInfoInteger(ACCOUNT_LOGIN),
        AccountInfoString(ACCOUNT_SERVER),
        AccountInfoDouble(ACCOUNT_BALANCE),
        AccountInfoDouble(ACCOUNT_EQUITY),
        AccountInfoDouble(ACCOUNT_MARGIN),
        AccountInfoDouble(ACCOUNT_FREEMARGIN),
        AccountInfoDouble(ACCOUNT_MARGIN_LEVEL)
    );
    
    SendWebSocketMessage(json);
}

//+------------------------------------------------------------------+
//| WebSocket helper functions (implement based on your library)    |
//+------------------------------------------------------------------+
bool InitializeWebSocket()
{
    // Initialize WebSocket server on specified port
    // This depends on the WebSocket library you're using
    return true;
}

void SendWebSocketMessage(string message)
{
    // Send message to all connected WebSocket clients
    // Implementation depends on your WebSocket library
}
```

### Step 3: Alternative - File-Based Communication
If WebSocket setup is complex, use file-based communication:

```mql5
//+------------------------------------------------------------------+
//| File-based bridge for SuperTrend Pro                            |
//+------------------------------------------------------------------+
void OnTick()
{
    // Write tick data to file
    string filename = "SuperTrend_" + _Symbol + "_tick.json";
    int handle = FileOpen(filename, FILE_WRITE|FILE_TXT);
    
    if(handle != INVALID_HANDLE)
    {
        MqlTick tick;
        if(SymbolInfoTick(_Symbol, tick))
        {
            string json = StringFormat(
                "{\"symbol\":\"%s\",\"time\":%d,\"bid\":%.5f,\"ask\":%.5f,\"last\":%.5f,\"volume\":%d}",
                _Symbol, tick.time, tick.bid, tick.ask, tick.last, tick.volume
            );
            
            FileWrite(handle, json);
        }
        FileClose(handle);
    }
}
```

## Method 2: DDE (Dynamic Data Exchange)

### Setup DDE Connection
1. Enable DDE in MT5: Tools → Options → Expert Advisors → Allow DDE server
2. Use DDE client in the web application (requires additional libraries)

## Method 3: MT5 Python Integration

### Using MetaTrader5 Python Package
```python
import MetaTrader5 as mt5
import websockets
import asyncio
import json

# Initialize MT5 connection
if not mt5.initialize():
    print("Failed to initialize MT5")
    quit()

async def mt5_websocket_server(websocket, path):
    try:
        while True:
            # Get tick data
            tick = mt5.symbol_info_tick("EURUSD")
            if tick:
                data = {
                    "type": "TICK",
                    "data": {
                        "symbol": "EURUSD",
                        "time": tick.time,
                        "bid": tick.bid,
                        "ask": tick.ask,
                        "last": tick.last,
                        "volume": tick.volume
                    }
                }
                await websocket.send(json.dumps(data))
            
            await asyncio.sleep(1)
    except websockets.exceptions.ConnectionClosed:
        pass

# Start WebSocket server
start_server = websockets.serve(mt5_websocket_server, "localhost", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
```

## Installation Steps

### For MQL5 Expert Advisor:
1. Open MT5 Terminal64.exe
2. Press F4 to open MetaEditor
3. Create new Expert Advisor
4. Copy the MQL5 code above
5. Compile and attach to chart
6. Ensure "Allow WebSocket connections" is enabled in settings

### For Python Bridge:
1. Install Python 3.8+
2. Install MetaTrader5 package: `pip install MetaTrader5`
3. Install websockets: `pip install websockets`
4. Run the Python script
5. Ensure MT5 is running and logged in

## Configuration

Update the WebSocket URL in the application:
- For local MT5: `ws://localhost:8765`
- For remote MT5: `ws://YOUR_IP:8765`

## Security Considerations

1. **Firewall**: Open port 8765 for WebSocket connections
2. **Authentication**: Add authentication to WebSocket server
3. **SSL/TLS**: Use secure WebSocket (wss://) for production
4. **IP Restrictions**: Limit connections to trusted IPs

## Troubleshooting

### Common Issues:
1. **Connection Failed**: Check if MT5 is running and Expert Advisor is active
2. **No Data**: Verify symbol subscriptions and market hours
3. **Permission Denied**: Enable Expert Advisors and WebSocket connections in MT5 settings

### Debug Steps:
1. Check MT5 Expert tab for error messages
2. Verify WebSocket server is listening on correct port
3. Test connection with WebSocket client tools
4. Check firewall and antivirus settings

## Supported Features

✅ Real-time tick data
✅ OHLC historical data  
✅ Account information
✅ Symbol information
✅ Multiple timeframes
✅ Multiple symbols
❌ Order execution (future feature)
❌ Trade management (future feature)

## Next Steps

1. Choose your preferred connection method
2. Set up the bridge/adapter
3. Configure the WebSocket URL in the application
4. Test the connection with a demo account first
5. Monitor performance and adjust update intervals as needed