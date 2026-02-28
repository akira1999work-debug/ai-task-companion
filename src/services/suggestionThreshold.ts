import type { SQLiteDatabase } from 'expo-sqlite';
import { countRecentSuggestionsByName, countUncategorizedTasksInCategory } from '../db/database';

// ---------------------------------------------------------------------------
// Subcategory suggestion threshold check
// ---------------------------------------------------------------------------

export interface ThresholdResult {
  shouldPropose: boolean;
  reason: string;
}

export async function checkSuggestionThreshold(
  db: SQLiteDatabase,
  tagName: string,
  categoryId: string,
): Promise<ThresholdResult> {
  // Condition 1: same tag name suggested 3+ times in last 7 days
  var recentCount = await countRecentSuggestionsByName(db, tagName, 7);
  if (recentCount >= 3) {
    return { shouldPropose: true, reason: 'frequency' };
  }

  // Condition 2: 5+ uncategorized tasks in the category
  var uncategorizedCount = await countUncategorizedTasksInCategory(db, categoryId);
  if (uncategorizedCount >= 5) {
    return { shouldPropose: true, reason: 'uncategorized_overflow' };
  }

  // Not yet
  return { shouldPropose: false, reason: '' };
}
