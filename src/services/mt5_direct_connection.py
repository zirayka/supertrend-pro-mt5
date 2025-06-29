"""
Enhanced MT5 direct connection using MetaTrader5 Python package
Fixed version with robust symbol loading and fallback mechanisms
"""

import asyncio
import logging
import MetaTrader5 as mt5
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Callable
import pandas as pd
import time

from src.core.models import (
    MT5Connection, MT5Tick, MarketData, CurrencyPair,
    ConnectionStatus
)

logger = logging.getLogger(__name__)


class MT5DirectConnection:
    """Enhanced direct connection to MT5 Terminal with robust symbol loading"""
    
    def __init__(self):
        self.is_connected = False
        self.connection_info = {}
        self.account_info = {}
        self.available_symbols = []
        self.subscribers = []
        self.monitoring_task = None
        
        # Connection retry logic
        self.max_retries = 3
        self.retry_delay = 5
        
    async def initialize(self) -> bool:
        """Initialize connection to MT5 Terminal with enhanced symbol loading"""
        try:
            logger.info("🔌 Initializing MT5 direct connection...")
            
            # Initialize MT5 connection
            if not mt5.initialize():
                error_code = mt5.last_error()
                logger.error(f"❌ MT5 initialization failed, error code: {error_code}")
                logger.error("💡 Please ensure:")
                logger.error("   1. MetaTrader 5 Terminal is running")
                logger.error("   2. You are logged into your trading account")
                logger.error("   3. 'Allow automated trading' is enabled in Tools → Options → Expert Advisors")
                return False
            
            logger.info("✅ MT5 initialized successfully")
            
            # Get account info
            account_info = mt5.account_info()
            if account_info is None:
                logger.error("❌ Failed to get MT5 account info - please check if you're logged in")
                mt5.shutdown()
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
            
            # Load available symbols with multiple attempts
            await self._load_symbols_with_retry()
            
            logger.info("✅ MT5 direct connection established successfully")
            logger.info(f"📊 Account: {self.connection_info['login']} on {self.connection_info['server']}")
            logger.info(f"🏢 Company: {self.connection_info['company']}")
            logger.info(f"💰 Balance: ${self.account_info.get('balance', 0):.2f} {self.connection_info['currency']}")
            logger.info(f"📈 Available symbols: {len(self.available_symbols)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error initializing MT5 connection: {e}")
            return False
    
    async def _load_symbols_with_retry(self):
        """Load symbols with multiple retry attempts and fallback strategies"""
        max_attempts = 3
        
        for attempt in range(max_attempts):
            logger.info(f"📈 Loading trading symbols from MT5 (attempt {attempt + 1}/{max_attempts})...")
            
            try:
                # Method 1: Get all symbols
                symbols = mt5.symbols_get()
                if symbols and len(symbols) > 0:
                    logger.info(f"✅ Method 1: Found {len(symbols)} symbols using symbols_get()")
                    await self._process_symbols(symbols)
                    if len(self.available_symbols) > 0:
                        return
                
                # Method 2: Get symbols by group
                logger.info("🔄 Method 2: Trying symbols_get() with groups...")
                for group in ["*", "Forex*", "Major*", "EUR*", "USD*", "GBP*"]:
                    symbols = mt5.symbols_get(group=group)
                    if symbols and len(symbols) > 0:
                        logger.info(f"✅ Method 2: Found {len(symbols)} symbols using group '{group}'")
                        await self._process_symbols(symbols)
                        if len(self.available_symbols) > 0:
                            return
                
                # Method 3: Get symbols from market watch
                logger.info("🔄 Method 3: Trying to get symbols from market watch...")
                symbols_total = mt5.symbols_total()
                logger.info(f"📊 Total symbols available: {symbols_total}")
                
                if symbols_total > 0:
                    # Try to get symbols one by one
                    for i in range(min(symbols_total, 100)):  # Limit to first 100
                        symbol_name = mt5.symbol_name(i)
                        if symbol_name:
                            symbol_info = mt5.symbol_info(symbol_name)
                            if symbol_info:
                                await self._process_single_symbol(symbol_info)
                
                if len(self.available_symbols) > 0:
                    logger.info(f"✅ Method 3: Loaded {len(self.available_symbols)} symbols from market watch")
                    return
                
                # Method 4: Try common symbols manually
                logger.info("🔄 Method 4: Trying common symbols manually...")
                await self._load_common_symbols()
                if len(self.available_symbols) > 0:
                    return
                
                # Wait before retry
                if attempt < max_attempts - 1:
                    logger.warning(f"⚠️ Attempt {attempt + 1} failed, retrying in 2 seconds...")
                    await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"❌ Error in symbol loading attempt {attempt + 1}: {e}")
                if attempt < max_attempts - 1:
                    await asyncio.sleep(2)
        
        # Final fallback: Create default symbols
        logger.warning("⚠️ All symbol loading methods failed, creating fallback symbols...")
        self._create_fallback_symbols()
    
    async def _process_symbols(self, symbols):
        """Process a list of symbols from MT5"""
        self.available_symbols = []
        symbol_categories = {
            'major': 0, 'minor': 0, 'exotic': 0, 'crypto': 0, 
            'commodities': 0, 'indices': 0, 'other': 0
        }
        
        for symbol in symbols:
            try:
                # Include visible symbols or try to select them
                if symbol.visible or self._try_select_symbol(symbol.name):
                    category = self._categorize_symbol(symbol.name)
                    symbol_categories[category] += 1
                    
                    symbol_info = {
                        'symbol': symbol.name,
                        'description': symbol.description or symbol.name,
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
                        'visible': symbol.visible,
                        'select': True
                    }
                    
                    self.available_symbols.append(symbol_info)
            except Exception as e:
                logger.debug(f"Error processing symbol {symbol.name}: {e}")
                continue
        
        # Sort symbols by category and name
        self.available_symbols.sort(key=lambda x: (x['category'], x['symbol']))
        
        logger.info(f"✅ Processed {len(self.available_symbols)} trading symbols")
        logger.info(f"📊 Symbol distribution: {symbol_categories}")
        
        # Log first few symbols for debugging
        if self.available_symbols:
            logger.info("📋 First 5 symbols loaded:")
            for i, symbol in enumerate(self.available_symbols[:5]):
                logger.info(f"   {i+1}. {symbol['symbol']} ({symbol['category']}) - {symbol['description']}")
    
    async def _process_single_symbol(self, symbol_info):
        """Process a single symbol"""
        try:
            if self._try_select_symbol(symbol_info.name):
                category = self._categorize_symbol(symbol_info.name)
                
                symbol_data = {
                    'symbol': symbol_info.name,
                    'description': symbol_info.description or symbol_info.name,
                    'category': category,
                    'digits': symbol_info.digits,
                    'point': symbol_info.point,
                    'min_lot': symbol_info.volume_min,
                    'max_lot': symbol_info.volume_max,
                    'lot_step': symbol_info.volume_step,
                    'spread': symbol_info.spread,
                    'swap_long': symbol_info.swap_long,
                    'swap_short': symbol_info.swap_short,
                    'currency_base': symbol_info.currency_base,
                    'currency_profit': symbol_info.currency_profit,
                    'currency_margin': symbol_info.currency_margin,
                    'visible': symbol_info.visible,
                    'select': True
                }
                
                self.available_symbols.append(symbol_data)
        except Exception as e:
            logger.debug(f"Error processing single symbol {symbol_info.name}: {e}")
    
    def _try_select_symbol(self, symbol_name: str) -> bool:
        """Try to select a symbol in MT5"""
        try:
            return mt5.symbol_select(symbol_name, True)
        except Exception:
            return False
    
    async def _load_common_symbols(self):
        """Load common trading symbols manually"""
        common_symbols = [
            'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
            'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD',
            'XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL',
            'US30', 'SPX500', 'NAS100', 'UK100', 'GER30',
            'BTCUSD', 'ETHUSD'
        ]
        
        self.available_symbols = []
        
        for symbol_name in common_symbols:
            try:
                # Try to get symbol info
                symbol_info = mt5.symbol_info(symbol_name)
                if symbol_info:
                    # Try to select the symbol
                    if mt5.symbol_select(symbol_name, True):
                        category = self._categorize_symbol(symbol_name)
                        
                        symbol_data = {
                            'symbol': symbol_name,
                            'description': symbol_info.description or symbol_name,
                            'category': category,
                            'digits': symbol_info.digits,
                            'point': symbol_info.point,
                            'min_lot': symbol_info.volume_min,
                            'max_lot': symbol_info.volume_max,
                            'lot_step': symbol_info.volume_step,
                            'spread': symbol_info.spread,
                            'swap_long': symbol_info.swap_long,
                            'swap_short': symbol_info.swap_short,
                            'currency_base': symbol_info.currency_base,
                            'currency_profit': symbol_info.currency_profit,
                            'currency_margin': symbol_info.currency_margin,
                            'visible': True,
                            'select': True
                        }
                        self.available_symbols.append(symbol_data)
                        logger.info(f"✅ Added symbol: {symbol_name}")
            except Exception as e:
                logger.debug(f"Could not load symbol {symbol_name}: {e}")
                continue
        
        logger.info(f"✅ Loaded {len(self.available_symbols)} common symbols manually")
    
    def _create_fallback_symbols(self):
        """Create fallback symbols when MT5 symbols cannot be loaded"""
        logger.info("🔄 Creating fallback symbol list...")
        
        fallback_symbols = [
            {'symbol': 'EURUSD', 'description': 'Euro vs US Dollar', 'category': 'major'},
            {'symbol': 'GBPUSD', 'description': 'British Pound vs US Dollar', 'category': 'major'},
            {'symbol': 'USDJPY', 'description': 'US Dollar vs Japanese Yen', 'category': 'major'},
            {'symbol': 'USDCHF', 'description': 'US Dollar vs Swiss Franc', 'category': 'major'},
            {'symbol': 'AUDUSD', 'description': 'Australian Dollar vs US Dollar', 'category': 'major'},
            {'symbol': 'USDCAD', 'description': 'US Dollar vs Canadian Dollar', 'category': 'major'},
            {'symbol': 'NZDUSD', 'description': 'New Zealand Dollar vs US Dollar', 'category': 'major'},
            {'symbol': 'EURGBP', 'description': 'Euro vs British Pound', 'category': 'minor'},
            {'symbol': 'EURJPY', 'description': 'Euro vs Japanese Yen', 'category': 'minor'},
            {'symbol': 'GBPJPY', 'description': 'British Pound vs Japanese Yen', 'category': 'minor'},
            {'symbol': 'XAUUSD', 'description': 'Gold vs US Dollar', 'category': 'commodities'},
            {'symbol': 'XAGUSD', 'description': 'Silver vs US Dollar', 'category': 'commodities'},
            {'symbol': 'BTCUSD', 'description': 'Bitcoin vs US Dollar', 'category': 'crypto'},
            {'symbol': 'ETHUSD', 'description': 'Ethereum vs US Dollar', 'category': 'crypto'},
            {'symbol': 'US30', 'description': 'Dow Jones Industrial Average', 'category': 'indices'},
            {'symbol': 'SPX500', 'description': 'S&P 500 Index', 'category': 'indices'},
            {'symbol': 'NAS100', 'description': 'NASDAQ 100 Index', 'category': 'indices'},
        ]
        
        self.available_symbols = []
        for symbol_data in fallback_symbols:
            symbol_info = {
                'symbol': symbol_data['symbol'],
                'description': symbol_data['description'],
                'category': symbol_data['category'],
                'digits': 5 if 'JPY' not in symbol_data['symbol'] else 3,
                'point': 0.00001 if 'JPY' not in symbol_data['symbol'] else 0.001,
                'min_lot': 0.01,
                'max_lot': 100.0,
                'lot_step': 0.01,
                'spread': 2.0,
                'swap_long': -1.0,
                'swap_short': 0.5,
                'currency_base': symbol_data['symbol'][:3] if len(symbol_data['symbol']) >= 3 else 'USD',
                'currency_profit': symbol_data['symbol'][3:6] if len(symbol_data['symbol']) >= 6 else 'USD',
                'currency_margin': symbol_data['symbol'][3:6] if len(symbol_data['symbol']) >= 6 else 'USD',
                'visible': True,
                'select': True
            }
            self.available_symbols.append(symbol_info)
        
        logger.info(f"✅ Created {len(self.available_symbols)} fallback symbols")
    
    def _categorize_symbol(self, symbol: str) -> str:
        """Categorize trading symbol based on name"""
        symbol_upper = symbol.upper()
        
        # Major forex pairs
        major_pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']
        if symbol_upper in major_pairs:
            return 'major'
        
        # Minor forex pairs
        minor_pairs = ['EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'GBPCHF', 'GBPAUD', 'AUDCAD', 'AUDCHF', 'AUDJPY', 'AUDNZD', 'CADCHF', 'CADJPY', 'CHFJPY', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'NZDJPY']
        if symbol_upper in minor_pairs:
            return 'minor'
        
        # Commodities
        if any(commodity in symbol_upper for commodity in ['XAU', 'XAG', 'GOLD', 'SILVER', 'OIL', 'WTI', 'BRENT', 'USOIL', 'UKOIL']):
            return 'commodities'
        
        # Indices
        if any(index in symbol_upper for index in ['US30', 'SPX500', 'NAS100', 'UK100', 'GER30', 'FRA40', 'JPN225', 'AUS200', 'HK50', 'CHINA50']):
            return 'indices'
        
        # Cryptocurrencies
        if any(crypto in symbol_upper for crypto in ['BTC', 'ETH', 'LTC', 'XRP', 'ADA', 'DOT', 'LINK', 'BCH', 'EOS', 'TRX']):
            return 'crypto'
        
        # Exotic forex pairs (6-character currency pairs not in major/minor)
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
        """Get available currency pairs with enhanced error handling"""
        if not self.is_connected:
            logger.warning("⚠️ MT5 not connected, returning empty pairs list")
            return []
        
        # If no symbols loaded, try to reload them
        if not self.available_symbols:
            logger.info("🔄 No symbols available, attempting to reload...")
            await self._load_symbols_with_retry()
        
        pairs = []
        for symbol_info in self.available_symbols:
            try:
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
            except Exception as e:
                logger.error(f"❌ Error creating pair for {symbol_info['symbol']}: {e}")
                continue
        
        logger.info(f"📊 Returning {len(pairs)} currency pairs")
        return pairs
    
    async def get_current_tick(self, symbol: str = "EURUSD") -> Optional[MT5Tick]:
        """Get current tick data for symbol"""
        if not self.is_connected:
            return None
        
        try:
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                # Try to select symbol first
                if mt5.symbol_select(symbol, True):
                    tick = mt5.symbol_info_tick(symbol)
                
                if tick is None:
                    logger.warning(f"⚠️ No tick data available for {symbol}")
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
                # Try to select symbol and retry
                if mt5.symbol_select(symbol, True):
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
                
                # Get tick data for available symbols (first few)
                available_symbols = [s['symbol'] for s in self.available_symbols[:5]]  # First 5 symbols
                for symbol in available_symbols:
                    tick = await self.get_current_tick(symbol)
                    if tick:
                        await self._notify_subscribers('tick', tick.dict())
                
                # Get positions and orders
                positions = await self.get_positions()
                orders = await self.get_orders()
                
                await self._notify_subscribers('positions', positions)
                await self._notify_subscribers('orders', orders)
                
                # Wait before next update
                await asyncio.sleep(3)  # Update every 3 seconds
                
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