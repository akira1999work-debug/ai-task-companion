import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Task, ChatMessage, PersonalityType, AIProviderConfig, ActiveConnection, ConnectionMode, RescheduleReason, SelfReportLevel } from '../types';
import { TaskCategory } from '../types/onboarding';
import * as DB from '../db/database';
import { useDatabase } from '../db/dbProvider';

const DEFAULT_AI_CONFIG: AIProviderConfig = {
  connectionMode: 'hybrid',
  ollamaHost: '127.0.0.1',
  ollamaPort: '11434',
  ollamaModel: 'llama4',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
};

interface AppState {
  tasks: Task[];
  chatMessages: ChatMessage[];
  personality: PersonalityType;
  googleCalendarEnabled: boolean;
  aiConfig: AIProviderConfig;
  activeConnection: ActiveConnection;
  isAiProcessing: boolean;
  isLoading: boolean;
  // Categories
  categories: TaskCategory[];
  // Care mode state
  isCareMode: boolean;
  careModeReason: RescheduleReason | null;
  careModeExpiresAt: string | null;
  // Self-report
  selfReport: SelfReportLevel | null;
  selfReportDate: string | null;
  // Onboarding
  onboardingComplete: boolean;
}

interface AppContextType extends AppState {
  addTask: (task: Task) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  rescheduleAllTasks: (reason: RescheduleReason) => void;
  addChatMessage: (message: ChatMessage) => void;
  setPersonality: (p: PersonalityType) => void;
  setGoogleCalendarEnabled: (enabled: boolean) => void;
  completeTaskByVoice: (taskTitle: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setOllamaHost: (host: string) => void;
  setOllamaPort: (port: string) => void;
  setGeminiApiKey: (key: string) => void;
  setActiveConnection: (conn: ActiveConnection) => void;
  setIsAiProcessing: (processing: boolean) => void;
  setSelfReport: (level: SelfReportLevel) => void;
  exitCareMode: () => void;
  setOnboardingComplete: () => void;
  updateTaskCategory: (taskId: string, categoryId: string) => void;
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
    taskType: 'normal',
    rescheduleCount: 0,
    originalDueDate: '2026-02-25',
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
    taskType: 'routine',
    rescheduleCount: 0,
    originalDueDate: '2026-02-25',
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
    taskType: 'normal',
    rescheduleCount: 0,
    originalDueDate: '2026-02-26',
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
    taskType: 'routine',
    rescheduleCount: 0,
    originalDueDate: '2026-02-25',
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
    taskType: 'routine',
    rescheduleCount: 0,
    originalDueDate: '2026-02-25',
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
  const db = useDatabase();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [personality, setPersonalityState] = useState<PersonalityType>('standard');
  const [googleCalendarEnabled, setGoogleCalendarEnabledState] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(DEFAULT_AI_CONFIG);
  const [activeConnection, setActiveConnection] = useState<ActiveConnection>('none');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Categories
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  // Care mode state
  const [isCareMode, setIsCareMode] = useState(false);
  const [careModeReason, setCareModeReason] = useState<RescheduleReason | null>(null);
  const [careModeExpiresAt, setCareModeExpiresAt] = useState<string | null>(null);
  // Self-report
  const [selfReport, setSelfReportState] = useState<SelfReportLevel | null>(null);
  const [selfReportDate, setSelfReportDate] = useState<string | null>(null);
  // Onboarding
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);

  // -----------------------------------------------------------------------
  // Load data from DB on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [dbTasks, dbMessages, dbPersonality, dbCalendar, dbConnMode, dbOllamaHost, dbOllamaPort, dbGeminiKey] = await Promise.all([
          DB.getAllTasks(db),
          DB.getAllChatMessages(db),
          DB.getSetting(db, 'personality'),
          DB.getSetting(db, 'googleCalendarEnabled'),
          DB.getSetting(db, 'connectionMode'),
          DB.getSetting(db, 'ollamaHost'),
          DB.getSetting(db, 'ollamaPort'),
          DB.getSetting(db, 'geminiApiKey'),
        ]);

        if (cancelled) return;

        // Seed mock data on first launch
        if (dbTasks.length === 0) {
          for (const task of MOCK_TASKS) {
            await DB.insertTask(db, task);
          }
          setTasks(MOCK_TASKS);
        } else {
          setTasks(dbTasks);
        }

        if (dbMessages.length === 0) {
          for (const msg of INITIAL_MESSAGES) {
            await DB.insertChatMessage(db, msg);
          }
          setChatMessages(INITIAL_MESSAGES);
        } else {
          setChatMessages(dbMessages);
        }

        // Load categories
        const dbCategories = await DB.getAllCategories(db);
        if (!cancelled) {
          setCategories(dbCategories);
        }

        if (dbPersonality) {
          setPersonalityState(dbPersonality as PersonalityType);
        }
        if (dbCalendar) {
          setGoogleCalendarEnabledState(dbCalendar === 'true');
        }

        setAiConfig((prev) => ({
          ...prev,
          connectionMode: (dbConnMode as ConnectionMode) || prev.connectionMode,
          ollamaHost: dbOllamaHost || prev.ollamaHost,
          ollamaPort: dbOllamaPort || prev.ollamaPort,
          geminiApiKey: dbGeminiKey || prev.geminiApiKey,
        }));

        // Restore onboarding / care mode / self-report from DB
        const dbOnboarding = await DB.getSetting(db, 'onboardingComplete');
        if (!cancelled && dbOnboarding === 'true') {
          setOnboardingCompleteState(true);
        }

        const [dbCareMode, dbCareReason, dbCareExpires, dbSelfReport, dbSelfReportDate] = await Promise.all([
          DB.getSetting(db, 'isCareMode'),
          DB.getSetting(db, 'careModeReason'),
          DB.getSetting(db, 'careModeExpiresAt'),
          DB.getSetting(db, 'selfReport'),
          DB.getSetting(db, 'selfReportDate'),
        ]);

        if (!cancelled) {
          // Auto-expire care mode if past expiry
          if (dbCareMode === 'true' && dbCareExpires) {
            if (new Date(dbCareExpires) > new Date()) {
              setIsCareMode(true);
              setCareModeReason(dbCareReason as RescheduleReason | null);
              setCareModeExpiresAt(dbCareExpires);
            } else {
              // Expired — clear it
              DB.setSetting(db, 'isCareMode', 'false').catch(console.error);
            }
          }
          if (dbSelfReport && dbSelfReportDate === new Date().toISOString().split('T')[0]) {
            setSelfReportState(dbSelfReport as SelfReportLevel);
            setSelfReportDate(dbSelfReportDate);
          }
        }
      } catch (e) {
        console.error('Failed to load data from DB:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  // -----------------------------------------------------------------------
  // Mutations — optimistic update + async DB write
  // -----------------------------------------------------------------------

  const addTask = useCallback(
    (task: Task) => {
      // Auto-assign default category if not specified
      let taskToInsert = task;
      if (!task.categoryId) {
        const defaultCat = categories.find(function (c) { return c.isDefault; });
        if (defaultCat) {
          taskToInsert = { ...task, categoryId: defaultCat.id };
        }
      }
      setTasks((prev) => [taskToInsert, ...prev]);
      DB.insertTask(db, taskToInsert).catch(console.error);
    },
    [db, categories],
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      let newCompleted = false;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            newCompleted = !t.completed;
            return {
              ...t,
              completed: newCompleted,
              completedAt: newCompleted ? new Date().toISOString() : undefined,
            };
          }
          return t;
        }),
      );
      DB.updateTaskCompleted(db, taskId, newCompleted).catch(console.error);
    },
    [db],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      DB.deleteTaskById(db, taskId).catch(console.error);
    },
    [db],
  );

  const rescheduleAllTasks = useCallback(
    (reason: RescheduleReason) => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const updates: { id: string; dueDate: string }[] = [];
      const affectedIds: string[] = [];

      setTasks((prev) =>
        prev.map((t) => {
          if (!t.completed && t.dueDate === todayStr) {
            updates.push({ id: t.id, dueDate: tomorrowStr });
            affectedIds.push(t.id);
            return {
              ...t,
              dueDate: tomorrowStr,
              rescheduleCount: t.rescheduleCount + 1,
            };
          }
          return t;
        }),
      );

      if (updates.length > 0) {
        DB.bulkRescheduleTasks(db, updates).catch(console.error);
        DB.insertRescheduleRecord(db, DB.generateId(), reason, affectedIds).catch(console.error);
      }

      // Activate care mode based on reason
      if (reason === 'struggling') {
        const expires = new Date();
        expires.setDate(expires.getDate() + 3);
        const expiresStr = expires.toISOString();
        setIsCareMode(true);
        setCareModeReason(reason);
        setCareModeExpiresAt(expiresStr);
        DB.setSetting(db, 'isCareMode', 'true').catch(console.error);
        DB.setSetting(db, 'careModeReason', reason).catch(console.error);
        DB.setSetting(db, 'careModeExpiresAt', expiresStr).catch(console.error);
      } else if (reason === 'rest') {
        const expires = new Date();
        expires.setDate(expires.getDate() + 1);
        const expiresStr = expires.toISOString();
        setIsCareMode(true);
        setCareModeReason(reason);
        setCareModeExpiresAt(expiresStr);
        DB.setSetting(db, 'isCareMode', 'true').catch(console.error);
        DB.setSetting(db, 'careModeReason', reason).catch(console.error);
        DB.setSetting(db, 'careModeExpiresAt', expiresStr).catch(console.error);
      }
      // 'schedule_change' does not activate care mode
    },
    [db],
  );

  const completeTaskByVoice = useCallback(
    (taskTitle: string) => {
      const matched: string[] = [];
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.completed && t.title.includes(taskTitle)) {
            matched.push(t.id);
            return { ...t, completed: true, completedAt: new Date().toISOString() };
          }
          return t;
        }),
      );
      for (const id of matched) {
        DB.updateTaskCompleted(db, id, true).catch(console.error);
      }
    },
    [db],
  );

  const updateTaskCategory = useCallback(
    (taskId: string, categoryId: string) => {
      setTasks((prev) =>
        prev.map(function (t) {
          if (t.id === taskId) {
            return { ...t, categoryId: categoryId };
          }
          return t;
        }),
      );
      DB.updateTaskCategory(db, taskId, categoryId).catch(console.error);
    },
    [db],
  );

  const setSelfReport = useCallback(
    (level: SelfReportLevel) => {
      const todayStr = new Date().toISOString().split('T')[0];
      setSelfReportState(level);
      setSelfReportDate(todayStr);
      DB.setSetting(db, 'selfReport', level).catch(console.error);
      DB.setSetting(db, 'selfReportDate', todayStr).catch(console.error);

      // If user reports 'good' while in care mode, exit immediately
      if (level === 'good' && isCareMode) {
        setIsCareMode(false);
        setCareModeReason(null);
        setCareModeExpiresAt(null);
        DB.setSetting(db, 'isCareMode', 'false').catch(console.error);
      }
    },
    [db, isCareMode],
  );

  const exitCareMode = useCallback(() => {
    setIsCareMode(false);
    setCareModeReason(null);
    setCareModeExpiresAt(null);
    DB.setSetting(db, 'isCareMode', 'false').catch(console.error);
  }, [db]);

  const setOnboardingComplete = useCallback(() => {
    setOnboardingCompleteState(true);
    DB.setSetting(db, 'onboardingComplete', 'true').catch(console.error);
  }, [db]);

  const addChatMessage = useCallback(
    (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);
      DB.insertChatMessage(db, message).catch(console.error);
    },
    [db],
  );

  const setPersonality = useCallback(
    (p: PersonalityType) => {
      setPersonalityState(p);
      DB.setSetting(db, 'personality', p).catch(console.error);
    },
    [db],
  );

  const setGoogleCalendarEnabled = useCallback(
    (enabled: boolean) => {
      setGoogleCalendarEnabledState(enabled);
      DB.setSetting(db, 'googleCalendarEnabled', String(enabled)).catch(console.error);
    },
    [db],
  );

  const setConnectionMode = useCallback(
    (mode: ConnectionMode) => {
      setAiConfig((prev) => ({ ...prev, connectionMode: mode }));
      DB.setSetting(db, 'connectionMode', mode).catch(console.error);
    },
    [db],
  );

  const setOllamaHost = useCallback(
    (host: string) => {
      setAiConfig((prev) => ({ ...prev, ollamaHost: host }));
      DB.setSetting(db, 'ollamaHost', host).catch(console.error);
    },
    [db],
  );

  const setOllamaPort = useCallback(
    (port: string) => {
      setAiConfig((prev) => ({ ...prev, ollamaPort: port }));
      DB.setSetting(db, 'ollamaPort', port).catch(console.error);
    },
    [db],
  );

  const setGeminiApiKey = useCallback(
    (key: string) => {
      setAiConfig((prev) => ({ ...prev, geminiApiKey: key }));
      DB.setSetting(db, 'geminiApiKey', key).catch(console.error);
    },
    [db],
  );

  return (
    <AppContext.Provider
      value={{
        tasks,
        chatMessages,
        personality,
        googleCalendarEnabled,
        aiConfig,
        activeConnection,
        isAiProcessing,
        isLoading,
        categories,
        isCareMode,
        careModeReason,
        careModeExpiresAt,
        selfReport,
        selfReportDate,
        onboardingComplete,
        addTask,
        toggleTask,
        deleteTask,
        rescheduleAllTasks,
        addChatMessage,
        setPersonality,
        setGoogleCalendarEnabled,
        completeTaskByVoice,
        setConnectionMode,
        setOllamaHost,
        setOllamaPort,
        setGeminiApiKey,
        setActiveConnection,
        setIsAiProcessing,
        setSelfReport,
        exitCareMode,
        setOnboardingComplete,
        updateTaskCategory,
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
