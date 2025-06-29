"""SuperTrend indicator calculation service with enhanced float validation and modern pandas syntax"""

import logging
import numpy as np
import pandas as pd
from typing import List, Optional, Tuple
from datetime import datetime
import math

from src.core.models import MarketData, SuperTrendConfig, SuperTrendResult

logger = logging.getLogger(__name__)


class SuperTrendCalculator:
    """Advanced SuperTrend indicator calculator with robust float validation"""
    
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
    
    def _validate_float(self, value: float, default: float = 0.0) -> float:
        """Validate float value and return safe value for JSON serialization"""
        if value is None:
            return default
        
        if math.isnan(value) or math.isinf(value):
            logger.warning(f"Invalid float value detected: {value}, using default: {default}")
            return default
        
        # Check for extremely large values that might cause JSON issues
        if abs(value) > 1e10:
            logger.warning(f"Extremely large float value detected: {value}, capping to reasonable range")
            return default
        
        return float(value)
    
    def _safe_divide(self, numerator: float, denominator: float, default: float = 0.0) -> float:
        """Safely divide two numbers, handling division by zero"""
        if denominator == 0 or math.isnan(denominator) or math.isinf(denominator):
            return default
        
        result = numerator / denominator
        return self._validate_float(result, default)
    
    def calculate(self) -> Optional[SuperTrendResult]:
        """Calculate SuperTrend indicator with enhanced error handling"""
        if len(self.data) < self.config.periods + 1:
            logger.debug(f"Insufficient data: {len(self.data)} candles, need {self.config.periods + 1}")
            return None
        
        try:
            # Convert to pandas DataFrame for easier calculation
            df = self._to_dataframe()
            
            if df.empty or len(df) < self.config.periods:
                logger.warning("DataFrame is empty or insufficient after conversion")
                return None
            
            # Calculate ATR with validation
            atr_values = self._calculate_atr(df, self.config.periods)
            if atr_values is None or atr_values.empty:
                logger.warning("ATR calculation failed")
                return None
            
            # Calculate RSI with validation
            rsi_values = self._calculate_rsi(df['close'], self.config.rsi_length)
            if rsi_values is None or rsi_values.empty:
                logger.warning("RSI calculation failed")
                return None
            
            # Calculate SuperTrend with validation
            supertrend_result = self._calculate_supertrend(df, atr_values)
            if supertrend_result is None:
                logger.warning("SuperTrend calculation failed")
                return None
            
            up, down, trend = supertrend_result
            
            # Validate all calculated values
            current_atr = self._validate_float(atr_values.iloc[-1], 0.0001)
            current_rsi = self._validate_float(rsi_values.iloc[-1], 50.0)
            current_price = self._validate_float(df['close'].iloc[-1], 1.0)
            
            up = self._validate_float(up, current_price)
            down = self._validate_float(down, current_price)
            trend = int(trend) if trend in [-1, 1] else 1
            
            # Calculate trend strength with safe division
            trend_level = up if trend == 1 else down
            price_diff = abs(current_price - trend_level)
            trend_strength = self._safe_divide(price_diff, current_atr, 0.0) * 100
            trend_strength = min(max(trend_strength, 0.0), 100.0)  # Clamp between 0-100
            
            # Generate signals with validation
            buy_signal, sell_signal = self._generate_signals(df, trend, rsi_values)
            strong_signal = trend_strength > self.config.strong_trend_threshold
            
            # Create result with all validated values
            result = SuperTrendResult(
                up=up,
                down=down,
                trend=trend,
                atr=current_atr,
                rsi=current_rsi,
                trend_strength=trend_strength,
                buy_signal=bool(buy_signal),
                sell_signal=bool(sell_signal),
                strong_signal=bool(strong_signal)
            )
            
            logger.debug(f"SuperTrend calculated successfully: trend={trend}, strength={trend_strength:.2f}%")
            return result
            
        except Exception as e:
            logger.error(f"Error calculating SuperTrend: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def _to_dataframe(self) -> pd.DataFrame:
        """Convert market data to pandas DataFrame with validation"""
        try:
            data_dict = {
                'timestamp': [d.timestamp for d in self.data],
                'open': [self._validate_float(d.open, 1.0) for d in self.data],
                'high': [self._validate_float(d.high, 1.0) for d in self.data],
                'low': [self._validate_float(d.low, 1.0) for d in self.data],
                'close': [self._validate_float(d.close, 1.0) for d in self.data],
                'volume': [max(int(d.volume), 1) for d in self.data]  # Ensure positive volume
            }
            
            df = pd.DataFrame(data_dict)
            df.set_index('timestamp', inplace=True)
            
            # Validate OHLC relationships
            df['high'] = df[['open', 'high', 'low', 'close']].max(axis=1)
            df['low'] = df[['open', 'high', 'low', 'close']].min(axis=1)
            
            return df
            
        except Exception as e:
            logger.error(f"Error converting to DataFrame: {e}")
            return pd.DataFrame()
    
    def _calculate_atr(self, df: pd.DataFrame, period: int) -> Optional[pd.Series]:
        """Calculate Average True Range with enhanced validation and modern pandas syntax"""
        try:
            if df.empty or len(df) < period:
                return None
            
            high = df['high']
            low = df['low']
            close = df['close']
            
            # True Range calculation with validation
            tr1 = high - low
            tr2 = abs(high - close.shift(1))
            tr3 = abs(low - close.shift(1))
            
            # Handle NaN values in shifted data using modern pandas syntax
            tr2 = tr2.fillna(tr1)
            tr3 = tr3.fillna(tr1)
            
            true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            
            # Ensure positive true range values
            true_range = true_range.clip(lower=0.0001)  # Minimum ATR to avoid division by zero
            
            # ATR is the moving average of True Range
            atr = true_range.rolling(window=period, min_periods=period).mean()
            
            # Fill any remaining NaN values using modern pandas syntax
            atr = atr.bfill().fillna(0.0001)
            
            # Validate all ATR values
            atr = atr.apply(lambda x: self._validate_float(x, 0.0001))
            
            return atr
            
        except Exception as e:
            logger.error(f"Error calculating ATR: {e}")
            return None
    
    def _calculate_rsi(self, prices: pd.Series, period: int) -> Optional[pd.Series]:
        """Calculate Relative Strength Index with enhanced validation and modern pandas syntax"""
        try:
            if prices.empty or len(prices) < period + 1:
                return None
            
            delta = prices.diff()
            
            # Handle NaN values
            delta = delta.fillna(0)
            
            gain = delta.where(delta > 0, 0)
            loss = -delta.where(delta < 0, 0)
            
            # Calculate rolling averages
            avg_gain = gain.rolling(window=period, min_periods=period).mean()
            avg_loss = loss.rolling(window=period, min_periods=period).mean()
            
            # Fill NaN values using modern pandas syntax
            avg_gain = avg_gain.bfill().fillna(0)
            avg_loss = avg_loss.bfill().fillna(0.0001)  # Avoid division by zero
            
            # Calculate RSI with safe division
            rs = avg_gain / avg_loss.replace(0, 0.0001)  # Avoid division by zero
            rsi = 100 - (100 / (1 + rs))
            
            # Validate RSI values (should be between 0 and 100)
            rsi = rsi.clip(lower=0, upper=100)
            rsi = rsi.apply(lambda x: self._validate_float(x, 50.0))
            
            return rsi
            
        except Exception as e:
            logger.error(f"Error calculating RSI: {e}")
            return None
    
    def _calculate_supertrend(self, df: pd.DataFrame, atr: pd.Series) -> Optional[Tuple[float, float, int]]:
        """Calculate SuperTrend levels and trend direction with enhanced validation"""
        try:
            if df.empty or atr.empty or len(df) != len(atr):
                return None
            
            high = df['high']
            low = df['low']
            close = df['close']
            
            # Calculate HL2 (typical price)
            hl2 = (high + low) / 2
            
            # Validate multiplier
            multiplier = self._validate_float(self.config.multiplier, 2.0)
            if multiplier <= 0:
                multiplier = 2.0
            
            # Calculate basic upper and lower bands
            basic_up = hl2 - (multiplier * atr)
            basic_down = hl2 + (multiplier * atr)
            
            # Validate basic bands
            basic_up = basic_up.apply(lambda x: self._validate_float(x, close.iloc[-1]))
            basic_down = basic_down.apply(lambda x: self._validate_float(x, close.iloc[-1]))
            
            # Initialize final bands
            final_up = basic_up.copy()
            final_down = basic_down.copy()
            
            # Calculate final bands with trend logic
            for i in range(1, len(df)):
                try:
                    # Final upper band
                    if (basic_up.iloc[i] > final_up.iloc[i-1] or 
                        close.iloc[i-1] <= final_up.iloc[i-1]):
                        final_up.iloc[i] = basic_up.iloc[i]
                    else:
                        final_up.iloc[i] = final_up.iloc[i-1]
                    
                    # Final lower band
                    if (basic_down.iloc[i] < final_down.iloc[i-1] or 
                        close.iloc[i-1] >= final_down.iloc[i-1]):
                        final_down.iloc[i] = basic_down.iloc[i]
                    else:
                        final_down.iloc[i] = final_down.iloc[i-1]
                        
                    # Validate values
                    final_up.iloc[i] = self._validate_float(final_up.iloc[i], close.iloc[i])
                    final_down.iloc[i] = self._validate_float(final_down.iloc[i], close.iloc[i])
                    
                except Exception as e:
                    logger.debug(f"Error in SuperTrend calculation at index {i}: {e}")
                    continue
            
            # Determine trend
            trend = pd.Series(index=df.index, dtype=int)
            trend.iloc[0] = 1  # Start with bullish trend
            
            for i in range(1, len(df)):
                try:
                    if (trend.iloc[i-1] == -1 and close.iloc[i] > final_down.iloc[i]):
                        trend.iloc[i] = 1
                    elif (trend.iloc[i-1] == 1 and close.iloc[i] < final_up.iloc[i]):
                        trend.iloc[i] = -1
                    else:
                        trend.iloc[i] = trend.iloc[i-1]
                except Exception as e:
                    logger.debug(f"Error in trend calculation at index {i}: {e}")
                    trend.iloc[i] = trend.iloc[i-1] if i > 0 else 1
            
            # Return current values with validation
            current_up = self._validate_float(final_up.iloc[-1], close.iloc[-1])
            current_down = self._validate_float(final_down.iloc[-1], close.iloc[-1])
            current_trend = int(trend.iloc[-1]) if trend.iloc[-1] in [-1, 1] else 1
            
            return current_up, current_down, current_trend
            
        except Exception as e:
            logger.error(f"Error in SuperTrend calculation: {e}")
            return None
    
    def _generate_signals(self, df: pd.DataFrame, current_trend: int, rsi: pd.Series) -> Tuple[bool, bool]:
        """Generate buy/sell signals with filters and validation"""
        try:
            if df.empty or rsi.empty or len(df) < 2:
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
                current_rsi = self._validate_float(rsi.iloc[-1], 50.0)
                
                if current_trend == 1:  # Bullish trend
                    buy_signal = True
                    
                    # Apply RSI filter
                    if (self.config.use_rsi_filter and 
                        current_rsi <= self.config.rsi_buy_threshold):
                        buy_signal = False
                    
                elif current_trend == -1:  # Bearish trend
                    sell_signal = True
                    
                    # Apply RSI filter
                    if (self.config.use_rsi_filter and 
                        current_rsi >= self.config.rsi_sell_threshold):
                        sell_signal = False
            
            return bool(buy_signal), bool(sell_signal)
            
        except Exception as e:
            logger.error(f"Error generating signals: {e}")
            return False, False
    
    def _calculate_previous_trend(self, df: pd.DataFrame) -> Optional[Tuple[float, float, int]]:
        """Calculate SuperTrend for previous data point with validation"""
        try:
            if df.empty or len(df) < self.config.periods:
                return None
            
            # Calculate ATR for previous data
            atr_values = self._calculate_atr(df, self.config.periods)
            if atr_values is None:
                return None
            
            # Calculate SuperTrend for previous data
            return self._calculate_supertrend(df, atr_values)
            
        except Exception as e:
            logger.debug(f"Error calculating previous trend: {e}")
            return None
    
    def get_historical_data(self) -> List[MarketData]:
        """Get historical market data"""
        return self.data.copy()
    
    def get_current_symbol(self) -> str:
        """Get current trading symbol"""
        return self.current_symbol