# QUICK FIX - 3 Steps to Get Files Working

## Your Issue: Files Not Being Created ❌

Your MT5 EA logs show data being sent, but no JSON files exist. Here's the fix:

## Step 1: Run MT5 as Administrator 👑
1. **Close MT5 completely**
2. **Right-click** `MT5 Terminal64.exe`
3. **Select** "Run as administrator"
4. **Reopen MT5**

## Step 2: Replace Expert Advisor 🔄
1. **Open MetaEditor** (F4)
2. **Open** your `SuperTrendBridge.mq5`
3. **Replace ALL code** with `MT5_EA_FIXED_V2.mq5`
4. **Compile** (F7) - should show 0 errors
5. **Attach to chart**

## Step 3: Test File Creation ✅
1. **Press 'T'** on the chart (test file writing)
2. **Should see**: `✅ File writing test successful!`
3. **Press 'P'** to see file paths
4. **Check folder**: `%APPDATA%\MetaQuotes\Terminal\Common\Files\`

## Expected Results 🎯

### In MT5 Expert Tab:
```
✅ File writing test successful!
Account info sent - Balance: 100.00 | File written: YES
Tick sent for BTCUSD: Bid=107652.56 | File written: YES
Symbols list sent - Total symbols: 1 | File written: YES
```

### In Files Folder:
- ✅ `tick_data.json` (updating every tick)
- ✅ `account_info.json` (updating every 5 seconds)
- ✅ `symbols_list.json` (created once)
- ✅ `ohlc_data.json` (updating every 5 seconds)

## If Still Not Working 🔧

### Try This:
1. **Press 'H'** on chart for help menu
2. **Check error messages** in Expert tab
3. **Try different folder**: Change `UseCommonFolder = false` in EA settings

### Common Errors:
- **Error 5002**: File access denied → Run as Administrator
- **Error 5018**: File operations disabled → Check Expert Advisors settings
- **Error 4103**: File locked → Close other programs using the files

## Success Indicator 🚀

When working correctly, your web application will show:
- **Mode**: "MT5 Live" (instead of "Demo")
- **Status**: Green connection indicator
- **Data**: Real BTCUSD prices from your MT5

The new EA has much better error reporting and will tell you exactly what's preventing file creation! 

**Total time to fix: 2-3 minutes** ⏱️