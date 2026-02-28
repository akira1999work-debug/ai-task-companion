import type { Task, AiReviewResult } from '../types';

export type GlowTier = 'gold' | 'green' | 'orange' | 'red' | 'gray';

export interface GlowStyle {
  tier: GlowTier;
  color: string;
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
}

const GLOW_COLORS: Record<GlowTier, string> = {
  gold: '#F59E0B',
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  gray: '#9CA3AF',
};

export function getGlowTier(task: Task): GlowTier {
  // 1. Sanctuary → gold
  if (task.isSanctuary) return 'gold';

  // 2. Inference pending → gray
  if (task.inferenceStatus === 'pending') return 'gray';

  // 3-5. Check AI review cache
  if (task.aiReviewCache) {
    try {
      var review: AiReviewResult = JSON.parse(task.aiReviewCache);
      if (review.overallScore >= 80) return 'green';
      if (review.overallScore >= 40) return 'orange';
      return 'red';
    } catch {
      // Parse failed → gray
    }
  }

  // 6. No data
  return 'gray';
}

export function getGlowStyle(task: Task): GlowStyle {
  var tier = getGlowTier(task);
  var color = GLOW_COLORS[tier];

  var shadowOpacity: number;
  var shadowRadius: number;

  if (tier === 'gold') {
    shadowOpacity = 0.35;
    shadowRadius = 12;
  } else if (tier === 'gray') {
    shadowOpacity = 0.1;
    shadowRadius = 4;
  } else {
    shadowOpacity = 0.25;
    shadowRadius = 8;
  }

  return {
    tier: tier,
    color: color,
    shadowColor: color,
    shadowOpacity: shadowOpacity,
    shadowRadius: shadowRadius,
  };
}
