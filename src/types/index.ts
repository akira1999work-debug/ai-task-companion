// Task types
export type TaskType = 'routine' | 'normal' | 'urgent';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  subTasks: SubTask[];
  createdAt: string;
  taskType: TaskType;
  completedAt?: string;
  originalDueDate?: string;
  rescheduleCount: number;
  categoryId?: string;
}

// Reschedule reason types
export type RescheduleReason = 'schedule_change' | 'rest' | 'struggling';

export interface RescheduleRecord {
  id: string;
  reason: RescheduleReason;
  taskIds: string[];
  createdAt: string;
}

// Self-report types
export type SelfReportLevel = 'good' | 'normal' | 'tough';

// AI Personality types
export type PersonalityType = 'standard' | 'yuru' | 'maji';

export interface PersonalityConfig {
  id: PersonalityType;
  name: string;
  description: string;
  icon: string;
  isPremium: boolean;
}

// Chat message types
export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

// AI Provider types
export type ConnectionMode = 'local' | 'cloud' | 'hybrid';
export type ActiveConnection = 'local' | 'cloud' | 'none';

export interface AIProviderConfig {
  connectionMode: ConnectionMode;
  ollamaHost: string;
  ollamaPort: string;
  ollamaModel: string;
  geminiApiKey: string;
  geminiModel: string;
}

export interface AIResponse {
  text: string;
  source: ActiveConnection;
}

// Navigation types
export type RootTabParamList = {
  Home: undefined;
  TaskList: undefined;
  Review: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  Settings: undefined;
  TaskDetail: { taskId: string };
};
