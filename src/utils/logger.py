"""Logging configuration for SuperTrend Pro MT5 - Windows Unicode Fix"""

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from datetime import datetime


def setup_logging(log_level: str = "INFO", log_file: str = "supertrend.log"):
    """Setup logging configuration with Windows Unicode support"""
    
    # Create logs directory if it doesn't exist
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Configure log level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create formatter without Unicode characters
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler with UTF-8 encoding
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    
    # Set encoding for Windows compatibility
    if hasattr(console_handler.stream, 'reconfigure'):
        try:
            console_handler.stream.reconfigure(encoding='utf-8')
        except Exception:
            pass
    
    root_logger.addHandler(console_handler)
    
    # File handler with UTF-8 encoding and rotation
    log_file_path = logs_dir / log_file
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file_path,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5,
            encoding='utf-8'  # Explicit UTF-8 encoding
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except Exception as e:
        # Fallback to basic file handler if rotation fails
        try:
            file_handler = logging.FileHandler(
                log_file_path,
                encoding='utf-8'
            )
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception:
            # If file logging fails completely, continue with console only
            pass
    
    # Log startup message without emoji
    logger = logging.getLogger(__name__)
    logger.info("SuperTrend Pro MT5 logging initialized")
    logger.info(f"Log file: {log_file_path}")
    logger.info(f"Log level: {log_level}")
    
    return logger