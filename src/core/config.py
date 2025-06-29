"""Application configuration"""

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 3000  # Changed from 8000 to avoid Windows permission issues
    DEBUG: bool = True
    
    # MT5 settings
    MT5_WEBSOCKET_URL: str = "ws://localhost:8765"
    MT5_FILE_SERVER_URL: str = "http://localhost:3001"
    MT5_FILES_PATH: Optional[str] = None
    
    # SuperTrend settings
    DEFAULT_ATR_PERIOD: int = 20
    DEFAULT_MULTIPLIER: float = 2.0
    DEFAULT_RSI_PERIOD: int = 14
    
    # Data settings
    MAX_CANDLES: int = 1000
    UPDATE_INTERVAL: float = 1.0
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "supertrend.log"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Set MT5 files path if not provided
        if not self.MT5_FILES_PATH:
            if os.name == 'nt':  # Windows
                appdata = os.getenv('APPDATA', '')
                self.MT5_FILES_PATH = os.path.join(
                    appdata, 'MetaQuotes', 'Terminal', 'Common', 'Files'
                )
            else:  # Linux/Mac (for development)
                self.MT5_FILES_PATH = str(Path.home() / 'MT5Files')


settings = Settings()