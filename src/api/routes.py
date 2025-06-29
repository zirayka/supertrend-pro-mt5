"""API routes for the application with direct MT5 integration only - Fixed calculator initialization"""

import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.core.models import (
    SuperTrendConfig, DashboardState, TradingSignal,
    MT5Connection, CurrencyPair, MarketData, MT5Tick
)
from src.services.supertrend_calculator import SuperTrendCalculator

logger = logging.getLogger(__name__)

# Create router
api_router = APIRouter()

# Global instances - will be injected from main.py
_mt5_manager = None
_calculator = None

# Request models for API endpoints
class SuperTrendRequest(BaseModel):
    symbol: str
    timeframe: str = "M15"
    periods: Optional[int] = None
    multiplier: Optional[float] = None

def set_mt5_manager(manager):
    """Set the global MT5 manager instance (called from main.py)"""
    global _mt5_manager
    _mt5_manager = manager
    logger.info("✅ MT5 manager instance set in API routes")

def set_calculator(calc):
    """Set the global calculator instance (called from main.py)"""
    global _calculator
    _calculator = calc
    logger.info("✅ Calculator instance set in API routes")

def get_mt5_manager():
    """Get MT5 connection manager instance"""
    if _mt5_manager is None:
        logger.error("❌ MT5 manager not initialized in API routes!")
        raise HTTPException(status_code=500, detail="MT5 manager not available")
    return _mt5_manager

def get_calculator():
    """Get SuperTrend calculator instance with proper initialization"""
    global _calculator
    if _calculator is None:
        logger.info("🔄 Creating new calculator instance...")
        from src.services.supertrend_calculator import SuperTrendCalculator
        from src.core.models import SuperTrendConfig
        _calculator = SuperTrendCalculator(SuperTrendConfig())
        logger.info("✅ Created new calculator instance")
    return _calculator

@api_router.get("/status")
async def get_status():
    """Get application status"""
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "connection_mode": "MT5 Direct Only",
        "mt5_package": "MetaTrader5 5.0.45",
        "mt5_manager_available": _mt5_manager is not None,
        "calculator_available": _calculator is not None
    }

@api_router.get("/connection", response_model=MT5Connection)
async def get_connection_status():
    """Get MT5 connection status"""
    try:
        mt5 = get_mt5_manager()
        logger.debug("📊 API: Getting connection status...")
        connection = await mt5.get_connection_status()
        logger.debug(f"📊 Connection status: {connection.is_connected} ({connection.connection_type})")
        return connection
    except Exception as e:
        logger.error(f"Error getting connection status: {e}")
        return MT5Connection(is_connected=False, connection_type="error")

@api_router.get("/pairs", response_model=List[CurrencyPair])
async def get_currency_pairs():
    """Get available currency pairs from MT5 account with enhanced debugging"""
    try:
        logger.debug("📊 API: Getting currency pairs...")
        
        # Check if MT5 manager is available
        if _mt5_manager is None:
            logger.error("❌ MT5 manager not available in API")
            return []
        
        mt5 = get_mt5_manager()
        logger.debug(f"📊 MT5 manager instance: {id(mt5)}")
        
        # Get connection status first
        connection = await mt5.get_connection_status()
        logger.debug(f"📊 Connection status: {connection.is_connected} ({connection.connection_type})")
        
        if not connection.is_connected:
            logger.warning("⚠️ MT5 not connected, attempting to reconnect...")
            
            # Try to reinitialize the connection
            await mt5.initialize()
            
            # Check connection again
            connection = await mt5.get_connection_status()
            if not connection.is_connected:
                logger.error("❌ Failed to reconnect to MT5")
                return []
        
        # Get pairs from MT5 manager
        pairs = await mt5.get_available_pairs()
        logger.debug(f"📊 Retrieved {len(pairs)} pairs from MT5 manager")
        
        if not pairs:
            logger.warning("⚠️ No trading pairs available from MT5, attempting force reload...")
            
            # Try to force reload pairs
            pairs = await mt5.force_reload_pairs()
            logger.debug(f"📊 Force reload returned {len(pairs)} pairs")
            
            if not pairs:
                logger.error("❌ Still no pairs available after force reload")
                logger.error("🔍 This indicates a fundamental issue with MT5 symbol loading")
                
                # Try to get direct connection info for debugging
                if hasattr(mt5, 'direct_connection') and mt5.direct_connection:
                    symbols_count = mt5.direct_connection.get_symbols_count()
                    pairs_count = mt5.direct_connection.get_pairs_count()
                    logger.error(f"🔍 Direct connection has {symbols_count} symbols, {pairs_count} pairs")
                    
                    # Try to reinitialize the direct connection
                    logger.info("🔄 Attempting to reinitialize direct connection...")
                    if await mt5.direct_connection.initialize():
                        logger.info("✅ Direct connection reinitialized")
                        pairs = await mt5.get_available_pairs()
                        logger.info(f"📊 After reinit: {len(pairs)} pairs available")
                
                # Return empty list if still no pairs
                if not pairs:
                    return []
        
        logger.debug(f"✅ API: Returning {len(pairs)} trading pairs")
        
        # Log first few pairs for debugging
        if pairs:
            logger.debug("📋 First few pairs being returned:")
            for i, pair in enumerate(pairs[:3]):
                logger.debug(f"   {i+1}. {pair.symbol} ({pair.category}) - {pair.name}")
        
        return pairs
        
    except Exception as e:
        logger.error(f"❌ Error getting currency pairs: {e}")
        logger.error(f"❌ Exception type: {type(e)}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        return []

@api_router.get("/pairs/reload")
async def reload_currency_pairs():
    """Force reload currency pairs from MT5"""
    try:
        logger.info("🔄 API: Force reloading currency pairs...")
        
        if _mt5_manager is None:
            logger.error("❌ MT5 manager not available for reload")
            return {
                "status": "error",
                "message": "MT5 manager not available",
                "pairs_count": 0,
                "timestamp": datetime.now().isoformat()
            }
        
        mt5 = get_mt5_manager()
        
        # First try to reinitialize the connection
        await mt5.initialize()
        
        # Then force reload pairs
        pairs = await mt5.force_reload_pairs()
        
        return {
            "status": "success",
            "message": f"Reloaded {len(pairs)} trading pairs",
            "pairs_count": len(pairs),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error reloading currency pairs: {e}")
        return {
            "status": "error",
            "message": str(e),
            "pairs_count": 0,
            "timestamp": datetime.now().isoformat()
        }

@api_router.get("/pairs/debug")
async def debug_currency_pairs():
    """Debug endpoint to check pairs loading status"""
    try:
        logger.info("🔍 API: Debug currency pairs...")
        
        # Check if MT5 manager is available
        if _mt5_manager is None:
            return {
                "error": "MT5 manager not available in API",
                "mt5_manager_available": False,
                "timestamp": datetime.now().isoformat()
            }
        
        mt5 = get_mt5_manager()
        
        # Get connection status
        connection = await mt5.get_connection_status()
        
        # Get pairs
        pairs = await mt5.get_available_pairs()
        
        # Get direct connection info if available
        direct_info = {}
        if hasattr(mt5, 'direct_connection') and mt5.direct_connection:
            direct_info = {
                "is_connected": mt5.direct_connection.is_connected,
                "symbols_loaded": mt5.direct_connection.symbols_loaded,
                "symbols_loading": mt5.direct_connection.symbols_loading,
                "symbols_count": mt5.direct_connection.get_symbols_count(),
                "pairs_count": mt5.direct_connection.get_pairs_count(),
                "available_symbols_length": len(mt5.direct_connection.available_symbols),
                "currency_pairs_length": len(mt5.direct_connection.currency_pairs)
            }
        
        return {
            "mt5_manager_available": True,
            "mt5_manager_id": id(mt5),
            "connection": {
                "is_connected": connection.is_connected,
                "connection_type": connection.connection_type,
                "server": connection.server,
                "account": connection.account
            },
            "pairs": {
                "count": len(pairs),
                "sample": [pair.dict() for pair in pairs[:3]] if pairs else []
            },
            "direct_connection": direct_info,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error in debug endpoint: {e}")
        return {
            "error": str(e),
            "mt5_manager_available": _mt5_manager is not None,
            "timestamp": datetime.now().isoformat()
        }

@api_router.get("/tick")
async def get_current_tick(symbol: str = Query(default="EURUSD")):
    """Get current tick data from MT5"""
    try:
        mt5 = get_mt5_manager()
        tick = await mt5.get_current_tick(symbol)
        if tick:
            return tick.dict()
        
        logger.warning(f"No tick data available for {symbol}")
        return {"error": f"No tick data available for {symbol}"}
        
    except Exception as e:
        logger.error(f"Error getting tick data for {symbol}: {e}")
        return {"error": f"Failed to get tick data: {str(e)}"}

@api_router.get("/market-data", response_model=List[MarketData])
async def get_market_data(
    symbol: str = Query(default="EURUSD"),
    timeframe: str = Query(default="M15"),
    count: int = Query(default=100)
):
    """Get market data from MT5"""
    try:
        mt5 = get_mt5_manager()
        data = await mt5.get_market_data(symbol, timeframe, count)
        if not data:
            logger.warning(f"No market data available for {symbol} on {timeframe}")
            return []
        return data
    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        return []

@api_router.get("/positions")
async def get_positions():
    """Get open positions from MT5 account"""
    try:
        mt5 = get_mt5_manager()
        return await mt5.get_positions()
    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        return []

@api_router.get("/orders")
async def get_orders():
    """Get pending orders from MT5 account"""
    try:
        mt5 = get_mt5_manager()
        return await mt5.get_orders()
    except Exception as e:
        logger.error(f"Error getting orders: {e}")
        return []

@api_router.post("/order")
async def place_order(
    symbol: str,
    order_type: str,
    volume: float,
    price: Optional[float] = None,
    sl: Optional[float] = None,
    tp: Optional[float] = None,
    comment: str = ""
):
    """Place a trading order in MT5"""
    try:
        mt5 = get_mt5_manager()
        
        # Validate order type
        valid_types = ['BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP']
        if order_type.upper() not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid order type. Must be one of: {valid_types}")
        
        # Validate volume
        if volume <= 0:
            raise HTTPException(status_code=400, detail="Volume must be greater than 0")
        
        result = await mt5.place_order(symbol, order_type, volume, price, sl, tp, comment)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error placing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/config")
async def update_config(config: SuperTrendConfig):
    """Update SuperTrend configuration"""
    try:
        calc = get_calculator()
        calc.update_config(config)
        return {"status": "success", "message": "Configuration updated"}
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/config", response_model=SuperTrendConfig)
async def get_config():
    """Get current SuperTrend configuration"""
    try:
        calc = get_calculator()
        return calc.config
    except Exception as e:
        logger.error(f"Error getting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/calculate")
async def calculate_supertrend(request: SuperTrendRequest):
    """Calculate SuperTrend for given symbol using MT5 data - Fixed calculator initialization"""
    try:
        logger.info(f"📊 Calculating SuperTrend for {request.symbol} on {request.timeframe}")
        
        # Get calculator with proper error handling
        try:
            calc = get_calculator()
        except Exception as calc_error:
            logger.error(f"❌ Error getting calculator: {calc_error}")
            raise HTTPException(status_code=500, detail="Calculator not available")
        
        # Get MT5 manager
        try:
            mt5 = get_mt5_manager()
        except Exception as mt5_error:
            logger.error(f"❌ Error getting MT5 manager: {mt5_error}")
            raise HTTPException(status_code=500, detail="MT5 connection not available")
        
        # Update calculator config if custom parameters provided
        if request.periods or request.multiplier:
            try:
                current_config = calc.config
                if request.periods:
                    current_config.periods = request.periods
                if request.multiplier:
                    current_config.multiplier = request.multiplier
                calc.update_config(current_config)
                logger.info(f"📊 Updated config: periods={current_config.periods}, multiplier={current_config.multiplier}")
            except Exception as config_error:
                logger.error(f"❌ Error updating config: {config_error}")
                # Continue with default config
        
        # Set symbol and add market data
        try:
            calc.set_symbol(request.symbol)
        except Exception as symbol_error:
            logger.error(f"❌ Error setting symbol: {symbol_error}")
            raise HTTPException(status_code=500, detail="Failed to set symbol")
        
        # Get market data for the symbol from MT5
        try:
            market_data = await mt5.get_market_data(request.symbol, request.timeframe, 100)
        except Exception as data_error:
            logger.error(f"❌ Error getting market data: {data_error}")
            raise HTTPException(status_code=500, detail="Failed to get market data")
        
        if not market_data:
            logger.warning(f"No market data available for {request.symbol} on {request.timeframe}")
            return {
                "status": "no_data",
                "message": f"No market data available for {request.symbol} on {request.timeframe} timeframe",
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "timestamp": datetime.now().isoformat()
            }
        
        # Add data to calculator
        try:
            for data_point in market_data:
                calc.add_data(data_point)
        except Exception as add_error:
            logger.error(f"❌ Error adding data to calculator: {add_error}")
            raise HTTPException(status_code=500, detail="Failed to process market data")
        
        # Calculate SuperTrend
        try:
            result = calc.calculate()
        except Exception as calc_error:
            logger.error(f"❌ Error calculating SuperTrend: {calc_error}")
            raise HTTPException(status_code=500, detail="SuperTrend calculation failed")
        
        if result is None:
            logger.warning(f"Insufficient data for SuperTrend calculation on {request.symbol}")
            return {
                "status": "insufficient_data", 
                "message": f"Not enough data for SuperTrend calculation. Need at least {calc.config.periods + 1} candles.",
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "data_points": len(market_data),
                "required_points": calc.config.periods + 1,
                "timestamp": datetime.now().isoformat()
            }
        
        logger.info(f"✅ SuperTrend calculated successfully for {request.symbol}")
        
        return {
            "status": "success",
            "result": result.dict(),
            "symbol": request.symbol,
            "timeframe": request.timeframe,
            "data_points": len(market_data),
            "config": {
                "periods": calc.config.periods,
                "multiplier": calc.config.multiplier
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error calculating SuperTrend: {e}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@api_router.post("/test-connection")
async def test_connection():
    """Test MT5 direct connection with enhanced pairs testing"""
    try:
        if _mt5_manager is None:
            return {
                "status": "error",
                "message": "MT5 manager not available",
                "results": {
                    "mt5_manager": {
                        "success": False,
                        "message": "MT5 manager not initialized"
                    }
                },
                "timestamp": datetime.now().isoformat()
            }
        
        mt5 = get_mt5_manager()
        connection = await mt5.get_connection_status()
        
        test_results = {
            "mt5_direct": {
                "success": connection.is_connected and connection.connection_type == "direct",
                "message": "Direct MT5 connection active" if connection.is_connected else "MT5 Terminal not connected"
            },
            "account_access": {
                "success": connection.account is not None,
                "message": f"Account {connection.account} accessible" if connection.account else "No account information"
            },
            "server_connection": {
                "success": connection.server is not None,
                "message": f"Connected to {connection.server}" if connection.server else "No server information"
            }
        }
        
        # Additional tests for direct connection
        if connection.is_connected:
            try:
                # Test getting pairs
                pairs = await mt5.get_available_pairs()
                test_results["pairs_data"] = {
                    "success": len(pairs) > 0,
                    "message": f"Available trading pairs: {len(pairs)}"
                }
                
                # Test getting tick data
                if pairs:
                    test_symbol = pairs[0].symbol
                    tick = await mt5.get_current_tick(test_symbol)
                    test_results["tick_data"] = {
                        "success": tick is not None,
                        "message": f"Tick data available for {test_symbol}: {tick.bid}/{tick.ask}" if tick else f"No tick data for {test_symbol}"
                    }
                else:
                    test_results["tick_data"] = {
                        "success": False,
                        "message": "No symbols available for tick test"
                    }
                
                # Test getting positions
                positions = await mt5.get_positions()
                test_results["positions_data"] = {
                    "success": True,
                    "message": f"Open positions: {len(positions)}"
                }
                
                # Test getting orders
                orders = await mt5.get_orders()
                test_results["orders_data"] = {
                    "success": True,
                    "message": f"Pending orders: {len(orders)}"
                }
                
                # Test calculator
                try:
                    calc = get_calculator()
                    test_results["calculator"] = {
                        "success": True,
                        "message": f"Calculator available with config: periods={calc.config.periods}, multiplier={calc.config.multiplier}"
                    }
                except Exception as calc_error:
                    test_results["calculator"] = {
                        "success": False,
                        "message": f"Calculator error: {str(calc_error)}"
                    }
                
            except Exception as e:
                test_results["detailed_tests"] = {
                    "success": False,
                    "message": f"Error in detailed tests: {str(e)}"
                }
        
        overall_success = all(test["success"] for test in test_results.values())
        
        return {
            "status": "success",
            "results": test_results,
            "overall": overall_success,
            "connection_type": connection.connection_type,
            "account": connection.account,
            "server": connection.server,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/dashboard-state", response_model=DashboardState)
async def get_dashboard_state():
    """Get complete dashboard state from MT5"""
    try:
        mt5 = get_mt5_manager()
        calc = get_calculator()
        
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
            market_data=market_data[-100:] if market_data else []  # Last 100 candles
        )
        
        return state
        
    except Exception as e:
        logger.error(f"Error getting dashboard state: {e}")
        # Return default state on error
        return DashboardState(
            selected_pair="EURUSD",
            is_running=True,
            config=SuperTrendConfig(),
            connection=MT5Connection(is_connected=False),
            available_pairs=[],
            signals=[],
            market_data=[]
        )

@api_router.post("/reconnect")
async def reconnect_mt5():
    """Reconnect to MT5 Terminal"""
    try:
        if _mt5_manager is None:
            return {
                "status": "error",
                "message": "MT5 manager not available",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
        
        mt5 = get_mt5_manager()
        await mt5.initialize()
        connection = await mt5.get_connection_status()
        
        return {
            "status": "success",
            "message": "MT5 reconnection attempted",
            "connected": connection.is_connected,
            "connection_type": connection.connection_type,
            "account": connection.account,
            "server": connection.server,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error reconnecting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/account-summary")
async def get_account_summary():
    """Get comprehensive MT5 account summary"""
    try:
        mt5 = get_mt5_manager()
        connection = await mt5.get_connection_status()
        
        if not connection.is_connected:
            return {
                "error": "MT5 Terminal not connected",
                "message": "Please start MT5 and log into your account",
                "account": {},
                "trading": {},
                "positions": [],
                "orders": [],
                "connection_status": {
                    "type": connection.connection_type,
                    "last_update": None
                },
                "timestamp": datetime.now().isoformat()
            }
        
        positions = await mt5.get_positions()
        orders = await mt5.get_orders()
        
        # Calculate summary statistics
        total_profit = sum(pos.get('profit', 0) for pos in positions)
        total_volume = sum(pos.get('volume', 0) for pos in positions)
        
        # Calculate daily P&L (simplified - difference between equity and balance)
        daily_pnl = (connection.equity or 0) - (connection.balance or 0)
        
        return {
            "account": {
                "login": connection.account,
                "server": connection.server,
                "balance": connection.balance,
                "equity": connection.equity,
                "margin": connection.margin,
                "free_margin": connection.free_margin,
                "margin_level": connection.margin_level,
                "currency": "USD"  # TODO: Get from MT5
            },
            "trading": {
                "open_positions": len(positions),
                "pending_orders": len(orders),
                "total_profit": total_profit,
                "total_volume": total_volume,
                "daily_pnl": daily_pnl
            },
            "positions": positions,
            "orders": orders,
            "connection_status": {
                "type": connection.connection_type,
                "last_update": connection.last_update.isoformat() if connection.last_update else None
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting account summary: {e}")
        return {
            "error": str(e),
            "account": {},
            "trading": {},
            "positions": [],
            "orders": [],
            "connection_status": {"type": "error", "last_update": None},
            "timestamp": datetime.now().isoformat()
        }