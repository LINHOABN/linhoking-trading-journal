from fastapi import WebSocket


class ConnectionManager:
    """Keeps track of connected clients per user and broadcasts JSON events.

    For a single-instance deployment this in-memory approach is fine.
    For multi-instance deployments, back this with Redis pub/sub instead.
    """

    def __init__(self) -> None:
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        if user_id in self.active and ws in self.active[user_id]:
            self.active[user_id].remove(ws)

    async def send_to_user(self, user_id: str, message: dict) -> None:
        sockets = list(self.active.get(user_id, []))
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)


manager = ConnectionManager()
