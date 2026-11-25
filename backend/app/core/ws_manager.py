import json
import uuid
from typing import Dict, Set
from fastapi import WebSocket
from app.core.logging import logger

class ConnectionManager:
    """
    Manages active WebSocket connections grouped by user_id.
    Thread-safe and supports multi-tab / multi-device streaming per user.
    """
    def __init__(self):
        # user_id -> Set of active WebSockets
        self.active_connections: Dict[uuid.UUID, Set[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"[WebSocket] User {user_id} connected. Active client sockets for user: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"[WebSocket] User {user_id} disconnected.")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.debug(f"[WebSocket] Failed to send personal message: {e}")

    async def broadcast_to_user(self, user_id: uuid.UUID, message: dict):
        """Pushes telemetry payload to all active sockets belonging to the target user."""
        if user_id not in self.active_connections:
            return

        dead_connections = set()
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.debug(f"[WebSocket] Error broadcasting to socket: {e}")
                dead_connections.add(websocket)

        # Clean up stale/broken connections
        for dead in dead_connections:
            self.active_connections[user_id].discard(dead)
        if user_id in self.active_connections and not self.active_connections[user_id]:
            del self.active_connections[user_id]

    async def broadcast_to_all(self, message: dict):
        """Pushes broadcast payload to every connected client across all users."""
        for user_id in list(self.active_connections.keys()):
            await self.broadcast_to_user(user_id, message)

    def get_connected_user_count(self) -> int:
        return len(self.active_connections)

# Singleton manager instance
ws_manager = ConnectionManager()
