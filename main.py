#!/usr/bin/env python3
"""
SuperTrend Pro MT5 - Python Trading Dashboard
Direct MT5 connection only - Enhanced startup
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.responses import HTMLResponse

from src.core.config import settings
from src.api.routes import api_router
from src.services.mt5_connection import MT5ConnectionManager
from src.services.websocket_manager import WebSocketManager
from src.utils.logger import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SuperTrend Pro MT5",
    description="Advanced SuperTrend Trading Indicator Dashboard with Direct MT5 Integration",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize services
mt5_manager = MT5ConnectionManager()
websocket_manager = WebSocketManager()

# Templates and static files
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include API routes
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 Starting SuperTrend Pro MT5 Dashboard - Direct MT5 Only")
    
    try:
        # Initialize MT5 connection
        await mt5_manager.initialize()
        
        # Subscribe websocket manager to MT5 events
        mt5_manager.subscribe(websocket_manager.handle_mt5_event)
        
        # Force load pairs after initialization
        pairs = await mt5_manager.get_available_pairs()
        logger.info(f"📊 Startup: {len(pairs)} trading pairs available")
        
        logger.info("✅ SuperTrend Pro MT5 Dashboard started successfully")
        
    except Exception as e:
        logger.error(f"❌ Error during startup: {e}")
        logger.error("💡 Dashboard will continue running, but MT5 features may be limited")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down SuperTrend Pro MT5 Dashboard")
    await mt5_manager.cleanup()
    await websocket_manager.cleanup()

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Main dashboard page"""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "title": "SuperTrend Pro MT5 Dashboard - Direct MT5 Connection"
    })

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time data"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            await websocket_manager.handle_message(websocket, data)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    connection_status = await mt5_manager.get_connection_status()
    pairs_count = len(await mt5_manager.get_available_pairs())
    
    return {
        "status": "healthy",
        "mt5_connected": connection_status.is_connected,
        "pairs_available": pairs_count,
        "websocket_connections": websocket_manager.get_connection_count(),
        "timestamp": "2024-01-01T00:00:00Z"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )