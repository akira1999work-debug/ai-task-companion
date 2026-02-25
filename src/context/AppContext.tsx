import React, { createContext, useContext, useState, useCallback } from 'react';
import { Task, ChatMessage, PersonalityType } from '../types';

interface AppState {
  tasks: Task[];
  chatMessages: ChatMessage[];
  personality: PersonalityType;
  googleCalendarEnabled: boolean;
}

interface AppContextType extends AppState {
  addTask: (task: Task) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  rescheduleAllTasks: () => void;
  addChatMessage: (message: ChatMessage) => void;
  setPersonality: (p: PersonalityType) => void;
  setGoogleCalendarEnabled: (enabled: boolean) => void;
  completeTaskByVoice: (taskTitle: string) => void;
}

const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: '企画書のドラフトを書く',
    description: '来週のミーティング用の企画書',
    completed: false,
    dueDate: '2026-02-25',
    priority: 'high',
    isRecurring: false,
    subTasks: [
      { id: '1-1', title: '競合調査', completed: true },
      { id: '1-2', title: 'コスト試算', completed: false },
      { id: '1-3', title: 'スライド作成', completed: false },
    ],
    createdAt: '2026-02-24T10:00:00Z',
  },
  {
    id: '2',
    title: '朝のストレッチ',
    description: '15分間の全身ストレッチ',
    completed: false,
    dueDate: '2026-02-25',
    priority: 'medium',
    isRecurring: true,
    recurringPattern: 'daily',
    subTasks: [],
    createdAt: '2026-02-20T08:00:00Z',
  },
  {
    id: '3',
    title: '買い物リスト整理',
    description: '今週の食材を買う',
    completed: false,
    dueDate: '2026-02-26',
    priority: 'low',
    isRecurring: false,
    subTasks: [
      { id: '3-1', title: '野菜', completed: false },
      { id: '3-2', title: '肉・魚', completed: false },
    ],
    createdAt: '2026-02-24T14:00:00Z',
  },
  {
    id: '4',
    title: 'チームMTGの準備',
    description: 'アジェンダの確認と資料準備',
    completed: false,
    dueDate: '2026-02-25',
    priority: 'high',
    isRecurring: true,
    recurringPattern: 'weekly',
    subTasks: [],
    createdAt: '2026-02-23T09:00:00Z',
  },
  {
    id: '5',
    title: '読書 30分',
    description: '「思考の整理学」を読む',
    completed: false,
    dueDate: '2026-02-25',
    priority: 'low',
    isRecurring: true,
    recurringPattern: 'daily',
    subTasks: [],
    createdAt: '2026-02-22T20:00:00Z',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    text: 'こんにちは！今日のタスクを一緒に振り返りましょう。何か気になることはありますか？',
    sender: 'ai',
    timestamp: '2026-02-25T09:00:00Z',
  },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [personality, setPersonality] = useState<PersonalityType>('standard');
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [task, ...prev]);
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const rescheduleAllTasks = useCallback(() => {
    setTasks(prev =>
      prev.map(t => {
        if (!t.completed && t.dueDate === '2026-02-25') {
          const tomorrow = new Date('2026-02-26');
          return { ...t, dueDate: tomorrow.toISOString().split('T')[0] };
        }
        return t;
      })
    );
  }, []);

  const completeTaskByVoice = useCallback((taskTitle: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (!t.completed && t.title.includes(taskTitle)) {
          return { ...t, completed: true };
        }
        return t;
      })
    );
  }, []);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages(prev => [...prev, message]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        tasks,
        chatMessages,
        personality,
        googleCalendarEnabled,
        addTask,
        toggleTask,
        deleteTask,
        rescheduleAllTasks,
        addChatMessage,
        setPersonality,
        setGoogleCalendarEnabled,
        completeTaskByVoice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
