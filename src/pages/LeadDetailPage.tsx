import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Copy,
  Check,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  Mic,
  Send,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Sparkles,
  Clock,
  FileText,
} from 'lucide-react';
import { Lead, ChatMessage, CallEvent, CallBrief, LeadStatus } from '../lib/types';
import { PriorityBadge, ScoreRing, ScoreBar, Skeleton } from '../components/ui';
import { VoiceRecorder } from '../components/VoiceRecorder';
import {
  formatBudgetRange,
  formatIntentLabel,
  formatRelativeDate,
  formatTimestamp,
} from '../lib/format';
import { useToast } from '../lib/toast';

const QUICK_PROMPTS = [
  'What should I emphasize on the call?',
  'Make my reply more assertive',
  'Shorten the reply',
  'Draft a WhatsApp follow-up',
  'What am I missing?',
  'Handle the price objection',
];

const REWRITE_STYLES = [
  { label: 'Shorter', instruction: 'Rewrite the suggested response to be shorter and more concise (under 40 words).' },
  { label: 'More assertive', instruction: 'Rewrite the suggested response to be more assertive with a clear call to action.' },
  { label: 'More formal', instruction: 'Rewrite the suggested response in formal professional English.' },
  { label: 'Hinglish', instruction: 'Rewrite the suggested response in natural conversational Hinglish (Roman script).' },
  { label: 'Hindi', instruction: 'Rewrite the suggested response in polite conversational Hindi (Roman script).' },
];

export function LeadDetailPage({ onLeadUpdated }: { onLeadUpdated?: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);

  // Mobile view switcher ('analysis' | 'workspace')
  const [mobileSection, setMobileSection] = useState<'analysis' | 'workspace'>('analysis');
  // Right column tab ('assistant' | 'call_loop')
  const [rightTab, setRightTab] = useState<'assistant' | 'call_loop'>('assistant');

  // Left column UI states
  const [copiedReply, setCopiedReply] = useState(false);
  const [rewriteMenuOpen, setRewriteMenuOpen] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [displayedReply, setDisplayedReply] = useState<string>('');
  const [showOriginalMsg, setShowOriginalMsg] = useState(false);

  // Assistant Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [failedChatInput, setFailedChatInput] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Call Loop state
  const [callEvents, setCallEvents] = useState<CallEvent[]>([]);
  const [latestBrief, setLatestBrief] = useState<CallBrief | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [debriefNotes, setDebriefNotes] = useState('');
  const [debriefInputMode, setDebriefInputMode] = useState<'typed' | 'voice'>('typed');
  const [submittingDebrief, setSubmittingDebrief] = useState(false);
  const [lastDebriefResult, setLastDebriefResult] = useState<{
    score_before: number | null;
    score_after: number | null;
    what_changed: string[];
    follow_up_message: string;
    commitments: Array<{ id: string; text: string; due_hint: string; done: boolean }>;
  } | null>(null);

  const fetchAllLeadData = async () => {
    if (!id) return;
    try {
      const [leadRes, chatRes, callsRes] = await Promise.all([
        fetch(`/api/leads/${id}`),
        fetch(`/api/leads/${id}/chat`),
        fetch(`/api/leads/${id}/calls`),
      ]);

      if (!leadRes.ok) {
        showToast('Lead not found', 'error');
        navigate('/queue');
        return;
      }

      const leadData = await leadRes.json();
      setLead(leadData.lead);
      setDisplayedReply(leadData.lead.analysis?.suggested_response || '');

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setMessages(chatData.messages || []);
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json();
        const events: CallEvent[] = callsData.calls || [];
        setCallEvents(events);
        const mostRecentBrief = events.find((e) => e.type === 'brief');
        if (mostRecentBrief?.output) {
          setLatestBrief(mostRecentBrief.output);
        }
      }
    } catch (err) {
      showToast('Failed to load lead details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAllLeadData();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendingChat]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.lead) {
        setLead(data.lead);
        onLeadUpdated?.();
        showToast(`Status updated to ${newStatus}`, 'success');
      }
    } catch {
      showToast('Could not update status', 'error');
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    if (!window.confirm(`Delete lead "${lead.name}"?`)) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Lead deleted', 'success');
        onLeadUpdated?.();
        navigate('/queue');
      }
    } catch {
      showToast('Could not delete lead', 'error');
    }
  };

  const handleRetryAnalysis = async () => {
    if (!lead) return;
    setRetryingAnalysis(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/analyze`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setLead(data.lead);
      setDisplayedReply(data.lead.analysis?.suggested_response || '');
      onLeadUpdated?.();
      showToast('Lead analysis updated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'AI is busy, please try again shortly.', 'error');
    } finally {
      setRetryingAnalysis(false);
    }
  };

  const handleToggleCommitment = async (commitmentId: string) => {
    if (!lead) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}/commitments/${commitmentId}`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok && data.lead) {
        setLead(data.lead);
      }
    } catch {
      showToast('Failed to update commitment', 'error');
    }
  };

  const handleRewriteReply = async (instruction: string) => {
    if (!lead) return;
    setRewriteMenuOpen(false);
    setRewriting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rewrite failed');

      setDisplayedReply(data.message.content);
      // Also append to chat history
      const chatRes = await fetch(`/api/leads/${lead.id}/chat`);
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setMessages(chatData.messages || []);
      }
      showToast('Suggested response rewritten!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not rewrite response', 'error');
    } finally {
      setRewriting(false);
    }
  };

  const sendChatMessage = async (textToSend: string) => {
    if (!lead || !textToSend.trim() || sendingChat) return;
    const clean = textToSend.trim();
    setChatInput('');
    setFailedChatInput(null);
    setSendingChat(true);

    // Optimistic user bubble
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      lead_id: lead.id,
      role: 'user',
      content: clean,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/leads/${lead.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get response');

      setMessages((prev) => [...prev, data.message]);
    } catch (err: any) {
      setFailedChatInput(clean);
      showToast(err.message || 'Assistant could not respond', 'error');
    } finally {
      setSendingChat(false);
    }
  };

  const handleClearChat = async () => {
    if (!lead) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}/chat`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
        setFailedChatInput(null);
        showToast('Chat history cleared', 'info');
      }
    } catch {
      showToast('Failed to clear chat', 'error');
    }
  };

  const handleGenerateBrief = async () => {
    if (!lead) return;
    setGeneratingBrief(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/brief`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate call brief');
      setLatestBrief(data.brief);
      setCallEvents((prev) => [data.callEvent, ...prev]);
      showToast('Pre-call brief ready!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not generate brief', 'error');
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleSubmitDebrief = async () => {
    if (!lead || !debriefNotes.trim()) return;
    setSubmittingDebrief(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/debrief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: debriefNotes.trim(),
          input_mode: debriefInputMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update lead from call');

      setLead(data.lead);
      setDisplayedReply(data.lead.analysis?.suggested_response || '');
      setLastDebriefResult({
        score_before: data.score_before,
        score_after: data.score_after,
        what_changed: data.what_changed || [],
        follow_up_message: data.follow_up_message || '',
        commitments: data.commitments || [],
      });
      setCallEvents((prev) => [data.callEvent, ...prev]);
      setDebriefNotes('');
      onLeadUpdated?.();
      showToast('Lead updated from your call summary!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not process call debrief', 'error');
    } finally {
      setSubmittingDebrief(false);
    }
  };

  const copyText = (text: string, label = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text);
    showToast(label, 'success', 2000);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-[520px] w-full" />
        </div>
      </div>
    );
  }

  if (!lead) return null;

  const analysis = lead.analysis;
  const subScores = lead.sub_scores || analysis?.sub_scores;

  // Build score history list from debrief events (oldest to newest)
  const debriefEventsChronological = [...callEvents]
    .filter((e) => e.type === 'debrief')
    .reverse();

  const ChannelIcon = ({ channel }: { channel?: string }) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4 text-[#0F766E]" />;
      case 'email':
        return <Mail className="w-4 h-4 text-[#0F766E]" />;
      case 'site_visit':
        return <MapPin className="w-4 h-4 text-[#0F766E]" />;
      default:
        return <Phone className="w-4 h-4 text-[#0F766E]" />;
    }
  };

  return (
    <div>
      {/* Mobile Section Switcher */}
      <div className="flex lg:hidden gap-2 mb-4 no-print">
        <button
          onClick={() => setMobileSection('analysis')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
            mobileSection === 'analysis'
              ? 'bg-[#0F766E] text-white border-[#0F766E]'
              : 'bg-white text-[#5F5C55] border-[#E7E5E0]'
          }`}
        >
          Lead Analysis
        </button>
        <button
          onClick={() => setMobileSection('workspace')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
            mobileSection === 'workspace'
              ? 'bg-[#0F766E] text-white border-[#0F766E]'
              : 'bg-white text-[#5F5C55] border-[#E7E5E0]'
          }`}
        >
          Assistant & Call Loop
        </button>
      </div>

      {/* Main 2-Column Layout (Desktop: ~62% Left / ~38% Right Sticky) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ============================================================
            LEFT COLUMN (62%): 10 Analysis Cards
        ============================================================ */}
        <div
          className={`w-full lg:w-[62%] space-y-5 no-print ${
            mobileSection === 'workspace' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* 1. HEADER CARD */}
          <div className="card-surface p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <ScoreRing score={lead.priority_score} tag={lead.priority_tag} size={58} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-[#1C1B19]">{lead.name}</h2>
                    <PriorityBadge tag={lead.priority_tag} score={lead.priority_score} />
                    {lead.source === 'voice' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E6F2F0] text-[#0F766E]">
                        <Mic className="w-3 h-3" /> Voice note
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5F5C55] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#8C8980]" />
                    <span>{lead.location}</span>
                    {lead.follow_up_date && (
                      <>
                        <span>·</span>
                        <span>Follow-up: {formatRelativeDate(lead.follow_up_date)}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Status dropdown & Delete button */}
              <div className="flex items-center gap-2 self-end sm:self-start">
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  aria-label="Lead status"
                  className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E0] bg-[#F7F7F5] text-xs font-medium text-[#1C1B19]"
                >
                  <option value="new">Status: New</option>
                  <option value="contacted">Status: Contacted</option>
                  <option value="follow_up">Status: Follow-up</option>
                  <option value="won">Status: Won</option>
                  <option value="lost">Status: Lost</option>
                </select>

                <button
                  onClick={handleDeleteLead}
                  title="Delete lead"
                  aria-label="Delete lead"
                  className="p-2 rounded-lg border border-[#E7E5E0] text-[#8C8980] hover:text-[#B42318] hover:bg-[#FDECEA]/50 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {analysis?.summary && (
              <p className="mt-4 pt-3 border-t border-[#E7E5E0] text-sm text-[#1C1B19] leading-relaxed">
                {analysis.summary}
              </p>
            )}
          </div>

          {/* FAILED OR PENDING ANALYSIS BANNER */}
          {(lead.analysis_status === 'failed' || !analysis) && (
            <div className="card-surface p-5 border-[#FCD9A8] bg-[#FEF3E2]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#B54708] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1B19]">
                    AI is busy, your lead is saved
                  </h3>
                  <p className="text-xs text-[#5F5C55] mt-0.5">
                    Click Retry to run the AI scoring and response generator now.
                  </p>
                </div>
              </div>
              <button
                onClick={handleRetryAnalysis}
                disabled={retryingAnalysis}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retryingAnalysis ? 'animate-spin' : ''}`} />
                <span>{retryingAnalysis ? 'Analyzing...' : 'Retry analysis'}</span>
              </button>
            </div>
          )}

          {analysis && (
            <>
              {/* 2. AT A GLANCE ROW (3 Small Cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="card-surface p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8980] block mb-1">
                    Customer intent
                  </span>
                  <div className="font-semibold text-sm text-[#1C1B19]">
                    {formatIntentLabel(analysis.intent.label)}
                  </div>
                  <p className="text-xs text-[#5F5C55] mt-1 line-clamp-2">
                    {analysis.intent.explanation}
                  </p>
                </div>

                <div className="card-surface p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8980] block mb-1">
                    Budget
                  </span>
                  <div className="font-semibold text-sm text-[#1C1B19]">
                    {formatBudgetRange(
                      lead.budget_min_inr,
                      lead.budget_max_inr,
                      lead.budget_text
                    )}
                  </div>
                  <p className="text-xs text-[#5F5C55] mt-1">
                    Stated: {lead.budget_text || 'Not specified'}
                  </p>
                </div>

                <div className="card-surface p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8980] block mb-1">
                    Timeline
                  </span>
                  <div className="font-semibold text-sm text-[#1C1B19]">
                    {lead.timeline || 'Not specified'}
                  </div>
                  <p className="text-xs text-[#5F5C55] mt-1 truncate">
                    {lead.property_requirement || 'Requirement not specified'}
                  </p>
                </div>
              </div>

              {/* 4. RECOMMENDED NEXT ACTION (Prominent soft teal card #E6F2F0) */}
              <div className="rounded-[10px] bg-[#E6F2F0] border border-[#0F766E]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#0F766E]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <ChannelIcon channel={analysis.recommended_next_action.channel} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
                        Recommended next action
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white text-[#0F766E] font-medium border border-[#0F766E]/20">
                        {analysis.recommended_next_action.timing}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1C1B19] mt-1">
                      {analysis.recommended_next_action.action}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. SUGGESTED RESPONSE */}
              <div className="card-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-sm font-semibold text-[#1C1B19]">Suggested response</h3>
                  </div>

                  <div className="flex items-center gap-2 relative">
                    <button
                      onClick={() => {
                        copyText(displayedReply, 'Response copied');
                        setCopiedReply(true);
                        setTimeout(() => setCopiedReply(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E7E5E0] bg-white hover:bg-[#F7F7F5] text-xs font-medium text-[#1C1B19] cursor-pointer"
                    >
                      {copiedReply ? (
                        <Check className="w-3.5 h-3.5 text-[#0F766E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedReply ? 'Copied' : 'Copy'}</span>
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setRewriteMenuOpen((o) => !o)}
                        disabled={rewriting}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E7E5E0] bg-white hover:bg-[#F7F7F5] text-xs font-medium text-[#1C1B19] cursor-pointer disabled:opacity-50"
                      >
                        {rewriting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F766E]" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5 text-[#0F766E]" />
                        )}
                        <span>Rewrite</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {rewriteMenuOpen && (
                        <div className="absolute right-0 mt-1 w-44 card-surface py-1 z-20 shadow-md">
                          {REWRITE_STYLES.map((item) => (
                            <button
                              key={item.label}
                              onClick={() => handleRewriteReply(item.instruction)}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#1C1B19] hover:bg-[#F7F7F5] cursor-pointer"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#F7F7F5] border border-[#E7E5E0] rounded-lg p-3.5 text-sm text-[#1C1B19] whitespace-pre-wrap leading-relaxed">
                  {displayedReply}
                </div>
              </div>

              {/* 3. WHY THIS SCORE + SCORE HISTORY */}
              {subScores && (
                <div className="card-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#0F766E]" />
                      <h3 className="text-sm font-semibold text-[#1C1B19]">Why this score</h3>
                    </div>
                    <span
                      className="text-xs text-[#8C8980] cursor-help underline decoration-dotted"
                      title="Weights: Intent 35% + Urgency 30% + Budget realism 20% + Fit & clarity 15%"
                    >
                      Final score is weighted from these four
                    </span>
                  </div>

                  <div>
                    <ScoreBar
                      label="Buying Intent"
                      weightLabel="35%"
                      score={subScores.intent.score}
                      reason={subScores.intent.reason}
                      evidenceQuote={subScores.intent.evidence_quote}
                    />
                    <ScoreBar
                      label="Timeline Urgency"
                      weightLabel="30%"
                      score={subScores.urgency.score}
                      reason={subScores.urgency.reason}
                      evidenceQuote={subScores.urgency.evidence_quote}
                    />
                    <ScoreBar
                      label="Budget Realism"
                      weightLabel="20%"
                      score={subScores.budget_realism.score}
                      reason={subScores.budget_realism.reason}
                      evidenceQuote={subScores.budget_realism.evidence_quote}
                    />
                    <ScoreBar
                      label="Fit & Clarity"
                      weightLabel="15%"
                      score={subScores.fit_clarity.score}
                      reason={subScores.fit_clarity.reason}
                      evidenceQuote={subScores.fit_clarity.evidence_quote}
                    />
                  </div>

                  {/* Score history built from call events */}
                  {debriefEventsChronological.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#E7E5E0] flex flex-wrap items-center gap-2 text-xs text-[#5F5C55]">
                      <span className="font-semibold text-[#1C1B19]">Score history:</span>
                      <span>
                        Initial {debriefEventsChronological[0].score_before ?? '—'}
                        {debriefEventsChronological.map((ev, idx) => (
                          <span key={ev.id}>
                            , after call {idx + 1}:{' '}
                            <strong className="text-[#1C1B19]">{ev.score_after}</strong>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 6. TWO COLUMNS: KEY REQUIREMENTS & OBJECTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Key Requirements */}
                <div className="card-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-sm font-semibold text-[#1C1B19]">Key requirements</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.key_requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#1C1B19]">
                        <span className="w-4 h-4 rounded bg-[#E6F2F0] text-[#0F766E] flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                          ✓
                        </span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Objections and Concerns */}
                <div className="card-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-[#B54708]" />
                    <h3 className="text-sm font-semibold text-[#1C1B19]">
                      Objections and concerns
                    </h3>
                  </div>
                  {analysis.objections.length === 0 ? (
                    <p className="text-xs text-[#8C8980]">
                      No explicit objections stated in the inquiry yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {analysis.objections.map((obj, idx) => {
                        const dotColor =
                          obj.severity === 'high'
                            ? 'bg-[#B42318]'
                            : obj.severity === 'medium'
                            ? 'bg-[#B54708]'
                            : 'bg-[#3E5C7E]';
                        return (
                          <li key={idx} className="text-xs space-y-0.5">
                            <div className="flex items-center gap-2 font-medium text-[#1C1B19]">
                              <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                              <span>{obj.concern}</span>
                            </div>
                            {obj.evidence_quote && (
                              <p className="text-[11px] italic text-[#8C8980] pl-4">
                                “{obj.evidence_quote}”
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* 7. MISSING INFORMATION (Soft Amber Card) */}
              {analysis.missing_info.length > 0 && (
                <div className="rounded-[10px] bg-[#FEF3E2] border border-[#FCD9A8] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="w-4 h-4 text-[#B54708]" />
                    <h3 className="text-sm font-semibold text-[#B54708]">
                      Missing information to ask on the call
                    </h3>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-[#1C1B19]">
                    {analysis.missing_info.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 8. PROMISES TO KEEP (Hide if empty) */}
              {Array.isArray(lead.commitments) && lead.commitments.length > 0 && (
                <div className="card-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarCheck className="w-4 h-4 text-[#0F766E]" />
                    <h3 className="text-sm font-semibold text-[#1C1B19]">Promises to keep</h3>
                  </div>
                  <div className="space-y-2">
                    {lead.commitments.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[#E7E5E0] bg-[#F7F7F5]/60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={() => handleToggleCommitment(c.id)}
                            className="w-4 h-4 accent-[#0F766E] rounded cursor-pointer"
                          />
                          <span
                            className={`text-xs font-medium ${
                              c.done ? 'line-through text-[#8C8980]' : 'text-[#1C1B19]'
                            }`}
                          >
                            {c.text}
                          </span>
                        </div>
                        {c.due_hint && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-white border border-[#E7E5E0] text-[#5F5C55]">
                            {c.due_hint}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 10. COLLAPSIBLE ORIGINAL CUSTOMER MESSAGE OR TRANSCRIPT */}
          <div className="card-surface overflow-hidden">
            <button
              onClick={() => setShowOriginalMsg((s) => !s)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-[#5F5C55] hover:text-[#1C1B19] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Original customer message / transcript</span>
              </span>
              {showOriginalMsg ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showOriginalMsg && (
              <div className="px-5 pb-4 pt-1 border-t border-[#E7E5E0] text-xs text-[#1C1B19] whitespace-pre-wrap leading-relaxed bg-[#F7F7F5]/50">
                {lead.customer_message || 'No customer message recorded.'}
              </div>
            )}
          </div>

          {/* 9. FOOTER LINE */}
          {analysis && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8C8980] px-1">
              <span>
                Confidence: <strong className="capitalize text-[#5F5C55]">{analysis.confidence}</strong> ·{' '}
                Provider: <strong className="text-[#5F5C55]">{lead.provider_used || 'AI'}</strong>
              </span>
              <span>
                v{lead.analysis_version} · Updated {formatTimestamp(lead.updated_at)}
              </span>
            </div>
          )}
        </div>

        {/* ============================================================
            RIGHT COLUMN (38% Sticky): Assistant & Call Loop Tabs
        ============================================================ */}
        <div
          className={`w-full lg:w-[38%] lg:sticky lg:top-20 ${
            mobileSection === 'analysis' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="card-surface overflow-hidden flex flex-col">
            {/* Tab Header */}
            <div className="grid grid-cols-2 border-b border-[#E7E5E0] bg-[#F7F7F5] no-print">
              <button
                onClick={() => setRightTab('assistant')}
                className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  rightTab === 'assistant'
                    ? 'border-[#0F766E] text-[#0F766E] bg-white'
                    : 'border-transparent text-[#5F5C55] hover:text-[#1C1B19]'
                }`}
              >
                Assistant
              </button>
              <button
                onClick={() => setRightTab('call_loop')}
                className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  rightTab === 'call_loop'
                    ? 'border-[#0F766E] text-[#0F766E] bg-white'
                    : 'border-transparent text-[#5F5C55] hover:text-[#1C1B19]'
                }`}
              >
                Call Loop
              </button>
            </div>

            {/* ==========================================
                TAB A: GROUNDED ASSISTANT
            ========================================== */}
            {rightTab === 'assistant' && (
              <div className="flex flex-col h-[580px] no-print">
                <div className="px-4 py-2 bg-[#F7F7F5]/60 border-b border-[#E7E5E0] flex items-center justify-between">
                  <span className="text-[11px] text-[#5F5C55]">
                    Answers use only this lead's information
                  </span>
                  {messages.length > 0 && (
                    <button
                      onClick={handleClearChat}
                      className="text-[11px] text-[#8C8980] hover:text-[#B42318] cursor-pointer"
                    >
                      Clear chat
                    </button>
                  )}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-xs text-[#5F5C55]">
                        Ask anything about {lead.name}'s inquiry, or click a quick prompt below:
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {QUICK_PROMPTS.map((q) => (
                          <button
                            key={q}
                            onClick={() => sendChatMessage(q)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E0] bg-[#F7F7F5] hover:bg-[#EAE8E1] text-xs text-[#1C1B19] text-left transition cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-[#0F766E] text-white'
                            : 'bg-[#F7F7F5] border border-[#E7E5E0] text-[#1C1B19]'
                        }`}
                      >
                        {m.content}
                      </div>
                      {m.role === 'assistant' && (
                        <button
                          onClick={() => {
                            copyText(m.content, 'Copied message');
                            setCopiedMsgId(m.id);
                            setTimeout(() => setCopiedMsgId(null), 1500);
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#8C8980] hover:text-[#1C1B19] cursor-pointer"
                        >
                          {copiedMsgId === m.id ? (
                            <Check className="w-3 h-3 text-[#0F766E]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copy</span>
                        </button>
                      )}
                    </div>
                  ))}

                  {sendingChat && (
                    <div className="flex items-center gap-2 text-xs text-[#5F5C55] bg-[#F7F7F5] border border-[#E7E5E0] rounded-xl px-3.5 py-2.5 w-fit">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F766E]" />
                      <span>Thinking...</span>
                    </div>
                  )}

                  {failedChatInput && (
                    <div className="bg-[#FDECEA] border border-[#F9D2CE] rounded-lg p-2.5 flex items-center justify-between text-xs text-[#B42318]">
                      <span>Message failed to send.</span>
                      <button
                        onClick={() => sendChatMessage(failedChatInput)}
                        className="font-semibold underline cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick chips when conversation is active */}
                {messages.length > 0 && (
                  <div className="px-3 py-1.5 border-t border-[#E7E5E0] flex gap-1.5 overflow-x-auto bg-[#F7F7F5]/50">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendChatMessage(q)}
                        disabled={sendingChat}
                        className="px-2 py-1 rounded border border-[#E7E5E0] bg-white text-[11px] text-[#5F5C55] hover:text-[#1C1B19] whitespace-nowrap cursor-pointer shrink-0"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Box */}
                <div className="p-3 border-t border-[#E7E5E0] bg-white flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage(chatInput);
                      }
                    }}
                    placeholder="Ask about this lead or request a rewrite... (Enter to send)"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#E7E5E0] text-xs text-[#1C1B19] resize-none"
                  />
                  <button
                    onClick={() => sendChatMessage(chatInput)}
                    disabled={sendingChat || !chatInput.trim()}
                    aria-label="Send message"
                    className="p-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ==========================================
                TAB B: VOICE-FIRST CALL LOOP
            ========================================== */}
            {rightTab === 'call_loop' && (
              <div className="p-4 space-y-6 max-h-[750px] overflow-y-auto">
                {/* STAGE 1: BEFORE THE CALL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between no-print">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E] block">
                        Stage 1 · Before the call
                      </span>
                      <h4 className="text-sm font-semibold text-[#1C1B19]">
                        30-second Pre-Call Brief
                      </h4>
                    </div>
                    <button
                      onClick={handleGenerateBrief}
                      disabled={generatingBrief}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                    >
                      {generatingBrief ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <span>{latestBrief ? 'Regenerate brief' : 'Generate call brief'}</span>
                      )}
                    </button>
                  </div>

                  {latestBrief && (
                    <div className="bg-[#F7F7F5] border border-[#E7E5E0] rounded-lg p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-[#E7E5E0] pb-2 no-print">
                        <span className="font-semibold text-[#1C1B19]">
                          Call Brief: {lead.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              copyText(
                                `Opening: ${latestBrief.opening_line}\nEmphasize: ${latestBrief.emphasize.join(
                                  '; '
                                )}\nAsk: ${latestBrief.questions_to_ask.join('; ')}`,
                                'Call brief copied'
                              )
                            }
                            className="inline-flex items-center gap-1 text-[#5F5C55] hover:text-[#1C1B19] cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </button>
                          <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1 text-[#5F5C55] hover:text-[#1C1B19] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-[#0F766E] block mb-0.5">
                          Opening line:
                        </span>
                        <p className="italic text-[#1C1B19]">“{latestBrief.opening_line}”</p>
                      </div>

                      <div>
                        <span className="font-semibold text-[#1C1B19] block mb-1">
                          3 things to emphasize:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-[#5F5C55]">
                          {latestBrief.emphasize.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="font-semibold text-[#1C1B19] block mb-1">
                          Questions to ask:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-[#5F5C55]">
                          {latestBrief.questions_to_ask.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>

                      {latestBrief.likely_objections.length > 0 && (
                        <div>
                          <span className="font-semibold text-[#1C1B19] block mb-1">
                            Likely objections & talking points:
                          </span>
                          <div className="space-y-1.5">
                            {latestBrief.likely_objections.map((obj, i) => (
                              <div
                                key={i}
                                className="bg-white border border-[#E7E5E0] rounded p-2"
                              >
                                <div className="font-medium text-[#B54708]">{obj.objection}</div>
                                <div className="text-[#5F5C55] mt-0.5">→ {obj.talking_point}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="font-semibold text-[#B42318] block mb-1">
                          Avoid saying:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-[#5F5C55]">
                          {latestBrief.avoid_saying.map((av, i) => (
                            <li key={i}>{av}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* STAGE 2: AFTER THE CALL (VOICE DEBRIEF) */}
                <div className="pt-4 border-t border-[#E7E5E0] space-y-3 no-print">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E] block">
                      Stage 2 · After the call
                    </span>
                    <h4 className="text-sm font-semibold text-[#1C1B19]">
                      Post-Call Debrief & Score Update
                    </h4>
                  </div>

                  <VoiceRecorder
                    label="Record your call summary"
                    onTranscriptReady={(text) => {
                      setDebriefNotes((prev) => (prev ? `${prev}\n${text}` : text));
                      setDebriefInputMode('voice');
                      showToast('Call summary transcribed! Review below and click Update.', 'success');
                    }}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
                      Paste or edit your call notes
                    </label>
                    <textarea
                      rows={4}
                      value={debriefNotes}
                      onChange={(e) => setDebriefNotes(e.target.value)}
                      placeholder="Example: Spoke to customer. Budget increased to 1.4 Cr. Wants Saturday 11am site visit. I promised to send the RERA certificate and brochure on WhatsApp by Friday evening."
                      className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-xs text-[#1C1B19]"
                    />
                  </div>

                  <button
                    onClick={handleSubmitDebrief}
                    disabled={submittingDebrief || !debriefNotes.trim()}
                    className="w-full py-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingDebrief ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating lead & re-scoring...</span>
                      </>
                    ) : (
                      <span>Update lead from this call</span>
                    )}
                  </button>

                  {/* WHAT CHANGED CARD */}
                  {lastDebriefResult && (
                    <div className="bg-[#E6F2F0] border border-[#0F766E]/30 rounded-lg p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0F766E] uppercase tracking-wider text-[11px]">
                          What changed
                        </span>
                        <div className="inline-flex items-center gap-1.5 font-semibold text-sm text-[#1C1B19] bg-white px-2.5 py-1 rounded border border-[#E7E5E0]">
                          <span>{lastDebriefResult.score_before ?? '—'}</span>
                          <span>→</span>
                          <span>{lastDebriefResult.score_after ?? '—'}</span>
                          {(lastDebriefResult.score_after ?? 0) >
                          (lastDebriefResult.score_before ?? 0) ? (
                            <ArrowUpRight className="w-4 h-4 text-[#0F766E]" />
                          ) : (lastDebriefResult.score_after ?? 0) <
                            (lastDebriefResult.score_before ?? 0) ? (
                            <ArrowDownRight className="w-4 h-4 text-[#B42318]" />
                          ) : (
                            <Minus className="w-4 h-4 text-[#8C8980]" />
                          )}
                        </div>
                      </div>

                      {lastDebriefResult.what_changed.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-[#1C1B19]">
                          {lastDebriefResult.what_changed.map((chg, i) => (
                            <li key={i}>{chg}</li>
                          ))}
                        </ul>
                      )}

                      {lastDebriefResult.commitments.length > 0 && (
                        <div>
                          <span className="font-semibold text-[#1C1B19] block mb-1">
                            New promises tracked:
                          </span>
                          <ul className="space-y-1">
                            {lastDebriefResult.commitments.map((c) => (
                              <li
                                key={c.id}
                                className="bg-white px-2.5 py-1.5 rounded border border-[#E7E5E0] flex justify-between"
                              >
                                <span>{c.text}</span>
                                <span className="text-[#5F5C55]">{c.due_hint}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {lastDebriefResult.follow_up_message && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#1C1B19]">
                              Follow-up message:
                            </span>
                            <button
                              onClick={() =>
                                copyText(
                                  lastDebriefResult.follow_up_message,
                                  'Follow-up message copied'
                                )
                              }
                              className="inline-flex items-center gap-1 text-[#0F766E] font-semibold cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                          </div>
                          <div className="bg-white p-2.5 rounded border border-[#E7E5E0] text-[#1C1B19] whitespace-pre-wrap">
                            {lastDebriefResult.follow_up_message}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PAST BRIEFS & DEBRIEFS TIMELINE */}
                {callEvents.length > 0 && (
                  <div className="pt-4 border-t border-[#E7E5E0] space-y-2.5 no-print">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5F5C55]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Call Loop timeline ({callEvents.length})</span>
                    </div>
                    <div className="space-y-2">
                      {callEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-[#F7F7F5] border border-[#E7E5E0] rounded-lg p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-semibold text-[#1C1B19]">
                              <span>
                                {ev.type === 'brief' ? 'Pre-Call Brief' : 'Post-Call Debrief'}
                              </span>
                              {ev.input_mode && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-[#E7E5E0] text-[#5F5C55] capitalize">
                                  {ev.input_mode}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#8C8980]">
                              {formatTimestamp(ev.created_at)}
                            </span>
                          </div>
                          {ev.type === 'debrief' && (
                            <div className="text-[#5F5C55]">
                              Score: <strong>{ev.score_before ?? '—'}</strong> →{' '}
                              <strong>{ev.score_after ?? '—'}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}