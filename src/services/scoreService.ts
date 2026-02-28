import type { SQLiteDatabase } from 'expo-sqlite';
import type { SelfReportLevel } from '../types';
import * as DB from '../db/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryScore {
  categoryId: string;
  score: number;            // 0 – 100
  label: ScoreLabel;
  breakdown: ScoreBreakdown;
}

export type ScoreLabel = 'care_needed' | 'slow_start' | 'on_track' | 'excellent';

export interface ScoreBreakdown {
  quantitative: number;     // 0 – 100 (before weighting)
  trend: number;            // -100 – 100
  selfReport: number;       // -20 – 20
  streakBonus: number;      // -5 – 15
  dataAvailableDays: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_TYPE_WEIGHTS = {
  routine: 0.6,
  normal: 0.3,
  urgent: 0.1,
} as const;

const SELF_REPORT_SCORES: Record<SelfReportLevel, number> = {
  good: 20,
  normal: 0,
  tough: -20,
};

const STREAK_BONUS: Record<string, number> = {
  perfect_7plus: 15,
  perfect_3to6: 10,
  perfect_1to2: 5,
  soft_active: 5,
  none: 0,
  broken: -5,
};

// ---------------------------------------------------------------------------
// Score label mapping
// ---------------------------------------------------------------------------

function scoreToLabel(score: number): ScoreLabel {
  if (score <= 25) return 'care_needed';
  if (score <= 50) return 'slow_start';
  if (score <= 75) return 'on_track';
  return 'excellent';
}

// ---------------------------------------------------------------------------
// Clamp utility
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ---------------------------------------------------------------------------
// 1. Quantitative score — weighted completion rate by task type (past 7 days)
// ---------------------------------------------------------------------------

async function calcQuantitativeScore(db: SQLiteDatabase): Promise<{ score: number; dataAvailableDays: number }> {
  const stats = await DB.getCompletionStatsByType(db, 7);
  const dailyRates = await DB.getDailyCompletionRates(db, 7);

  if (stats.length === 0) {
    return { score: 50, dataAvailableDays: 0 };
  }

  let weightedSum = 0;
  let weightTotal = 0;

  for (const row of stats) {
    const taskType = row.task_type as keyof typeof TASK_TYPE_WEIGHTS;
    const weight = TASK_TYPE_WEIGHTS[taskType] || TASK_TYPE_WEIGHTS.normal;
    const rate = row.total > 0 ? (row.completed / row.total) * 100 : 50;

    weightedSum += rate * weight;
    weightTotal += weight;
  }

  const score = weightTotal > 0 ? weightedSum / weightTotal : 50;
  return { score: clamp(score, 0, 100), dataAvailableDays: dailyRates.length };
}

// ---------------------------------------------------------------------------
// 2. Trend score — 3-day moving average vs 7-day moving average
// ---------------------------------------------------------------------------

async function calcTrendScore(db: SQLiteDatabase): Promise<number> {
  const dailyRates = await DB.getDailyCompletionRates(db, 7);

  if (dailyRates.length < 2) {
    return 0; // Not enough data — neutral
  }

  const rates = dailyRates.map((r) => (r.total > 0 ? (r.completed / r.total) * 100 : 0));

  // 7-day average (or however many days we have)
  const avg7 = rates.reduce((sum, r) => sum + r, 0) / rates.length;

  // 3-day average (last 3 entries)
  const last3 = rates.slice(-3);
  const avg3 = last3.reduce((sum, r) => sum + r, 0) / last3.length;

  // Difference: positive = improving, negative = declining
  // Normalize to roughly -100 to 100 range
  const diff = avg3 - avg7;

  // Scale: a 30% improvement maps to +100, -30% maps to -100
  return clamp(diff * (100 / 30), -100, 100);
}

// ---------------------------------------------------------------------------
// 3. Self-report score
// ---------------------------------------------------------------------------

function calcSelfReportScore(
  selfReport: SelfReportLevel | null,
  selfReportDate: string | null,
): number {
  if (!selfReport || !selfReportDate) return 0;

  // Only use today's self-report
  const today = new Date().toISOString().split('T')[0];
  if (selfReportDate !== today) return 0;

  return SELF_REPORT_SCORES[selfReport] || 0;
}

// ---------------------------------------------------------------------------
// 4. Streak bonus (placeholder — full implementation requires routine tracking)
// ---------------------------------------------------------------------------

function calcStreakBonus(
  _perfectStreak: number,
  _softStreakActive: boolean,
): number {
  // This will be fully implemented when RoutineConfig is added to the DB.
  // For now, provide the structure so the scoring engine is complete.
  if (_perfectStreak >= 7) return STREAK_BONUS.perfect_7plus;
  if (_perfectStreak >= 3) return STREAK_BONUS.perfect_3to6;
  if (_perfectStreak >= 1) return STREAK_BONUS.perfect_1to2;
  if (_softStreakActive) return STREAK_BONUS.soft_active;
  return STREAK_BONUS.none;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export interface ScoreInput {
  db: SQLiteDatabase;
  selfReport: SelfReportLevel | null;
  selfReportDate: string | null;
  isCareMode: boolean;
  // Streak data (will come from routine tracking in the future)
  perfectStreak?: number;
  softStreakActive?: boolean;
}

export async function calculateScore(input: ScoreInput): Promise<CategoryScore> {
  const { db, selfReport, selfReportDate, isCareMode } = input;
  const perfectStreak = input.perfectStreak || 0;
  const softStreakActive = input.softStreakActive || false;

  // 1. Quantitative (base weight: 50%)
  const { score: quantScore, dataAvailableDays } = await calcQuantitativeScore(db);

  // 2. Trend (base weight: 30%)
  const trendRaw = await calcTrendScore(db);

  // 3. Self-report (base weight: 20%)
  const selfReportScore = calcSelfReportScore(selfReport, selfReportDate);

  // 4. Streak bonus (added on top)
  const streakBonus = calcStreakBonus(perfectStreak, softStreakActive);

  // Dynamic weight adjustment for new users
  let wQuant = 0.5;
  let wTrend = 0.3;
  let wSelf = 0.2;

  if (dataAvailableDays < 3) {
    // New user — self-report is more important, quantitative is less reliable
    wQuant = 0.2;
    wTrend = 0.1;
    wSelf = 0.7;
  } else if (dataAvailableDays < 5) {
    // Still building up data
    wQuant = 0.35;
    wTrend = 0.25;
    wSelf = 0.4;
  }

  // Composite score
  // quantScore: 0-100, trendRaw: -100 to 100 (scale to 0-100 by adding 50 and halving)
  const trendNormalized = (trendRaw + 100) / 2; // maps -100..100 to 0..100

  let composite =
    quantScore * wQuant +
    trendNormalized * wTrend +
    (50 + selfReportScore) * wSelf + // 50 is the neutral base for self-report
    streakBonus;

  // Care mode clamp: score cannot exceed 50 while in care mode
  if (isCareMode) {
    composite = Math.min(composite, 50);
  }

  composite = clamp(Math.round(composite), 0, 100);

  return {
    categoryId: 'global', // Will be per-category when TaskCategory is implemented
    score: composite,
    label: scoreToLabel(composite),
    breakdown: {
      quantitative: Math.round(quantScore),
      trend: Math.round(trendRaw),
      selfReport: selfReportScore,
      streakBonus,
      dataAvailableDays,
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience: get score label text (for AI prompt building)
// ---------------------------------------------------------------------------

export const SCORE_LABEL_TEXT: Record<ScoreLabel, { ja: string; aiHint: string }> = {
  care_needed: {
    ja: '要ケア',
    aiHint: 'ユーザーは停滞中です。5〜10分のベビーステップを提案し、タスク数を減らすことを推奨してください。励ましを最優先にしてください。',
  },
  slow_start: {
    ja: 'スロースタート',
    aiHint: 'ユーザーは回復途中です。15〜30分の小さなタスクを中心に、1日3件以内を推奨してください。',
  },
  on_track: {
    ja: '順調',
    aiHint: 'ユーザーは順調です。標準的なサブタスク分解とバランスの取れた提案をしてください。',
  },
  excellent: {
    ja: '絶好調',
    aiHint: 'ユーザーは絶好調です。チャレンジ目標やマイルストーン型の提案をしてください。',
  },
};
