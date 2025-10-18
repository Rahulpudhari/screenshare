import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function ShareScreen() {
  const router = useRouter();
  const [isSharing, setIsSharing] = useState(false);
  const [roomId, setRoomId] = useState<string>('');
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const captureInterval = useRef<NodeJS.Timeout | null>(null);
  const screenRef = useRef<View>(null);

  useEffect(() => {
    // Connect to Socket.IO server  
    const socket = io(BACKEND_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('room_created', (data) => {
      console.log('Room created:', data.room_id);
      setRoomId(data.room_id);
    });

    socket.on('viewer_joined', (data) => {
      console.log('Viewer joined:', data.viewer_count);
      setViewerCount(data.viewer_count);
    });

    socket.on('viewer_left', (data) => {
      console.log('Viewer left:', data.viewer_count);
      setViewerCount(data.viewer_count);
    });

    socket.on('error', (data) => {
      Alert.alert('Error', data.message);
    });

    socketRef.current = socket;

    return () => {
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
      }
      socket.disconnect();
    };
  }, []);

  const startSharing = () => {
    if (!socketRef.current || !isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    // Create room
    socketRef.current.emit('create_room', {});
    setIsSharing(true);

    // Start capturing screen at intervals
    captureInterval.current = setInterval(async () => {
      try {
        if (screenRef.current) {
          const uri = await captureRef(screenRef.current, {
            format: 'jpg',
            quality: 0.3,
            result: 'base64',
          });

          if (socketRef.current && roomId) {
            socketRef.current.emit('screen_frame', {
              room_id: roomId,
              frame: uri,
            });
          }
        }
      } catch (error) {
        console.error('Capture error:', error);
      }
    }, 500); // Capture every 500ms (2 FPS)
  };

  const stopSharing = () => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
      captureInterval.current = null;
    }

    if (socketRef.current && roomId) {
      socketRef.current.emit('leave_room', { room_id: roomId });
    }

    setIsSharing(false);
    setRoomId('');
    setViewerCount(0);
  };

  const copyRoomId = () => {
    if (roomId) {
      // Note: Clipboard API would be used here in production
      Alert.alert('Room Code', `Share this code: ${roomId}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Screen</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, isConnected && styles.statusDotConnected]} />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View ref={screenRef} style={styles.screenPreview}>
          <Ionicons name="tv" size={64} color="#4A90E2" />
          <Text style={styles.previewText}>This area will be shared</Text>
          
          {isSharing && roomId && (
            <View style={styles.roomInfo}>
              <Text style={styles.roomLabel}>Room Code:</Text>
              <TouchableOpacity onPress={copyRoomId} style={styles.roomCodeContainer}>
                <Text style={styles.roomCode}>{roomId}</Text>
                <Ionicons name="copy-outline" size={20} color="#4A90E2" />
              </TouchableOpacity>
              
              <View style={styles.viewerInfo}>
                <Ionicons name="people" size={20} color="#50C878" />
                <Text style={styles.viewerText}>{viewerCount} viewers</Text>
              </View>
            </View>
          )}
        </View>

        {!isSharing ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton, !isConnected && styles.disabledButton]}
            onPress={startSharing}
            disabled={!isConnected}
            activeOpacity={0.8}
          >
            <Ionicons name="play-circle" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Start Sharing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={stopSharing}
            activeOpacity={0.8}
          >
            <Ionicons name="stop-circle" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Stop Sharing</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#4A90E2" />
          <Text style={styles.infoText}>
            Share the room code with others on the same WiFi network to let them view your screen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#666',
  },
  statusDotConnected: {
    backgroundColor: '#50C878',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  screenPreview: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  previewText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  roomInfo: {
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
  },
  roomLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  roomCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 12,
  },
  roomCode: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90E2',
    letterSpacing: 4,
  },
  viewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a3a1a',
    borderRadius: 20,
  },
  viewerText: {
    fontSize: 14,
    color: '#50C878',
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 12,
    marginTop: 24,
  },
  startButton: {
    backgroundColor: '#4A90E2',
  },
  stopButton: {
    backgroundColor: '#E74C3C',
  },
  disabledButton: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
});
