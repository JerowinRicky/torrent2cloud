import asyncio
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.task_db import task_session_factory
from app.core.security import decode_token
from app.core.ws_manager import ws_manager
from app.core.redis import get_redis
from app.models.user import User
from app.services.telemetry_service import TelemetryService
from app.core.logging import logger

router = APIRouter(prefix="/telemetry", tags=["Real-Time Telemetry & Streaming"])

async def authenticate_ws_token(token: str | None, db: AsyncSession) -> User | None:
    """Validates JWT access token for WebSocket / SSE connection."""
    if not token:
        logger.warning("[Telemetry Auth] No token provided")
        return None
    try:
        payload = decode_token(token)
        logger.info(f"[Telemetry Auth] Decoded payload: {payload}")
        if payload.get("type") != "access":
            logger.warning(f"[Telemetry Auth] Token type is not access: {payload.get('type')}")
            return None
        user_id = uuid.UUID(payload.get("sub"))
        user = await db.get(User, user_id)
        if user and user.is_active:
            return user
        logger.warning(f"[Telemetry Auth] User not found or inactive: {user_id}")
        return None
    except Exception as e:
        logger.warning(f"[Telemetry Auth] Token verification failed: {e}")
        return None

@router.websocket("/ws")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    token: str | None = Query(None)
):
    """
    Bi-directional WebSocket endpoint for live download speed, ETA,
    peers, seeds, and completion telemetry.
    """
    try:
        async with task_session_factory() as db:
            user = await authenticate_ws_token(token, db)
            if not user:
                # Fallback: allow authenticating via initial message frame
                await websocket.accept()
                try:
                    auth_msg = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
                    if auth_msg.get("type") == "auth":
                        user = await authenticate_ws_token(auth_msg.get("token"), db)
                except Exception as ae:
                    logger.warning(f"[WebSocket] Message auth failed: {ae}")

                if not user:
                    logger.warning("[WebSocket] Unauthenticated connection rejected.")
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    return
            else:
                await ws_manager.connect(user.id, websocket)

            # 1. Send initial snapshot of all active/queued jobs
            snapshot = await TelemetryService.get_user_snapshot(user.id, db)
            await ws_manager.send_personal_message({
                "type": "init",
                "user_id": str(user.id),
                "jobs": snapshot,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, websocket)

            # 2. Main receive loop (heartbeats & commands)
            try:
                while True:
                    data = await websocket.receive_json()
                    msg_type = data.get("type")
                    if msg_type == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
            except WebSocketDisconnect:
                ws_manager.disconnect(user.id, websocket)
            except Exception as e:
                logger.debug(f"[WebSocket] Loop exception: {e}")
                ws_manager.disconnect(user.id, websocket)
    except Exception as exc:
        logger.error(f"[WebSocket] Top level endpoint exception: {exc}", exc_info=True)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

@router.get("/events", summary="Server-Sent Events (SSE) streaming fallback")
async def sse_telemetry_endpoint(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Server-Sent Events fallback streaming endpoint for clients
    behind strict corporate proxies or environments blocking WebSockets.
    """
    user = await authenticate_ws_token(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token for streaming"
        )

    async def event_generator():
        # Send initial snapshot
        snapshot = await TelemetryService.get_user_snapshot(user.id, db)
        init_event = {
            "type": "init",
            "user_id": str(user.id),
            "jobs": snapshot,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        yield f"data: {json.dumps(init_event)}\n\n"

        # Subscribe to Redis pubsub channel
        redis = await get_redis()
        pubsub = redis.pubsub()
        channel_name = f"channel:telemetry:user:{user.id}"
        await pubsub.subscribe(channel_name)

        try:
            while True:
                # Listen with a timeout to allow ping keepalives
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    data_str = message.get("data")
                    yield f"data: {data_str}\n\n"
                else:
                    # Keepalive heartbeat
                    yield ": ping\n\n"
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
