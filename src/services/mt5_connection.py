"""
MT5 connection management service - Direct MT5 connection only
Provides real-time access to MT5 Terminal data and account information
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable

from src.core.models import (
    MT5Connection, MT5Tick, MarketData, CurrencyPair,
    ConnectionStatus
)
from src.services.mt5_direct_connection import MT5DirectConnection

logger = logging.getLogger(__name__)


class MT5ConnectionManager:
    """MT5 connection manager - Direct MT5 connection only"""
    
    def __init__(self):
        self.connection_status = MT5Connection(is_connected=False)
        self.subscribers: List[Callable] = []
        self.is_monitoring = False
        
        # Direct MT5 connection
        self.direct_connection = MT5DirectConnection()
        
        # Data storage
        self.current_tick: Optional[MT5Tick] = None
        self.market_data: List[MarketData] = []
        self.available_pairs: List[CurrencyPair] = []
        self.positions: List[Dict] = []
        self.orders: List[Dict] = []
        
        # Connection stability tracking
        self.connection_attempts = 0
        self.max_connection_attempts = 5
        self.connection_retry_delay = 10  # seconds
        
    async def initialize(self):
        """Initialize MT5 direct connection with retry logic"""
        logger.info("Initializing MT5 direct connection...")
        
        # Try direct MT5 connection with retries
        for attempt in range(self.max_connection_attempts):
            self.connection_attempts = attempt + 1
            
            logger.info(f"MT5 connection attempt {self.connection_attempts}/{self.max_connection_attempts}")
            
            if await self._try_direct_connection():
                await self._notify_subscribers("connection", self.connection_status.dict())
                return
            
            if attempt < self.max_connection_attempts - 1:
                logger.warning(f"Connection attempt {self.connection_attempts} failed, retrying in {self.connection_retry_delay} seconds...")
                await asyncio.sleep(self.connection_retry_delay)
        
        # If all attempts failed
        logger.error("Failed to establish MT5 connection after all attempts")
        logger.error("Please ensure:")
        logger.error("   1. MetaTrader 5 Terminal is running")
        logger.error("   2. You are logged into a trading account")
        logger.error("   3. 'Allow automated trading' is enabled in MT5 settings")
        
        self.connection_status.is_connected = False
        self.connection_status.connection_type = "disconnected"
        await self._notify_subscribers("connection", self.connection_status.dict())
    
    async def _try_direct_connection(self) -> bool:
        """Try to establish direct MT5 connection"""
        try:
            logger.info("Attempting direct MT5 connection...")
            
            if await self.direct_connection.initialize():
                self.connection_status.is_connected = True
                self.connection_status.connection_type = "direct"
                
                # Subscribe to direct connection events
                self.direct_connection.subscribe(self._handle_direct_connection_event)
                
                # Load initial data
                await self._load_direct_connection_data()
                
                # Start monitoring
                await self.direct_connection.start_monitoring()
                
                logger.info("Direct MT5 connection established successfully")
                return True
            
        except Exception as e:
            logger.error(f"Direct MT5 connection failed: {e}")
        
        return False
    
    async def _load_direct_connection_data(self):
        """Load initial data from direct MT5 connection"""
        try:
            # Load connection status
            connection = await self.direct_connection.get_connection_status()
            self.connection_status = connection
            
            # Load available pairs
            pairs = await self.direct_connection.get_available_pairs()
            self.available_pairs = pairs
            
            # Load positions and orders
            self.positions = await self.direct_connection.get_positions()
            self.orders = await self.direct_connection.get_orders()
            
            # Get initial tick data for EURUSD
            self.current_tick = await self.direct_connection.get_current_tick("EURUSD")
            
            # Get market data for EURUSD
            market_data = await self.direct_connection.get_market_data("EURUSD", "M15", 100)
            self.market_data = market_data
            
            logger.info(f"Loaded {len(self.available_pairs)} pairs, {len(self.positions)} positions, {len(self.orders)} orders")
            
            # Notify subscribers about loaded data
            await self._notify_subscribers("symbols", self.available_pairs)
            await self._notify_subscribers("positions", self.positions)
            await self._notify_subscribers("orders", self.orders)
            
        except Exception as e:
            logger.error(f"Error loading direct connection data: {e}")
    
    async def _handle_direct_connection_event(self, event_type: str, data):
        """Handle events from direct MT5 connection"""
        try:
            if event_type == 'tick':
                tick_data = data
                self.current_tick = MT5Tick(**tick_data)
                await self._notify_subscribers("tick", tick_data)
                
            elif event_type == 'account_info':
                # Update connection status with account info
                self.connection_status.balance = data.get('balance')
                self.connection_status.equity = data.get('equity')
                self.connection_status.margin = data.get('margin')
                self.connection_status.free_margin = data.get('margin_free')
                self.connection_status.margin_level = data.get('margin_level')
                self.connection_status.last_update = datetime.now()
                
                await self._notify_subscribers("connection", self.connection_status.dict())
                await self._notify_subscribers("account_info", data)
                
            elif event_type == 'positions':
                self.positions = data
                await self._notify_subscribers("positions", data)
                
            elif event_type == 'orders':
                self.orders = data
                await self._notify_subscribers("orders", data)
                
        except Exception as e:
            logger.error(f"Error handling direct connection event: {e}")
    
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
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            return await self.direct_connection.get_connection_status()
        return self.connection_status
    
    async def get_available_pairs(self) -> List[CurrencyPair]:
        """Get available currency pairs"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            pairs = await self.direct_connection.get_available_pairs()
            self.available_pairs = pairs  # Cache the pairs
            return pairs
        return self.available_pairs
    
    async def get_current_tick(self, symbol: str = "EURUSD") -> Optional[MT5Tick]:
        """Get current tick data"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            return await self.direct_connection.get_current_tick(symbol)
        return self.current_tick
    
    async def get_market_data(self, symbol: str = "EURUSD", timeframe: str = "M15", count: int = 100) -> List[MarketData]:
        """Get market data"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            return await self.direct_connection.get_market_data(symbol, timeframe, count)
        return self.market_data
    
    async def get_positions(self) -> List[Dict]:
        """Get open positions"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            positions = await self.direct_connection.get_positions()
            self.positions = positions  # Cache the positions
            return positions
        return self.positions
    
    async def get_orders(self) -> List[Dict]:
        """Get pending orders"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            orders = await self.direct_connection.get_orders()
            self.orders = orders  # Cache the orders
            return orders
        return self.orders
    
    async def place_order(self, symbol: str, order_type: str, volume: float, price: float = None, 
                         sl: float = None, tp: float = None, comment: str = "") -> Dict:
        """Place a trading order"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            return await self.direct_connection.place_order(symbol, order_type, volume, price, sl, tp, comment)
        return {"error": "MT5 connection not available"}
    
    async def cleanup(self):
        """Cleanup resources"""
        self.is_monitoring = False
        
        if self.direct_connection:
            await self.direct_connection.cleanup()
        
        logger.info("MT5 connection manager cleaned up")