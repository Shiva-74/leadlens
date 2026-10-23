import { SubScores } from './schemas.js';

export type PriorityTag = 'hot' | 'warm' | 'cold';

/**
 * Why scoring is split between AI and deterministic code:
 * The AI judges the four qualitative dimensions (intent, urgency, budget_realism, fit_clarity)
 * based on domain context and customer quotes. Deterministic code then computes the final
 * weighted number and priority tag so scoring is 100% consistent, auditable, and explainable.
 * Any final score hallucinated by the model is ignored.
 */
export function computePriorityScore(subScores: SubScores): number {
  const raw =
    subScores.intent.score * 0.35 +
    subScores.urgency.score * 0.30 +
    subScores.budget_realism.score * 0.20 +
    subScores.fit_clarity.score * 0.15;

  const rounded = Math.round(raw);
  return Math.max(0, Math.min(100, rounded));
}

export function computePriorityTag(score: number): PriorityTag {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}