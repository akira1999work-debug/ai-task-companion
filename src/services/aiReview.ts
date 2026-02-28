import type {
  Task,
  AIProviderConfig,
  PersonalityType,
  SuperGoal,
  AiReviewWeights,
  AiReviewResult,
  AiReviewPerspective,
} from '../types';
import type { TaskCategory } from '../types/onboarding';
import { chatWithGemini, chatWithOllama } from './aiProvider';

// ---------------------------------------------------------------------------
// Sanctuary (聖域) auto-detection
// ---------------------------------------------------------------------------

export function checkSanctuary(
  task: Task,
  sanctuaryKeywords: string[],
): boolean {
  // 1. portfolioType === 'recharge' → always sanctuary
  if (task.portfolioType === 'recharge') return true;

  // 2. Already flagged as sanctuary
  if (task.isSanctuary) return true;

  // 3. Title matches any sanctuary keyword
  if (sanctuaryKeywords.length > 0) {
    var title = task.title.toLowerCase();
    for (var i = 0; i < sanctuaryKeywords.length; i++) {
      if (title.indexOf(sanctuaryKeywords[i].toLowerCase()) >= 0) {
        return true;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Personality-based review behaviour
// ---------------------------------------------------------------------------

interface PersonalityReviewBehavior {
  primaryPerspective: 'necessity' | 'feasibility';
  overrideConfirm: boolean;   // maji: push back on goal deviation
  suggestSanctuary: boolean;  // yuru: proactively suggest sanctuary
}

function getPersonalityReviewBehavior(personality: PersonalityType): PersonalityReviewBehavior {
  switch (personality) {
    case 'yuru':
      return { primaryPerspective: 'feasibility', suggestSanctuary: true, overrideConfirm: false };
    case 'maji':
      return { primaryPerspective: 'necessity', suggestSanctuary: false, overrideConfirm: true };
    default:
      return { primaryPerspective: 'necessity', suggestSanctuary: false, overrideConfirm: false };
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildReviewPrompt(
  task: Task,
  personality: PersonalityType,
  superGoals: SuperGoal[],
  categories: TaskCategory[],
  isCareMode: boolean,
  todayTaskCount: number,
): string {
  var behavior = getPersonalityReviewBehavior(personality);

  // Find linked super goal
  var linkedGoal: SuperGoal | undefined;
  if (task.superGoalId) {
    linkedGoal = superGoals.find(function (g) { return g.id === task.superGoalId; });
  }

  // Find category name
  var categoryName = '未分類';
  if (task.categoryId) {
    var cat = categories.find(function (c) { return c.id === task.categoryId; });
    if (cat) categoryName = cat.name;
  }

  var parts: string[] = [];
  parts.push('あなたはタスクレビューAIです。以下のタスクを4つの視点で評価してください。');
  parts.push('');
  parts.push('【タスク情報】');
  parts.push('タイトル: ' + task.title);
  if (task.description) parts.push('説明: ' + task.description);
  parts.push('カテゴリ: ' + categoryName);
  parts.push('ポートフォリオ: ' + (task.portfolioType || 'maintenance'));
  if (task.dueDate) parts.push('期限: ' + task.dueDate);
  parts.push('');

  // Super goal context
  if (linkedGoal) {
    parts.push('【紐づくスーパーゴール】');
    parts.push('タイトル: ' + linkedGoal.title);
    if (linkedGoal.description) parts.push('説明: ' + linkedGoal.description);
    if (linkedGoal.targetDate) parts.push('目標日: ' + linkedGoal.targetDate);
    parts.push('');
  }

  // Context
  parts.push('【状況】');
  parts.push('本日のタスク数: ' + todayTaskCount + '件');
  if (isCareMode) parts.push('ケアモード: ON（ユーザーは疲れています）');
  parts.push('');

  // 4 perspectives
  parts.push('【4つの評価視点】');
  parts.push('1. 必要性(necessity): ' +
    (task.portfolioType === 'drive'
      ? 'スーパーゴールとの整合性を厳格に判定してください'
      : '生活維持に不可欠かを確認してください'));
  parts.push('2. 実現可能性(feasibility): 今日のタスク量' + (isCareMode ? '（ケアモード中）' : '') + 'を踏まえて判定');
  parts.push('3. 分解(decomposition): タスク名が抽象的なら最小単位のサブタスク案を生成');
  parts.push('4. 最適化(efficiency): 効率的な手段やショートカットの提案');
  parts.push('');

  // Personality instructions
  if (behavior.primaryPerspective === 'feasibility') {
    parts.push('【性格指示】ゆるい性格です。実現可能性を重視し、無理のない提案をしてください。');
  } else if (personality === 'maji') {
    parts.push('【性格指示】厳格な性格です。必要性を厳しく評価し、ゴール逸脱には指摘してください。');
  }
  parts.push('');

  // Output format
  parts.push('以下のJSON形式のみで回答してください:');
  parts.push('{');
  parts.push('  "necessity": { "score": 0-100, "summary": "1行", "suggestion": "改善案" },');
  parts.push('  "feasibility": { "score": 0-100, "summary": "1行", "suggestion": "改善案" },');
  parts.push('  "decomposition": { "score": 0-100, "summary": "1行", "suggestion": "改善案", "suggestedSubTasks": ["サブタスク1", ...] },');
  parts.push('  "efficiency": { "score": 0-100, "summary": "1行", "suggestion": "改善案" }');
  parts.push('}');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseDefaultPerspective(): AiReviewPerspective {
  return { score: 50, summary: '評価できませんでした' };
}

function parseReviewResponse(text: string): {
  necessity: AiReviewPerspective;
  feasibility: AiReviewPerspective;
  decomposition: AiReviewPerspective & { suggestedSubTasks?: string[] };
  efficiency: AiReviewPerspective;
} | null {
  try {
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    var parsed = JSON.parse(jsonMatch[0]);

    function toPerspective(obj: any): AiReviewPerspective {
      if (!obj || typeof obj !== 'object') return parseDefaultPerspective();
      return {
        score: typeof obj.score === 'number' ? Math.max(0, Math.min(100, obj.score)) : 50,
        summary: typeof obj.summary === 'string' ? obj.summary : '評価なし',
        suggestion: typeof obj.suggestion === 'string' ? obj.suggestion : undefined,
      };
    }

    var decomp = toPerspective(parsed.decomposition);
    var subTasks: string[] | undefined;
    if (parsed.decomposition && Array.isArray(parsed.decomposition.suggestedSubTasks)) {
      subTasks = parsed.decomposition.suggestedSubTasks.filter(
        function (s: any) { return typeof s === 'string'; }
      );
    }

    return {
      necessity: toPerspective(parsed.necessity),
      feasibility: toPerspective(parsed.feasibility),
      decomposition: { ...decomp, suggestedSubTasks: subTasks },
      efficiency: toPerspective(parsed.efficiency),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weighted overall score
// ---------------------------------------------------------------------------

function computeOverallScore(
  perspectives: {
    necessity: AiReviewPerspective;
    feasibility: AiReviewPerspective;
    decomposition: AiReviewPerspective;
    efficiency: AiReviewPerspective;
  },
  weights: AiReviewWeights,
): number {
  var totalWeight = weights.necessity + weights.feasibility + weights.decomposition + weights.efficiency;
  if (totalWeight === 0) return 50;

  var weighted =
    perspectives.necessity.score * weights.necessity +
    perspectives.feasibility.score * weights.feasibility +
    perspectives.decomposition.score * weights.decomposition +
    perspectives.efficiency.score * weights.efficiency;

  return Math.round(weighted / totalWeight);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function executeAiReview(
  task: Task,
  config: AIProviderConfig,
  personality: PersonalityType,
  superGoals: SuperGoal[],
  categories: TaskCategory[],
  weights: AiReviewWeights,
  isCareMode: boolean,
  todayTaskCount: number,
): Promise<AiReviewResult> {
  var now = new Date().toISOString();

  // Sanctuary check — skip full review
  // Note: sanctuary check is done by caller (AppContext), but we double-check here
  if (task.isSanctuary) {
    var behavior = getPersonalityReviewBehavior(personality);
    var sanctuaryMsg = behavior.suggestSanctuary
      ? 'これは大切な時間だよ〜！そのまま楽しんでね♪'
      : 'この活動は聖域として保護されています。レビューをスキップしました。';

    return {
      necessity: { score: 100, summary: '聖域タスク' },
      feasibility: { score: 100, summary: '聖域タスク' },
      decomposition: { score: 100, summary: '聖域タスク' },
      efficiency: { score: 100, summary: '聖域タスク' },
      overallScore: 100,
      isSanctuary: true,
      sanctuaryMessage: sanctuaryMsg,
      reviewedAt: now,
    };
  }

  // Build prompt and call AI
  var prompt = buildReviewPrompt(task, personality, superGoals, categories, isCareMode, todayTaskCount);
  var messages = [{ role: 'user' as const, content: prompt }];
  var systemPrompt = 'あなたはJSON出力専用のタスクレビューAIです。指示されたJSON形式のみで回答してください。';

  try {
    var text: string;

    if (config.connectionMode === 'local') {
      text = await chatWithOllama(config, systemPrompt, messages, 10000);
    } else if (config.connectionMode === 'cloud') {
      text = await chatWithGemini(config, systemPrompt, messages);
    } else {
      // hybrid
      try {
        text = await chatWithOllama(config, systemPrompt, messages, 5000);
      } catch {
        text = await chatWithGemini(config, systemPrompt, messages);
      }
    }

    var parsed = parseReviewResponse(text);
    if (!parsed) {
      // Parse failure — return neutral scores
      return {
        necessity: parseDefaultPerspective(),
        feasibility: parseDefaultPerspective(),
        decomposition: { ...parseDefaultPerspective() },
        efficiency: parseDefaultPerspective(),
        overallScore: 50,
        isSanctuary: false,
        reviewedAt: now,
      };
    }

    return {
      ...parsed,
      overallScore: computeOverallScore(parsed, weights),
      isSanctuary: false,
      reviewedAt: now,
    };
  } catch {
    // API failure — return neutral scores
    return {
      necessity: parseDefaultPerspective(),
      feasibility: parseDefaultPerspective(),
      decomposition: { ...parseDefaultPerspective() },
      efficiency: parseDefaultPerspective(),
      overallScore: 50,
      isSanctuary: false,
      reviewedAt: now,
    };
  }
}
