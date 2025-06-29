"""Data models for the application"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TrendDirection(str, Enum):
    """Trend direction enumeration"""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class SignalType(str, Enum):
    """Trading signal types"""
    BUY = "buy"
    SELL = "sell"


class ConnectionStatus(str, Enum):
    """Connection status types"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    ERROR = "error"


class MarketData(BaseModel):
    """Market data structure"""
    timestamp: datetime
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    bid: Optional[float] = None
    ask: Optional[float] = None
    spread: Optional[float] = None


class MT5Tick(BaseModel):
    """MT5 tick data structure"""
    symbol: str
    time: datetime
    bid: float
    ask: float
    last: float
    volume: int
    flags: int = 0


class SuperTrendConfig(BaseModel):
    """SuperTrend indicator configuration"""
    periods: int = Field(default=20, ge=5, le=50)
    multiplier: float = Field(default=2.0, ge=0.5, le=5.0)
    change_atr: bool = True
    show_signals: bool = True
    highlighting: bool = True
    
    # RSI filter settings
    rsi_length: int = Field(default=14, ge=5, le=30)
    rsi_buy_threshold: int = Field(default=50, ge=30, le=70)
    rsi_sell_threshold: int = Field(default=50, ge=30, le=70)
    use_rsi_filter: bool = True
    
    # Additional filters
    use_volatility_filter: bool = True
    atr_ma_length: int = Field(default=20, ge=5, le=50)
    use_htf_filter: bool = False
    cooldown_bars: int = Field(default=5, ge=1, le=20)
    strong_trend_threshold: int = Field(default=50, ge=10, le=100)


class SuperTrendResult(BaseModel):
    """SuperTrend calculation result"""
    up: float
    down: float
    trend: int  # 1 for bullish, -1 for bearish
    atr: float
    rsi: float
    trend_strength: float
    buy_signal: bool = False
    sell_signal: bool = False
    strong_signal: bool = False


class TradingSignal(BaseModel):
    """Trading signal structure"""
    id: str
    timestamp: datetime
    type: SignalType
    symbol: str
    price: float
    strength: float
    confidence: float
    message: Optional[str] = None


class CurrencyPair(BaseModel):
    """Currency pair information"""
    symbol: str
    name: str
    category: str  # major, minor, exotic, crypto, indices, commodities
    digits: int
    point_size: float
    min_lot: float
    max_lot: float
    lot_step: float
    spread: Optional[float] = None
    swap_long: Optional[float] = None
    swap_short: Optional[float] = None


class MT5Connection(BaseModel):
    """MT5 connection information"""
    is_connected: bool
    connection_type: str = "demo"  # websocket, file, demo
    server: Optional[str] = None
    account: Optional[int] = None
    balance: Optional[float] = None
    equity: Optional[float] = None
    margin: Optional[float] = None
    free_margin: Optional[float] = None
    margin_level: Optional[float] = None
    last_update: Optional[datetime] = None


class DashboardState(BaseModel):
    """Dashboard state information"""
    selected_pair: str = "EURUSD"
    is_running: bool = True
    config: SuperTrendConfig = SuperTrendConfig()
    connection: MT5Connection = MT5Connection(is_connected=False)
    available_pairs: List[CurrencyPair] = []
    signals: List[TradingSignal] = []
    market_data: List[MarketData] = []


class WebSocketMessage(BaseModel):
    """WebSocket message structure"""
    type: str
    data: Dict[str, Any]
    timestamp: Optional[datetime] = None