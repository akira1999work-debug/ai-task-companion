import { useMemo } from 'react';
import type { Task } from '../types';
import type { TaskCategory } from '../types/onboarding';
import { calcDisplayScore } from '../services/displayScore';

export interface ScoredTask {
  task: Task;
  score: number;
  category: TaskCategory | undefined;
}

export function useSortedTasks(
  tasks: Task[],
  categories: TaskCategory[],
): ScoredTask[] {
  return useMemo(function () {
    var today = new Date().toISOString().split('T')[0];

    // Build category lookup
    var catMap: Record<string, TaskCategory> = {};
    for (var i = 0; i < categories.length; i++) {
      catMap[categories[i].id] = categories[i];
    }

    // Filter: incomplete tasks that are due today, overdue, or have no due date
    var filtered = tasks.filter(function (t) {
      if (t.completed) return false;
      if (!t.dueDate) return true;       // No due date → show
      if (t.dueDate <= today) return true; // Today or overdue
      return false;
    });

    // Score and sort descending
    var scored: ScoredTask[] = filtered.map(function (t) {
      var cat = t.categoryId ? catMap[t.categoryId] : undefined;
      return {
        task: t,
        score: calcDisplayScore(t, cat),
        category: cat,
      };
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    return scored;
  }, [tasks, categories]);
}
