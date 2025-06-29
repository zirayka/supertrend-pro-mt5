"""
Enhanced MT5 direct connection using MetaTrader5 Python package
Provides real-time access to MT5 Terminal data with improved error handling and performance
"""

import asyncio
import logging
import MetaTrader5 as mt5
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Callable
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import threading
import time

from src.core.models import (
    MT5Connection, MT5Tick, MarketData, CurrencyPair,
    ConnectionStatus
)

logger = logging.getLogger(__name__)


class MT5DirectConnection:
    """Enhanced direct connection to MT5 Terminal using MetaTrader5 package"""
    
    def __init__(self):
        self.is_connected = False
        self.connection_info = {}
        self.account_info = {}
        self.available_symbols = []
        self.subscribers = []
        self.monitoring_task = None
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Performance monitoring
        self.last_tick_time = {}
        self.connection_stats = {
            'total_ticks': 0,
            'total_errors': 0,
            'avg_latency': 0,
            'uptime_start': None
        }
        
        # Data caching
        self.symbol_cache = {}
        self.tick_cache = {}
        self.rates_cache = {}
        
        # Connection retry logic
        self.max_retries = 3
        self.retry_delay = 5
        self.connection_timeout = 30
        
    async def initialize(self) -> bool:
        """Initialize connection to MT5 Terminal with enhanced error handling"""
        try:
            logger.info("🔌 Initializing enhanced MT5 direct connection...")
            
            # Initialize MT5 connection in thread pool
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(self.executor, self._initialize_mt5)
            
            if not success:
                return False
            
            # Get account info
            account_info = await loop.run_in_executor(self.executor, mt5.account_info)
            if account_info is None:
                logger.error("❌ Failed to get MT5 account info")
                await loop.run_in_executor(self.executor, mt5.shutdown)
                return False
            
            # Store connection info
            self.account_info = account_info._asdict()
            self.connection_info = {
                'server': self.account_info.get('server', 'Unknown'),
                'login': self.account_info.get('login', 0),
                'trade_mode': self.account_info.get('trade_mode', 0),
                'leverage': self.account_info.get('leverage', 1),
                'currency': self.account_info.get('currency', 'USD'),
                'company': self.account_info.get('company', 'Unknown')
            }
            
            self.is_connected = True
            self.connection_stats['uptime_start'] = datetime.now()
            
            # Load available symbols with caching
            await self._load_symbols_enhanced()
            
            # Validate connection
            if not await self._validate_connection():
                logger.error("❌ MT5 connection validation failed")
                return False
            
            logger.info("✅ Enhanced MT5 direct connection established successfully")
            logger.info(f"📊 Account: {self.connection_info['login']} on {self.connection_info['server']}")
            logger.info(f"🏢 Company: {self.connection_info['company']}")
            logger.info(f"💰 Balance: ${self.account_info.get('balance', 0):.2f} {self.connection_info['currency']}")
            logger.info(f"🔢 Available symbols: {len(self.available_symbols)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error initializing enhanced MT5 connection: {e}")
            return False
    
    def _initialize_mt5(self) -> bool:
        """Initialize MT5 in thread pool"""
        try:
            # Try to initialize with timeout
            if not mt5.initialize():
                error_code = mt5.last_error()
                logger.error(f"❌ MT5 initialization failed, error code: {error_code}")
                return False
            return True
        except Exception as e:
            logger.error(f"❌ MT5 initialization exception: {e}")
            return False
    
    async def _validate_connection(self) -> bool:
        """Validate MT5 connection with comprehensive checks"""
        try:
            # Test basic functionality
            loop = asyncio.get_event_loop()
            
            # Test account info
            account_info = await loop.run_in_executor(self.executor, mt5.account_info)
            if not account_info:
                return False
            
            # Test symbol info
            symbol_info = await loop.run_in_executor(self.executor, mt5.symbol_info, "EURUSD")
            if not symbol_info:
                logger.warning("⚠️ Cannot access EURUSD symbol info")
            
            # Test tick data
            tick = await loop.run_in_executor(self.executor, mt5.symbol_info_tick, "EURUSD")
            if not tick:
                logger.warning("⚠️ Cannot access EURUSD tick data")
            
            # Test rates data
            rates = await loop.run_in_executor(self.executor, mt5.copy_rates_from_pos, "EURUSD", mt5.TIMEFRAME_M1, 0, 1)
            if rates is None or len(rates) == 0:
                logger.warning("⚠️ Cannot access EURUSD rates data")
            
            logger.info("✅ MT5 connection validation successful")
            return True
            
        except Exception as e:
            logger.error(f"❌ MT5 connection validation failed: {e}")
            return False
    
    async def _load_symbols_enhanced(self):
        """Load available trading symbols with enhanced categorization and caching"""
        try:
            loop = asyncio.get_event_loop()
            symbols = await loop.run_in_executor(self.executor, mt5.symbols_get)
            
            if symbols is None:
                logger.warning("⚠️ No symbols available from MT5")
                return
            
            self.available_symbols = []
            symbol_categories = {
                'major': 0, 'minor': 0, 'exotic': 0, 'crypto': 0, 
                'commodities': 0, 'indices': 0, 'other': 0
            }
            
            for symbol in symbols:
                # Only include visible symbols
                if symbol.visible:
                    category = self._categorize_symbol_enhanced(symbol.name)
                    symbol_categories[category] += 1
                    
                    symbol_info = {
                        'symbol': symbol.name,
                        'description': symbol.description,
                        'category': category,
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
                        'currency_margin': symbol.currency_margin,
                        'trade_mode': symbol.trade_mode,
                        'margin_initial': symbol.margin_initial,
                        'margin_maintenance': symbol.margin_maintenance
                    }
                    
                    self.available_symbols.append(symbol_info)
                    self.symbol_cache[symbol.name] = symbol_info
            
            # Sort symbols by category and name
            self.available_symbols.sort(key=lambda x: (x['category'], x['symbol']))
            
            logger.info(f"📈 Loaded {len(self.available_symbols)} trading symbols")
            logger.info(f"📊 Symbol distribution: {symbol_categories}")
            
        except Exception as e:
            logger.error(f"❌ Error loading symbols: {e}")
    
    def _categorize_symbol_enhanced(self, symbol: str) -> str:
        """Enhanced symbol categorization with more comprehensive rules"""
        symbol_upper = symbol.upper()
        
        # Major forex pairs
        major_pairs = [
            'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'
        ]
        if symbol_upper in major_pairs:
            return 'major'
        
        # Minor forex pairs
        minor_pairs = [
            'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 
            'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDCAD', 'AUDJPY',
            'AUDNZD', 'CADJPY', 'CHFJPY', 'NZDJPY', 'NZDCAD', 'NZDCHF'
        ]
        if symbol_upper in minor_pairs:
            return 'minor'
        
        # Cryptocurrencies
        crypto_patterns = [
            'BTC', 'ETH', 'LTC', 'XRP', 'ADA', 'DOT', 'LINK', 'BCH', 
            'XLM', 'EOS', 'TRX', 'XMR', 'DASH', 'ZEC', 'DOGE', 'SHIB'
        ]
        if any(crypto in symbol_upper for crypto in crypto_patterns):
            return 'crypto'
        
        # Commodities
        commodity_patterns = [
            'XAU', 'XAG', 'GOLD', 'SILVER', 'OIL', 'WTI', 'BRENT', 'CRUDE',
            'COPPER', 'PLATINUM', 'PALLADIUM', 'NATURAL', 'GAS', 'WHEAT',
            'CORN', 'SOYBEAN', 'SUGAR', 'COFFEE', 'COCOA', 'COTTON'
        ]
        if any(commodity in symbol_upper for commodity in commodity_patterns):
            return 'commodities'
        
        # Stock indices
        index_patterns = [
            'US30', 'SPX500', 'NAS100', 'UK100', 'GER30', 'FRA40', 'JPN225',
            'AUS200', 'HK50', 'CHINA50', 'INDIA50', 'RUSSELL', 'DOW', 'NASDAQ',
            'SP500', 'FTSE', 'DAX', 'CAC', 'NIKKEI', 'ASX', 'HANG', 'SENSEX'
        ]
        if any(index in symbol_upper for index in index_patterns):
            return 'indices'
        
        # Exotic forex pairs (6-character currency pairs not in major/minor)
        if len(symbol) == 6 and symbol.isalpha():
            return 'exotic'
        
        return 'other'
    
    async def get_connection_status(self) -> MT5Connection:
        """Get enhanced connection status with performance metrics"""
        if not self.is_connected:
            return MT5Connection(
                is_connected=False,
                connection_type="disconnected"
            )
        
        try:
            loop = asyncio.get_event_loop()
            
            # Refresh account info
            account_info = await loop.run_in_executor(self.executor, mt5.account_info)
            if account_info:
                self.account_info = account_info._asdict()
            
            # Calculate uptime
            uptime = None
            if self.connection_stats['uptime_start']:
                uptime = datetime.now() - self.connection_stats['uptime_start']
            
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
        """Get available currency pairs with enhanced information"""
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
        """Get current tick data with caching and error handling"""
        if not self.is_connected:
            return None
        
        try:
            loop = asyncio.get_event_loop()
            tick = await loop.run_in_executor(self.executor, mt5.symbol_info_tick, symbol)
            
            if tick is None:
                # Try to enable symbol if not available
                await self._ensure_symbol_available(symbol)
                tick = await loop.run_in_executor(self.executor, mt5.symbol_info_tick, symbol)
                
                if tick is None:
                    return None
            
            # Update statistics
            self.connection_stats['total_ticks'] += 1
            self.last_tick_time[symbol] = datetime.now()
            
            # Cache tick data
            tick_data = MT5Tick(
                symbol=symbol,
                time=datetime.fromtimestamp(tick.time, tz=timezone.utc),
                bid=tick.bid,
                ask=tick.ask,
                last=tick.last,
                volume=tick.volume,
                flags=tick.flags
            )
            
            self.tick_cache[symbol] = tick_data
            return tick_data
            
        except Exception as e:
            logger.error(f"❌ Error getting tick for {symbol}: {e}")
            self.connection_stats['total_errors'] += 1
            return None
    
    async def _ensure_symbol_available(self, symbol: str):
        """Ensure symbol is available for trading"""
        try:
            loop = asyncio.get_event_loop()
            
            # Try to select symbol
            selected = await loop.run_in_executor(self.executor, mt5.symbol_select, symbol, True)
            if selected:
                logger.info(f"✅ Symbol {symbol} selected successfully")
            else:
                logger.warning(f"⚠️ Could not select symbol {symbol}")
                
        except Exception as e:
            logger.error(f"❌ Error selecting symbol {symbol}: {e}")
    
    async def get_market_data(self, symbol: str = "EURUSD", timeframe: str = "M15", count: int = 100) -> List[MarketData]:
        """Get historical market data with enhanced caching"""
        if not self.is_connected:
            return []
        
        try:
            # Check cache first
            cache_key = f"{symbol}_{timeframe}_{count}"
            if cache_key in self.rates_cache:
                cached_data, cache_time = self.rates_cache[cache_key]
                # Use cache if less than 1 minute old
                if (datetime.now() - cache_time).seconds < 60:
                    return cached_data
            
            loop = asyncio.get_event_loop()
            
            # Convert timeframe string to MT5 constant
            timeframe_map = {
                "M1": mt5.TIMEFRAME_M1,
                "M5": mt5.TIMEFRAME_M5,
                "M15": mt5.TIMEFRAME_M15,
                "M30": mt5.TIMEFRAME_M30,
                "H1": mt5.TIMEFRAME_H1,
                "H4": mt5.TIMEFRAME_H4,
                "D1": mt5.TIMEFRAME_D1,
                "W1": mt5.TIMEFRAME_W1,
                "MN1": mt5.TIMEFRAME_MN1
            }
            
            mt5_timeframe = timeframe_map.get(timeframe, mt5.TIMEFRAME_M15)
            
            # Get rates
            rates = await loop.run_in_executor(
                self.executor, 
                mt5.copy_rates_from_pos, 
                symbol, mt5_timeframe, 0, count
            )
            
            if rates is None:
                # Try to enable symbol and retry
                await self._ensure_symbol_available(symbol)
                rates = await loop.run_in_executor(
                    self.executor, 
                    mt5.copy_rates_from_pos, 
                    symbol, mt5_timeframe, 0, count
                )
                
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
            
            # Cache the data
            self.rates_cache[cache_key] = (market_data, datetime.now())
            
            # Limit cache size
            if len(self.rates_cache) > 50:
                # Remove oldest entries
                oldest_key = min(self.rates_cache.keys(), 
                               key=lambda k: self.rates_cache[k][1])
                del self.rates_cache[oldest_key]
            
            return market_data
            
        except Exception as e:
            logger.error(f"❌ Error getting market data for {symbol}: {e}")
            self.connection_stats['total_errors'] += 1
            return []
    
    async def get_positions(self) -> List[Dict]:
        """Get open positions with enhanced information"""
        if not self.is_connected:
            return []
        
        try:
            loop = asyncio.get_event_loop()
            positions = await loop.run_in_executor(self.executor, mt5.positions_get)
            
            if positions is None:
                return []
            
            position_list = []
            for pos in positions:
                # Calculate additional metrics
                pip_value = self._calculate_pip_value(pos.symbol, pos.volume)
                pips_profit = self._calculate_pips_profit(pos)
                
                position_info = {
                    'ticket': pos.ticket,
                    'symbol': pos.symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'volume': pos.volume,
                    'price_open': pos.price_open,
                    'price_current': pos.price_current,
                    'profit': pos.profit,
                    'swap': pos.swap,
                    'commission': getattr(pos, 'commission', 0),
                    'comment': pos.comment,
                    'time': datetime.fromtimestamp(pos.time, tz=timezone.utc),
                    'time_update': datetime.fromtimestamp(getattr(pos, 'time_update', pos.time), tz=timezone.utc),
                    'pip_value': pip_value,
                    'pips_profit': pips_profit,
                    'magic': getattr(pos, 'magic', 0),
                    'identifier': getattr(pos, 'identifier', pos.ticket)
                }
                position_list.append(position_info)
            
            return position_list
            
        except Exception as e:
            logger.error(f"❌ Error getting positions: {e}")
            self.connection_stats['total_errors'] += 1
            return []
    
    def _calculate_pip_value(self, symbol: str, volume: float) -> float:
        """Calculate pip value for position"""
        try:
            symbol_info = self.symbol_cache.get(symbol)
            if not symbol_info:
                return 0.0
            
            point = symbol_info['point']
            if 'JPY' in symbol:
                pip_size = point * 100  # For JPY pairs, pip is 0.01
            else:
                pip_size = point * 10   # For other pairs, pip is 0.0001
            
            return pip_size * volume * 100000  # Standard lot size
            
        except Exception:
            return 0.0
    
    def _calculate_pips_profit(self, position) -> float:
        """Calculate profit in pips"""
        try:
            price_diff = position.price_current - position.price_open
            if position.type == 1:  # SELL position
                price_diff = -price_diff
            
            if 'JPY' in position.symbol:
                return price_diff * 100
            else:
                return price_diff * 10000
                
        except Exception:
            return 0.0
    
    async def get_orders(self) -> List[Dict]:
        """Get pending orders with enhanced information"""
        if not self.is_connected:
            return []
        
        try:
            loop = asyncio.get_event_loop()
            orders = await loop.run_in_executor(self.executor, mt5.orders_get)
            
            if orders is None:
                return []
            
            order_list = []
            for order in orders:
                order_info = {
                    'ticket': order.ticket,
                    'symbol': order.symbol,
                    'type': self._get_order_type_name(order.type),
                    'volume': order.volume_initial,
                    'volume_current': order.volume_current,
                    'price_open': order.price_open,
                    'sl': order.sl,
                    'tp': order.tp,
                    'comment': order.comment,
                    'time_setup': datetime.fromtimestamp(order.time_setup, tz=timezone.utc),
                    'time_expiration': datetime.fromtimestamp(order.time_expiration, tz=timezone.utc) if order.time_expiration > 0 else None,
                    'magic': getattr(order, 'magic', 0),
                    'state': getattr(order, 'state', 'unknown')
                }
                order_list.append(order_info)
            
            return order_list
            
        except Exception as e:
            logger.error(f"❌ Error getting orders: {e}")
            self.connection_stats['total_errors'] += 1
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
        """Start enhanced monitoring with performance tracking"""
        if self.monitoring_task is None:
            self.monitoring_task = asyncio.create_task(self._enhanced_monitoring_loop())
    
    async def _enhanced_monitoring_loop(self):
        """Enhanced monitoring loop with adaptive intervals"""
        logger.info("🔄 Starting enhanced MT5 monitoring loop...")
        
        base_interval = 2.0  # Base update interval
        error_count = 0
        max_errors = 10
        
        while self.is_connected:
            try:
                start_time = time.time()
                
                # Update account info
                loop = asyncio.get_event_loop()
                account_info = await loop.run_in_executor(self.executor, mt5.account_info)
                
                if account_info:
                    self.account_info = account_info._asdict()
                    await self._notify_subscribers('account_info', self.account_info)
                    error_count = 0  # Reset error count on success
                else:
                    error_count += 1
                
                # Get tick data for major symbols
                major_symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD']
                for symbol in major_symbols:
                    if symbol in [s['symbol'] for s in self.available_symbols]:
                        tick = await self.get_current_tick(symbol)
                        if tick:
                            await self._notify_subscribers('tick', tick.dict())
                
                # Get positions and orders
                positions = await self.get_positions()
                orders = await self.get_orders()
                
                await self._notify_subscribers('positions', positions)
                await self._notify_subscribers('orders', orders)
                
                # Calculate processing time for performance monitoring
                processing_time = time.time() - start_time
                self.connection_stats['avg_latency'] = (
                    self.connection_stats['avg_latency'] * 0.9 + processing_time * 0.1
                )
                
                # Adaptive interval based on performance
                if processing_time > 1.0:
                    interval = base_interval * 1.5  # Slow down if processing is slow
                elif error_count > 0:
                    interval = base_interval * (1 + error_count * 0.5)  # Slow down on errors
                else:
                    interval = base_interval
                
                await asyncio.sleep(interval)
                
                # Check for too many errors
                if error_count >= max_errors:
                    logger.error(f"❌ Too many errors ({error_count}), stopping monitoring")
                    break
                
            except Exception as e:
                logger.error(f"❌ Error in enhanced monitoring loop: {e}")
                error_count += 1
                await asyncio.sleep(base_interval * 2)  # Wait longer on exception
    
    def subscribe(self, callback: Callable):
        """Subscribe to MT5 events"""
        self.subscribers.append(callback)
    
    def unsubscribe(self, callback: Callable):
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
        """Place a trading order with enhanced validation"""
        if not self.is_connected:
            return {"error": "Not connected to MT5"}
        
        try:
            # Validate symbol
            if symbol not in [s['symbol'] for s in self.available_symbols]:
                return {"error": f"Symbol {symbol} not available"}
            
            # Get symbol info for validation
            symbol_info = self.symbol_cache.get(symbol)
            if not symbol_info:
                return {"error": f"Symbol {symbol} info not available"}
            
            # Validate volume
            min_lot = symbol_info['min_lot']
            max_lot = symbol_info['max_lot']
            lot_step = symbol_info['lot_step']
            
            if volume < min_lot or volume > max_lot:
                return {"error": f"Volume must be between {min_lot} and {max_lot}"}
            
            # Validate lot step
            if (volume - min_lot) % lot_step != 0:
                return {"error": f"Volume must be in steps of {lot_step}"}
            
            loop = asyncio.get_event_loop()
            
            # Get current price if not provided
            if price is None:
                tick = await loop.run_in_executor(self.executor, mt5.symbol_info_tick, symbol)
                if tick is None:
                    return {"error": f"Cannot get price for {symbol}"}
                price = tick.ask if order_type.upper() == 'BUY' else tick.bid
            
            # Prepare order request
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
            result = await loop.run_in_executor(self.executor, mt5.order_send, request)
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    "error": f"Order failed: {result.retcode}",
                    "comment": result.comment,
                    "retcode": result.retcode
                }
            
            return {
                "success": True,
                "order": result.order,
                "deal": result.deal,
                "price": result.price,
                "volume": result.volume,
                "retcode": result.retcode,
                "comment": result.comment
            }
            
        except Exception as e:
            logger.error(f"❌ Error placing order: {e}")
            self.connection_stats['total_errors'] += 1
            return {"error": str(e)}
    
    def get_connection_stats(self) -> Dict:
        """Get connection performance statistics"""
        uptime = None
        if self.connection_stats['uptime_start']:
            uptime = datetime.now() - self.connection_stats['uptime_start']
        
        return {
            'total_ticks': self.connection_stats['total_ticks'],
            'total_errors': self.connection_stats['total_errors'],
            'avg_latency': self.connection_stats['avg_latency'],
            'uptime': uptime.total_seconds() if uptime else 0,
            'error_rate': self.connection_stats['total_errors'] / max(1, self.connection_stats['total_ticks']),
            'symbols_cached': len(self.symbol_cache),
            'ticks_cached': len(self.tick_cache),
            'rates_cached': len(self.rates_cache)
        }
    
    async def cleanup(self):
        """Enhanced cleanup with proper resource management"""
        logger.info("🧹 Cleaning up enhanced MT5 direct connection...")
        
        self.is_connected = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        # Clear caches
        self.symbol_cache.clear()
        self.tick_cache.clear()
        self.rates_cache.clear()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        # Shutdown MT5 connection
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, mt5.shutdown)
        
        logger.info("✅ Enhanced MT5 direct connection cleaned up successfully")