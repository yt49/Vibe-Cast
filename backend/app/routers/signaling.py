from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

router = APIRouter()

rooms: Dict[str, List[WebSocket]] = {}


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = []
    room = rooms[room_id]
    room.append(websocket)

    # 既にいる人に「誰か来たよ」と通知 → その人がofferを作る
    for peer in room[:-1]:
        await peer.send_text('{"type":"peer_joined"}')

    try:
        while True:
            data = await websocket.receive_text()
            # 同じ部屋の他の人全員に転送
            for peer in room:
                if peer != websocket:
                    await peer.send_text(data)
    except WebSocketDisconnect:
        room.remove(websocket)
        if not room:
            del rooms[room_id]
