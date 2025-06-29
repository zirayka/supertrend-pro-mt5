"""
Enhanced MT5 direct connection using MetaTrader5 Python package
Fixed version with robust symbol loading and optimized monitoring for minimal delay
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
    """Enhanced direct connection to MT5 Terminal with optimized monitoring for minimal delay"""
    
    def __init__(self):
        self.is_connected = False
        self.connection_info = {}
        self.account_info = {}
        self.available_symbols = []
        self.currency_pairs = []  # Processed CurrencyPair objects
        self.subscribers = []
        self.monitoring_task = None
        
        # Connection retry logic
        self.max_retries = 3
        self.retry_delay = 3  # Reduced from 5 to 3 seconds
        
        # Symbol loading state
        self.symbols_loaded = False
        self.symbols_loading = False
        
        # Performance optimization
        self.monitoring_interval = 1.0  # Reduced from 3 to 1 second
        self.tick_symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD"]  # Focus on major pairs for faster updates
        
    async def initialize(self) -> bool:
        """Initialize connection to MT5 Terminal with enhanced error handling"""
        try:
            logger.info("🔌 Initializing MT5 direct connection...")
            
            # Check if MT5 package is available
            try:
                import MetaTrader5 as mt5
                logger.info("✅ MetaTrader5 package imported successfully")
            except ImportError as e:
                logger.error(f"❌ MetaTrader5 package not available: {e}")
                logger.error("💡 Please install MetaTrader5 package: pip install MetaTrader5")
                return False
            
            # Initialize MT5 connection
            logger.info("🔄 Attempting to initialize MT5...")
            init_result = mt5.initialize()
            logger.info(f"📊 MT5 initialize() returned: {init_result}")
            
            if not init_result:
                error_code = mt5.last_error()
                logger.error(f"❌ MT5 initialization failed, error code: {error_code}")
                
                # Provide specific error guidance
                if error_code == (1, 'Terminal: no connection'):
                    logger.error("💡 MT5 Terminal is not running or not connected to internet")
                    logger.error("   1. Start MetaTrader 5 Terminal")
                    logger.error("   2. Ensure internet connection is available")
                    logger.error("   3. Wait for terminal to connect to broker server")
                elif error_code == (1, 'Terminal: authorization failed'):
                    logger.error("💡 MT5 Terminal authorization failed")
                    logger.error("   1. Check your login credentials in MT5")
                    logger.error("   2. Ensure you're logged into a trading account")
                    logger.error("   3. Check if your account is active")
                else:
                    logger.error("💡 General MT5 connection issues:")
                    logger.error("   1. Ensure MetaTrader 5 Terminal is running")
                    logger.error("   2. Log into your trading account")
                    logger.error("   3. Enable 'Allow automated trading' in Tools → Options → Expert Advisors")
                    logger.error("   4. Check if your broker allows API connections")
                
                return False
            
            logger.info("✅ MT5 initialized successfully")
            
            # Get terminal info for debugging
            try:
                terminal_info = mt5.terminal_info()
                if terminal_info:
                    logger.info(f"📊 Terminal: {terminal_info.name} {terminal_info.build}")
                    logger.info(f"📊 Company: {terminal_info.company}")
                    logger.info(f"📊 Connected: {terminal_info.connected}")
                    logger.info(f"📊 Trade allowed: {terminal_info.trade_allowed}")
                else:
                    logger.warning("⚠️ Could not get terminal info")
            except Exception as e:
                logger.warning(f"⚠️ Error getting terminal info: {e}")
            
            # Get account info
            logger.info("🔄 Getting account information...")
            account_info = mt5.account_info()
            if account_info is None:
                logger.error("❌ Failed to get MT5 account info")
                logger.error("💡 This usually means:")
                logger.error("   1. You're not logged into a trading account")
                logger.error("   2. The account connection is unstable")
                logger.error("   3. The broker server is not responding")
                
                # Try to get last error
                error_code = mt5.last_error()
                logger.error(f"❌ Last error: {error_code}")
                
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
            
            logger.info("✅ Account info retrieved successfully")
            logger.info(f"📊 Account: {self.connection_info['login']} on {self.connection_info['server']}")
            logger.info(f"🏢 Company: {self.connection_info['company']}")
            logger.info(f"💰 Balance: ${self.account_info.get('balance', 0):.2f} {self.connection_info['currency']}")
            
            # Load available symbols immediately and synchronously
            logger.info("🔄 Loading trading symbols...")
            await self._load_symbols_async()
            
            logger.info("✅ MT5 direct connection established successfully")
            logger.info(f"📈 Available symbols: {len(self.available_symbols)}")
            logger.info(f"📋 Currency pairs: {len(self.currency_pairs)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error initializing MT5 connection: {e}")
            logger.error(f"❌ Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return False
    
    async def _load_symbols_async(self):
        """Load symbols asynchronously during initialization"""
        if self.symbols_loading:
            logger.info("⏳ Symbols already loading, waiting...")
            while self.symbols_loading:
                await asyncio.sleep(0.1)
            return
        
        self.symbols_loading = True
        logger.info("📈 Loading trading symbols from MT5...")
        
        try:
            # Run symbol loading in executor to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._load_symbols_sync)
            
        except Exception as e:
            logger.error(f"❌ Error in async symbol loading: {e}")
            await loop.run_in_executor(None, self._create_fallback_symbols)
        finally:
            self.symbols_loading = False
            self.symbols_loaded = True
            
        logger.info(f"✅ Async symbol loading complete: {len(self.available_symbols)} symbols, {len(self.currency_pairs)} pairs")
    
    def _load_symbols_sync(self):
        """Load symbols synchronously with enhanced error handling"""
        logger.info("📊 Starting synchronous symbol loading...")
        
        try:
            # Check if MT5 is still connected
            if not mt5.terminal_info():
                logger.error("❌ MT5 terminal not available during symbol loading")
                self._create_fallback_symbols()
                return
            
            # Method 1: Get all symbols directly
            logger.info("🔄 Attempting to get symbols using symbols_get()...")
            symbols = mt5.symbols_get()
            if symbols and len(symbols) > 0:
                logger.info(f"✅ Found {len(symbols)} symbols using symbols_get()")
                self._process_symbols_sync(symbols)
                if len(self.currency_pairs) > 0:
                    logger.info(f"✅ Successfully processed {len(self.currency_pairs)} currency pairs")
                    return
            else:
                logger.warning("⚠️ symbols_get() returned no symbols")
            
            # Method 2: Get symbols total and iterate
            logger.info("🔄 Attempting to get symbols by iteration...")
            symbols_total = mt5.symbols_total()
            logger.info(f"📊 Total symbols in MT5: {symbols_total}")
            
            if symbols_total > 0:
                loaded_symbols = []
                for i in range(min(symbols_total, 100)):  # Load first 100 symbols for testing
                    try:
                        symbol_name = mt5.symbol_name(i)
                        if symbol_name:
                            symbol_info = mt5.symbol_info(symbol_name)
                            if symbol_info:
                                loaded_symbols.append(symbol_info)
                                if len(loaded_symbols) % 20 == 0:
                                    logger.info(f"📊 Loaded {len(loaded_symbols)} symbols so far...")
                    except Exception as e:
                        logger.debug(f"Error loading symbol {i}: {e}")
                        continue
                
                if loaded_symbols:
                    logger.info(f"✅ Found {len(loaded_symbols)} symbols by iteration")
                    self._process_symbols_sync(loaded_symbols)
                    if len(self.currency_pairs) > 0:
                        logger.info(f"✅ Successfully processed {len(self.currency_pairs)} currency pairs")
                        return
                else:
                    logger.warning("⚠️ Symbol iteration returned no symbols")
            else:
                logger.warning("⚠️ symbols_total() returned 0")
            
            # Method 3: Try common symbols
            logger.info("🔄 Trying common symbols...")
            self._load_common_symbols_sync()
            if len(self.currency_pairs) > 0:
                logger.info(f"✅ Successfully loaded {len(self.currency_pairs)} common symbols")
                return
            
            # Method 4: Create fallback symbols
            logger.warning("⚠️ All symbol loading methods failed, creating fallback symbols...")
            self._create_fallback_symbols()
            
        except Exception as e:
            logger.error(f"❌ Error loading symbols: {e}")
            logger.error(f"❌ Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            self._create_fallback_symbols()
    
    def _process_symbols_sync(self, symbols):
        """Process symbols synchronously and create CurrencyPair objects"""
        logger.info(f"🔄 Processing {len(symbols)} symbols...")
        
        self.available_symbols = []
        self.currency_pairs = []
        
        symbol_categories = {
            'major': 0, 'minor': 0, 'exotic': 0, 'crypto': 0, 
            'commodities': 0, 'indices': 0, 'other': 0
        }
        
        processed_count = 0
        
        for symbol in symbols:
            try:
                # Process symbol info
                symbol_name = symbol.name if hasattr(symbol, 'name') else str(symbol)
                
                # Try to get full symbol info if we only have name
                if isinstance(symbol, str):
                    symbol_info = mt5.symbol_info(symbol)
                    if not symbol_info:
                        continue
                    symbol = symbol_info
                
                # Try to select symbol to make it available
                try:
                    mt5.symbol_select(symbol_name, True)
                except:
                    pass  # Continue even if selection fails
                
                category = self._categorize_symbol(symbol_name)
                symbol_categories[category] += 1
                
                # Create symbol info dict with safe attribute access
                symbol_data = {
                    'symbol': symbol_name,
                    'description': self._safe_get_attr(symbol, 'description', symbol_name) or symbol_name,
                    'category': category,
                    'digits': self._safe_get_attr(symbol, 'digits', 5),
                    'point': self._safe_get_attr(symbol, 'point', 0.00001),
                    'min_lot': self._safe_get_attr(symbol, 'volume_min', 0.01),
                    'max_lot': self._safe_get_attr(symbol, 'volume_max', 100.0),
                    'lot_step': self._safe_get_attr(symbol, 'volume_step', 0.01),
                    'spread': self._safe_get_attr(symbol, 'spread', 2),
                    'swap_long': self._safe_get_attr(symbol, 'swap_long', -1.0),
                    'swap_short': self._safe_get_attr(symbol, 'swap_short', 0.5),
                    'currency_base': self._safe_get_attr(symbol, 'currency_base', 'USD'),
                    'currency_profit': self._safe_get_attr(symbol, 'currency_profit', 'USD'),
                    'currency_margin': self._safe_get_attr(symbol, 'currency_margin', 'USD'),
                    'visible': self._safe_get_attr(symbol, 'visible', True),
                    'select': True
                }
                
                self.available_symbols.append(symbol_data)
                
                # Create CurrencyPair object with validation
                try:
                    pair = CurrencyPair(
                        symbol=symbol_data['symbol'],
                        name=symbol_data['description'],
                        category=symbol_data['category'],
                        digits=int(symbol_data['digits']),
                        point_size=float(symbol_data['point']),
                        min_lot=float(symbol_data['min_lot']),
                        max_lot=float(symbol_data['max_lot']),
                        lot_step=float(symbol_data['lot_step']),
                        spread=float(symbol_data['spread']) if symbol_data['spread'] is not None else 2.0,
                        swap_long=float(symbol_data['swap_long']) if symbol_data['swap_long'] is not None else -1.0,
                        swap_short=float(symbol_data['swap_short']) if symbol_data['swap_short'] is not None else 0.5
                    )
                    self.currency_pairs.append(pair)
                    processed_count += 1
                    
                    # Log progress for first few symbols
                    if processed_count <= 5:
                        logger.info(f"   ✅ Processed: {symbol_name} ({category}) - {symbol_data['description']}")
                        
                except Exception as e:
                    logger.debug(f"Error creating CurrencyPair for {symbol_name}: {e}")
                    continue
                    
            except Exception as e:
                logger.debug(f"Error processing symbol {symbol}: {e}")
                continue
        
        # Sort symbols by category and name
        self.available_symbols.sort(key=lambda x: (x['category'], x['symbol']))
        self.currency_pairs.sort(key=lambda x: (x.category, x.symbol))
        
        logger.info(f"✅ Processed {len(self.available_symbols)} symbols into {len(self.currency_pairs)} currency pairs")
        logger.info(f"📊 Symbol distribution: {symbol_categories}")
        
        # Validate that we have currency pairs
        if len(self.currency_pairs) == 0:
            logger.error("❌ No currency pairs were created from symbols!")
            logger.error("🔍 This might indicate a data processing issue")
            # Create fallback symbols if processing failed
            self._create_fallback_symbols()
        else:
            logger.info("📋 Sample currency pairs:")
            for i, pair in enumerate(self.currency_pairs[:3]):
                logger.info(f"   {i+1}. {pair.symbol} ({pair.category}) - {pair.name}")
    
    def _safe_get_attr(self, obj, attr_name, default_value):
        """Safely get attribute from object with default value"""
        try:
            value = getattr(obj, attr_name, default_value)
            return value if value is not None else default_value
        except:
            return default_value
    
    def _load_common_symbols_sync(self):
        """Load common trading symbols synchronously"""
        logger.info("🔄 Loading common trading symbols...")
        
        common_symbols = [
            'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
            'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD',
            'XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL',
            'US30', 'SPX500', 'NAS100', 'UK100', 'GER30',
            'BTCUSD', 'ETHUSD'
        ]
        
        self.available_symbols = []
        self.currency_pairs = []
        
        successful_symbols = 0
        
        for symbol_name in common_symbols:
            try:
                # Try to get symbol info
                symbol_info = mt5.symbol_info(symbol_name)
                if symbol_info:
                    # Try to select the symbol
                    try:
                        mt5.symbol_select(symbol_name, True)
                    except:
                        pass  # Continue even if selection fails
                    
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
                    
                    # Create CurrencyPair object
                    try:
                        pair = CurrencyPair(
                            symbol=symbol_name,
                            name=symbol_data['description'],
                            category=category,
                            digits=symbol_data['digits'],
                            point_size=symbol_data['point'],
                            min_lot=symbol_data['min_lot'],
                            max_lot=symbol_data['max_lot'],
                            lot_step=symbol_data['lot_step'],
                            spread=float(symbol_data['spread']) if symbol_data['spread'] is not None else 2.0,
                            swap_long=float(symbol_data['swap_long']) if symbol_data['swap_long'] is not None else -1.0,
                            swap_short=float(symbol_data['swap_short']) if symbol_data['swap_short'] is not None else 0.5
                        )
                        self.currency_pairs.append(pair)
                        successful_symbols += 1
                        logger.info(f"✅ Added common symbol: {symbol_name}")
                    except Exception as e:
                        logger.debug(f"Error creating pair for {symbol_name}: {e}")
                else:
                    logger.debug(f"Symbol info not available for {symbol_name}")
            except Exception as e:
                logger.debug(f"Could not load symbol {symbol_name}: {e}")
                continue
        
        logger.info(f"✅ Loaded {successful_symbols} common symbols out of {len(common_symbols)} attempted")
    
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
        self.currency_pairs = []
        
        for symbol_data in fallback_symbols:
            # Create symbol info dict
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
            
            # Create CurrencyPair object
            try:
                pair = CurrencyPair(
                    symbol=symbol_data['symbol'],
                    name=symbol_data['description'],
                    category=symbol_data['category'],
                    digits=symbol_info['digits'],
                    point_size=symbol_info['point'],
                    min_lot=symbol_info['min_lot'],
                    max_lot=symbol_info['max_lot'],
                    lot_step=symbol_info['lot_step'],
                    spread=symbol_info['spread'],
                    swap_long=symbol_info['swap_long'],
                    swap_short=symbol_info['swap_short']
                )
                self.currency_pairs.append(pair)
            except Exception as e:
                logger.error(f"Error creating fallback pair for {symbol_data['symbol']}: {e}")
        
        logger.info(f"✅ Created {len(self.available_symbols)} fallback symbols and {len(self.currency_pairs)} pairs")
    
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
        """Get available currency pairs - returns the actual loaded pairs"""
        logger.debug(f"📊 MT5DirectConnection: get_available_pairs called")
        logger.debug(f"📊 Connection status: {self.is_connected}")
        logger.debug(f"📊 Symbols loaded: {self.symbols_loaded}")
        logger.debug(f"📊 Symbols loading: {self.symbols_loading}")
        logger.debug(f"📊 Currency pairs count: {len(self.currency_pairs)}")
        
        if not self.is_connected:
            logger.warning("⚠️ MT5 not connected, returning empty pairs list")
            return []
        
        # If symbols are not loaded yet, try to load them
        if not self.symbols_loaded and not self.symbols_loading:
            logger.info("🔄 Symbols not loaded, loading now...")
            await self._load_symbols_async()
        
        # Wait for loading to complete if in progress
        while self.symbols_loading:
            logger.info("⏳ Waiting for symbol loading to complete...")
            await asyncio.sleep(0.1)
        
        logger.debug(f"✅ Returning {len(self.currency_pairs)} currency pairs")
        
        # Log first few pairs for debugging
        if self.currency_pairs:
            logger.debug("📋 First few pairs:")
            for i, pair in enumerate(self.currency_pairs[:3]):
                logger.debug(f"   {i+1}. {pair.symbol} ({pair.category}) - {pair.name}")
        else:
            logger.error("❌ No currency pairs available to return!")
        
        # Return a copy to prevent external modification
        return [pair for pair in self.currency_pairs]
    
    def get_symbols_count(self) -> int:
        """Get the count of available symbols (for health check)"""
        return len(self.available_symbols)
    
    def get_pairs_count(self) -> int:
        """Get the count of processed currency pairs"""
        return len(self.currency_pairs)
    
    async def _load_symbols(self):
        """Async wrapper for symbol loading (for compatibility)"""
        if not self.symbols_loaded:
            await self._load_symbols_async()
    
    async def get_current_tick(self, symbol: str = "EURUSD") -> Optional[MT5Tick]:
        """Get current tick data for symbol with optimized performance"""
        if not self.is_connected:
            return None
        
        try:
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                # Try to select symbol first
                if mt5.symbol_select(symbol, True):
                    tick = mt5.symbol_info_tick(symbol)
                
                if tick is None:
                    logger.debug(f"⚠️ No tick data available for {symbol}")
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
        """Start optimized monitoring MT5 data with reduced delay"""
        if self.monitoring_task is None:
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())
    
    async def _monitoring_loop(self):
        """Optimized monitoring loop for real-time data with minimal delay"""
        logger.info("🔄 Starting optimized MT5 monitoring loop...")
        
        while self.is_connected:
            try:
                # Update account info less frequently (every 3 cycles)
                if hasattr(self, '_monitor_cycle'):
                    self._monitor_cycle += 1
                else:
                    self._monitor_cycle = 0
                
                if self._monitor_cycle % 3 == 0:
                    account_info = mt5.account_info()
                    if account_info:
                        self.account_info = account_info._asdict()
                        await self._notify_subscribers('account_info', self.account_info)
                
                # Get tick data for focused symbols (faster than all symbols)
                for symbol in self.tick_symbols:
                    try:
                        tick = await self.get_current_tick(symbol)
                        if tick:
                            await self._notify_subscribers('tick', tick.dict())
                    except Exception as e:
                        logger.debug(f"Error getting tick for {symbol}: {e}")
                        continue
                
                # Get positions and orders less frequently (every 5 cycles)
                if self._monitor_cycle % 5 == 0:
                    positions = await self.get_positions()
                    orders = await self.get_orders()
                    
                    await self._notify_subscribers('positions', positions)
                    await self._notify_subscribers('orders', orders)
                
                # Optimized wait time for minimal delay
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"❌ Error in monitoring loop: {e}")
                await asyncio.sleep(2)  # Wait longer on error
    
    def subscribe(self, callback):
        """Subscribe to MT5 events"""
        self.subscribers.append(callback)
    
    def unsubscribe(self, callback):
        """Unsubscribe from MT5 events"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)
    
    async def _notify_subscribers(self, event_type: str, data):
        """Notify all subscribers of events with optimized async processing"""
        if not self.subscribers:
            return
            
        # Process notifications concurrently for better performance
        tasks = []
        for callback in self.subscribers:
            try:
                task = asyncio.create_task(callback(event_type, data))
                tasks.append(task)
            except Exception as e:
                logger.error(f"❌ Error creating notification task: {e}")
        
        if tasks:
            try:
                await asyncio.gather(*tasks, return_exceptions=True)
            except Exception as e:
                logger.error(f"❌ Error in notification gathering: {e}")
    
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
        try:
            mt5.shutdown()
            logger.info("✅ MT5 connection shutdown successfully")
        except Exception as e:
            logger.error(f"❌ Error shutting down MT5: {e}")
        
        logger.info("✅ MT5 direct connection cleaned up")