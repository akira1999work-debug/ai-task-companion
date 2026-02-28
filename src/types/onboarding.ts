import type { PersonalityType } from './index';

// ---------------------------------------------------------------------------
// Onboarding conversation state
// ---------------------------------------------------------------------------

export interface CollectedInfo {
  work: boolean;      // 仕事・本業について聞けたか
  hobby: boolean;     // 趣味・リラックスについて聞けたか
  goal: boolean;      // 目標・学習について聞けたか
  sidework: boolean;  // 副業・ライフワークについて聞けたか
}

export interface OnboardingMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

export interface OnboardingState {
  collectedInfo: CollectedInfo;
  rawTranscript: string;           // 全発話の結合テキスト（トークン節約用に要約も管理）
  turnCount: number;               // 現在の往復数
  maxTurns: number;                // 最大ターン数（3〜4）
  messages: OnboardingMessage[];   // チャット履歴（UI表示用）
  suggestedCategories: SuggestedCategory[];
  isComplete: boolean;
  personality: PersonalityType;
}

// ---------------------------------------------------------------------------
// Category suggestion (AI output)
// ---------------------------------------------------------------------------

export type ScalingWeight = 'strict' | 'normal' | 'relaxed';

export interface SuggestedCategory {
  name: string;
  icon: string;
  color: string;
  scalingWeight: ScalingWeight;
  source: string;  // どの発話から抽出されたか（例: "IT企業でエンジニア"）
}

// ---------------------------------------------------------------------------
// Gemini structured response
// ---------------------------------------------------------------------------

export interface OnboardingAIResponse {
  reply: string;                            // AIの返答テキスト
  extractedCategories: SuggestedCategory[]; // 今回のターンで抽出されたカテゴリ
  collectedUpdate: Partial<CollectedInfo>;  // 今回のターンで収集できた情報
  shouldContinue: boolean;                  // まだ聞き足りないか
  summary: string;                          // これまでの会話の要約（トークン節約用）
}

// ---------------------------------------------------------------------------
// User Profile (persisted)
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  onboardingRaw: string;
  occupation: string | null;
  sideWork: string | null;
  interests: string[];
  goals: string[];
  ageGroup: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Task Category (persisted)
// ---------------------------------------------------------------------------

export interface TaskCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  scalingWeight: ScalingWeight;
  parentId: string | null;
}
