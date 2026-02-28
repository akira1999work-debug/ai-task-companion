import type { AIProviderConfig } from '../types';
import type { TaskCategory } from '../types/onboarding';
import { chatWithGemini, chatWithOllama } from './aiProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InferenceResult {
  categoryId: string;
  action: 'existing' | 'new_subcategory' | 'fallback';
  suggestedName?: string;
  suggestedParentId?: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildCategoryPrompt(taskTitle: string, categories: TaskCategory[]): string {
  var categoryList = categories
    .map(function (c) { return c.name + ' (id: ' + c.id + ')'; })
    .join(', ');

  return (
    'あなたはタスクカテゴリ分類AIです。以下のルールに従ってJSON形式のみで回答してください。\n\n' +
    '【既存カテゴリ】\n' +
    categoryList + '\n\n' +
    '【タスク名】\n' +
    '「' + taskTitle + '」\n\n' +
    '【ルール】\n' +
    '1. 既存カテゴリと同義/類似なら: {"action":"existing","categoryId":"<id>","confidence":"high"}\n' +
    '   同義語判定: 「ビジネス」→「仕事」、「ゲーム」→「趣味」なども考慮\n' +
    '2. 既存カテゴリの子として新カテゴリが適切なら: {"action":"new_subcategory","parentId":"<id>","suggestedName":"<名前>"}\n' +
    '3. 判断できない場合: {"action":"fallback"}\n\n' +
    'JSON以外の文字列は出力しないでください。'
  );
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseInferenceResponse(
  text: string,
  categories: TaskCategory[],
): InferenceResult {
  var defaultCat = categories.find(function (c) { return c.isDefault; });
  var fallbackId = defaultCat ? defaultCat.id : categories[0].id;

  try {
    // Extract JSON from response (may include markdown code blocks)
    var jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { categoryId: fallbackId, action: 'fallback' };
    }

    var parsed = JSON.parse(jsonMatch[0]);

    if (parsed.action === 'existing' && parsed.categoryId) {
      // Verify the categoryId actually exists
      var exists = categories.some(function (c) { return c.id === parsed.categoryId; });
      if (exists) {
        return { categoryId: parsed.categoryId, action: 'existing' };
      }
      // Try matching by name if ID is wrong
      var byName = categories.find(function (c) {
        return c.name === parsed.categoryName || c.name === parsed.categoryId;
      });
      if (byName) {
        return { categoryId: byName.id, action: 'existing' };
      }
      return { categoryId: fallbackId, action: 'fallback' };
    }

    if (parsed.action === 'new_subcategory' && parsed.parentId && parsed.suggestedName) {
      var parentExists = categories.some(function (c) { return c.id === parsed.parentId; });
      if (parentExists) {
        return {
          categoryId: fallbackId,
          action: 'new_subcategory',
          suggestedName: parsed.suggestedName,
          suggestedParentId: parsed.parentId,
        };
      }
      // Try matching parent by name
      var parentByName = categories.find(function (c) {
        return c.name === parsed.parentName || c.name === parsed.parentId;
      });
      if (parentByName) {
        return {
          categoryId: fallbackId,
          action: 'new_subcategory',
          suggestedName: parsed.suggestedName,
          suggestedParentId: parentByName.id,
        };
      }
    }

    return { categoryId: fallbackId, action: 'fallback' };
  } catch {
    return { categoryId: fallbackId, action: 'fallback' };
  }
}

// ---------------------------------------------------------------------------
// Main inference function
// ---------------------------------------------------------------------------

export async function inferCategory(
  taskTitle: string,
  categories: TaskCategory[],
  config: AIProviderConfig,
): Promise<InferenceResult> {
  // If no categories exist, can't infer
  if (categories.length === 0) {
    return { categoryId: '', action: 'fallback' };
  }

  var defaultCat = categories.find(function (c) { return c.isDefault; });
  var fallbackId = defaultCat ? defaultCat.id : categories[0].id;

  var prompt = buildCategoryPrompt(taskTitle, categories);
  var messages = [{ role: 'user' as const, content: prompt }];
  var systemPrompt = 'あなたはJSON出力専用のタスク分類AIです。指示されたJSON形式のみで回答してください。';

  try {
    var text: string;

    if (config.connectionMode === 'local') {
      text = await chatWithOllama(config, systemPrompt, messages, 5000);
    } else if (config.connectionMode === 'cloud') {
      text = await chatWithGemini(config, systemPrompt, messages);
    } else {
      // hybrid: try Ollama first with short timeout
      try {
        text = await chatWithOllama(config, systemPrompt, messages, 3000);
      } catch {
        text = await chatWithGemini(config, systemPrompt, messages);
      }
    }

    return parseInferenceResponse(text, categories);
  } catch {
    // API failure → fallback
    return { categoryId: fallbackId, action: 'fallback' };
  }
}
