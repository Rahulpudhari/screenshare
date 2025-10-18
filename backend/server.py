from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Set
import uuid
from datetime import datetime
import socketio
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Store active rooms and connections
rooms: Dict[str, Dict] = {}  # room_id -> {sharer: sid, viewers: Set[sid], last_frame: base64}

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    # Remove from any rooms
    for room_id, room_data in list(rooms.items()):
        if room_data.get('sharer') == sid:
            # Sharer disconnected, notify viewers
            await sio.emit('sharer_disconnected', room=room_id)
            del rooms[room_id]
            logger.info(f"Room {room_id} deleted (sharer disconnected)")
        elif sid in room_data.get('viewers', set()):
            room_data['viewers'].remove(sid)
            await sio.leave_room(sid, room_id)
            logger.info(f"Viewer {sid} removed from room {room_id}")

@sio.event
async def create_room(sid, data):
    """Create a new room for screen sharing"""
    room_id = str(uuid.uuid4())[:8].upper()
    rooms[room_id] = {
        'sharer': sid,
        'viewers': set(),
        'last_frame': None,
        'created_at': datetime.utcnow().isoformat()
    }
    await sio.enter_room(sid, room_id)
    logger.info(f"Room created: {room_id} by {sid}")
    await sio.emit('room_created', {'room_id': room_id}, room=sid)

@sio.event
async def join_room(sid, data):
    """Join an existing room as a viewer"""
    room_id = data.get('room_id', '').upper()
    
    if room_id not in rooms:
        await sio.emit('error', {'message': 'Room not found'}, room=sid)
        return
    
    rooms[room_id]['viewers'].add(sid)
    await sio.enter_room(sid, room_id)
    logger.info(f"Viewer {sid} joined room {room_id}")
    
    # Send confirmation and last frame if available
    response = {'room_id': room_id, 'success': True}
    if rooms[room_id]['last_frame']:
        response['last_frame'] = rooms[room_id]['last_frame']
    
    await sio.emit('room_joined', response, room=sid)
    
    # Notify sharer
    sharer_sid = rooms[room_id]['sharer']
    await sio.emit('viewer_joined', {'viewer_count': len(rooms[room_id]['viewers'])}, room=sharer_sid)

@sio.event
async def screen_frame(sid, data):
    """Receive screen frame from sharer and broadcast to viewers"""
    room_id = data.get('room_id')
    frame = data.get('frame')
    
    if not room_id or room_id not in rooms:
        return
    
    if rooms[room_id]['sharer'] != sid:
        await sio.emit('error', {'message': 'Only sharer can send frames'}, room=sid)
        return
    
    # Store last frame
    rooms[room_id]['last_frame'] = frame
    
    # Broadcast to all viewers in the room
    for viewer_sid in rooms[room_id]['viewers']:
        await sio.emit('frame_update', {'frame': frame}, room=viewer_sid)

@sio.event
async def leave_room(sid, data):
    """Leave a room"""
    room_id = data.get('room_id')
    
    if room_id not in rooms:
        return
    
    if rooms[room_id]['sharer'] == sid:
        # Sharer left, close room
        await sio.emit('sharer_disconnected', room=room_id)
        del rooms[room_id]
        logger.info(f"Room {room_id} closed by sharer")
    elif sid in rooms[room_id]['viewers']:
        rooms[room_id]['viewers'].remove(sid)
        await sio.leave_room(sid, room_id)
        logger.info(f"Viewer {sid} left room {room_id}")
        
        # Notify sharer
        sharer_sid = rooms[room_id]['sharer']
        await sio.emit('viewer_left', {'viewer_count': len(rooms[room_id]['viewers'])}, room=sharer_sid)

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Screen Share Server Running", "active_rooms": len(rooms)}

@api_router.get("/rooms")
async def get_rooms():
    """Get list of active rooms"""
    return {
        "rooms": [
            {
                "room_id": room_id,
                "viewer_count": len(data['viewers']),
                "created_at": data['created_at']
            }
            for room_id, data in rooms.items()
        ]
    }

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Mount Socket.IO and create the final app
app = socketio.ASGIApp(sio, app)
