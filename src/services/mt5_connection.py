"""
MT5 connection management service - Direct MT5 connection only
Enhanced version with better pair loading and connection stability - Reduced monitoring delay
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
    """MT5 connection manager - Direct MT5 connection only with optimized performance"""
    
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
        self.max_connection_attempts = 3
        self.connection_retry_delay = 3  # Reduced from 5 to 3 seconds
        self.last_successful_connection = None
        
        # Performance optimization
        self.monitoring_interval = 1.0  # Reduced from 3 to 1 second for faster updates
        self.tick_update_interval = 0.5  # Ultra-fast tick updates
        
    async def initialize(self):
        """Initialize MT5 direct connection with enhanced retry logic"""
        logger.info("🚀 Initializing MT5 connection manager...")
        
        # Try direct MT5 connection with retries
        for attempt in range(self.max_connection_attempts):
            self.connection_attempts = attempt + 1
            
            logger.info(f"🔄 MT5 connection attempt {self.connection_attempts}/{self.max_connection_attempts}")
            
            if await self._try_direct_connection():
                self.last_successful_connection = datetime.now()
                await self._notify_subscribers("connection", self.connection_status.dict())
                return
            
            if attempt < self.max_connection_attempts - 1:
                logger.warning(f"⚠️ Connection attempt {self.connection_attempts} failed, retrying in {self.connection_retry_delay} seconds...")
                await asyncio.sleep(self.connection_retry_delay)
        
        # If all attempts failed
        logger.error("❌ Failed to establish MT5 connection after all attempts")
        logger.error("💡 Please ensure:")
        logger.error("   1. MetaTrader 5 Terminal is running")
        logger.error("   2. You are logged into a trading account")
        logger.error("   3. 'Allow automated trading' is enabled in MT5 settings")
        logger.error("   4. Your account has trading permissions")
        
        self.connection_status.is_connected = False
        self.connection_status.connection_type = "disconnected"
        await self._notify_subscribers("connection", self.connection_status.dict())
    
    async def _try_direct_connection(self) -> bool:
        """Try to establish direct MT5 connection"""
        try:
            logger.info("🔌 Attempting direct MT5 connection...")
            
            if await self.direct_connection.initialize():
                self.connection_status.is_connected = True
                self.connection_status.connection_type = "direct"
                
                # Subscribe to direct connection events
                self.direct_connection.subscribe(self._handle_direct_connection_event)
                
                # Load initial data
                await self._load_direct_connection_data()
                
                # Start optimized monitoring
                await self.direct_connection.start_monitoring()
                
                logger.info("✅ Direct MT5 connection established successfully")
                return True
            
        except Exception as e:
            logger.error(f"❌ Direct MT5 connection failed: {e}")
        
        return False
    
    async def _load_direct_connection_data(self):
        """Load initial data from direct MT5 connection"""
        try:
            logger.info("📊 Loading initial data from MT5...")
            
            # Load connection status
            connection = await self.direct_connection.get_connection_status()
            self.connection_status = connection
            
            # Load available pairs with retry logic
            pairs = await self.direct_connection.get_available_pairs()
            if pairs:
                self.available_pairs = pairs
                logger.info(f"✅ Loaded {len(pairs)} trading pairs")
                
                # Notify subscribers immediately about pairs
                await self._notify_subscribers("symbols", pairs)
            else:
                logger.warning("⚠️ No trading pairs loaded from MT5")
                # Try to reload pairs after a short delay
                await asyncio.sleep(1)  # Reduced delay
                pairs = await self.direct_connection.get_available_pairs()
                if pairs:
                    self.available_pairs = pairs
                    await self._notify_subscribers("symbols", pairs)
                    logger.info(f"✅ Loaded {len(pairs)} trading pairs on retry")
            
            # Load positions and orders
            self.positions = await self.direct_connection.get_positions()
            self.orders = await self.direct_connection.get_orders()
            
            # Get initial tick data for EURUSD
            self.current_tick = await self.direct_connection.get_current_tick("EURUSD")
            
            # Get market data for EURUSD
            market_data = await self.direct_connection.get_market_data("EURUSD", "M15", 100)
            self.market_data = market_data
            
            logger.info(f"📈 Loaded {len(self.available_pairs)} pairs, {len(self.positions)} positions, {len(self.orders)} orders")
            
            # Notify subscribers about loaded data
            await self._notify_subscribers("positions", self.positions)
            await self._notify_subscribers("orders", self.orders)
            
            if self.current_tick:
                await self._notify_subscribers("tick", self.current_tick.dict())
            
        except Exception as e:
            logger.error(f"❌ Error loading direct connection data: {e}")
    
    async def _handle_direct_connection_event(self, event_type: str, data):
        """Handle events from direct MT5 connection with optimized processing"""
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
            logger.error(f"❌ Error handling direct connection event: {e}")
    
    def subscribe(self, callback: Callable):
        """Subscribe to MT5 events"""
        self.subscribers.append(callback)
    
    def unsubscribe(self, callback: Callable):
        """Unsubscribe from MT5 events"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)
    
    async def _notify_subscribers(self, event_type: str, data: dict):
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
    
    async def get_connection_status(self) -> MT5Connection:
        """Get current connection status"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                return await self.direct_connection.get_connection_status()
            except Exception as e:
                logger.error(f"❌ Error getting connection status: {e}")
                return self.connection_status
        return self.connection_status
    
    async def get_available_pairs(self) -> List[CurrencyPair]:
        """Get available currency pairs with fallback"""
        logger.debug("📊 MT5ConnectionManager: Getting available pairs...")
        
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                pairs = await self.direct_connection.get_available_pairs()
                if pairs:
                    self.available_pairs = pairs  # Cache the pairs
                    logger.debug(f"✅ Retrieved {len(pairs)} pairs from direct connection")
                    return pairs
                else:
                    logger.warning("⚠️ Direct connection returned empty pairs list")
            except Exception as e:
                logger.error(f"❌ Error getting pairs from direct connection: {e}")
        
        # Return cached pairs if available
        if self.available_pairs:
            logger.debug(f"📊 Returning {len(self.available_pairs)} cached pairs")
            return self.available_pairs
        
        # Return empty list if no pairs available
        logger.warning("⚠️ No trading pairs available")
        return []
    
    async def get_current_tick(self, symbol: str = "EURUSD") -> Optional[MT5Tick]:
        """Get current tick data with caching"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                tick = await self.direct_connection.get_current_tick(symbol)
                if tick:
                    self.current_tick = tick  # Cache the tick
                return tick
            except Exception as e:
                logger.error(f"❌ Error getting tick data: {e}")
        return self.current_tick
    
    async def get_market_data(self, symbol: str = "EURUSD", timeframe: str = "M15", count: int = 100) -> List[MarketData]:
        """Get market data with caching"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                data = await self.direct_connection.get_market_data(symbol, timeframe, count)
                if data:
                    self.market_data = data  # Cache the data
                return data
            except Exception as e:
                logger.error(f"❌ Error getting market data: {e}")
        return self.market_data
    
    async def get_positions(self) -> List[Dict]:
        """Get open positions with caching"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                positions = await self.direct_connection.get_positions()
                self.positions = positions  # Cache the positions
                return positions
            except Exception as e:
                logger.error(f"❌ Error getting positions: {e}")
        return self.positions
    
    async def get_orders(self) -> List[Dict]:
        """Get pending orders with caching"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                orders = await self.direct_connection.get_orders()
                self.orders = orders  # Cache the orders
                return orders
            except Exception as e:
                logger.error(f"❌ Error getting orders: {e}")
        return self.orders
    
    async def place_order(self, symbol: str, order_type: str, volume: float, price: float = None, 
                         sl: float = None, tp: float = None, comment: str = "") -> Dict:
        """Place a trading order"""
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                return await self.direct_connection.place_order(symbol, order_type, volume, price, sl, tp, comment)
            except Exception as e:
                logger.error(f"❌ Error placing order: {e}")
                return {"error": str(e)}
        return {"error": "MT5 connection not available"}
    
    async def force_reload_pairs(self):
        """Force reload trading pairs from MT5"""
        logger.info("🔄 Force reloading trading pairs...")
        
        if self.connection_status.connection_type == "direct" and self.direct_connection:
            try:
                # Reinitialize symbols in direct connection
                await self.direct_connection._load_symbols()
                pairs = await self.direct_connection.get_available_pairs()
                if pairs:
                    self.available_pairs = pairs
                    await self._notify_subscribers("symbols", pairs)
                    logger.info(f"✅ Force reloaded {len(pairs)} trading pairs")
                    return pairs
                else:
                    logger.warning("⚠️ Force reload returned empty pairs list")
            except Exception as e:
                logger.error(f"❌ Error force reloading pairs: {e}")
        
        # If force reload fails, return cached pairs
        if self.available_pairs:
            logger.info(f"📊 Returning {len(self.available_pairs)} cached pairs after failed reload")
            return self.available_pairs
        
        return []
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("🧹 Cleaning up MT5 connection manager...")
        self.is_monitoring = False
        
        if self.direct_connection:
            await self.direct_connection.cleanup()
        
        logger.info("✅ MT5 connection manager cleaned up")