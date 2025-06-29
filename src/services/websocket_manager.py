"""WebSocket connection manager for real-time MT5 data communication with enhanced JSON serialization"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime objects"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class WebSocketManager:
    """Manages WebSocket connections for real-time MT5 data with enhanced serialization"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_data: Dict[WebSocket, Dict[str, Any]] = {}
        self.encoder = DateTimeEncoder()
    
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_data[websocket] = {
            "connected_at": datetime.now(),
            "subscriptions": set()
        }
        logger.info(f"New WebSocket connection established. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_data:
            del self.connection_data[websocket]
        logger.info(f"WebSocket connection closed. Total: {len(self.active_connections)}")
    
    def _serialize_message(self, message: dict) -> str:
        """Safely serialize message to JSON with datetime handling"""
        try:
            return self.encoder.encode(message)
        except Exception as e:
            logger.error(f"Error serializing message: {e}")
            # Fallback: convert all datetime objects to strings
            return self._safe_serialize(message)
    
    def _safe_serialize(self, obj) -> str:
        """Safe serialization with recursive datetime conversion"""
        def convert_datetime(item):
            if isinstance(item, datetime):
                return item.isoformat()
            elif isinstance(item, dict):
                return {k: convert_datetime(v) for k, v in item.items()}
            elif isinstance(item, list):
                return [convert_datetime(v) for v in item]
            elif isinstance(item, tuple):
                return tuple(convert_datetime(v) for v in item)
            else:
                return item
        
        try:
            converted = convert_datetime(obj)
            return json.dumps(converted)
        except Exception as e:
            logger.error(f"Error in safe serialization: {e}")
            # Ultimate fallback
            return json.dumps({"error": "Serialization failed", "timestamp": datetime.now().isoformat()})
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific WebSocket connection"""
        try:
            message_json = self._serialize_message(message)
            await websocket.send_text(message_json)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return
        
        message_json = self._serialize_message(message)
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
        
        message_json = self._serialize_message(message)
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
                        "events": list(event_types),
                        "timestamp": datetime.now().isoformat()
                    }, websocket)
            
            elif message_type == "unsubscribe":
                # Unsubscribe from event types
                event_types = data.get("events", [])
                if websocket in self.connection_data:
                    self.connection_data[websocket]["subscriptions"].difference_update(event_types)
                    await self.send_personal_message({
                        "type": "unsubscription_confirmed",
                        "events": list(event_types),
                        "timestamp": datetime.now().isoformat()
                    }, websocket)
            
            elif message_type == "ping":
                # Respond to ping
                await self.send_personal_message({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                }, websocket)
            
            elif message_type == "get_status":
                # Send current status
                await self.send_personal_message({
                    "type": "status_response",
                    "data": {
                        "connected": True,
                        "subscriptions": list(self.connection_data.get(websocket, {}).get("subscriptions", set())),
                        "total_connections": len(self.active_connections)
                    },
                    "timestamp": datetime.now().isoformat()
                }, websocket)
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await self.send_personal_message({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}",
                    "timestamp": datetime.now().isoformat()
                }, websocket)
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
            await self.send_personal_message({
                "type": "error",
                "message": "Invalid JSON format",
                "timestamp": datetime.now().isoformat()
            }, websocket)
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            await self.send_personal_message({
                "type": "error",
                "message": "Internal server error",
                "timestamp": datetime.now().isoformat()
            }, websocket)
    
    async def handle_mt5_event(self, event_type: str, data: dict):
        """Handle events from MT5 connection manager with safe serialization"""
        try:
            # Ensure data is serializable
            serializable_data = self._prepare_data_for_serialization(data)
            
            # Broadcast MT5 events to subscribed clients
            await self.broadcast_to_subscribers(event_type, serializable_data)
            
            # Special handling for connection events
            if event_type == "connection":
                await self.send_connection_status(serializable_data)
            
        except Exception as e:
            logger.error(f"Error handling MT5 event: {e}")
    
    def _prepare_data_for_serialization(self, data) -> dict:
        """Prepare data for JSON serialization by converting datetime objects"""
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                if isinstance(value, datetime):
                    result[key] = value.isoformat()
                elif isinstance(value, dict):
                    result[key] = self._prepare_data_for_serialization(value)
                elif isinstance(value, list):
                    result[key] = [self._prepare_data_for_serialization(item) if isinstance(item, dict) else 
                                 item.isoformat() if isinstance(item, datetime) else item for item in value]
                else:
                    result[key] = value
            return result
        elif isinstance(data, list):
            return [self._prepare_data_for_serialization(item) if isinstance(item, dict) else 
                   item.isoformat() if isinstance(item, datetime) else item for item in data]
        elif isinstance(data, datetime):
            return data.isoformat()
        else:
            return data
    
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
    
    async def send_supertrend_update(self, data: dict):
        """Send SuperTrend calculation update to subscribed clients"""
        await self.broadcast_to_subscribers("supertrend_update", data)
    
    async def send_error(self, error_message: str, error_type: str = "general"):
        """Send error message to all clients"""
        await self.broadcast({
            "type": "error",
            "data": {
                "message": error_message,
                "error_type": error_type
            },
            "timestamp": datetime.now().isoformat()
        })
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information with serializable data"""
        connections_info = []
        for websocket, conn_data in self.connection_data.items():
            connections_info.append({
                "connected_at": conn_data["connected_at"].isoformat(),
                "subscriptions": list(conn_data["subscriptions"]),
                "id": id(websocket)  # Use object id as identifier
            })
        
        return {
            "total_connections": len(self.active_connections),
            "connections": connections_info,
            "timestamp": datetime.now().isoformat()
        }
    
    async def send_heartbeat(self):
        """Send heartbeat to all connected clients"""
        heartbeat_data = {
            "type": "heartbeat",
            "data": {
                "server_time": datetime.now().isoformat(),
                "active_connections": len(self.active_connections)
            },
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(heartbeat_data)
    
    async def cleanup(self):
        """Cleanup all connections"""
        logger.info("Cleaning up WebSocket manager...")
        
        # Send disconnect message to all clients
        disconnect_message = {
            "type": "server_shutdown",
            "message": "Server is shutting down",
            "timestamp": datetime.now().isoformat()
        }
        
        for connection in self.active_connections.copy():
            try:
                await self.send_personal_message(disconnect_message, connection)
                await connection.close()
            except Exception:
                pass
            self.disconnect(connection)
        
        logger.info("WebSocket manager cleaned up successfully")