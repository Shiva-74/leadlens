import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { SAMPLE_LEADS } from '../db/seed.js';
import {
  analyzeLead,
  extractLeadFromText,
  generateCallBrief,
  generateCallDebrief,
  chatWithLead,
} from '../ai/index.js';
import { transcribeAudioBuffer } from '../voice/index.js';
import { checkTextRateLimit, checkVoiceRateLimit } from '../lib/rateLimit.js';

export const apiRouter = Router();

// Multer memory storage (no audio files ever written to disk)
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'video/webm',
  'video/mp4',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
});

// Helper: compute if a lead is 'Stale' (status is new or contacted and not updated for 3 days)
function enrichLeadRow(row: any) {
  const updatedMs = new Date(row.updated_at).getTime();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const isStale =
    (row.status === 'new' || row.status === 'contacted') &&
    Date.now() - updatedMs >= threeDaysMs;

  return {
    ...row,
    is_stale: isStale,
  };
}

// ==========================================
// 1. POST /api/transcribe (Voice to Text)
// ==========================================
apiRouter.post('/transcribe', (req: Request, res: Response) => {
  const rate = checkVoiceRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'Voice transcription rate limit reached (10 per hour). You can type the notes instead.',
    });
  }

  const singleUpload = upload.single('audio');
  singleUpload(req, res, async (err: any) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Audio file is over the 25 MB limit. Please upload a shorter recording.',
      });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid audio upload.' });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No audio file received.' });
    }

    const baseMime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const allowedExts = new Set(['webm', 'ogg', 'mp3', 'm4a', 'mp4', 'wav', 'flac', 'mpeg']);

    if (!ALLOWED_AUDIO_MIMES.has(baseMime) && !allowedExts.has(ext)) {
      return res.status(400).json({
        error: 'Unsupported audio format. Please use webm, ogg, mp3, m4a, mp4, wav, or flac.',
      });
    }

    try {
      const result = await transcribeAudioBuffer(
        file.buffer,
        baseMime || 'audio/webm',
        file.originalname || 'recording.webm'
      );
      return res.json(result);
    } catch (transcribeErr: any) {
      return res.status(422).json({
        error:
          transcribeErr?.message ||
          'We could not transcribe this audio. You can type the notes instead.',
      });
    }
  });
});

// ==========================================
// 2. POST /api/extract (Transcript -> Form)
// ==========================================
const ExtractBodySchema = z.object({
  text: z.string().min(3, 'Please provide a transcript or message to extract from.'),
});

apiRouter.post('/extract', async (req: Request, res: Response) => {
  const parsed = ExtractBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }

  const rate = checkTextRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'You have reached the hourly limit of 30 AI requests for this session. Please try again shortly.',
    });
  }

  try {
    const result = await extractLeadFromText(parsed.data.text);
    return res.json(result);
  } catch (err: any) {
    return res.status(503).json({
      error: 'AI extraction is temporarily busy. Please fill the fields manually.',
    });
  }
});

// ==========================================
// 3. POST /api/leads (Create & Analyze Lead)
// ==========================================
const CreateLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  property_requirement: z.string().optional().nullable(),
  budget_text: z.string().optional().nullable(),
  timeline: z.string().optional().nullable(),
  customer_message: z.string().optional().nullable(),
  source: z.enum(['form', 'transcript', 'voice', 'sample']).default('form'),
});

apiRouter.post('/leads', async (req: Request, res: Response) => {
  const parsed = CreateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    });
  }

  const rate = checkTextRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'You have reached the hourly limit of 30 AI requests for this session.',
    });
  }

  const leadId = crypto.randomUUID();
  const { name, location, property_requirement, budget_text, timeline, customer_message, source } =
    parsed.data;

  try {
    // Save initially with analysis_status = 'pending'
    await pool.query(
      `INSERT INTO leads (
        id, session_id, name, location, property_requirement, budget_text, timeline, customer_message, source, status, analysis_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', 'pending')`,
      [
        leadId,
        req.sessionId,
        name.trim(),
        location.trim(),
        property_requirement?.trim() || null,
        budget_text?.trim() || null,
        timeline?.trim() || null,
        customer_message?.trim() || null,
        source,
      ]
    );

    try {
      const aiResult = await analyzeLead(parsed.data);

      const updated = await pool.query(
        `UPDATE leads SET
          analysis = $1,
          priority_score = $2,
          priority_tag = $3,
          sub_scores = $4,
          budget_min_inr = $5,
          budget_max_inr = $6,
          follow_up_date = $7,
          analysis_status = 'done',
          analysis_version = 1,
          provider_used = $8,
          updated_at = NOW()
        WHERE id = $9 AND session_id = $10
        RETURNING *`,
        [
          JSON.stringify(aiResult.analysis),
          aiResult.priorityScore,
          aiResult.priorityTag,
          JSON.stringify(aiResult.subScores),
          aiResult.parsedBudget.min_inr,
          aiResult.parsedBudget.max_inr,
          aiResult.followUpDate,
          aiResult.providerUsed,
          leadId,
          req.sessionId,
        ]
      );

      return res.status(201).json({ lead: enrichLeadRow(updated.rows[0]) });
    } catch (aiErr: any) {
      console.error('AI analysis failed during lead creation:', aiErr);
      const failedRow = await pool.query(
        `UPDATE leads SET analysis_status = 'failed', updated_at = NOW()
         WHERE id = $1 AND session_id = $2 RETURNING *`,
        [leadId, req.sessionId]
      );
      return res.status(201).json({
        lead: enrichLeadRow(failedRow.rows[0]),
        warning: 'AI is busy, your lead is saved. You can retry analysis from the lead page.',
      });
    }
  } catch (dbErr: any) {
    console.error('Database error creating lead:', dbErr);
    return res.status(500).json({ error: 'Could not save lead to database.' });
  }
});

// ==========================================
// 4. POST /api/leads/:id/analyze (Retry/Re-run)
// ==========================================
apiRouter.post('/leads/:id/analyze', async (req: Request, res: Response) => {
  const rate = checkTextRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'Hourly limit of 30 AI requests reached. Please try again later.',
    });
  }

  try {
    const existing = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = existing.rows[0];
    const aiResult = await analyzeLead(lead);

    const updated = await pool.query(
      `UPDATE leads SET
        analysis = $1,
        priority_score = $2,
        priority_tag = $3,
        sub_scores = $4,
        budget_min_inr = $5,
        budget_max_inr = $6,
        follow_up_date = $7,
        analysis_status = 'done',
        analysis_version = analysis_version + 1,
        provider_used = $8,
        updated_at = NOW()
      WHERE id = $9 AND session_id = $10
      RETURNING *`,
      [
        JSON.stringify(aiResult.analysis),
        aiResult.priorityScore,
        aiResult.priorityTag,
        JSON.stringify(aiResult.subScores),
        aiResult.parsedBudget.min_inr,
        aiResult.parsedBudget.max_inr,
        aiResult.followUpDate,
        aiResult.providerUsed,
        lead.id,
        req.sessionId,
      ]
    );

    return res.json({ lead: enrichLeadRow(updated.rows[0]) });
  } catch (err: any) {
    await pool.query(
      `UPDATE leads SET analysis_status = 'failed', updated_at = NOW() WHERE id = $1 AND session_id = $2`,
      [req.params.id, req.sessionId]
    );
    return res.status(503).json({
      error: 'AI is currently busy. Your lead is safe—please retry in a moment.',
    });
  }
});

// ==========================================
// 5. GET /api/leads (List, Filter, Search, Sort)
// ==========================================
apiRouter.get('/leads', async (req: Request, res: Response) => {
  try {
    const { search, tag, status, sort = 'score' } = req.query;
    const params: any[] = [req.sessionId];
    const conditions: string[] = ['session_id = $1'];

    if (tag && typeof tag === 'string' && ['hot', 'warm', 'cold'].includes(tag)) {
      params.push(tag);
      conditions.push(`priority_tag = $${params.length}`);
    }

    if (
      status &&
      typeof status === 'string' &&
      ['new', 'contacted', 'follow_up', 'won', 'lost'].includes(status)
    ) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      conditions.push(`(name ILIKE $${params.length} OR location ILIKE $${params.length})`);
    }

    let orderBy = 'priority_score DESC NULLS LAST, created_at DESC';
    if (sort === 'newest') {
      orderBy = 'created_at DESC';
    } else if (sort === 'followup') {
      orderBy = 'follow_up_date ASC NULLS LAST, priority_score DESC NULLS LAST';
    }

    const sql = `SELECT * FROM leads WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`;
    const result = await pool.query(sql, params);

    return res.json({ leads: result.rows.map(enrichLeadRow) });
  } catch (err: any) {
    console.error('Error listing leads:', err);
    return res.status(500).json({ error: 'Failed to load leads.' });
  }
});

// ==========================================
// 6. GET /api/queue (Today's Queue & Stats)
// ==========================================
apiRouter.get('/queue', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leads WHERE session_id = $1 ORDER BY created_at DESC',
      [req.sessionId]
    );
    const allLeads = result.rows.map(enrichLeadRow);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const isFollowUpDueOrOverdue = (lead: any) => {
      if (!lead.follow_up_date) return false;
      if (lead.status === 'won' || lead.status === 'lost') return false;
      // Only treat as follow-up due if already contacted/follow_up OR explicitly past due date
      const dueMs = new Date(lead.follow_up_date).getTime();
      return dueMs <= endOfToday.getTime();
    };

    const stats = {
      totalLeads: allLeads.length,
      hotLeads: allLeads.filter((l) => l.priority_tag === 'hot' && l.status !== 'won' && l.status !== 'lost').length,
      followUpsDue: allLeads.filter((l) => isFollowUpDueOrOverdue(l)).length,
      awaitingFirstContact: allLeads.filter((l) => l.status === 'new').length,
    };

    /**
     * Deterministic Queue Prioritization Rules (Section 9):
     * Won and lost leads never appear in Today's Queue.
     * Rank 1: Follow-up overdue or due today
     * Rank 2: Hot leads never contacted (status === 'new')
     * Rank 3: Warm leads never contacted (status === 'new')
     * Rank 4: Remaining active leads sorted by priority_score descending
     */
    const activeLeads = allLeads.filter((l) => l.status !== 'won' && l.status !== 'lost');

    function getQueueBucketAndReason(lead: any): { bucket: number; reason: string } {
      const now = new Date();
      if (lead.follow_up_date) {
        const dueDate = new Date(lead.follow_up_date);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          return {
            bucket: 1,
            reason: `Follow-up overdue by ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`,
          };
        }
        if (dueDate.getTime() <= endOfToday.getTime()) {
          return {
            bucket: 1,
            reason: 'Follow-up due today',
          };
        }
      }

      if (lead.priority_tag === 'hot' && lead.status === 'new') {
        return { bucket: 2, reason: 'Hot lead, never contacted' };
      }

      if (lead.priority_tag === 'warm' && lead.status === 'new') {
        return { bucket: 3, reason: 'Warm lead, never contacted' };
      }

      if (lead.priority_tag === 'hot') {
        return { bucket: 4, reason: `High priority score (${lead.priority_score ?? 0})` };
      }
      if (lead.priority_tag === 'warm') {
        return { bucket: 4, reason: `Warm priority (${lead.priority_score ?? 0})` };
      }
      return { bucket: 4, reason: 'Awaiting review' };
    }

    const decorated = activeLeads.map((lead) => {
      const { bucket, reason } = getQueueBucketAndReason(lead);
      return {
        ...lead,
        queue_bucket: bucket,
        queue_reason: reason,
      };
    });

    decorated.sort((a, b) => {
      if (a.queue_bucket !== b.queue_bucket) {
        return a.queue_bucket - b.queue_bucket;
      }
      return (b.priority_score ?? 0) - (a.priority_score ?? 0);
    });

    const doFirstToday = decorated.slice(0, 8);
    const doFirstIds = new Set(doFirstToday.map((l) => l.id));
    const remaining = decorated.filter((l) => !doFirstIds.has(l.id));

    return res.json({
      stats,
      doFirstToday,
      remainingGrouped: {
        hot: remaining.filter((l) => l.priority_tag === 'hot'),
        warm: remaining.filter((l) => l.priority_tag === 'warm'),
        cold: remaining.filter((l) => !l.priority_tag || l.priority_tag === 'cold'),
      },
    });
  } catch (err: any) {
    console.error('Queue error:', err);
    return res.status(500).json({ error: 'Failed to load Today\'s Queue.' });
  }
});

// ==========================================
// 7. GET, PATCH, DELETE /api/leads/:id
// ==========================================
apiRouter.get('/leads/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    return res.json({ lead: enrichLeadRow(result.rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load lead details.' });
  }
});

const PatchLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'follow_up', 'won', 'lost']).optional(),
  follow_up_date: z.string().nullable().optional(),
});

apiRouter.patch('/leads/:id', async (req: Request, res: Response) => {
  const parsed = PatchLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status or follow_up_date update.' });
  }

  try {
    const existing = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const current = existing.rows[0];
    const newStatus = parsed.data.status ?? current.status;
    const newFollowUp =
      parsed.data.follow_up_date !== undefined
        ? parsed.data.follow_up_date
        : current.follow_up_date;

    const updated = await pool.query(
      `UPDATE leads SET status = $1, follow_up_date = $2, updated_at = NOW()
       WHERE id = $3 AND session_id = $4 RETURNING *`,
      [newStatus, newFollowUp, req.params.id, req.sessionId]
    );

    return res.json({ lead: enrichLeadRow(updated.rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update lead.' });
  }
});

apiRouter.delete('/leads/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await pool.query(
      'DELETE FROM leads WHERE id = $1 AND session_id = $2 RETURNING id',
      [req.params.id, req.sessionId]
    );
    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete lead.' });
  }
});

// ==========================================
// 8. PATCH /api/leads/:id/commitments/:commitmentId
// ==========================================
apiRouter.patch('/leads/:id/commitments/:commitmentId', async (req: Request, res: Response) => {
  try {
    const existing = await pool.query(
      'SELECT commitments FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const commitments: Array<{ id: string; text: string; due_hint: string; done: boolean }> =
      Array.isArray(existing.rows[0].commitments) ? existing.rows[0].commitments : [];

    const updatedCommitments = commitments.map((c) =>
      c.id === req.params.commitmentId ? { ...c, done: !c.done } : c
    );

    const updated = await pool.query(
      `UPDATE leads SET commitments = $1, updated_at = NOW()
       WHERE id = $2 AND session_id = $3 RETURNING *`,
      [JSON.stringify(updatedCommitments), req.params.id, req.sessionId]
    );

    return res.json({ lead: enrichLeadRow(updated.rows[0]) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update commitment.' });
  }
});

// ==========================================
// 9. GET, POST, DELETE /api/leads/:id/chat
// ==========================================
apiRouter.get('/leads/:id/chat', async (req: Request, res: Response) => {
  try {
    const check = await pool.query(
      'SELECT id FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const msgs = await pool.query(
      'SELECT * FROM chat_messages WHERE lead_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json({ messages: msgs.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load chat history.' });
  }
});

const ChatBodySchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000),
});

apiRouter.post('/leads/:id/chat', async (req: Request, res: Response) => {
  const parsed = ChatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid message.' });
  }

  const rate = checkTextRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'Hourly limit of 30 AI requests reached. Please try again shortly.',
    });
  }

  try {
    const leadRes = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (leadRes.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    const lead = leadRes.rows[0];

    // Fetch last 11 messages + new user message = 12 messages of context
    const historyRes = await pool.query(
      `SELECT role, content FROM chat_messages
       WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 11`,
      [lead.id]
    );
    const history = historyRes.rows.reverse();

    const userMsgId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO chat_messages (id, lead_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [userMsgId, lead.id, parsed.data.message.trim()]
    );

    const messagesForAI = [
      ...history,
      { role: 'user' as const, content: parsed.data.message.trim() },
    ];

    const aiReply = await chatWithLead(lead, messagesForAI);

    const assistantMsgId = crypto.randomUUID();
    const savedAssistant = await pool.query(
      `INSERT INTO chat_messages (id, lead_id, role, content)
       VALUES ($1, $2, 'assistant', $3) RETURNING *`,
      [assistantMsgId, lead.id, aiReply.text]
    );

    return res.json({
      message: savedAssistant.rows[0],
      providerUsed: aiReply.providerUsed,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return res.status(503).json({
      error: 'Assistant could not respond right now. Click retry to try again.',
    });
  }
});

apiRouter.delete('/leads/:id/chat', async (req: Request, res: Response) => {
  try {
    const check = await pool.query(
      'SELECT id FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    await pool.query('DELETE FROM chat_messages WHERE lead_id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear chat.' });
  }
});

// ==========================================
// 10. POST /api/leads/:id/brief (Pre-call Brief)
// ==========================================
apiRouter.post('/leads/:id/brief', async (req: Request, res: Response) => {
  const rate = checkTextRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'Hourly limit of 30 AI requests reached. Please try again shortly.',
    });
  }

  try {
    const leadRes = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (leadRes.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    const lead = leadRes.rows[0];

    const briefResult = await generateCallBrief(lead);
    const eventId = crypto.randomUUID();

    const savedEvent = await pool.query(
      `INSERT INTO call_events (id, lead_id, type, output)
       VALUES ($1, $2, 'brief', $3) RETURNING *`,
      [eventId, lead.id, JSON.stringify(briefResult.data)]
    );

    return res.json({
      brief: briefResult.data,
      callEvent: savedEvent.rows[0],
      providerUsed: briefResult.providerUsed,
    });
  } catch (err: any) {
    console.error('Call brief error:', err);
    return res.status(503).json({ error: 'Could not generate call brief right now. Please retry.' });
  }
});

// ==========================================
// 11. POST /api/leads/:id/debrief (Post-call Loop)
// ==========================================
const DebriefBodySchema = z.object({
  notes: z.string().min(3, 'Please enter or record your call notes.'),
  input_mode: z.enum(['typed', 'voice']).default('typed'),
});

apiRouter.post('/leads/:id/debrief', async (req: Request, res: Response) => {
  const parsed = DebriefBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid call notes.' });
  }

  const rate = checkTextRateLimit(req.sessionId);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'Hourly limit of 30 AI requests reached. Please try again shortly.',
    });
  }

  try {
    const leadRes = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (leadRes.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    const lead = leadRes.rows[0];
    const scoreBefore = lead.priority_score ?? null;

    const result = await generateCallDebrief(lead, parsed.data.notes, parsed.data.input_mode);
    const { debrief, newScore, newTag, followUpDate, providerUsed } = result;

    // Build updated LeadAnalysis object
    const updatedAnalysis = {
      summary: debrief.summary,
      intent: debrief.intent,
      key_requirements: debrief.key_requirements,
      objections: debrief.objections,
      missing_info: debrief.missing_info,
      recommended_next_action: debrief.recommended_next_action,
      suggested_response: debrief.suggested_response,
      sub_scores: debrief.sub_scores,
      parsed_budget: debrief.parsed_budget,
      confidence: debrief.confidence,
      suggested_follow_up_days: debrief.suggested_follow_up_days,
    };

    const existingCommitments = Array.isArray(lead.commitments) ? lead.commitments : [];
    const newCommitmentsWithIds = debrief.commitments.map((c) => ({
      id: crypto.randomUUID(),
      text: c.text,
      due_hint: c.due_hint,
      done: false,
    }));
    const mergedCommitments = [...existingCommitments, ...newCommitmentsWithIds];

    const newStatus =
      lead.status === 'new'
        ? 'contacted'
        : lead.status === 'contacted'
        ? 'follow_up'
        : lead.status;

    const updatedLeadRes = await pool.query(
      `UPDATE leads SET
        analysis = $1,
        priority_score = $2,
        priority_tag = $3,
        sub_scores = $4,
        budget_min_inr = COALESCE($5, budget_min_inr),
        budget_max_inr = COALESCE($6, budget_max_inr),
        commitments = $7,
        follow_up_date = $8,
        status = $9,
        analysis_status = 'done',
        analysis_version = analysis_version + 1,
        provider_used = $10,
        updated_at = NOW()
      WHERE id = $11 AND session_id = $12
      RETURNING *`,
      [
        JSON.stringify(updatedAnalysis),
        newScore,
        newTag,
        JSON.stringify(debrief.sub_scores),
        debrief.parsed_budget.min_inr,
        debrief.parsed_budget.max_inr,
        JSON.stringify(mergedCommitments),
        followUpDate,
        newStatus,
        providerUsed,
        lead.id,
        req.sessionId,
      ]
    );

    const eventId = crypto.randomUUID();
    const eventOutput = {
      what_changed: debrief.what_changed,
      follow_up_message: debrief.follow_up_message,
      commitments: newCommitmentsWithIds,
    };

    const savedEvent = await pool.query(
      `INSERT INTO call_events (
        id, lead_id, type, input_mode, input_notes, score_before, score_after, output
      ) VALUES ($1, $2, 'debrief', $3, $4, $5, $6, $7) RETURNING *`,
      [
        eventId,
        lead.id,
        parsed.data.input_mode,
        parsed.data.notes,
        scoreBefore,
        newScore,
        JSON.stringify(eventOutput),
      ]
    );

    return res.json({
      lead: enrichLeadRow(updatedLeadRes.rows[0]),
      score_before: scoreBefore,
      score_after: newScore,
      what_changed: debrief.what_changed,
      follow_up_message: debrief.follow_up_message,
      commitments: newCommitmentsWithIds,
      callEvent: savedEvent.rows[0],
    });
  } catch (err: any) {
    console.error('Call debrief error:', err);
    return res.status(503).json({
      error: 'Could not process call debrief right now. Please try again.',
    });
  }
});

// ==========================================
// 12. GET /api/leads/:id/calls (Call History)
// ==========================================
apiRouter.get('/leads/:id/calls', async (req: Request, res: Response) => {
  try {
    const check = await pool.query(
      'SELECT id FROM leads WHERE id = $1 AND session_id = $2',
      [req.params.id, req.sessionId]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const events = await pool.query(
      'SELECT * FROM call_events WHERE lead_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    return res.json({ calls: events.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load call history.' });
  }
});

// ==========================================
// 13. POST /api/sample-leads (Seed 8 Leads)
// ==========================================
apiRouter.post('/sample-leads', async (req: Request, res: Response) => {
  try {
    // Idempotent per session: check if sample leads already exist
    const existingSamples = await pool.query(
      `SELECT * FROM leads WHERE session_id = $1 AND source = 'sample' ORDER BY created_at ASC`,
      [req.sessionId]
    );

    if (existingSamples.rowCount && existingSamples.rowCount > 0) {
      return res.json({
        leads: existingSamples.rows.map(enrichLeadRow),
        alreadyLoaded: true,
      });
    }

    // Insert all 8 leads as 'pending' first so the frontend can show progress or analyze in batches
    const createdLeads: any[] = [];
    for (const item of SAMPLE_LEADS) {
      const id = crypto.randomUUID();
      const inserted = await pool.query(
        `INSERT INTO leads (
          id, session_id, name, location, property_requirement, budget_text, timeline, customer_message, source, status, analysis_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sample', 'new', 'pending')
        RETURNING *`,
        [
          id,
          req.sessionId,
          item.name,
          item.location,
          item.property_requirement,
          item.budget_text,
          item.timeline,
          item.customer_message,
        ]
      );
      createdLeads.push(enrichLeadRow(inserted.rows[0]));
    }

    return res.status(201).json({
      leads: createdLeads,
      alreadyLoaded: false,
    });
  } catch (err: any) {
    console.error('Sample leads seed error:', err);
    return res.status(500).json({ error: 'Failed to create sample leads.' });
  }
});

// ==========================================
// 14. DELETE /api/my-data (Clear Session Data)
// ==========================================
apiRouter.delete('/my-data', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM leads WHERE session_id = $1', [req.sessionId]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear session data.' });
  }
});