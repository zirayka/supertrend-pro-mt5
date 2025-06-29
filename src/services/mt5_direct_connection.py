"""
Direct MT5 connection using MetaTrader5 Python package
Provides real-time access to MT5 Terminal data and account information
"""

import asyncio
import logging
import MetaTrader5 as mt5
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import pandas as pd

from src.core.models import (
    MT5Connection, MT5Tick, MarketData, CurrencyPair,
    ConnectionStatus
)

logger = logging.getLogger(__name__)


class MT5DirectConnection:
    """Direct connection to MT5 Terminal using MetaTrader5 package"""
    
    def __init__(self):
        self.is_connected = False
        self.connection_info = {}
        self.account_info = {}
        self.available_symbols = []
        self.subscribers = []
        self.monitoring_task = None
        
    async def initialize(self) -> bool:
        """Initialize connection to MT5 Terminal"""
        try:
            logger.info("🔌 Initializing direct MT5 connection...")
            
            # Initialize MT5 connection
            if not mt5.initialize():
                error_code = mt5.last_error()
                logger.error(f"❌ MT5 initialization failed, error code: {error_code}")
                return False
            
            # Get account info
            account_info = mt5.account_info()
            if account_info is None:
                logger.error("❌ Failed to get MT5 account info")
                mt5.shutdown()
                return False
            
            # Store connection info
            self.account_info = account_info._asdict()
            self.connection_info = {
                'server': self.account_info.get('server', 'Unknown'),
                'login': self.account_info.get('login', 0),
                'trade_mode': self.account_info.get('trade_mode', 0),
                'leverage': self.account_info.get('leverage', 1),
                'currency': self.account_info.get('currency', 'USD')
            }
            
            self.is_connected = True
            
            # Load available symbols
            await self._load_symbols()
            
            logger.info("✅ Direct MT5 connection established successfully")
            logger.info(f"📊 Account: {self.connection_info['login']} on {self.connection_info['server']}")
            logger.info(f"💰 Balance: ${self.account_info.get('balance', 0):.2f}")
            logger.info(f"🔢 Available symbols: {len(self.available_symbols)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error initializing MT5 connection: {e}")
            return False
    
    async def _load_symbols(self):
        """Load available trading symbols from MT5"""
        try:
            # Get all symbols
            symbols = mt5.symbols_get()
            if symbols is None:
                logger.warning("⚠️ No symbols available from MT5")
                return
            
            self.available_symbols = []
            
            for symbol in symbols:
                # Only include visible symbols
                if symbol.visible:
                    symbol_info = {
                        'symbol': symbol.name,
                        'description': symbol.description,
                        'category': self._categorize_symbol(symbol.name),
                        'digits': symbol.digits,
                        'point': symbol.point,
                        'min_lot': symbol.volume_min,
                        'max_lot': symbol.volume_max,
                        'lot_step': symbol.volume_step,
                        'spread': symbol.spread,
                        'swap_long': symbol.swap_long,
                        'swap_short': symbol.swap_short,
                        'currency_base': symbol.currency_base,
                        'currency_profit': symbol.currency_profit,
                        'currency_margin': symbol.currency_margin
                    }
                    self.available_symbols.append(symbol_info)
            
            logger.info(f"📈 Loaded {len(self.available_symbols)} trading symbols")
            
        except Exception as e:
            logger.error(f"❌ Error loading symbols: {e}")
    
    def _categorize_symbol(self, symbol: str) -> str:
        """Categorize trading symbol based on name"""
        symbol_upper = symbol.upper()
        
        # Major forex pairs
        major_pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']
        if symbol_upper in major_pairs:
            return 'major'
        
        # Minor forex pairs
        minor_pairs = ['EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'GBPCHF', 'GBPAUD']
        if symbol_upper in minor_pairs:
            return 'minor'
        
        # Commodities
        if any(commodity in symbol_upper for commodity in ['XAU', 'XAG', 'GOLD', 'SILVER', 'OIL', 'WTI', 'BRENT']):
            return 'commodities'
        
        # Indices
        if any(index in symbol_upper for index in ['US30', 'SPX500', 'NAS100', 'UK100', 'GER30', 'FRA40', 'JPN225']):
            return 'indices'
        
        # Cryptocurrencies
        if any(crypto in symbol_upper for crypto in ['BTC', 'ETH', 'LTC', 'XRP', 'ADA', 'DOT']):
            return 'crypto'
        
        # Exotic forex pairs
        if len(symbol) == 6 and symbol.isalpha():
            return 'exotic'
        
        return 'other'
    
    async def get_connection_status(self) -> MT5Connection:
        """Get current connection status"""
        if not self.is_connected:
            return MT5Connection(
                is_connected=False,
                connection_type="disconnected"
            )
        
        try:
            # Refresh account info
            account_info = mt5.account_info()
            if account_info:
                self.account_info = account_info._asdict()
            
            return MT5Connection(
                is_connected=True,
                connection_type="direct",
                server=self.connection_info.get('server'),
                account=self.connection_info.get('login'),
                balance=self.account_info.get('balance'),
                equity=self.account_info.get('equity'),
                margin=self.account_info.get('margin'),
                free_margin=self.account_info.get('margin_free'),
                margin_level=self.account_info.get('margin_level'),
                last_update=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Error getting connection status: {e}")
            return MT5Connection(
                is_connected=False,
                connection_type="error"
            )
    
    async def get_available_pairs(self) -> List[CurrencyPair]:
        """Get available currency pairs"""
        if not self.is_connected:
            return []
        
        pairs = []
        for symbol_info in self.available_symbols:
            pair = CurrencyPair(
                symbol=symbol_info['symbol'],
                name=symbol_info['description'],
                category=symbol_info['category'],
                digits=symbol_info['digits'],
                point_size=symbol_info['point'],
                min_lot=symbol_info['min_lot'],
                max_lot=symbol_info['max_lot'],
                lot_step=symbol_info['lot_step'],
                spread=symbol_info.get('spread'),
                swap_long=symbol_info.get('swap_long'),
                swap_short=symbol_info.get('swap_short')
            )
            pairs.append(pair)
        
        return pairs
    
    async def get_current_tick(self, symbol: str = "EURUSD") -> Optional[MT5Tick]:
        """Get current tick data for symbol"""
        if not self.is_connected:
            return None
        
        try:
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                return None
            
            return MT5Tick(
                symbol=symbol,
                time=datetime.fromtimestamp(tick.time, tz=timezone.utc),
                bid=tick.bid,
                ask=tick.ask,
                last=tick.last,
                volume=tick.volume,
                flags=tick.flags
            )
            
        except Exception as e:
            logger.error(f"❌ Error getting tick for {symbol}: {e}")
            return None
    
    async def get_market_data(self, symbol: str = "EURUSD", timeframe: str = "M15", count: int = 100) -> List[MarketData]:
        """Get historical market data"""
        if not self.is_connected:
            return []
        
        try:
            # Convert timeframe string to MT5 constant
            timeframe_map = {
                "M1": mt5.TIMEFRAME_M1,
                "M5": mt5.TIMEFRAME_M5,
                "M15": mt5.TIMEFRAME_M15,
                "M30": mt5.TIMEFRAME_M30,
                "H1": mt5.TIMEFRAME_H1,
                "H4": mt5.TIMEFRAME_H4,
                "D1": mt5.TIMEFRAME_D1
            }
            
            mt5_timeframe = timeframe_map.get(timeframe, mt5.TIMEFRAME_M15)
            
            # Get rates
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, count)
            if rates is None:
                logger.warning(f"⚠️ No market data available for {symbol}")
                return []
            
            market_data = []
            for rate in rates:
                data = MarketData(
                    timestamp=datetime.fromtimestamp(rate['time'], tz=timezone.utc),
                    symbol=symbol,
                    open=rate['open'],
                    high=rate['high'],
                    low=rate['low'],
                    close=rate['close'],
                    volume=int(rate['tick_volume'])
                )
                market_data.append(data)
            
            return market_data
            
        except Exception as e:
            logger.error(f"❌ Error getting market data for {symbol}: {e}")
            return []
    
    async def get_positions(self) -> List[Dict]:
        """Get open positions"""
        if not self.is_connected:
            return []
        
        try:
            positions = mt5.positions_get()
            if positions is None:
                return []
            
            position_list = []
            for pos in positions:
                position_info = {
                    'ticket': pos.ticket,
                    'symbol': pos.symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'volume': pos.volume,
                    'price_open': pos.price_open,
                    'price_current': pos.price_current,
                    'profit': pos.profit,
                    'swap': pos.swap,
                    'comment': pos.comment,
                    'time': datetime.fromtimestamp(pos.time, tz=timezone.utc)
                }
                position_list.append(position_info)
            
            return position_list
            
        except Exception as e:
            logger.error(f"❌ Error getting positions: {e}")
            return []
    
    async def get_orders(self) -> List[Dict]:
        """Get pending orders"""
        if not self.is_connected:
            return []
        
        try:
            orders = mt5.orders_get()
            if orders is None:
                return []
            
            order_list = []
            for order in orders:
                order_info = {
                    'ticket': order.ticket,
                    'symbol': order.symbol,
                    'type': self._get_order_type_name(order.type),
                    'volume': order.volume_initial,
                    'price_open': order.price_open,
                    'sl': order.sl,
                    'tp': order.tp,
                    'comment': order.comment,
                    'time_setup': datetime.fromtimestamp(order.time_setup, tz=timezone.utc)
                }
                order_list.append(order_info)
            
            return order_list
            
        except Exception as e:
            logger.error(f"❌ Error getting orders: {e}")
            return []
    
    def _get_order_type_name(self, order_type: int) -> str:
        """Convert MT5 order type to readable name"""
        type_map = {
            0: 'BUY',
            1: 'SELL',
            2: 'BUY_LIMIT',
            3: 'SELL_LIMIT',
            4: 'BUY_STOP',
            5: 'SELL_STOP',
            6: 'BUY_STOP_LIMIT',
            7: 'SELL_STOP_LIMIT'
        }
        return type_map.get(order_type, 'UNKNOWN')
    
    async def start_monitoring(self):
        """Start monitoring MT5 data"""
        if self.monitoring_task is None:
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())
    
    async def _monitoring_loop(self):
        """Main monitoring loop for real-time data"""
        logger.info("🔄 Starting MT5 monitoring loop...")
        
        while self.is_connected:
            try:
                # Update account info
                account_info = mt5.account_info()
                if account_info:
                    self.account_info = account_info._asdict()
                    await self._notify_subscribers('account_info', self.account_info)
                
                # Get tick data for major pairs
                major_symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']
                for symbol in major_symbols:
                    tick = await self.get_current_tick(symbol)
                    if tick:
                        await self._notify_subscribers('tick', tick.dict())
                
                # Get positions and orders
                positions = await self.get_positions()
                orders = await self.get_orders()
                
                await self._notify_subscribers('positions', positions)
                await self._notify_subscribers('orders', orders)
                
                # Wait before next update
                await asyncio.sleep(2)  # Update every 2 seconds
                
            except Exception as e:
                logger.error(f"❌ Error in monitoring loop: {e}")
                await asyncio.sleep(5)  # Wait longer on error
    
    def subscribe(self, callback):
        """Subscribe to MT5 events"""
        self.subscribers.append(callback)
    
    def unsubscribe(self, callback):
        """Unsubscribe from MT5 events"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)
    
    async def _notify_subscribers(self, event_type: str, data):
        """Notify all subscribers of events"""
        for callback in self.subscribers:
            try:
                await callback(event_type, data)
            except Exception as e:
                logger.error(f"❌ Error notifying subscriber: {e}")
    
    async def place_order(self, symbol: str, order_type: str, volume: float, price: float = None, 
                         sl: float = None, tp: float = None, comment: str = "") -> Dict:
        """Place a trading order"""
        if not self.is_connected:
            return {"error": "Not connected to MT5"}
        
        try:
            # Prepare order request
            if price is None:
                tick = mt5.symbol_info_tick(symbol)
                if tick is None:
                    return {"error": f"Cannot get price for {symbol}"}
                price = tick.ask if order_type.upper() == 'BUY' else tick.bid
            
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": volume,
                "type": mt5.ORDER_TYPE_BUY if order_type.upper() == 'BUY' else mt5.ORDER_TYPE_SELL,
                "price": price,
                "deviation": 20,
                "magic": 234000,
                "comment": comment,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            if sl:
                request["sl"] = sl
            if tp:
                request["tp"] = tp
            
            # Send order
            result = mt5.order_send(request)
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    "error": f"Order failed: {result.retcode}",
                    "comment": result.comment
                }
            
            return {
                "success": True,
                "order": result.order,
                "deal": result.deal,
                "price": result.price,
                "volume": result.volume
            }
            
        except Exception as e:
            logger.error(f"❌ Error placing order: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """Cleanup MT5 connection"""
        logger.info("🧹 Cleaning up MT5 direct connection...")
        
        self.is_connected = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        # Shutdown MT5 connection
        mt5.shutdown()
        
        logger.info("✅ MT5 direct connection cleaned up")