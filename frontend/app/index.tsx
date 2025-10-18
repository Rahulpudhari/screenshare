import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="tv-outline" size={80} color="#4A90E2" />
          <Text style={styles.title}>Screen Share</Text>
          <Text style={styles.subtitle}>Share your screen on local network</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.shareButton]}
            onPress={() => router.push('/share')}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={32} color="#fff" />
            <Text style={styles.buttonText}>Share Screen</Text>
            <Text style={styles.buttonSubtext}>Start sharing your screen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.viewButton]}
            onPress={() => router.push('/view')}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={32} color="#fff" />
            <Text style={styles.buttonText}>View Screen</Text>
            <Text style={styles.buttonSubtext}>Join with a room code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Ionicons name="wifi" size={20} color="#666" />
          <Text style={styles.footerText}>Works on WiFi and Hotspot</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 16,
  },
  button: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  shareButton: {
    backgroundColor: '#4A90E2',
  },
  viewButton: {
    backgroundColor: '#50C878',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  buttonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
});
