"""WebSocket connection manager for real-time MT5 data communication"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time MT5 data"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_data: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_data[websocket] = {
            "connected_at": datetime.now(),
            "subscriptions": set()
        }
        logger.info(f"📡 New WebSocket connection established. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_data:
            del self.connection_data[websocket]
        logger.info(f"📡 WebSocket connection closed. Total: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return
        
        message_json = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    async def broadcast_to_subscribers(self, event_type: str, data: dict):
        """Broadcast to clients subscribed to specific event type"""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        subscribed_connections = []
        for connection, conn_data in self.connection_data.items():
            if event_type in conn_data.get("subscriptions", set()):
                subscribed_connections.append(connection)
        
        if not subscribed_connections:
            return
        
        message_json = json.dumps(message)
        disconnected = []
        
        for connection in subscribed_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Error sending to subscriber: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    async def handle_message(self, websocket: WebSocket, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "subscribe":
                # Subscribe to event types
                event_types = data.get("events", [])
                if websocket in self.connection_data:
                    self.connection_data[websocket]["subscriptions"].update(event_types)
                    await self.send_personal_message({
                        "type": "subscription_confirmed",
                        "events": list(event_types)
                    }, websocket)
            
            elif message_type == "unsubscribe":
                # Unsubscribe from event types
                event_types = data.get("events", [])
                if websocket in self.connection_data:
                    self.connection_data[websocket]["subscriptions"].difference_update(event_types)
                    await self.send_personal_message({
                        "type": "unsubscription_confirmed",
                        "events": list(event_types)
                    }, websocket)
            
            elif message_type == "ping":
                # Respond to ping
                await self.send_personal_message({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                }, websocket)
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
    
    async def handle_mt5_event(self, event_type: str, data: dict):
        """Handle events from MT5 connection manager"""
        try:
            # Broadcast MT5 events to subscribed clients
            await self.broadcast_to_subscribers(event_type, data)
            
            # Special handling for connection events
            if event_type == "connection":
                await self.send_connection_status(data)
            
        except Exception as e:
            logger.error(f"Error handling MT5 event: {e}")
    
    async def send_connection_status(self, status: dict):
        """Send connection status to all clients"""
        await self.broadcast({
            "type": "connection_status",
            "data": status,
            "timestamp": datetime.now().isoformat()
        })
    
    async def send_market_data(self, data: dict):
        """Send market data to subscribed clients"""
        await self.broadcast_to_subscribers("market_data", data)
    
    async def send_tick_data(self, data: dict):
        """Send tick data to subscribed clients"""
        await self.broadcast_to_subscribers("tick", data)
    
    async def send_signal(self, signal: dict):
        """Send trading signal to subscribed clients"""
        await self.broadcast_to_subscribers("signal", signal)
    
    async def send_account_info(self, data: dict):
        """Send account info to subscribed clients"""
        await self.broadcast_to_subscribers("account_info", data)
    
    async def send_positions(self, data: list):
        """Send positions data to subscribed clients"""
        await self.broadcast_to_subscribers("positions", data)
    
    async def send_orders(self, data: list):
        """Send orders data to subscribed clients"""
        await self.broadcast_to_subscribers("orders", data)
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information"""
        return {
            "total_connections": len(self.active_connections),
            "connections": [
                {
                    "connected_at": conn_data["connected_at"].isoformat(),
                    "subscriptions": list(conn_data["subscriptions"])
                }
                for conn_data in self.connection_data.values()
            ]
        }
    
    async def cleanup(self):
        """Cleanup all connections"""
        for connection in self.active_connections.copy():
            try:
                await connection.close()
            except Exception:
                pass
            self.disconnect(connection)
        
        logger.info("🧹 WebSocket manager cleaned up")