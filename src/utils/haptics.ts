import { Platform } from 'react-native';

// Web-safe haptics wrapper — expo-haptics throws UnavailabilityError on web

interface HapticsModule {
  impactAsync: (style?: any) => Promise<void>;
  notificationAsync: (type?: any) => Promise<void>;
  selectionAsync: () => Promise<void>;
  ImpactFeedbackStyle: {
    Light: string;
    Medium: string;
    Heavy: string;
  };
  NotificationFeedbackType: {
    Success: string;
    Warning: string;
    Error: string;
  };
}

var noop = function (_?: any) { return Promise.resolve(); };

var HapticsWeb: HapticsModule = {
  impactAsync: noop,
  notificationAsync: noop,
  selectionAsync: function () { return Promise.resolve(); },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
};

var Haptics: HapticsModule;

if (Platform.OS === 'web') {
  Haptics = HapticsWeb;
} else {
  try {
    Haptics = require('expo-haptics');
  } catch {
    // expo-haptics failed to load (e.g. web bundler resolved this branch)
    Haptics = HapticsWeb;
  }
}

export default Haptics;
