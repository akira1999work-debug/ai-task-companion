import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { themes } from './src/theme';

function ThemedApp() {
  const { personality } = useApp();
  const theme = themes[personality];

  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
      <StatusBar style={personality === 'maji' ? 'light' : 'auto'} />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemedApp />
    </AppProvider>
  );
}
