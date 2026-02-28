import type { Task } from '../types';
import type { TaskCategory } from '../types/onboarding';

/**
 * Calculate a display priority score for a task.
 * Higher score = should be shown first.
 * Range: roughly 50~120.
 */
export function calcDisplayScore(task: Task, category?: TaskCategory): number {
  var score = 50;

  // Priority bonus
  if (task.priority === 'high') {
    score += 30;
  } else if (task.priority === 'medium') {
    score += 15;
  }
  // low = +0

  // Scaling weight bonus (from category)
  if (category) {
    if (category.scalingWeight === 'strict') {
      score += 20;
    } else if (category.scalingWeight === 'normal') {
      score += 10;
    }
    // relaxed = +0
  }

  // Due date bonus
  if (task.dueDate) {
    var today = new Date().toISOString().split('T')[0];
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (task.dueDate <= today) {
      // Today or overdue
      score += 20;
    } else if (task.dueDate === tomorrowStr) {
      score += 10;
    }
    // later = +0
  }

  return score;
}
