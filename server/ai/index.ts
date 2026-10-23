import { generateStructured, generateText } from './provider.js';
import {
  LeadAnalysisSchema,
  ExtractionResultSchema,
  CallBriefSchema,
  DebriefResultSchema,
} from './schemas.js';
import { computePriorityScore, computePriorityTag } from './scoring.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  BRIEF_SYSTEM_PROMPT,
  DEBRIEF_SYSTEM_PROMPT,
  buildChatSystemPrompt,
} from './prompts.js';

export async function analyzeLead(lead: {
  name: string;
  location: string;
  property_requirement?: string | null;
  budget_text?: string | null;
  timeline?: string | null;
  customer_message?: string | null;
  source?: string;
}) {
  const userPrompt = `Analyze this Indian real-estate lead:
Name: ${lead.name}
Location: ${lead.location}
Property Requirement: ${lead.property_requirement || 'Not specified'}
Stated Budget: ${lead.budget_text || 'Not specified'}
Timeline: ${lead.timeline || 'Not specified'}
Lead Source: ${lead.source || 'form'}
Customer Message / Transcript:
"""
${lead.customer_message || 'No additional message provided.'}
"""`;

  const { data, providerUsed, fellBack } = await generateStructured({
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
    zodSchema: LeadAnalysisSchema,
  });

  // Deterministic code computes the final score and tag from the 4 AI sub-scores
  const priorityScore = computePriorityScore(data.sub_scores);
  const priorityTag = computePriorityTag(priorityScore);

  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + (data.suggested_follow_up_days ?? 2));

  return {
    analysis: data,
    priorityScore,
    priorityTag,
    subScores: data.sub_scores,
    parsedBudget: data.parsed_budget,
    followUpDate: followUpDate.toISOString(),
    providerUsed: fellBack ? `${providerUsed} (fallback)` : providerUsed,
  };
}

export async function extractLeadFromText(transcriptOrText: string) {
  const userPrompt = `Extract the lead form fields from this text:\n"""\n${transcriptOrText}\n"""`;
  return generateStructured({
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    zodSchema: ExtractionResultSchema,
  });
}

export async function generateCallBrief(lead: any) {
  const userPrompt = `Generate a pre-call brief for this lead:
Lead Details:
${JSON.stringify(
  {
    name: lead.name,
    location: lead.location,
    property_requirement: lead.property_requirement,
    budget_text: lead.budget_text,
    timeline: lead.timeline,
    customer_message: lead.customer_message,
    analysis: lead.analysis,
    commitments: lead.commitments,
  },
  null,
  2
)}`;

  return generateStructured({
    systemPrompt: BRIEF_SYSTEM_PROMPT,
    userPrompt,
    zodSchema: CallBriefSchema,
  });
}

export async function generateCallDebrief(lead: any, callNotes: string, inputMode: 'typed' | 'voice') {
  const userPrompt = `Update this lead based on the salesperson's post-call notes.

Existing Lead & Analysis:
${JSON.stringify(
  {
    name: lead.name,
    location: lead.location,
    property_requirement: lead.property_requirement,
    budget_text: lead.budget_text,
    timeline: lead.timeline,
    customer_message: lead.customer_message,
    previous_score: lead.priority_score,
    previous_analysis: lead.analysis,
    existing_commitments: lead.commitments,
  },
  null,
  2
)}

New Call Notes (input mode: ${inputMode}):
"""
${callNotes}
"""`;

  const { data, providerUsed, fellBack } = await generateStructured({
    systemPrompt: DEBRIEF_SYSTEM_PROMPT,
    userPrompt,
    zodSchema: DebriefResultSchema,
  });

  const newScore = computePriorityScore(data.sub_scores);
  const newTag = computePriorityTag(newScore);

  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + (data.suggested_follow_up_days ?? 2));

  return {
    debrief: data,
    newScore,
    newTag,
    followUpDate: followUpDate.toISOString(),
    providerUsed: fellBack ? `${providerUsed} (fallback)` : providerUsed,
  };
}

export async function chatWithLead(
  lead: any,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const systemPrompt = buildChatSystemPrompt(lead);
  return generateText({
    systemPrompt,
    messages,
  });
}