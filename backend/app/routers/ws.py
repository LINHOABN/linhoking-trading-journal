from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.ws_manager import manager
from app.security import decode_access_token

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/live")
async def live_updates(websocket: WebSocket, token: str = Query(...)):
    """Frontend connects here with its JWT as a query param
    (browsers can't set custom headers on a WebSocket handshake) to
    receive live events: new trades, MT5 syncs, tier changes."""
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # We don't expect the client to send anything meaningful,
            # but we must keep reading to detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
