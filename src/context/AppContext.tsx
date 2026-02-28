import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Task, SubTask, ChatMessage, PersonalityType, AIProviderConfig, ActiveConnection, ConnectionMode, RescheduleReason, SelfReportLevel, SuperGoal, PendingSuggestion, AiReviewWeights, PortfolioType, AiReviewResult } from '../types';
import { TaskCategory } from '../types/onboarding';
import * as DB from '../db/database';
import { useDatabase } from '../db/dbProvider';
import { inferCategory } from '../services/categoryInference';
import { executeAiReview, checkSanctuary } from '../services/aiReview';
import { checkSuggestionThreshold } from '../services/suggestionThreshold';

const DEFAULT_AI_CONFIG: AIProviderConfig = {
  connectionMode: 'cloud',
  ollamaHost: '127.0.0.1',
  ollamaPort: '11434',
  ollamaModel: 'gemma3:4b',
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
};

const DEFAULT_WEIGHTS_BY_PERSONALITY: Record<PersonalityType, AiReviewWeights> = {
  standard: { necessity: 1.0, feasibility: 1.0, decomposition: 1.0, efficiency: 1.0 },
  yuru:     { necessity: 0.5, feasibility: 1.5, decomposition: 0.8, efficiency: 0.7 },
  maji:     { necessity: 1.5, feasibility: 0.8, decomposition: 1.0, efficiency: 1.2 },
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
  // AI Review extensions
  superGoals: SuperGoal[];
  pendingSuggestions: PendingSuggestion[];
  sanctuaryKeywords: string[];
  aiReviewWeights: AiReviewWeights;
  hasPendingReviewSuggestions: boolean;
  insightVisualizationStyle: 'tiles' | 'bars';
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
  // Super Goals
  addSuperGoal: (goal: SuperGoal) => void;
  updateSuperGoal: (goal: SuperGoal) => void;
  deleteSuperGoal: (goalId: string) => void;
  // Pending Suggestions
  addPendingSuggestion: (suggestion: PendingSuggestion) => void;
  deletePendingSuggestion: (suggestionId: string) => void;
  // Task extended fields
  updateTaskPortfolioType: (taskId: string, portfolioType: PortfolioType) => void;
  toggleTaskSanctuary: (taskId: string) => void;
  updateTaskAiReviewCache: (taskId: string, cache: string | null) => void;
  updateTaskSuperGoalId: (taskId: string, superGoalId: string | null) => void;
  // SubTask mutations
  addSubTasksToTask: (taskId: string, subTasks: SubTask[]) => void;
  toggleSubTask: (taskId: string, subTaskId: string) => void;
  deleteSubTask: (taskId: string, subTaskId: string) => void;
  // Task field mutations
  updateTaskTitle: (taskId: string, title: string) => void;
  updateTaskDueDate: (taskId: string, dueDate: string | null) => void;
  // Settings
  setSanctuaryKeywords: (keywords: string[]) => void;
  setAiReviewWeights: (weights: AiReviewWeights) => void;
  setAiSubcategorySuggestions: (enabled: boolean) => void;
  setInsightVisualizationStyle: (style: 'tiles' | 'bars') => void;
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
  // AI Review extensions
  const [superGoals, setSuperGoals] = useState<SuperGoal[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestion[]>([]);
  const [sanctuaryKeywords, setSanctuaryKeywordsState] = useState<string[]>([]);
  const [aiReviewWeights, setAiReviewWeightsState] = useState<AiReviewWeights>(
    DEFAULT_WEIGHTS_BY_PERSONALITY.standard
  );
  const [hasPendingReviewSuggestions, setHasPendingReviewSuggestions] = useState(false);
  const [insightVisualizationStyle, setInsightVisualizationStyleState] = useState<'tiles' | 'bars'>('tiles');

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

        // Load super goals & pending suggestions
        const [dbSuperGoals, dbPendingSuggestions] = await Promise.all([
          DB.getAllSuperGoals(db),
          DB.getAllPendingSuggestions(db),
        ]);
        if (!cancelled) {
          setSuperGoals(dbSuperGoals);
          setPendingSuggestions(dbPendingSuggestions);
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

          // Load AI review settings
          const [dbWeights, dbSanctuaryKeywords, dbInsightStyle] = await Promise.all([
            DB.getSetting(db, 'ai_review_weights'),
            DB.getSetting(db, 'sanctuary_keywords'),
            DB.getSetting(db, 'insight_visualization_style'),
          ]);
          if (!cancelled) {
            if (dbWeights) {
              try {
                setAiReviewWeightsState(JSON.parse(dbWeights));
              } catch {
                // Use personality-based default
                var p = (dbPersonality || 'standard') as PersonalityType;
                setAiReviewWeightsState(DEFAULT_WEIGHTS_BY_PERSONALITY[p]);
              }
            } else {
              var p2 = (dbPersonality || 'standard') as PersonalityType;
              setAiReviewWeightsState(DEFAULT_WEIGHTS_BY_PERSONALITY[p2]);
            }
            if (dbSanctuaryKeywords) {
              try {
                setSanctuaryKeywordsState(JSON.parse(dbSanctuaryKeywords));
              } catch {
                setSanctuaryKeywordsState([]);
              }
            }
            if (dbInsightStyle === 'tiles' || dbInsightStyle === 'bars') {
              setInsightVisualizationStyleState(dbInsightStyle);
            }
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
  // Background inference + AI review helper
  // (defined before addTask so it can be referenced in addTask's deps)
  // -----------------------------------------------------------------------

  const runBackgroundInferenceAndReview = useCallback(async (taskId: string, taskTitle: string) => {
    try {
      // --- Phase 1: Sanctuary auto-detection ---
      const currentTask = tasks.find(function (t) { return t.id === taskId; }) || { title: taskTitle } as Task;
      const isSanc = checkSanctuary(currentTask, sanctuaryKeywords);
      if (isSanc && !currentTask.isSanctuary) {
        setTasks(function (prev) {
          return prev.map(function (t) {
            return t.id === taskId ? { ...t, isSanctuary: true } : t;
          });
        });
        DB.updateTaskSanctuary(db, taskId, true).catch(console.error);
      }

      // --- Phase 2: Category inference ---
      const result = await inferCategory(taskTitle, categories, aiConfig);
      setTasks(function (prev) {
        return prev.map(function (t) {
          if (t.id === taskId) {
            return {
              ...t,
              categoryId: result.categoryId || t.categoryId,
              inferenceStatus: 'completed' as const,
            };
          }
          return t;
        });
      });
      if (result.categoryId) {
        DB.updateTaskCategory(db, taskId, result.categoryId).catch(console.error);
      }
      DB.updateTaskInferenceStatus(db, taskId, 'completed').catch(console.error);

      // --- Phase 3: Subcategory accumulation ---
      if (result.action === 'new_subcategory' && result.suggestedName) {
        const suggestion: PendingSuggestion = {
          id: DB.generateId(),
          taskId: taskId,
          suggestedTagName: result.suggestedName,
          reason: result.suggestedParentId ? 'parent:' + result.suggestedParentId : undefined,
          createdAt: new Date().toISOString(),
        };
        setPendingSuggestions(function (prev) { return [suggestion, ...prev]; });
        DB.insertPendingSuggestion(db, suggestion).catch(console.error);

        // Threshold check
        if (result.categoryId) {
          const threshold = await checkSuggestionThreshold(db, result.suggestedName, result.categoryId);
          if (threshold.shouldPropose) {
            setHasPendingReviewSuggestions(true);
          }
        }
      }

      // --- Phase 4: AI review ---
      const todayStr = new Date().toISOString().split('T')[0];
      const updatedTask = tasks.find(function (t) { return t.id === taskId; });
      const taskForReview = updatedTask || { ...currentTask, isSanctuary: isSanc };
      const todayTasks = tasks.filter(function (t) {
        return t.dueDate === todayStr && !t.completed;
      });
      const reviewResult = await executeAiReview(
        taskForReview as Task,
        aiConfig,
        personality,
        superGoals,
        categories,
        aiReviewWeights,
        isCareMode,
        todayTasks.length,
      );
      const cacheJson = JSON.stringify(reviewResult);
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, aiReviewCache: cacheJson } : t;
        });
      });
      DB.updateTaskAiReviewCache(db, taskId, cacheJson).catch(console.error);

    } catch (e) {
      console.error('Background inference/review failed:', e);
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, inferenceStatus: 'failed' as const } : t;
        });
      });
      DB.updateTaskInferenceStatus(db, taskId, 'failed').catch(console.error);
    }
  }, [db, categories, aiConfig, sanctuaryKeywords, personality, superGoals, aiReviewWeights, isCareMode, tasks]);

  // -----------------------------------------------------------------------
  // Startup retry for pending inference tasks
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (isLoading || categories.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const pendingTasks = await DB.getTasksByInferenceStatus(db, 'pending');
        for (const task of pendingTasks) {
          if (cancelled) break;
          await runBackgroundInferenceAndReview(task.id, task.title);
          await new Promise(function (resolve) { setTimeout(resolve, 500); });
        }
      } catch (e) {
        console.error('Startup retry failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading]);

  // -----------------------------------------------------------------------
  // Mutations — optimistic update + async DB write
  // -----------------------------------------------------------------------

  const addTask = useCallback(
    (task: Task) => {
      // Auto-assign default category if not specified
      let taskToInsert = { ...task, inferenceStatus: 'pending' as const };
      if (!task.categoryId) {
        const defaultCat = categories.find(function (c) { return c.isDefault; });
        if (defaultCat) {
          taskToInsert = { ...taskToInsert, categoryId: defaultCat.id };
        }
      }
      setTasks((prev) => [taskToInsert, ...prev]);
      DB.insertTask(db, taskToInsert).catch(console.error);
      // Fire-and-forget background inference + review
      runBackgroundInferenceAndReview(taskToInsert.id, taskToInsert.title).catch(console.error);
    },
    [db, categories, runBackgroundInferenceAndReview],
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

  // -----------------------------------------------------------------------
  // Super Goals CRUD
  // -----------------------------------------------------------------------

  const addSuperGoal = useCallback(
    (goal: SuperGoal) => {
      setSuperGoals(function (prev) { return [...prev, goal]; });
      DB.insertSuperGoal(db, goal).catch(console.error);
    },
    [db],
  );

  const updateSuperGoalAction = useCallback(
    (goal: SuperGoal) => {
      setSuperGoals(function (prev) {
        return prev.map(function (g) { return g.id === goal.id ? goal : g; });
      });
      DB.updateSuperGoal(db, goal).catch(console.error);
    },
    [db],
  );

  const deleteSuperGoal = useCallback(
    (goalId: string) => {
      setSuperGoals(function (prev) {
        return prev.filter(function (g) { return g.id !== goalId; });
      });
      DB.deleteSuperGoalById(db, goalId).catch(console.error);
    },
    [db],
  );

  // -----------------------------------------------------------------------
  // Pending Suggestions
  // -----------------------------------------------------------------------

  const addPendingSuggestion = useCallback(
    (suggestion: PendingSuggestion) => {
      setPendingSuggestions(function (prev) { return [suggestion, ...prev]; });
      DB.insertPendingSuggestion(db, suggestion).catch(console.error);
    },
    [db],
  );

  const deletePendingSuggestion = useCallback(
    (suggestionId: string) => {
      setPendingSuggestions(function (prev) {
        return prev.filter(function (s) { return s.id !== suggestionId; });
      });
      DB.deletePendingSuggestionById(db, suggestionId).catch(console.error);
    },
    [db],
  );

  // -----------------------------------------------------------------------
  // Task extended field mutations
  // -----------------------------------------------------------------------

  const updateTaskPortfolioType = useCallback(
    (taskId: string, portfolioType: PortfolioType) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, portfolioType: portfolioType } : t;
        });
      });
      DB.updateTaskPortfolioType(db, taskId, portfolioType).catch(console.error);
    },
    [db],
  );

  const toggleTaskSanctuary = useCallback(
    (taskId: string) => {
      let newVal = false;
      setTasks(function (prev) {
        return prev.map(function (t) {
          if (t.id === taskId) {
            newVal = !t.isSanctuary;
            return { ...t, isSanctuary: newVal };
          }
          return t;
        });
      });
      DB.updateTaskSanctuary(db, taskId, newVal).catch(console.error);
    },
    [db],
  );

  const updateTaskAiReviewCacheAction = useCallback(
    (taskId: string, cache: string | null) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, aiReviewCache: cache ?? undefined } : t;
        });
      });
      DB.updateTaskAiReviewCache(db, taskId, cache).catch(console.error);
    },
    [db],
  );

  const updateTaskSuperGoalId = useCallback(
    (taskId: string, superGoalId: string | null) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, superGoalId: superGoalId ?? undefined } : t;
        });
      });
      DB.updateTaskSuperGoalId(db, taskId, superGoalId).catch(console.error);
    },
    [db],
  );

  // -----------------------------------------------------------------------
  // SubTask mutations
  // -----------------------------------------------------------------------

  const addSubTasksToTask = useCallback(
    (taskId: string, newSubTasks: SubTask[]) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          if (t.id === taskId) {
            return { ...t, subTasks: t.subTasks.concat(newSubTasks) };
          }
          return t;
        });
      });
      DB.bulkInsertSubTasks(db, taskId, newSubTasks).catch(console.error);
    },
    [db],
  );

  const toggleSubTask = useCallback(
    (taskId: string, subTaskId: string) => {
      var newCompleted = false;
      setTasks(function (prev) {
        return prev.map(function (t) {
          if (t.id === taskId) {
            return {
              ...t,
              subTasks: t.subTasks.map(function (s) {
                if (s.id === subTaskId) {
                  newCompleted = !s.completed;
                  return { ...s, completed: newCompleted };
                }
                return s;
              }),
            };
          }
          return t;
        });
      });
      DB.updateSubTaskCompleted(db, subTaskId, newCompleted).catch(console.error);
    },
    [db],
  );

  const deleteSubTask = useCallback(
    (taskId: string, subTaskId: string) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          if (t.id === taskId) {
            return {
              ...t,
              subTasks: t.subTasks.filter(function (s) { return s.id !== subTaskId; }),
            };
          }
          return t;
        });
      });
      DB.deleteSubTaskById(db, subTaskId).catch(console.error);
    },
    [db],
  );

  // -----------------------------------------------------------------------
  // Task field mutations
  // -----------------------------------------------------------------------

  const updateTaskTitleAction = useCallback(
    (taskId: string, title: string) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, title: title } : t;
        });
      });
      DB.updateTaskTitle(db, taskId, title).catch(console.error);
    },
    [db],
  );

  const updateTaskDueDateAction = useCallback(
    (taskId: string, dueDate: string | null) => {
      setTasks(function (prev) {
        return prev.map(function (t) {
          return t.id === taskId ? { ...t, dueDate: dueDate ?? undefined } : t;
        });
      });
      DB.updateTaskDueDate(db, taskId, dueDate).catch(console.error);
    },
    [db],
  );

  // -----------------------------------------------------------------------
  // Settings mutations
  // -----------------------------------------------------------------------

  const setSanctuaryKeywords = useCallback(
    (keywords: string[]) => {
      setSanctuaryKeywordsState(keywords);
      DB.setSetting(db, 'sanctuary_keywords', JSON.stringify(keywords)).catch(console.error);
    },
    [db],
  );

  const setAiReviewWeights = useCallback(
    (weights: AiReviewWeights) => {
      setAiReviewWeightsState(weights);
      DB.setSetting(db, 'ai_review_weights', JSON.stringify(weights)).catch(console.error);
    },
    [db],
  );

  const setAiSubcategorySuggestions = useCallback(
    (enabled: boolean) => {
      DB.setSetting(db, 'ai_subcategory_suggestions', enabled ? '1' : '0').catch(console.error);
    },
    [db],
  );

  const setInsightVisualizationStyle = useCallback(
    (style: 'tiles' | 'bars') => {
      setInsightVisualizationStyleState(style);
      DB.setSetting(db, 'insight_visualization_style', style).catch(console.error);
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
        superGoals,
        pendingSuggestions,
        sanctuaryKeywords,
        aiReviewWeights,
        hasPendingReviewSuggestions,
        insightVisualizationStyle,
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
        addSuperGoal,
        updateSuperGoal: updateSuperGoalAction,
        deleteSuperGoal,
        addPendingSuggestion,
        deletePendingSuggestion,
        updateTaskPortfolioType,
        toggleTaskSanctuary,
        updateTaskAiReviewCache: updateTaskAiReviewCacheAction,
        updateTaskSuperGoalId,
        addSubTasksToTask,
        toggleSubTask,
        deleteSubTask,
        updateTaskTitle: updateTaskTitleAction,
        updateTaskDueDate: updateTaskDueDateAction,
        setSanctuaryKeywords,
        setAiReviewWeights,
        setAiSubcategorySuggestions,
        setInsightVisualizationStyle,
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
