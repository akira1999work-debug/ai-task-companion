// Task types
export type TaskType = 'routine' | 'normal' | 'urgent';
export type PortfolioType = 'drive' | 'maintenance' | 'recharge';
export type InferenceStatus = 'pending' | 'completed' | 'failed';
export type SuperGoalStatus = 'active' | 'completed' | 'archived';

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
  portfolioType?: PortfolioType;
  isSanctuary?: boolean;
  aiReviewCache?: string;           // JSON.stringify(AiReviewResult)
  inferenceStatus?: InferenceStatus;
  superGoalId?: string;
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

// ---------------------------------------------------------------------------
// AI Review types
// ---------------------------------------------------------------------------

export interface AiReviewPerspective {
  score: number;        // 0-100
  summary: string;      // 1行の評価テキスト
  suggestion?: string;  // 改善提案（あれば）
}

export interface AiReviewResult {
  necessity: AiReviewPerspective;
  feasibility: AiReviewPerspective;
  decomposition: AiReviewPerspective & {
    suggestedSubTasks?: string[];  // 分解提案のサブタスク名リスト
  };
  efficiency: AiReviewPerspective;
  overallScore: number;            // 加重平均スコア
  isSanctuary: boolean;            // 聖域判定でスキップされたか
  sanctuaryMessage?: string;       // 聖域の場合の肯定メッセージ
  reviewedAt: string;              // ISO timestamp
}

// ---------------------------------------------------------------------------
// Super Goals
// ---------------------------------------------------------------------------

export interface SuperGoal {
  id: string;
  categoryId?: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: SuperGoalStatus;
}

// ---------------------------------------------------------------------------
// Pending Suggestions
// ---------------------------------------------------------------------------

export interface PendingSuggestion {
  id: string;
  taskId?: string;
  suggestedTagName: string;
  reason?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// AI Review Weights
// ---------------------------------------------------------------------------

export interface AiReviewWeights {
  necessity: number;      // 0.0 ~ 2.0
  feasibility: number;
  decomposition: number;
  efficiency: number;
}
