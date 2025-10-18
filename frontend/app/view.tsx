import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function ViewScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io(BACKEND_URL, {
      path: '/socket.io',
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
      setIsJoined(false);
    });

    socket.on('room_joined', (data) => {
      console.log('Joined room:', data.room_id);
      setIsJoined(true);
      setIsLoading(false);
      
      if (data.last_frame) {
        setCurrentFrame(data.last_frame);
      }
    });

    socket.on('frame_update', (data) => {
      setCurrentFrame(data.frame);
    });

    socket.on('sharer_disconnected', () => {
      Alert.alert('Session Ended', 'The sharer has disconnected', [
        {
          text: 'OK',
          onPress: () => {
            setIsJoined(false);
            setCurrentFrame(null);
            setRoomCode('');
          },
        },
      ]);
    });

    socket.on('error', (data) => {
      Alert.alert('Error', data.message);
      setIsLoading(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }

    if (!socketRef.current || !isConnected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    setIsLoading(true);
    socketRef.current.emit('join_room', { room_id: roomCode.toUpperCase() });
  };

  const leaveRoom = () => {
    if (socketRef.current && roomCode) {
      socketRef.current.emit('leave_room', { room_id: roomCode.toUpperCase() });
    }

    setIsJoined(false);
    setCurrentFrame(null);
    setRoomCode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>View Screen</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, isConnected && styles.statusDotConnected]} />
        </View>
      </View>

      {!isJoined ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.joinContainer}>
            <Ionicons name="log-in-outline" size={64} color="#50C878" />
            <Text style={styles.joinTitle}>Join a Session</Text>
            <Text style={styles.joinSubtitle}>Enter the room code shared by the presenter</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter Room Code"
                placeholderTextColor="#666"
                value={roomCode}
                onChangeText={setRoomCode}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            <TouchableOpacity
              style={[styles.joinButton, (!isConnected || isLoading) && styles.disabledButton]}
              onPress={joinRoom}
              disabled={!isConnected || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="enter" size={24} color="#fff" />
                  <Text style={styles.joinButtonText}>Join Room</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#4A90E2" />
              <Text style={styles.infoText}>
                Make sure you're on the same WiFi network as the presenter.
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <View style={styles.roomBadge}>
              <Text style={styles.roomBadgeText}>Room: {roomCode}</Text>
            </View>
            <TouchableOpacity onPress={leaveRoom} style={styles.leaveButton}>
              <Ionicons name="exit-outline" size={20} color="#E74C3C" />
              <Text style={styles.leaveButtonText}>Leave</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.screenContainer}
            contentContainerStyle={styles.screenContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {currentFrame ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${currentFrame}` }}
                style={styles.screenImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.waitingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.waitingText}>Waiting for screen share...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

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
    flexGrow: 1,
    justifyContent: 'center',
  },
  joinContainer: {
    alignItems: 'center',
  },
  joinTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  joinSubtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginTop: 32,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#50C878',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  joinButtonText: {
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
    marginTop: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  viewerContainer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  roomBadge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roomBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3a1a1a',
    borderRadius: 20,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  screenContent: {
    flexGrow: 1,
  },
  screenImage: {
    width: '100%',
    height: '100%',
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  waitingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },
});
