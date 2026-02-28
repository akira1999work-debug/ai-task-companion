import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from './src/db/database';
import { DatabaseProvider } from './src/db/dbProvider';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { themes, getCareTheme } from './src/theme';

function ThemedApp() {
  const { personality, isCareMode } = useApp();
  const theme = isCareMode ? getCareTheme(personality) : themes[personality];

  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
      <StatusBar style={personality === 'maji' ? 'light' : 'auto'} />
    </PaperProvider>
  );
}

function LoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics || {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
      <Suspense fallback={<LoadingFallback />}>
        <DatabaseProvider databaseName="aitas.db" onInit={initializeDatabase}>
          <AppProvider>
            <ThemedApp />
          </AppProvider>
        </DatabaseProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
