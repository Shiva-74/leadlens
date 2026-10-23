export type PriorityTag = 'hot' | 'warm' | 'cold';
export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'won' | 'lost';
export type LeadSource = 'form' | 'transcript' | 'voice' | 'sample';

export interface SubScoreItem {
  score: number;
  reason: string;
  evidence_quote: string;
}

export interface SubScores {
  intent: SubScoreItem;
  urgency: SubScoreItem;
  budget_realism: SubScoreItem;
  fit_clarity: SubScoreItem;
}

export interface LeadAnalysis {
  summary: string;
  intent: {
    label: 'ready_to_buy' | 'serious_researching' | 'early_browsing' | 'investor' | 'unclear';
    explanation: string;
  };
  key_requirements: string[];
  objections: Array<{
    concern: string;
    evidence_quote: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  missing_info: string[];
  recommended_next_action: {
    action: string;
    channel: 'call' | 'whatsapp' | 'email' | 'site_visit';
    timing: string;
  };
  suggested_response: string;
  sub_scores: SubScores;
  parsed_budget: {
    min_inr: number | null;
    max_inr: number | null;
  };
  confidence: 'high' | 'medium' | 'low';
  suggested_follow_up_days: number;
}

export interface CommitmentItem {
  id: string;
  text: string;
  due_hint: string;
  done: boolean;
}

export interface Lead {
  id: string;
  session_id: string;
  name: string;
  phone: string | null;
  location: string;
  property_requirement: string | null;
  budget_text: string | null;
  budget_min_inr: number | null;
  budget_max_inr: number | null;
  timeline: string | null;
  customer_message: string | null;
  source: LeadSource;
  status: LeadStatus;
  analysis: LeadAnalysis | null;
  priority_score: number | null;
  priority_tag: PriorityTag | null;
  sub_scores: SubScores | null;
  commitments: CommitmentItem[];
  follow_up_date: string | null;
  analysis_status: 'pending' | 'done' | 'failed';
  analysis_version: number;
  provider_used: string | null;
  created_at: string;
  updated_at: string;
  is_stale?: boolean;
  queue_bucket?: number;
  queue_reason?: string;
}

export interface ChatMessage {
  id: string;
  lead_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CallBrief {
  opening_line: string;
  emphasize: string[];
  questions_to_ask: string[];
  likely_objections: Array<{
    objection: string;
    talking_point: string;
  }>;
  avoid_saying: string[];
}

export interface CallEvent {
  id: string;
  lead_id: string;
  type: 'brief' | 'debrief';
  input_mode: 'typed' | 'voice' | null;
  input_notes: string | null;
  score_before: number | null;
  score_after: number | null;
  output: any;
  created_at: string;
}