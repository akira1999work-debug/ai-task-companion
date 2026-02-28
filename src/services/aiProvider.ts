import type {
  AIProviderConfig,
  AIResponse,
  ActiveConnection,
  ChatMessage,
  PersonalityType,
  Task,
} from '../types';

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

type AIContext = 'home' | 'review';

const PERSONALITY_INSTRUCTIONS: Record<PersonalityType, string> = {
  standard:
    'あなたは「アイタス」という名前のタスク管理AIアシスタントです。丁寧語で話してください。温かみがありつつ的確にサポートします。',
  yuru:
    'あなたは「ゆるアシ」という名前のゆるふわ系AIアシスタントです。カジュアルでギャルっぽい口調で話してください。語尾に「〜」や絵文字を使い、フレンドリーに接してください。',
  maji:
    'あなたは「マジアシ」という名前の効率重視AIアシスタントです。ビジネス調の簡潔な敬語で話してください。データや数字を交え、論理的にアドバイスしてください。',
};

function buildTaskSummary(tasks: Task[]): string {
  if (tasks.length === 0) return '現在タスクはありません。';

  const completed = tasks.filter((t) => t.completed).length;
  const remaining = tasks.length - completed;
  const highPriority = tasks.filter((t) => !t.completed && t.priority === 'high').length;

  let summary = '【現在のタスク状況】\n';
  summary += '合計: ' + tasks.length + '件 / 完了: ' + completed + '件 / 残り: ' + remaining + '件';
  if (highPriority > 0) {
    summary += ' / 高優先度(未完了): ' + highPriority + '件';
  }
  summary += '\n';

  const incomplete = tasks.filter((t) => !t.completed).slice(0, 5);
  if (incomplete.length > 0) {
    summary += '未完了タスク:\n';
    for (const t of incomplete) {
      summary += '- ' + t.title + ' [' + t.priority + ']' + (t.dueDate ? ' 期限:' + t.dueDate : '') + '\n';
    }
  }
  return summary;
}

export function buildSystemPrompt(
  personality: PersonalityType,
  tasks: Task[],
  context: AIContext,
): string {
  const base = PERSONALITY_INSTRUCTIONS[personality];
  const taskInfo = buildTaskSummary(tasks);

  if (context === 'home') {
    return (
      base +
      '\n\nユーザーはタスク管理のホーム画面であなたに話しかけています。' +
      'ユーザーの発言がタスクの追加依頼であれば、タスクが追加されたことを簡潔に確認してください。' +
      'タスクの完了報告であれば、ねぎらいの言葉をかけてください。' +
      '回答は1〜2文で簡潔にしてください。\n\n' +
      taskInfo
    );
  }

  // context === 'review'
  return (
    base +
    '\n\nユーザーはタスクの振り返り・レビュー画面であなたと対話しています。' +
    'タスクの進捗状況をもとにアドバイスや励ましをしてください。' +
    '会話の文脈を踏まえて自然に返答してください。\n\n' +
    taskInfo
  );
}

// ---------------------------------------------------------------------------
// Chat history conversion (last 20 messages)
// ---------------------------------------------------------------------------

interface APIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function chatMessagesToHistory(messages: ChatMessage[]): APIMessage[] {
  return messages.slice(-20).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
}

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------

export async function checkOllamaConnection(host: string, port: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 2000);
    const res = await fetch('http://' + host + ':' + port + '/api/tags', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function chatWithOllama(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: APIMessage[],
  timeoutMs: number = 30000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);

  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  try {
    const res = await fetch(
      'http://' + config.ollamaHost + ':' + config.ollamaPort + '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel,
          messages: ollamaMessages,
          stream: false,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error('Ollama returned ' + res.status);
    }

    const data = await res.json();
    return data.message.content;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

export async function chatWithGemini(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: APIMessage[],
): Promise<string> {
  if (!config.geminiApiKey) {
    throw new Error('Gemini APIキーが設定されていません');
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Add conversation history
  for (const m of messages) {
    contents.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    });
  }

  // Ensure first message is from user (Gemini requirement)
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({
      role: 'user',
      parts: [{ text: 'こんにちは' }],
    });
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    config.geminiModel +
    ':generateContent?key=' +
    config.geminiApiKey;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: contents,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(function () { return 'unknown'; });
    throw new Error('Gemini API error ' + res.status + ': ' + errorText);
  }

  const data = await res.json();

  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    throw new Error('Gemini returned unexpected response format');
  }

  return candidate.content.parts.map(function (p: { text?: string }) { return p.text || ''; }).join('');
}

// ---------------------------------------------------------------------------
// Main entry point — sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(
  config: AIProviderConfig,
  personality: PersonalityType,
  tasks: Task[],
  chatHistory: ChatMessage[],
  userMessage: string,
  context: AIContext,
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(personality, tasks, context);
  const history = chatMessagesToHistory(chatHistory);
  // Append the new user message
  history.push({ role: 'user', content: userMessage });

  const mode = config.connectionMode;

  if (mode === 'local') {
    const text = await chatWithOllama(config, systemPrompt, history, 30000);
    return { text: text, source: 'local' };
  }

  if (mode === 'cloud') {
    const text = await chatWithGemini(config, systemPrompt, history);
    return { text: text, source: 'cloud' };
  }

  // hybrid: try Ollama first (3s timeout), fallback to Gemini
  try {
    const text = await chatWithOllama(config, systemPrompt, history, 3000);
    return { text: text, source: 'local' };
  } catch {
    // Fallback to Gemini
    try {
      const text = await chatWithGemini(config, systemPrompt, history);
      return { text: text, source: 'cloud' };
    } catch (geminiError) {
      throw geminiError;
    }
  }
}
