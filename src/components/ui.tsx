import React from 'react';
import { PriorityTag } from '../lib/types';
import { X, HelpCircle } from 'lucide-react';

// Priority pills with exact spec tokens:
// Hot bg #FDECEA text #B42318; Warm bg #FEF3E2 text #B54708; Cold bg #EAF0F7 text #3E5C7E
export function PriorityBadge({
  tag,
  score,
  size = 'md',
}: {
  tag: PriorityTag | null | undefined;
  score?: number | null;
  size?: 'sm' | 'md';
}) {
  const normalized = tag || 'cold';
  const styles: Record<PriorityTag, string> = {
    hot: 'bg-[#FDECEA] text-[#B42318] border-[#F9D2CE]',
    warm: 'bg-[#FEF3E2] text-[#B54708] border-[#FCD9A8]',
    cold: 'bg-[#EAF0F7] text-[#3E5C7E] border-[#CEDCEB]',
  };

  const labels: Record<PriorityTag, string> = {
    hot: 'Hot',
    warm: 'Warm',
    cold: 'Cold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold border rounded-full ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'
      } ${styles[normalized]}`}
    >
      <span>{labels[normalized]}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-85 font-normal">· {score}</span>
      )}
    </span>
  );
}

// Circular progress ScoreRing colored by priority
export function ScoreRing({
  score,
  tag,
  size = 56,
}: {
  score: number | null | undefined;
  tag?: PriorityTag | null;
  size?: number;
}) {
  const safeScore = score ?? 0;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, safeScore)) / 100) * circumference;

  const strokeColor =
    tag === 'hot' || safeScore >= 70
      ? '#B42318'
      : tag === 'warm' || safeScore >= 40
      ? '#B54708'
      : '#3E5C7E';

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      title={`Priority Score: ${safeScore}/100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E7E5E0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-semibold text-[#1C1B19]">
        {score !== null && score !== undefined ? safeScore : '—'}
      </span>
    </div>
  );
}

// Horizontal ScoreBar with reason and evidence quote
export function ScoreBar({
  label,
  weightLabel,
  score,
  reason,
  evidenceQuote,
}: {
  label: string;
  weightLabel: string;
  score: number;
  reason: string;
  evidenceQuote?: string;
}) {
  const barColor =
    score >= 70 ? 'bg-[#B42318]' : score >= 40 ? 'bg-[#B54708]' : 'bg-[#3E5C7E]';
  const textColor =
    score >= 70 ? 'text-[#B42318]' : score >= 40 ? 'text-[#B54708]' : 'text-[#3E5C7E]';

  return (
    <div className="py-3 first:pt-0 last:pb-0 border-b border-[#E7E5E0] last:border-b-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#1C1B19]">{label}</span>
          <span className="text-xs text-[#8C8980]">({weightLabel})</span>
        </div>
        <span className={`font-semibold text-sm ${textColor}`}>{score}/100</span>
      </div>
      <div className="w-full h-2 bg-[#F0EFEA] rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <p className="text-xs text-[#5F5C55] leading-relaxed">{reason}</p>
      {evidenceQuote && evidenceQuote.trim() !== '' && (
        <p className="text-xs italic text-[#8C8980] mt-1">“{evidenceQuote}”</p>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  helper,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  helper?: string;
}) {
  return (
    <div className="card-surface p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between text-[#5F5C55] mb-2">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-[#8C8980]" />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold text-[#1C1B19]">{value}</span>
        {helper && <span className="text-xs text-[#8C8980]">{helper}</span>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  onLoadSamples,
  onNewLead,
  loadingSamples,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onLoadSamples?: () => void;
  onNewLead?: () => void;
  loadingSamples?: boolean;
}) {
  return (
    <div className="card-surface p-8 text-center max-w-lg mx-auto my-6">
      <div className="w-10 h-10 rounded-full bg-[#F7F7F5] border border-[#E7E5E0] flex items-center justify-center mx-auto mb-3">
        <Icon className="w-5 h-5 text-[#5F5C55]" />
      </div>
      <h3 className="text-base font-semibold text-[#1C1B19] mb-1">{title}</h3>
      <p className="text-sm text-[#5F5C55] mb-5">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onLoadSamples && (
          <button
            onClick={onLoadSamples}
            disabled={loadingSamples}
            className="px-4 py-2 rounded-lg border border-[#E7E5E0] bg-white hover:bg-[#F7F7F5] text-[#1C1B19] font-medium text-sm transition cursor-pointer disabled:opacity-50"
          >
            {loadingSamples ? 'Loading sample leads...' : 'Load sample leads'}
          </button>
        )}
        {onNewLead && (
          <button
            onClick={onNewLead}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white font-medium text-sm transition cursor-pointer"
          >
            Add a lead
          </button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#EAE8E1] rounded-md ${className}`} />;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="card-surface w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E7E5E0]">
          <h3 className="text-lg font-semibold text-[#1C1B19]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-[#8C8980] hover:text-[#1C1B19] rounded"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HowScoringWorksDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="How LeadLens Scoring Works">
      <div className="space-y-4 text-sm text-[#5F5C55]">
        <p className="text-[#1C1B19] font-medium">
          AI judges the qualitative context, while deterministic code computes the final score.
        </p>
        <p>
          Instead of letting an LLM guess an arbitrary overall number, LeadLens asks the AI to
          evaluate four specific real-estate buying dimensions (0–100) backed by exact customer
          quotes. Our server then applies a fixed mathematical formula:
        </p>
        <div className="bg-[#F7F7F5] border border-[#E7E5E0] rounded-lg p-3.5 space-y-2.5">
          <div className="flex justify-between">
            <span className="font-semibold text-[#1C1B19]">1. Buying Intent (35% weight)</span>
            <span className="text-xs text-[#8C8980]">× 0.35</span>
          </div>
          <p className="text-xs">
            Measures whether the buyer is ready to transact (site visit requested, loan pre-approved)
            versus casually browsing prices.
          </p>

          <div className="flex justify-between pt-1 border-t border-[#E7E5E0]">
            <span className="font-semibold text-[#1C1B19]">2. Timeline Urgency (30% weight)</span>
            <span className="text-xs text-[#8C8980]">× 0.30</span>
          </div>
          <p className="text-xs">
            Prioritizes buyers shifting immediately or within 1–3 months over undecided timelines.
          </p>

          <div className="flex justify-between pt-1 border-t border-[#E7E5E0]">
            <span className="font-semibold text-[#1C1B19]">3. Budget Realism (20% weight)</span>
            <span className="text-xs text-[#8C8980]">× 0.20</span>
          </div>
          <p className="text-xs">
            Checks whether the stated budget in Lakhs/Crores matches realistic market prices for the
            requested configuration and locality.
          </p>

          <div className="flex justify-between pt-1 border-t border-[#E7E5E0]">
            <span className="font-semibold text-[#1C1B19]">4. Requirement Fit & Clarity (15% weight)</span>
            <span className="text-xs text-[#8C8980]">× 0.15</span>
          </div>
          <p className="text-xs">
            Measures how clearly the customer stated BHK, locality, possession, and family needs.
          </p>
        </div>

        <div className="pt-2">
          <h4 className="font-semibold text-[#1C1B19] mb-2">Priority Thresholds</h4>
          <div className="flex flex-wrap gap-3">
            <PriorityBadge tag="hot" score={70} />
            <span className="text-xs self-center">70 to 100</span>
            <PriorityBadge tag="warm" score={40} />
            <span className="text-xs self-center">40 to 69</span>
            <PriorityBadge tag="cold" score={25} />
            <span className="text-xs self-center">Below 40</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}