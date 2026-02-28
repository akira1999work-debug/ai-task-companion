import type { AIProviderConfig, PersonalityType } from '../types';
import type {
  CollectedInfo,
  OnboardingAIResponse,
  OnboardingState,
  SuggestedCategory,
  ScalingWeight,
} from '../types/onboarding';
import { chatWithGemini, chatWithOllama } from './aiProvider';

// ---------------------------------------------------------------------------
// Default category icons & colors by domain
// ---------------------------------------------------------------------------

const DOMAIN_DEFAULTS: Record<string, { icon: string; color: string; weight: ScalingWeight }> = {
  work:     { icon: 'briefcase-outline',     color: '#3B82F6', weight: 'strict'  },
  sidework: { icon: 'laptop',                color: '#8B5CF6', weight: 'strict'  },
  study:    { icon: 'book-open-variant',     color: '#F59E0B', weight: 'normal'  },
  hobby:    { icon: 'gamepad-variant',       color: '#10B981', weight: 'relaxed' },
  health:   { icon: 'heart-pulse',           color: '#EF4444', weight: 'normal'  },
  life:     { icon: 'star-outline',          color: '#EC4899', weight: 'relaxed' },
  misc:     { icon: 'package-variant',       color: '#9CA3AF', weight: 'normal'  },
};

// ---------------------------------------------------------------------------
// System prompt builder — personality-aware
// ---------------------------------------------------------------------------

const PERSONALITY_TONE: Record<PersonalityType, string> = {
  standard:
    '丁寧語で温かみのある口調で話してください。',
  yuru:
    'カジュアルでギャルっぽい口調で話してください。語尾に「〜」や絵文字を使ってフレンドリーに。例: 「えー！すごいじゃん〜！」',
  maji:
    '簡潔なビジネス調の敬語で話してください。データや効率を意識した口調で。例: 「なるほど、それは効率的ですね」',
};

function buildOnboardingSystemPrompt(
  personality: PersonalityType,
  collectedInfo: CollectedInfo,
  summary: string,
  turnCount: number,
  maxTurns: number,
): string {
  const toneInstruction = PERSONALITY_TONE[personality];

  const missingAreas: string[] = [];
  if (!collectedInfo.work)     missingAreas.push('仕事・本業 (strict)');
  if (!collectedInfo.hobby)    missingAreas.push('趣味・リラックス (relaxed)');
  if (!collectedInfo.goal)     missingAreas.push('目標・学習 (normal)');
  if (!collectedInfo.sidework) missingAreas.push('副業・ライフワーク (normal)');

  const remainingTurns = maxTurns - turnCount;

  return `あなたは「アイタス」というタスク管理アプリのオンボーディングAIです。
${toneInstruction}

【あなたの役割】
ユーザーの普段の生活や仕事、趣味、目標について自然に聞き出し、タスクカテゴリを提案するための情報を集めることです。

【重要なルール】
- ユーザーが感情を込めた発言（「忙しい」「大変」「つらい」等）をしたら、必ず共感の一言を添えてから質問に入ってください。例: 「それは大変ですね」「お疲れ様です」
- 一度に複数の質問をしないでください。1つずつ自然に聞いてください。
- 尋問のように聞かず、雑談の延長のように自然に広げてください。
- ユーザーが話したくなさそうな領域は無理に聞かないでください。

【まだ聞けていない領域】
${missingAreas.length > 0 ? missingAreas.join('\n') : '全て聞けました！'}

【残りターン数】
${remainingTurns}回（${remainingTurns <= 1 ? 'これが最後のターンです。まとめに入ってください。' : ''})

【これまでの会話要約】
${summary || '（最初のターンです）'}

【出力形式】
以下のJSON形式で回答してください。JSON以外のテキストは含めないでください。
{
  "reply": "ユーザーへの返答テキスト",
  "extractedCategories": [
    {
      "name": "カテゴリ名",
      "icon": "MaterialCommunityIcons名",
      "color": "#HEXカラー",
      "scalingWeight": "strict|normal|relaxed",
      "source": "抽出元の発話"
    }
  ],
  "collectedUpdate": {
    "work": true/false,
    "hobby": true/false,
    "goal": true/false,
    "sidework": true/false
  },
  "shouldContinue": true/false,
  "summary": "これまでの会話全体の要約（100文字以内）"
}

【カテゴリ抽出の注意】
- "work" フラグは仕事・本業について情報が得られた場合に true
- "hobby" フラグは趣味・遊びについて情報が得られた場合に true
- "goal" フラグは将来の目標・学習について情報が得られた場合に true
- "sidework" フラグは副業・ライフワークについて情報が得られた場合に true
- scalingWeight: 仕事系="strict"、生活/健康="normal"、趣味/長期目標="relaxed"
- icon は MaterialCommunityIcons から適切なものを選んでください
- 「雑務」カテゴリは絶対に出力しないでください（システムが自動追加します）`;
}

// ---------------------------------------------------------------------------
// Initial greeting (first turn — AI speaks first)
// ---------------------------------------------------------------------------

const INITIAL_GREETINGS: Record<PersonalityType, string> = {
  standard:
    'はじめまして！アイタスへようこそ。\n\nあなたに合ったタスク管理を始めるために、普段のことを少し教えてください。\n\nお仕事のこと、趣味のこと、これからやってみたいこと…なんでも気軽にどうぞ！',
  yuru:
    'やっほ〜！アイタスへようこそ〜！\n\nあなたのこと教えてほしいな〜！\n\nお仕事とか趣味とか、やりたいこととか…なんでもOKだよ〜！',
  maji:
    'アイタスへようこそ。効率的なタスク管理のため、あなたの状況を把握させてください。\n\n現在の業務内容、学習目標、プライベートの活動など、お聞かせください。',
};

export function getInitialGreeting(personality: PersonalityType): string {
  return INITIAL_GREETINGS[personality];
}

// ---------------------------------------------------------------------------
// Process a single onboarding turn
// ---------------------------------------------------------------------------

export async function processOnboardingTurn(
  config: AIProviderConfig,
  state: OnboardingState,
  userMessage: string,
): Promise<OnboardingAIResponse> {
  const systemPrompt = buildOnboardingSystemPrompt(
    state.personality,
    state.collectedInfo,
    state.rawTranscript,
    state.turnCount,
    state.maxTurns,
  );

  // Token saving: only send system prompt + summary + latest user message
  // (not the full chat history)
  const messages = [{ role: 'user' as const, content: userMessage }];

  let rawResponse: string;

  if (config.connectionMode === 'local') {
    rawResponse = await chatWithOllama(config, systemPrompt, messages, 15000);
  } else {
    // Cloud-first (default) or hybrid fallback
    try {
      rawResponse = await chatWithGemini(config, systemPrompt, messages);
    } catch {
      if (config.connectionMode === 'hybrid') {
        rawResponse = await chatWithOllama(config, systemPrompt, messages, 15000);
      } else {
        throw new Error('AI接続に失敗しました。設定を確認してください。');
      }
    }
  }

  // Parse JSON response
  try {
    // Extract JSON from potential markdown code blocks
    let jsonStr = rawResponse.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed: OnboardingAIResponse = JSON.parse(jsonStr);

    // Validate and provide defaults
    return {
      reply: parsed.reply || 'もう少し教えてもらえますか？',
      extractedCategories: (parsed.extractedCategories || []).map(normalizeCategoryDefaults),
      collectedUpdate: parsed.collectedUpdate || {},
      shouldContinue: parsed.shouldContinue !== false,
      summary: parsed.summary || '',
    };
  } catch {
    // If JSON parsing fails, treat the whole response as a conversational reply
    return {
      reply: rawResponse,
      extractedCategories: [],
      collectedUpdate: {},
      shouldContinue: state.turnCount < state.maxTurns - 1,
      summary: state.rawTranscript,
    };
  }
}

// ---------------------------------------------------------------------------
// Normalize category defaults
// ---------------------------------------------------------------------------

function normalizeCategoryDefaults(cat: SuggestedCategory): SuggestedCategory {
  // Ensure valid scalingWeight
  const validWeights: ScalingWeight[] = ['strict', 'normal', 'relaxed'];
  if (!validWeights.includes(cat.scalingWeight)) {
    cat.scalingWeight = 'normal';
  }

  // Fill in defaults if AI omitted icon/color
  if (!cat.icon || cat.icon === '') {
    cat.icon = 'folder-outline';
  }
  if (!cat.color || !cat.color.startsWith('#')) {
    cat.color = '#9CA3AF';
  }

  return cat;
}

// ---------------------------------------------------------------------------
// Build final category list (includes silent "雑務" addition)
// ---------------------------------------------------------------------------

export function buildFinalCategories(
  extracted: SuggestedCategory[],
): SuggestedCategory[] {
  // Deduplicate by name (keep first occurrence)
  const seen = new Set<string>();
  const unique: SuggestedCategory[] = [];
  for (const cat of extracted) {
    const key = cat.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cat);
    }
  }

  // Check if "雑務" already exists (user might have mentioned it)
  const hasMisc = unique.some(
    (c) => c.name === '雑務' || c.name === 'その他' || c.name === '雑用',
  );

  if (!hasMisc) {
    unique.push({
      name: '雑務',
      icon: DOMAIN_DEFAULTS.misc.icon,
      color: DOMAIN_DEFAULTS.misc.color,
      scalingWeight: DOMAIN_DEFAULTS.misc.weight,
      source: 'system',
    });
  }

  return unique;
}

// ---------------------------------------------------------------------------
// Extract UserProfile from conversation
// ---------------------------------------------------------------------------

export function extractUserProfile(
  rawTranscript: string,
  categories: SuggestedCategory[],
): {
  occupation: string | null;
  sideWork: string | null;
  interests: string[];
  goals: string[];
} {
  const occupation = categories.find(
    (c) => c.scalingWeight === 'strict' && !c.name.includes('副業'),
  );
  const sideWork = categories.find(
    (c) => c.source.includes('副業') || c.name.includes('副業'),
  );
  const interests = categories
    .filter((c) => c.scalingWeight === 'relaxed')
    .map((c) => c.name);
  const goals = categories
    .filter((c) => c.scalingWeight === 'normal' && c.name !== '雑務')
    .map((c) => c.name);

  return {
    occupation: occupation ? occupation.source : null,
    sideWork: sideWork ? sideWork.source : null,
    interests,
    goals,
  };
}
