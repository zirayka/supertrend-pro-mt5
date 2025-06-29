"""MT5 connection management service"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Callable
import aiofiles
import websockets
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from src.core.config import settings
from src.core.models import (
    MT5Connection, MT5Tick, MarketData, CurrencyPair,
    ConnectionStatus
)

logger = logging.getLogger(__name__)


class MT5FileHandler(FileSystemEventHandler):
    """File system event handler for MT5 files"""
    
    def __init__(self, callback: Callable):
        self.callback = callback
        self.last_modified = {}
    
    def on_modified(self, event):
        if event.is_directory:
            return
        
        if event.src_path.endswith('.json'):
            # Debounce file changes
            now = datetime.now().timestamp()
            if event.src_path in self.last_modified:
                if now - self.last_modified[event.src_path] < 0.5:
                    return
            
            self.last_modified[event.src_path] = now
            asyncio.create_task(self.callback(event.src_path))


class MT5ConnectionManager:
    """Manages connections to MT5 Terminal"""
    
    def __init__(self):
        self.connection_status = MT5Connection(is_connected=False)
        self.subscribers: List[Callable] = []
        self.websocket_connection: Optional[websockets.WebSocketServerProtocol] = None
        self.file_observer: Optional[Observer] = None
        self.is_monitoring = False
        
        # Data storage
        self.current_tick: Optional[MT5Tick] = None
        self.market_data: List[MarketData] = []
        self.available_pairs: List[CurrencyPair] = []
        
    async def initialize(self):
        """Initialize MT5 connection"""
        logger.info("🔍 Initializing MT5 connection...")
        
        # Try WebSocket connection first
        websocket_connected = await self._try_websocket_connection()
        
        if not websocket_connected:
            # Try file-based connection
            file_connected = await self._try_file_connection()
            
            if not file_connected:
                logger.warning("⚠️ No MT5 connection available, using demo mode")
                self.connection_status.connection_type = "demo"
                await self._initialize_demo_data()
        
        await self._notify_subscribers("connection", self.connection_status.dict())
    
    async def _try_websocket_connection(self) -> bool:
        """Try to establish WebSocket connection to MT5"""
        try:
            logger.info("🔌 Attempting WebSocket connection to MT5...")
            
            # Test connection with timeout
            async with websockets.connect(
                settings.MT5_WEBSOCKET_URL,
                timeout=5
            ) as websocket:
                # Send ping to test connection
                await websocket.send(json.dumps({"command": "PING"}))
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                
                logger.info("✅ WebSocket connection to MT5 successful")
                self.connection_status.is_connected = True
                self.connection_status.connection_type = "websocket"
                
                # Start WebSocket listener
                asyncio.create_task(self._websocket_listener())
                return True
                
        except Exception as e:
            logger.debug(f"❌ WebSocket connection failed: {e}")
            return False
    
    async def _try_file_connection(self) -> bool:
        """Try to establish file-based connection to MT5"""
        try:
            logger.info("📁 Attempting file-based connection to MT5...")
            
            mt5_files_path = Path(settings.MT5_FILES_PATH)
            if not mt5_files_path.exists():
                logger.warning(f"📁 MT5 files directory not found: {mt5_files_path}")
                return False
            
            # Check for required files
            required_files = ['tick_data.json', 'account_info.json', 'symbols_list.json']
            found_files = []
            
            for file_name in required_files:
                file_path = mt5_files_path / file_name
                if file_path.exists():
                    found_files.append(file_name)
            
            if found_files:
                logger.info(f"✅ File-based connection successful - found {len(found_files)} files")
                self.connection_status.is_connected = True
                self.connection_status.connection_type = "file"
                
                # Start file monitoring
                await self._start_file_monitoring()
                
                # Load initial data
                await self._load_initial_file_data()
                return True
            else:
                logger.warning("📁 No MT5 data files found")
                return False
                
        except Exception as e:
            logger.error(f"❌ File connection failed: {e}")
            return False
    
    async def _start_file_monitoring(self):
        """Start monitoring MT5 files for changes"""
        try:
            mt5_files_path = Path(settings.MT5_FILES_PATH)
            
            # Create file handler
            handler = MT5FileHandler(self._handle_file_change)
            
            # Start observer
            self.file_observer = Observer()
            self.file_observer.schedule(handler, str(mt5_files_path), recursive=False)
            self.file_observer.start()
            
            logger.info("👁️ Started file monitoring for MT5 data")
            
        except Exception as e:
            logger.error(f"❌ Failed to start file monitoring: {e}")
    
    async def _handle_file_change(self, file_path: str):
        """Handle file change events"""
        try:
            file_name = Path(file_path).name
            
            if file_name == 'tick_data.json':
                await self._process_tick_file(file_path)
            elif file_name == 'account_info.json':
                await self._process_account_file(file_path)
            elif file_name == 'symbols_list.json':
                await self._process_symbols_file(file_path)
            elif file_name == 'ohlc_data.json':
                await self._process_ohlc_file(file_path)
                
        except Exception as e:
            logger.error(f"❌ Error processing file change {file_path}: {e}")
    
    async def _process_tick_file(self, file_path: str):
        """Process tick data file"""
        try:
            async with aiofiles.open(file_path, 'r') as f:
                content = await f.read()
                
            if not content.strip():
                return
            
            # Parse JSON (handle multiple lines)
            lines = content.strip().split('\n')
            for line in reversed(lines):  # Process latest first
                if line.strip():
                    try:
                        data = json.loads(line)
                        if data.get('type') == 'TICK' and 'data' in data:
                            tick_data = data['data']
                            tick = MT5Tick(
                                symbol=tick_data['symbol'],
                                time=datetime.fromtimestamp(tick_data['time']),
                                bid=tick_data['bid'],
                                ask=tick_data['ask'],
                                last=tick_data['last'],
                                volume=tick_data['volume'],
                                flags=tick_data.get('flags', 0)
                            )
                            
                            self.current_tick = tick
                            await self._notify_subscribers("tick", tick.dict())
                            break
                    except json.JSONDecodeError:
                        continue
                        
        except Exception as e:
            logger.debug(f"Error processing tick file: {e}")
    
    async def _process_account_file(self, file_path: str):
        """Process account info file"""
        try:
            async with aiofiles.open(file_path, 'r') as f:
                content = await f.read()
            
            if not content.strip():
                return
            
            data = json.loads(content)
            if data.get('type') == 'ACCOUNT_INFO' and 'data' in data:
                account_data = data['data']
                
                self.connection_status.server = account_data.get('server')
                self.connection_status.account = account_data.get('account')
                self.connection_status.balance = account_data.get('balance')
                self.connection_status.equity = account_data.get('equity')
                self.connection_status.margin = account_data.get('margin')
                self.connection_status.free_margin = account_data.get('freeMargin')
                self.connection_status.margin_level = account_data.get('marginLevel')
                self.connection_status.last_update = datetime.now()
                
                await self._notify_subscribers("connection", self.connection_status.dict())
                
        except Exception as e:
            logger.debug(f"Error processing account file: {e}")
    
    async def _process_symbols_file(self, file_path: str):
        """Process symbols list file"""
        try:
            async with aiofiles.open(file_path, 'r') as f:
                content = await f.read()
            
            if not content.strip():
                return
            
            data = json.loads(content)
            if data.get('type') == 'SYMBOLS' and 'data' in data:
                symbols_data = data['data']
                
                self.available_pairs = []
                for symbol_info in symbols_data:
                    pair = CurrencyPair(
                        symbol=symbol_info['name'],
                        name=symbol_info.get('description', symbol_info['name']),
                        category=self._categorize_symbol(symbol_info['name']),
                        digits=symbol_info['digits'],
                        point_size=10 ** -symbol_info['digits'],
                        min_lot=symbol_info['volume_min'],
                        max_lot=symbol_info['volume_max'],
                        lot_step=symbol_info['volume_step'],
                        spread=symbol_info.get('spread')
                    )
                    self.available_pairs.append(pair)
                
                await self._notify_subscribers("symbols", [p.dict() for p in self.available_pairs])
                
        except Exception as e:
            logger.debug(f"Error processing symbols file: {e}")
    
    async def _process_ohlc_file(self, file_path: str):
        """Process OHLC data file"""
        try:
            async with aiofiles.open(file_path, 'r') as f:
                content = await f.read()
            
            if not content.strip():
                return
            
            data = json.loads(content)
            if data.get('type') == 'OHLC' and 'data' in data:
                ohlc_data = data['data']
                
                market_data = MarketData(
                    timestamp=datetime.fromtimestamp(ohlc_data['timestamp']),
                    symbol=ohlc_data['symbol'],
                    open=ohlc_data['open'],
                    high=ohlc_data['high'],
                    low=ohlc_data['low'],
                    close=ohlc_data['close'],
                    volume=ohlc_data['volume']
                )
                
                # Add to market data (keep last 1000 candles)
                self.market_data.append(market_data)
                if len(self.market_data) > settings.MAX_CANDLES:
                    self.market_data = self.market_data[-settings.MAX_CANDLES:]
                
                await self._notify_subscribers("ohlc", market_data.dict())
                
        except Exception as e:
            logger.debug(f"Error processing OHLC file: {e}")
    
    async def _load_initial_file_data(self):
        """Load initial data from files"""
        mt5_files_path = Path(settings.MT5_FILES_PATH)
        
        # Load symbols first
        symbols_file = mt5_files_path / 'symbols_list.json'
        if symbols_file.exists():
            await self._process_symbols_file(str(symbols_file))
        
        # Load account info
        account_file = mt5_files_path / 'account_info.json'
        if account_file.exists():
            await self._process_account_file(str(account_file))
        
        # Load latest tick
        tick_file = mt5_files_path / 'tick_data.json'
        if tick_file.exists():
            await self._process_tick_file(str(tick_file))
    
    def _categorize_symbol(self, symbol: str) -> str:
        """Categorize trading symbol"""
        major_pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']
        minor_pairs = ['EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD']
        commodities = ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL']
        indices = ['US30', 'SPX500', 'NAS100', 'UK100', 'GER30']
        crypto = ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD']
        
        if symbol in major_pairs:
            return 'major'
        elif symbol in minor_pairs:
            return 'minor'
        elif any(c in symbol for c in commodities):
            return 'commodities'
        elif any(i in symbol for i in indices):
            return 'indices'
        elif any(c in symbol for c in crypto):
            return 'crypto'
        else:
            return 'exotic'
    
    async def _initialize_demo_data(self):
        """Initialize demo data when no MT5 connection"""
        # Create demo currency pairs
        demo_pairs = [
            CurrencyPair(
                symbol='EURUSD', name='Euro vs US Dollar', category='major',
                digits=5, point_size=0.00001, min_lot=0.01, max_lot=100, lot_step=0.01
            ),
            CurrencyPair(
                symbol='GBPUSD', name='British Pound vs US Dollar', category='major',
                digits=5, point_size=0.00001, min_lot=0.01, max_lot=100, lot_step=0.01
            ),
            CurrencyPair(
                symbol='USDJPY', name='US Dollar vs Japanese Yen', category='major',
                digits=3, point_size=0.001, min_lot=0.01, max_lot=100, lot_step=0.01
            ),
            CurrencyPair(
                symbol='XAUUSD', name='Gold vs US Dollar', category='commodities',
                digits=2, point_size=0.01, min_lot=0.01, max_lot=100, lot_step=0.01
            ),
            CurrencyPair(
                symbol='BTCUSD', name='Bitcoin vs US Dollar', category='crypto',
                digits=2, point_size=0.01, min_lot=0.01, max_lot=10, lot_step=0.01
            )
        ]
        
        self.available_pairs = demo_pairs
        
        # Set demo connection info
        self.connection_status.server = "Demo Mode"
        self.connection_status.account = 12345678
        self.connection_status.balance = 10000.0
        self.connection_status.equity = 10000.0
        self.connection_status.margin = 0.0
        self.connection_status.free_margin = 10000.0
        self.connection_status.margin_level = 0.0
        self.connection_status.last_update = datetime.now()
    
    async def _websocket_listener(self):
        """Listen for WebSocket messages from MT5"""
        try:
            async with websockets.connect(settings.MT5_WEBSOCKET_URL) as websocket:
                self.websocket_connection = websocket
                
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        await self._handle_websocket_message(data)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON received: {message}")
                        
        except Exception as e:
            logger.error(f"WebSocket listener error: {e}")
            self.connection_status.is_connected = False
            await self._notify_subscribers("connection", self.connection_status.dict())
    
    async def _handle_websocket_message(self, data: dict):
        """Handle WebSocket message from MT5"""
        message_type = data.get('type')
        
        if message_type == 'TICK':
            tick_data = data['data']
            tick = MT5Tick(
                symbol=tick_data['symbol'],
                time=datetime.fromtimestamp(tick_data['time']),
                bid=tick_data['bid'],
                ask=tick_data['ask'],
                last=tick_data['last'],
                volume=tick_data['volume'],
                flags=tick_data.get('flags', 0)
            )
            self.current_tick = tick
            await self._notify_subscribers("tick", tick.dict())
            
        elif message_type == 'ACCOUNT_INFO':
            account_data = data['data']
            self.connection_status.server = account_data.get('server')
            self.connection_status.account = account_data.get('account')
            self.connection_status.balance = account_data.get('balance')
            self.connection_status.equity = account_data.get('equity')
            self.connection_status.margin = account_data.get('margin')
            self.connection_status.free_margin = account_data.get('freeMargin')
            self.connection_status.margin_level = account_data.get('marginLevel')
            self.connection_status.last_update = datetime.now()
            
            await self._notify_subscribers("connection", self.connection_status.dict())
    
    async def start_monitoring(self):
        """Start monitoring for demo data generation"""
        if self.connection_status.connection_type == "demo":
            self.is_monitoring = True
            asyncio.create_task(self._generate_demo_data())
    
    async def _generate_demo_data(self):
        """Generate demo market data"""
        import random
        import math
        
        base_prices = {
            'EURUSD': 1.0850,
            'GBPUSD': 1.2650,
            'USDJPY': 149.50,
            'XAUUSD': 2050.0,
            'BTCUSD': 43500.0
        }
        
        current_prices = base_prices.copy()
        
        while self.is_monitoring:
            try:
                for symbol, base_price in base_prices.items():
                    # Generate realistic price movement
                    volatility = {
                        'EURUSD': 0.0001,
                        'GBPUSD': 0.0002,
                        'USDJPY': 0.01,
                        'XAUUSD': 0.5,
                        'BTCUSD': 50.0
                    }.get(symbol, 0.0001)
                    
                    # Add trend and random movement
                    trend = math.sin(datetime.now().timestamp() / 60) * 0.3
                    random_change = (random.random() - 0.5) * 2
                    change = (trend + random_change) * volatility * current_prices[symbol]
                    
                    new_price = max(current_prices[symbol] + change, current_prices[symbol] * 0.95)
                    current_prices[symbol] = new_price
                    
                    # Generate spread
                    spread = {
                        'EURUSD': 0.00015,
                        'GBPUSD': 0.0002,
                        'USDJPY': 0.015,
                        'XAUUSD': 0.3,
                        'BTCUSD': 10.0
                    }.get(symbol, 0.0002)
                    
                    bid = new_price - spread / 2
                    ask = new_price + spread / 2
                    
                    # Create tick
                    tick = MT5Tick(
                        symbol=symbol,
                        time=datetime.now(),
                        bid=bid,
                        ask=ask,
                        last=new_price,
                        volume=random.randint(100, 1000),
                        flags=0
                    )
                    
                    if symbol == 'EURUSD':  # Only send EURUSD for demo
                        self.current_tick = tick
                        await self._notify_subscribers("tick", tick.dict())
                
                await asyncio.sleep(settings.UPDATE_INTERVAL)
                
            except Exception as e:
                logger.error(f"Error generating demo data: {e}")
                await asyncio.sleep(5)
    
    def subscribe(self, callback: Callable):
        """Subscribe to MT5 events"""
        self.subscribers.append(callback)
    
    def unsubscribe(self, callback: Callable):
        """Unsubscribe from MT5 events"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)
    
    async def _notify_subscribers(self, event_type: str, data: dict):
        """Notify all subscribers of events"""
        for callback in self.subscribers:
            try:
                await callback(event_type, data)
            except Exception as e:
                logger.error(f"Error notifying subscriber: {e}")
    
    async def get_connection_status(self) -> MT5Connection:
        """Get current connection status"""
        return self.connection_status
    
    async def get_available_pairs(self) -> List[CurrencyPair]:
        """Get available currency pairs"""
        return self.available_pairs
    
    async def get_current_tick(self) -> Optional[MT5Tick]:
        """Get current tick data"""
        return self.current_tick
    
    async def get_market_data(self) -> List[MarketData]:
        """Get market data"""
        return self.market_data
    
    async def cleanup(self):
        """Cleanup resources"""
        self.is_monitoring = False
        
        if self.file_observer:
            self.file_observer.stop()
            self.file_observer.join()
        
        if self.websocket_connection:
            await self.websocket_connection.close()
        
        logger.info("🧹 MT5 connection manager cleaned up")