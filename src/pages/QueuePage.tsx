import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Flame,
  CalendarClock,
  Clock,
  HelpCircle,
  ArrowRight,
  Mic,
  ListChecks,
} from 'lucide-react';
import { Lead } from '../lib/types';
import {
  PriorityBadge,
  StatCard,
  EmptyState,
  Skeleton,
  HowScoringWorksDialog,
} from '../components/ui';
import { formatBudgetRange, formatStatusLabel } from '../lib/format';

export function QueuePage({
  refreshTrigger,
  loadingSamples,
  onLoadSamples,
}: {
  refreshTrigger: number;
  loadingSamples: boolean;
  onLoadSamples: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    hotLeads: 0,
    followUpsDue: 0,
    awaitingFirstContact: 0,
  });
  const [doFirstToday, setDoFirstToday] = useState<Lead[]>([]);
  const [remainingGrouped, setRemainingGrouped] = useState<{
    hot: Lead[];
    warm: Lead[];
    cold: Lead[];
  }>({ hot: [], warm: [], cold: [] });
  const [scoringDialogOpen, setScoringDialogOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/queue')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.stats) setStats(data.stats);
        if (data.doFirstToday) setDoFirstToday(data.doFirstToday);
        if (data.remainingGrouped) setRemainingGrouped(data.remainingGrouped);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  const QueueRow = ({ lead }: { lead: Lead }) => (
    <div
      onClick={() => navigate(`/leads/${lead.id}`)}
      className="card-surface p-4 hover:border-[#0F766E]/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge tag={lead.priority_tag} score={lead.priority_score} />
          <span className="font-semibold text-[#1C1B19] text-sm truncate">{lead.name}</span>
          <span className="text-xs text-[#5F5C55]">· {lead.location}</span>
          {lead.source === 'voice' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[#F7F7F5] text-[#5F5C55] border border-[#E7E5E0]">
              <Mic className="w-3 h-3 text-[#0F766E]" /> Voice
            </span>
          )}
          {lead.is_stale && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#FEF3E2] text-[#B54708]">
              Stale
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5F5C55]">
          <span className="font-medium text-[#0F766E]">{lead.queue_reason}</span>
          <span>·</span>
          <span>
            {lead.property_requirement || 'Requirement unspecified'} (
            {formatBudgetRange(lead.budget_min_inr, lead.budget_max_inr, lead.budget_text)})
          </span>
        </div>

        {lead.analysis?.recommended_next_action?.action && (
          <p className="text-xs text-[#1C1B19] truncate pt-0.5">
            <span className="text-[#8C8980]">Next: </span>
            {lead.analysis.recommended_next_action.action}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <span className="text-xs px-2 py-0.5 rounded bg-[#F7F7F5] border border-[#E7E5E0] text-[#5F5C55]">
          {formatStatusLabel(lead.status)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/leads/${lead.id}`);
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs font-medium transition cursor-pointer"
        >
          <span>Open</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total leads" value={stats.totalLeads} icon={Users} />
        <StatCard label="Hot leads" value={stats.hotLeads} icon={Flame} helper="Score 70+" />
        <StatCard
          label="Follow-ups due or overdue"
          value={stats.followUpsDue}
          icon={CalendarClock}
        />
        <StatCard
          label="Awaiting first contact"
          value={stats.awaitingFirstContact}
          icon={Clock}
        />
      </div>

      {/* Header bar with 'How scoring works' button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#1C1B19]">Do these first today</h2>
          <p className="text-xs text-[#5F5C55]">
            Ranked by overdue follow-ups, uncontacted hot leads, and deterministic priority score.
          </p>
        </div>
        <button
          onClick={() => setScoringDialogOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E5E0] bg-white hover:bg-[#F7F7F5] text-xs font-medium text-[#1C1B19] cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#0F766E]" />
          <span>How scoring works</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card-surface p-4 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
          ))}
        </div>
      ) : stats.totalLeads === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Your queue is empty"
          description="Load 8 realistic Indian real-estate sample leads (Hinglish WhatsApp, NRI, investor, conflicting requirements) or record a voice note to see LeadLens in action."
          onLoadSamples={onLoadSamples}
          onNewLead={() => navigate('/new')}
          loadingSamples={loadingSamples}
        />
      ) : (
        <>
          {/* Do these first today (up to 8 leads) */}
          <div className="space-y-2.5">
            {doFirstToday.map((lead) => (
              <QueueRow key={lead.id} lead={lead} />
            ))}
          </div>

          {/* Remaining Leads Grouped under Hot, Warm, Cold */}
          {(remainingGrouped.hot.length > 0 ||
            remainingGrouped.warm.length > 0 ||
            remainingGrouped.cold.length > 0) && (
            <div className="pt-4 space-y-6">
              {remainingGrouped.hot.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#B42318]">
                    Remaining Hot Leads ({remainingGrouped.hot.length})
                  </h3>
                  {remainingGrouped.hot.map((lead) => (
                    <QueueRow key={lead.id} lead={lead} />
                  ))}
                </div>
              )}

              {remainingGrouped.warm.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#B54708]">
                    Remaining Warm Leads ({remainingGrouped.warm.length})
                  </h3>
                  {remainingGrouped.warm.map((lead) => (
                    <QueueRow key={lead.id} lead={lead} />
                  ))}
                </div>
              )}

              {remainingGrouped.cold.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3E5C7E]">
                    Remaining Cold Leads ({remainingGrouped.cold.length})
                  </h3>
                  {remainingGrouped.cold.map((lead) => (
                    <QueueRow key={lead.id} lead={lead} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <HowScoringWorksDialog
        open={scoringDialogOpen}
        onClose={() => setScoringDialogOpen(false)}
      />
    </div>
  );
}