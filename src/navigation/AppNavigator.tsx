import React, { useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import TaskListScreen from '../screens/TaskListScreen';
import ReviewScreen from '../screens/ReviewScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import { useApp } from '../context/AppContext';
import type { RootTabParamList, RootStackParamList } from '../types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const theme = useTheme();
  const { personality } = useApp();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline + '30',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TaskList"
        component={TaskListScreen}
        options={{
          tabBarLabel: 'タスク',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="format-list-checks" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Review"
        component={ReviewScreen}
        options={{
          tabBarLabel: 'レビュー',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat-processing-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function OnboardingWrapper({ navigation }: { navigation: any }) {
  const { setOnboardingComplete } = useApp();

  const handleComplete = useCallback(() => {
    setOnboardingComplete();
    navigation.replace('MainTabs');
  }, [navigation, setOnboardingComplete]);

  return <OnboardingScreen onComplete={handleComplete} />;
}

export default function AppNavigator() {
  const theme = useTheme();
  const { onboardingComplete, isLoading } = useApp();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoading && !onboardingComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingWrapper} />
        ) : null}
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="TaskDetail"
          component={TaskDetailScreen}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
