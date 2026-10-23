import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Mic } from 'lucide-react';
import { Lead, PriorityTag } from '../lib/types';
import { PriorityBadge, EmptyState, Skeleton } from '../components/ui';
import {
  formatBudgetRange,
  formatRelativeDate,
  formatStatusLabel,
} from '../lib/format';

export function AllLeadsPage({
  refreshTrigger,
  loadingSamples,
  onLoadSamples,
}: {
  refreshTrigger: number;
  loadingSamples: boolean;
  onLoadSamples: () => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<PriorityTag | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<'score' | 'newest' | 'followup'>('score');

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (tagFilter) params.set('tag', tagFilter);
    if (statusFilter) params.set('status', statusFilter);
    params.set('sort', sort);

    fetch(`/api/leads?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.leads) setLeads(data.leads);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, tagFilter, statusFilter, sort, refreshTrigger]);

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="card-surface p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C8980] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or locality..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
          />
        </div>

        {/* Priority Filter Chips & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E7E5E0] bg-[#F7F7F5] p-0.5">
            {(['', 'hot', 'warm', 'cold'] as const).map((t) => (
              <button
                key={t || 'all'}
                onClick={() => setTagFilter(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                  tagFilter === t
                    ? 'bg-white text-[#1C1B19] shadow-xs'
                    : 'text-[#5F5C55] hover:text-[#1C1B19]'
                }`}
              >
                {t === '' ? 'All' : t}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E0] bg-white text-xs text-[#1C1B19]"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="follow_up">Follow-up</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            aria-label="Sort leads"
            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E0] bg-white text-xs text-[#1C1B19]"
          >
            <option value="score">Sort: Priority score</option>
            <option value="newest">Sort: Newest first</option>
            <option value="followup">Sort: Follow-up date</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card-surface p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads found"
          description="Try clearing your search filters, load the 8 sample leads, or add a new lead."
          onLoadSamples={onLoadSamples}
          onNewLead={() => navigate('/new')}
          loadingSamples={loadingSamples}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block card-surface overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E5E0] text-[11px] font-semibold uppercase tracking-wider text-[#8C8980] bg-[#F7F7F5]/60">
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Lead</th>
                  <th className="py-3 px-4">Requirement</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Timeline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Next Action</th>
                  <th className="py-3 px-4">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E0] text-sm">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="hover:bg-[#F7F7F5] transition cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <PriorityBadge tag={lead.priority_tag} score={lead.priority_score} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-[#1C1B19]">
                        <span>{lead.name}</span>
                        {lead.source === 'voice' && (
                          <Mic className="w-3.5 h-3.5 text-[#0F766E]" title="Voice note lead" />
                        )}
                        {lead.is_stale && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEF3E2] text-[#B54708]">
                            Stale
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#5F5C55]">{lead.location}</div>
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate text-xs text-[#5F5C55]">
                      {lead.property_requirement || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-[#1C1B19]">
                      {formatBudgetRange(
                        lead.budget_min_inr,
                        lead.budget_max_inr,
                        lead.budget_text
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5F5C55]">
                      {lead.timeline || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#F7F7F5] border border-[#E7E5E0] text-[#5F5C55]">
                        {formatStatusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate text-xs text-[#5F5C55]">
                      {lead.analysis?.recommended_next_action?.action || 'Pending analysis'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5F5C55]">
                      {formatRelativeDate(lead.follow_up_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="card-surface p-4 space-y-2 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <PriorityBadge tag={lead.priority_tag} score={lead.priority_score} size="sm" />
                  <span className="text-xs px-2 py-0.5 rounded bg-[#F7F7F5] border border-[#E7E5E0] text-[#5F5C55]">
                    {formatStatusLabel(lead.status)}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-[#1C1B19]">{lead.name}</div>
                  <div className="text-xs text-[#5F5C55]">{lead.location}</div>
                </div>
                <div className="text-xs text-[#5F5C55] flex flex-wrap gap-2">
                  <span>{lead.property_requirement || '—'}</span>
                  <span>·</span>
                  <span className="font-medium text-[#1C1B19]">
                    {formatBudgetRange(lead.budget_min_inr, lead.budget_max_inr, lead.budget_text)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}