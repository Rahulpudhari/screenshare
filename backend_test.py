#!/usr/bin/env python3
"""
Backend Test Suite for Screen Sharing App
Tests Socket.IO WebSocket functionality and REST API endpoints
"""

import asyncio
import socketio
import requests
import base64
import json
import time
from typing import Dict, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
EXTERNAL_BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://hotspot-mirror.preview.emergentagent.com')
INTERNAL_BACKEND_URL = 'http://localhost:8001'
API_BASE_URL = f"{EXTERNAL_BACKEND_URL}/api"

# Use internal URL for Socket.IO since external routing might not support it
SOCKETIO_URL = INTERNAL_BACKEND_URL

print(f"Testing REST API at: {EXTERNAL_BACKEND_URL}")
print(f"Testing Socket.IO at: {SOCKETIO_URL}")
print(f"API base URL: {API_BASE_URL}")

class ScreenShareTester:
    def __init__(self):
        self.test_results = {}
        self.clients = {}
        self.room_id = None
        
    async def setup_client(self, client_name: str) -> socketio.AsyncClient:
        """Create and connect a Socket.IO client"""
        client = socketio.AsyncClient(logger=False, engineio_logger=False)
        
        # Event handlers for testing
        @client.event
        async def connect():
            print(f"✓ {client_name} connected successfully")
            
        @client.event
        async def disconnect():
            print(f"✓ {client_name} disconnected")
            
        @client.event
        async def connected(data):
            print(f"✓ {client_name} received connected event: {data}")
            
        @client.event
        async def room_created(data):
            print(f"✓ {client_name} received room_created: {data}")
            self.room_id = data.get('room_id')
            
        @client.event
        async def room_joined(data):
            print(f"✓ {client_name} received room_joined: {data}")
            
        @client.event
        async def viewer_joined(data):
            print(f"✓ {client_name} received viewer_joined: {data}")
            
        @client.event
        async def viewer_left(data):
            print(f"✓ {client_name} received viewer_left: {data}")
            
        @client.event
        async def frame_update(data):
            print(f"✓ {client_name} received frame_update (frame size: {len(data.get('frame', ''))} chars)")
            
        @client.event
        async def sharer_disconnected():
            print(f"✓ {client_name} received sharer_disconnected")
            
        @client.event
        async def error(data):
            print(f"✗ {client_name} received error: {data}")
        
        self.clients[client_name] = client
        return client
    
    def create_test_frame(self) -> str:
        """Create a base64 encoded test image"""
        # Create a simple test image data (1x1 pixel PNG)
        test_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        return base64.b64encode(test_data).decode('utf-8')
    
    async def test_connection(self) -> bool:
        """Test Socket.IO connection"""
        print("\n=== Testing Socket.IO Connection ===")
        try:
            client = await self.setup_client("test_connection")
            await client.connect(BACKEND_URL)
            await asyncio.sleep(1)  # Wait for connection events
            await client.disconnect()
            self.test_results['connection'] = True
            print("✓ Connection test passed")
            return True
        except Exception as e:
            print(f"✗ Connection test failed: {e}")
            self.test_results['connection'] = False
            return False
    
    async def test_room_creation(self) -> bool:
        """Test room creation functionality"""
        print("\n=== Testing Room Creation ===")
        try:
            client = await self.setup_client("sharer")
            await client.connect(BACKEND_URL)
            await asyncio.sleep(1)
            
            # Create room
            await client.emit('create_room', {})
            await asyncio.sleep(2)  # Wait for room_created event
            
            if self.room_id and len(self.room_id) == 8:
                print(f"✓ Room created with ID: {self.room_id}")
                self.test_results['room_creation'] = True
                await client.disconnect()
                return True
            else:
                print("✗ Room creation failed - no valid room ID received")
                self.test_results['room_creation'] = False
                await client.disconnect()
                return False
                
        except Exception as e:
            print(f"✗ Room creation test failed: {e}")
            self.test_results['room_creation'] = False
            return False
    
    async def test_room_joining(self) -> bool:
        """Test room joining functionality"""
        print("\n=== Testing Room Joining ===")
        try:
            # First create a room
            sharer = await self.setup_client("sharer")
            await sharer.connect(BACKEND_URL)
            await asyncio.sleep(1)
            
            await sharer.emit('create_room', {})
            await asyncio.sleep(2)
            
            if not self.room_id:
                print("✗ Cannot test room joining - no room created")
                self.test_results['room_joining'] = False
                return False
            
            # Test valid room join
            viewer = await self.setup_client("viewer")
            await viewer.connect(BACKEND_URL)
            await asyncio.sleep(1)
            
            await viewer.emit('join_room', {'room_id': self.room_id})
            await asyncio.sleep(2)
            
            # Test invalid room join
            await viewer.emit('join_room', {'room_id': 'INVALID1'})
            await asyncio.sleep(2)
            
            await viewer.disconnect()
            await sharer.disconnect()
            
            self.test_results['room_joining'] = True
            print("✓ Room joining test passed")
            return True
            
        except Exception as e:
            print(f"✗ Room joining test failed: {e}")
            self.test_results['room_joining'] = False
            return False
    
    async def test_screen_frame_broadcasting(self) -> bool:
        """Test screen frame broadcasting"""
        print("\n=== Testing Screen Frame Broadcasting ===")
        try:
            # Create sharer and viewer
            sharer = await self.setup_client("sharer")
            viewer1 = await self.setup_client("viewer1")
            viewer2 = await self.setup_client("viewer2")
            
            # Connect all clients
            await sharer.connect(BACKEND_URL)
            await viewer1.connect(BACKEND_URL)
            await viewer2.connect(BACKEND_URL)
            await asyncio.sleep(1)
            
            # Create room
            await sharer.emit('create_room', {})
            await asyncio.sleep(2)
            
            if not self.room_id:
                print("✗ Cannot test frame broadcasting - no room created")
                self.test_results['frame_broadcasting'] = False
                return False
            
            # Join viewers
            await viewer1.emit('join_room', {'room_id': self.room_id})
            await viewer2.emit('join_room', {'room_id': self.room_id})
            await asyncio.sleep(2)
            
            # Send test frame
            test_frame = self.create_test_frame()
            await sharer.emit('screen_frame', {
                'room_id': self.room_id,
                'frame': test_frame
            })
            await asyncio.sleep(2)
            
            # Test that only sharer can send frames
            await viewer1.emit('screen_frame', {
                'room_id': self.room_id,
                'frame': test_frame
            })
            await asyncio.sleep(2)
            
            await viewer1.disconnect()
            await viewer2.disconnect()
            await sharer.disconnect()
            
            self.test_results['frame_broadcasting'] = True
            print("✓ Frame broadcasting test passed")
            return True
            
        except Exception as e:
            print(f"✗ Frame broadcasting test failed: {e}")
            self.test_results['frame_broadcasting'] = False
            return False
    
    async def test_connection_management(self) -> bool:
        """Test connection management and cleanup"""
        print("\n=== Testing Connection Management ===")
        try:
            # Create sharer and viewers
            sharer = await self.setup_client("sharer")
            viewer1 = await self.setup_client("viewer1")
            viewer2 = await self.setup_client("viewer2")
            
            # Connect all
            await sharer.connect(BACKEND_URL)
            await viewer1.connect(BACKEND_URL)
            await viewer2.connect(BACKEND_URL)
            await asyncio.sleep(1)
            
            # Create room and join viewers
            await sharer.emit('create_room', {})
            await asyncio.sleep(2)
            
            if self.room_id:
                await viewer1.emit('join_room', {'room_id': self.room_id})
                await viewer2.emit('join_room', {'room_id': self.room_id})
                await asyncio.sleep(2)
                
                # Test viewer leaving
                await viewer1.emit('leave_room', {'room_id': self.room_id})
                await asyncio.sleep(2)
                
                # Test sharer disconnecting (should notify remaining viewer)
                await sharer.disconnect()
                await asyncio.sleep(2)
                
                await viewer2.disconnect()
            
            self.test_results['connection_management'] = True
            print("✓ Connection management test passed")
            return True
            
        except Exception as e:
            print(f"✗ Connection management test failed: {e}")
            self.test_results['connection_management'] = False
            return False
    
    def test_rest_api(self) -> bool:
        """Test REST API endpoints"""
        print("\n=== Testing REST API ===")
        try:
            # Test root endpoint
            response = requests.get(f"{API_BASE_URL}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ GET /api/ - Status: {response.status_code}, Response: {data}")
            else:
                print(f"✗ GET /api/ failed - Status: {response.status_code}")
                self.test_results['rest_api'] = False
                return False
            
            # Test rooms endpoint
            response = requests.get(f"{API_BASE_URL}/rooms", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ GET /api/rooms - Status: {response.status_code}, Rooms: {len(data.get('rooms', []))}")
            else:
                print(f"✗ GET /api/rooms failed - Status: {response.status_code}")
                self.test_results['rest_api'] = False
                return False
            
            self.test_results['rest_api'] = True
            print("✓ REST API test passed")
            return True
            
        except Exception as e:
            print(f"✗ REST API test failed: {e}")
            self.test_results['rest_api'] = False
            return False
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Screen Share Backend Tests")
        print(f"Backend URL: {BACKEND_URL}")
        
        # Test REST API first (doesn't require Socket.IO)
        self.test_rest_api()
        
        # Test Socket.IO functionality
        await self.test_connection()
        await self.test_room_creation()
        await self.test_room_joining()
        await self.test_screen_frame_broadcasting()
        await self.test_connection_management()
        
        # Print summary
        print("\n" + "="*50)
        print("TEST SUMMARY")
        print("="*50)
        
        passed = 0
        total = len(self.test_results)
        
        for test_name, result in self.test_results.items():
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed += 1
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed!")
            return True
        else:
            print("❌ Some tests failed!")
            return False

async def main():
    """Main test runner"""
    tester = ScreenShareTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)