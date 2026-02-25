// Task types
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
}

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

// Navigation types
export type RootTabParamList = {
  Home: undefined;
  TaskList: undefined;
  Review: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  TaskDetail: { taskId: string };
};
