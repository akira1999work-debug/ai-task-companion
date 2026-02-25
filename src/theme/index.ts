import { MD3LightTheme } from 'react-native-paper';
import { PersonalityType } from '../types';

const baseTheme = {
  ...MD3LightTheme,
};

export const themes: Record<PersonalityType, typeof baseTheme> = {
  standard: {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#6366F1',
      primaryContainer: '#E0E7FF',
      secondary: '#8B5CF6',
      secondaryContainer: '#EDE9FE',
      tertiary: '#06B6D4',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceVariant: '#F1F5F9',
      error: '#EF4444',
      onPrimary: '#FFFFFF',
      onBackground: '#1E293B',
      onSurface: '#334155',
      outline: '#CBD5E1',
    },
  },
  yuru: {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#F472B6',
      primaryContainer: '#FFF1F2',
      secondary: '#FB923C',
      secondaryContainer: '#FFF7ED',
      tertiary: '#FBBF24',
      background: '#FFFBEB',
      surface: '#FFFFFF',
      surfaceVariant: '#FFF1F2',
      error: '#FB7185',
      onPrimary: '#FFFFFF',
      onBackground: '#78350F',
      onSurface: '#92400E',
      outline: '#FED7AA',
    },
  },
  maji: {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#3B82F6',
      primaryContainer: '#1E293B',
      secondary: '#64748B',
      secondaryContainer: '#334155',
      tertiary: '#06B6D4',
      background: '#0F172A',
      surface: '#1E293B',
      surfaceVariant: '#334155',
      error: '#EF4444',
      onPrimary: '#FFFFFF',
      onBackground: '#E2E8F0',
      onSurface: '#CBD5E1',
      outline: '#475569',
    },
  },
};
