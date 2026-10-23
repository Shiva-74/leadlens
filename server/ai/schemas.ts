import { z } from 'zod';

export const SubScoreItemSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(),
  evidence_quote: z.string().default(''),
});

export const SubScoresSchema = z.object({
  intent: SubScoreItemSchema,
  urgency: SubScoreItemSchema,
  budget_realism: SubScoreItemSchema,
  fit_clarity: SubScoreItemSchema,
});

export const LeadAnalysisSchema = z.object({
  summary: z.string(),
  intent: z.object({
    label: z.enum(['ready_to_buy', 'serious_researching', 'early_browsing', 'investor', 'unclear']),
    explanation: z.string(),
  }),
  key_requirements: z.array(z.string()).min(1).max(8),
  objections: z.array(
    z.object({
      concern: z.string(),
      evidence_quote: z.string().default(''),
      severity: z.enum(['low', 'medium', 'high']),
    })
  ),
  missing_info: z.array(z.string()),
  recommended_next_action: z.object({
    action: z.string(),
    channel: z.enum(['call', 'whatsapp', 'email', 'site_visit']),
    timing: z.string(),
  }),
  suggested_response: z.string(),
  sub_scores: SubScoresSchema,
  parsed_budget: z.object({
    min_inr: z.number().nullable(),
    max_inr: z.number().nullable(),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  suggested_follow_up_days: z.number().int().min(0).max(90),
});

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;
export type SubScores = z.infer<typeof SubScoresSchema>;

export const ExtractionResultSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable(),
  property_requirement: z.string().nullable(),
  budget_text: z.string().nullable(),
  timeline: z.string().nullable(),
  customer_message: z.string().nullable(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const CallBriefSchema = z.object({
  opening_line: z.string(),
  emphasize: z.array(z.string()).min(1).max(4),
  questions_to_ask: z.array(z.string()).min(1).max(5),
  likely_objections: z.array(
    z.object({
      objection: z.string(),
      talking_point: z.string(),
    })
  ),
  avoid_saying: z.array(z.string()).min(1).max(4),
});

export type CallBrief = z.infer<typeof CallBriefSchema>;

export const DebriefResultSchema = z.object({
  summary: z.string(),
  intent: z.object({
    label: z.enum(['ready_to_buy', 'serious_researching', 'early_browsing', 'investor', 'unclear']),
    explanation: z.string(),
  }),
  key_requirements: z.array(z.string()).min(1).max(8),
  objections: z.array(
    z.object({
      concern: z.string(),
      evidence_quote: z.string().default(''),
      severity: z.enum(['low', 'medium', 'high']),
    })
  ),
  missing_info: z.array(z.string()),
  recommended_next_action: z.object({
    action: z.string(),
    channel: z.enum(['call', 'whatsapp', 'email', 'site_visit']),
    timing: z.string(),
  }),
  suggested_response: z.string(),
  sub_scores: SubScoresSchema,
  parsed_budget: z.object({
    min_inr: z.number().nullable(),
    max_inr: z.number().nullable(),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  suggested_follow_up_days: z.number().int().min(0).max(90),
  what_changed: z.array(z.string()),
  follow_up_message: z.string(),
  commitments: z.array(
    z.object({
      text: z.string(),
      due_hint: z.string(),
    })
  ),
});

export type DebriefResult = z.infer<typeof DebriefResultSchema>;