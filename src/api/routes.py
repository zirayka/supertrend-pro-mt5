"""API routes for the application with enhanced MT5 integration"""

import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse

from src.core.models import (
    SuperTrendConfig, DashboardState, TradingSignal,
    MT5Connection, CurrencyPair, MarketData, MT5Tick
)
from src.services.mt5_connection import MT5ConnectionManager
from src.services.supertrend_calculator import SuperTrendCalculator

logger = logging.getLogger(__name__)

# Create router
api_router = APIRouter()

# Global instances (in a real app, use dependency injection)
mt5_manager: Optional[MT5ConnectionManager] = None
calculator: Optional[SuperTrendCalculator] = None

def get_mt5_manager() -> MT5ConnectionManager:
    """Get MT5 connection manager instance"""
    global mt5_manager
    if mt5_manager is None:
        mt5_manager = MT5ConnectionManager()
    return mt5_manager

def get_calculator() -> SuperTrendCalculator:
    """Get SuperTrend calculator instance"""
    global calculator
    if calculator is None:
        calculator = SuperTrendCalculator(SuperTrendConfig())
    return calculator

@api_router.get("/status")
async def get_status():
    """Get application status"""
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "mt5_package": "MetaTrader5 5.0.45"
    }

@api_router.get("/connection", response_model=MT5Connection)
async def get_connection_status(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Get MT5 connection status"""
    return await mt5.get_connection_status()

@api_router.get("/pairs", response_model=List[CurrencyPair])
async def get_currency_pairs(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Get available currency pairs"""
    return await mt5.get_available_pairs()

@api_router.get("/tick")
async def get_current_tick(
    symbol: str = "EURUSD",
    mt5: MT5ConnectionManager = Depends(get_mt5_manager)
):
    """Get current tick data"""
    tick = await mt5.get_current_tick(symbol)
    if tick:
        return tick.dict()
    return {"error": f"No tick data available for {symbol}"}

@api_router.get("/market-data", response_model=List[MarketData])
async def get_market_data(
    symbol: str = "EURUSD",
    timeframe: str = "M15",
    count: int = 100,
    mt5: MT5ConnectionManager = Depends(get_mt5_manager)
):
    """Get market data"""
    return await mt5.get_market_data(symbol, timeframe, count)

@api_router.get("/positions")
async def get_positions(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Get open positions"""
    return await mt5.get_positions()

@api_router.get("/orders")
async def get_orders(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Get pending orders"""
    return await mt5.get_orders()

@api_router.post("/order")
async def place_order(
    symbol: str,
    order_type: str,
    volume: float,
    price: Optional[float] = None,
    sl: Optional[float] = None,
    tp: Optional[float] = None,
    comment: str = "",
    mt5: MT5ConnectionManager = Depends(get_mt5_manager)
):
    """Place a trading order"""
    try:
        result = await mt5.place_order(symbol, order_type, volume, price, sl, tp, comment)
        return result
    except Exception as e:
        logger.error(f"Error placing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/config")
async def update_config(
    config: SuperTrendConfig,
    calc: SuperTrendCalculator = Depends(get_calculator)
):
    """Update SuperTrend configuration"""
    try:
        calc.update_config(config)
        return {"status": "success", "message": "Configuration updated"}
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/config", response_model=SuperTrendConfig)
async def get_config(calc: SuperTrendCalculator = Depends(get_calculator)):
    """Get current SuperTrend configuration"""
    return calc.config

@api_router.post("/calculate")
async def calculate_supertrend(
    symbol: str,
    timeframe: str = "M15",
    calc: SuperTrendCalculator = Depends(get_calculator),
    mt5: MT5ConnectionManager = Depends(get_mt5_manager)
):
    """Calculate SuperTrend for given symbol"""
    try:
        # Set symbol and add market data
        calc.set_symbol(symbol)
        
        # Get market data for the symbol
        market_data = await mt5.get_market_data(symbol, timeframe, 100)
        
        # Add data to calculator
        for data_point in market_data:
            calc.add_data(data_point)
        
        # Calculate SuperTrend
        result = calc.calculate()
        
        if result is None:
            return {"status": "insufficient_data", "message": "Not enough data for calculation"}
        
        return {
            "status": "success",
            "result": result.dict(),
            "symbol": symbol,
            "timeframe": timeframe,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error calculating SuperTrend: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/test-connection")
async def test_connection(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Test MT5 connection"""
    try:
        connection = await mt5.get_connection_status()
        
        test_results = {
            "direct_mt5": {
                "success": connection.connection_type == "direct",
                "message": "Direct MT5 connection active" if connection.connection_type == "direct" else "Direct MT5 not available"
            },
            "websocket": {
                "success": connection.connection_type == "websocket",
                "message": "WebSocket connection active" if connection.connection_type == "websocket" else "WebSocket not available"
            },
            "file_access": {
                "success": connection.connection_type == "file",
                "message": "File access available" if connection.connection_type == "file" else "File access not available"
            },
            "overall": connection.is_connected
        }
        
        # Additional tests for direct connection
        if connection.connection_type == "direct":
            try:
                # Test getting tick data
                tick = await mt5.get_current_tick("EURUSD")
                test_results["tick_data"] = {
                    "success": tick is not None,
                    "message": f"Tick data available: {tick.symbol if tick else 'None'}"
                }
                
                # Test getting pairs
                pairs = await mt5.get_available_pairs()
                test_results["pairs_data"] = {
                    "success": len(pairs) > 0,
                    "message": f"Available pairs: {len(pairs)}"
                }
                
                # Test getting positions
                positions = await mt5.get_positions()
                test_results["positions_data"] = {
                    "success": True,
                    "message": f"Open positions: {len(positions)}"
                }
                
            except Exception as e:
                test_results["direct_mt5_detailed"] = {
                    "success": False,
                    "message": f"Error in detailed tests: {str(e)}"
                }
        
        return {
            "status": "success",
            "results": test_results,
            "connection_type": connection.connection_type,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/dashboard-state", response_model=DashboardState)
async def get_dashboard_state(
    mt5: MT5ConnectionManager = Depends(get_mt5_manager),
    calc: SuperTrendCalculator = Depends(get_calculator)
):
    """Get complete dashboard state"""
    try:
        connection = await mt5.get_connection_status()
        pairs = await mt5.get_available_pairs()
        market_data = await mt5.get_market_data("EURUSD", "M15", 100)
        
        state = DashboardState(
            selected_pair=calc.get_current_symbol() or "EURUSD",
            is_running=True,
            config=calc.config,
            connection=connection,
            available_pairs=pairs,
            signals=[],  # TODO: Implement signal storage
            market_data=market_data[-100:]  # Last 100 candles
        )
        
        return state
        
    except Exception as e:
        logger.error(f"Error getting dashboard state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/reconnect")
async def reconnect_mt5(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Reconnect to MT5"""
    try:
        await mt5.initialize()
        connection = await mt5.get_connection_status()
        
        return {
            "status": "success",
            "message": "Reconnection attempted",
            "connected": connection.is_connected,
            "connection_type": connection.connection_type,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error reconnecting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/account-summary")
async def get_account_summary(mt5: MT5ConnectionManager = Depends(get_mt5_manager)):
    """Get comprehensive account summary"""
    try:
        connection = await mt5.get_connection_status()
        positions = await mt5.get_positions()
        orders = await mt5.get_orders()
        
        # Calculate summary statistics
        total_profit = sum(pos.get('profit', 0) for pos in positions)
        total_volume = sum(pos.get('volume', 0) for pos in positions)
        
        return {
            "account": {
                "login": connection.account,
                "server": connection.server,
                "balance": connection.balance,
                "equity": connection.equity,
                "margin": connection.margin,
                "free_margin": connection.free_margin,
                "margin_level": connection.margin_level
            },
            "trading": {
                "open_positions": len(positions),
                "pending_orders": len(orders),
                "total_profit": total_profit,
                "total_volume": total_volume
            },
            "positions": positions,
            "orders": orders,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting account summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))