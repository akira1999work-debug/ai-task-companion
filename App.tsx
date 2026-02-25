import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>アイタス</Text>
      <Text style={styles.subtitle}>Loading...</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366F1',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
  },
});
