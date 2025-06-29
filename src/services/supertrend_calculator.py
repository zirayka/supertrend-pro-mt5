"""SuperTrend indicator calculation service"""

import logging
import numpy as np
import pandas as pd
from typing import List, Optional, Tuple
from datetime import datetime

from src.core.models import MarketData, SuperTrendConfig, SuperTrendResult

logger = logging.getLogger(__name__)


class SuperTrendCalculator:
    """Advanced SuperTrend indicator calculator"""
    
    def __init__(self, config: SuperTrendConfig):
        self.config = config
        self.data: List[MarketData] = []
        self.current_symbol = ""
        
    def update_config(self, config: SuperTrendConfig):
        """Update calculator configuration"""
        self.config = config
    
    def set_symbol(self, symbol: str):
        """Set current trading symbol"""
        if symbol != self.current_symbol:
            self.current_symbol = symbol
            self.data = []  # Clear data when switching symbols
    
    def add_data(self, candle: MarketData):
        """Add new market data"""
        if candle.symbol != self.current_symbol:
            return
        
        self.data.append(candle)
        # Keep only last 1000 candles for performance
        if len(self.data) > 1000:
            self.data = self.data[-500:]
    
    def calculate(self) -> Optional[SuperTrendResult]:
        """Calculate SuperTrend indicator"""
        if len(self.data) < self.config.periods + 1:
            return None
        
        try:
            # Convert to pandas DataFrame for easier calculation
            df = self._to_dataframe()
            
            # Calculate ATR
            atr_values = self._calculate_atr(df, self.config.periods)
            
            # Calculate RSI
            rsi_values = self._calculate_rsi(df['close'], self.config.rsi_length)
            
            # Calculate SuperTrend
            supertrend_result = self._calculate_supertrend(df, atr_values)
            
            if supertrend_result is None:
                return None
            
            up, down, trend = supertrend_result
            
            # Get current values
            current_atr = atr_values.iloc[-1]
            current_rsi = rsi_values.iloc[-1]
            current_price = df['close'].iloc[-1]
            
            # Calculate trend strength
            trend_level = up if trend == 1 else down
            trend_strength = min(abs(current_price - trend_level) / current_atr * 100, 100)
            
            # Generate signals
            buy_signal, sell_signal = self._generate_signals(df, trend, rsi_values)
            strong_signal = trend_strength > self.config.strong_trend_threshold
            
            return SuperTrendResult(
                up=up,
                down=down,
                trend=trend,
                atr=current_atr,
                rsi=current_rsi,
                trend_strength=trend_strength,
                buy_signal=buy_signal,
                sell_signal=sell_signal,
                strong_signal=strong_signal
            )
            
        except Exception as e:
            logger.error(f"Error calculating SuperTrend: {e}")
            return None
    
    def _to_dataframe(self) -> pd.DataFrame:
        """Convert market data to pandas DataFrame"""
        data_dict = {
            'timestamp': [d.timestamp for d in self.data],
            'open': [d.open for d in self.data],
            'high': [d.high for d in self.data],
            'low': [d.low for d in self.data],
            'close': [d.close for d in self.data],
            'volume': [d.volume for d in self.data]
        }
        
        df = pd.DataFrame(data_dict)
        df.set_index('timestamp', inplace=True)
        return df
    
    def _calculate_atr(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Average True Range"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        # True Range calculation
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        # ATR is the moving average of True Range
        atr = true_range.rolling(window=period).mean()
        
        return atr
    
    def _calculate_rsi(self, prices: pd.Series, period: int) -> pd.Series:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def _calculate_supertrend(self, df: pd.DataFrame, atr: pd.Series) -> Optional[Tuple[float, float, int]]:
        """Calculate SuperTrend levels and trend direction"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        # Calculate HL2 (typical price)
        hl2 = (high + low) / 2
        
        # Calculate basic upper and lower bands
        basic_up = hl2 - (self.config.multiplier * atr)
        basic_down = hl2 + (self.config.multiplier * atr)
        
        # Initialize final bands
        final_up = basic_up.copy()
        final_down = basic_down.copy()
        
        # Calculate final bands with trend logic
        for i in range(1, len(df)):
            # Final upper band
            if basic_up.iloc[i] > final_up.iloc[i-1] or close.iloc[i-1] <= final_up.iloc[i-1]:
                final_up.iloc[i] = basic_up.iloc[i]
            else:
                final_up.iloc[i] = final_up.iloc[i-1]
            
            # Final lower band
            if basic_down.iloc[i] < final_down.iloc[i-1] or close.iloc[i-1] >= final_down.iloc[i-1]:
                final_down.iloc[i] = basic_down.iloc[i]
            else:
                final_down.iloc[i] = final_down.iloc[i-1]
        
        # Determine trend
        trend = pd.Series(index=df.index, dtype=int)
        trend.iloc[0] = 1  # Start with bullish trend
        
        for i in range(1, len(df)):
            if trend.iloc[i-1] == -1 and close.iloc[i] > final_down.iloc[i]:
                trend.iloc[i] = 1
            elif trend.iloc[i-1] == 1 and close.iloc[i] < final_up.iloc[i]:
                trend.iloc[i] = -1
            else:
                trend.iloc[i] = trend.iloc[i-1]
        
        # Return current values
        current_up = final_up.iloc[-1]
        current_down = final_down.iloc[-1]
        current_trend = trend.iloc[-1]
        
        return current_up, current_down, current_trend
    
    def _generate_signals(self, df: pd.DataFrame, current_trend: int, rsi: pd.Series) -> Tuple[bool, bool]:
        """Generate buy/sell signals with filters"""
        if len(df) < 2:
            return False, False
        
        # Check for trend change
        prev_result = self._calculate_previous_trend(df.iloc[:-1])
        if prev_result is None:
            return False, False
        
        _, _, prev_trend = prev_result
        trend_changed = current_trend != prev_trend
        
        buy_signal = False
        sell_signal = False
        
        if trend_changed:
            current_rsi = rsi.iloc[-1]
            
            if current_trend == 1:  # Bullish trend
                buy_signal = True
                
                # Apply RSI filter
                if self.config.use_rsi_filter and current_rsi <= self.config.rsi_buy_threshold:
                    buy_signal = False
                
            elif current_trend == -1:  # Bearish trend
                sell_signal = True
                
                # Apply RSI filter
                if self.config.use_rsi_filter and current_rsi >= self.config.rsi_sell_threshold:
                    sell_signal = False
        
        return buy_signal, sell_signal
    
    def _calculate_previous_trend(self, df: pd.DataFrame) -> Optional[Tuple[float, float, int]]:
        """Calculate SuperTrend for previous data point"""
        if len(df) < self.config.periods:
            return None
        
        try:
            # Calculate ATR for previous data
            atr_values = self._calculate_atr(df, self.config.periods)
            
            # Calculate SuperTrend for previous data
            return self._calculate_supertrend(df, atr_values)
            
        except Exception:
            return None
    
    def get_historical_data(self) -> List[MarketData]:
        """Get historical market data"""
        return self.data.copy()
    
    def get_current_symbol(self) -> str:
        """Get current trading symbol"""
        return self.current_symbol