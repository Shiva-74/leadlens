import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Mic } from 'lucide-react';
import { Lead, PriorityTag } from '../lib/types';
import { PriorityBadge, ScoreRing, EmptyState, SkeletonCard } from '../components/UI';
import {
  formatBudgetDisplay,
  formatDateShort,
  formatRelativeTime,
  formatStatusLabel,
} from '../lib/format';
import { useWorkspace } from '../components/Layout';

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<PriorityTag | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'newest' | 'followup'>('score');

  const { refreshTick, loadSampleLeads, loadingSamples } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (tagFilter !== 'all') params.set('tag', tagFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('sort', sortBy);

    fetch(`/api/leads?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setLeads(data.leads || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, tagFilter, statusFilter, sortBy, refreshTick]);

  return (
    <div className="space-y-4">
      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E7E5E0] rounded-[10px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C8980] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or location..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E7E5E0] text-sm text-[#1C1B19]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Priority Filter Chips */}
          <div className="inline-flex rounded-lg border border-[#E7E5E0] p-0.5 bg-[#F7F7F5]">
            {(['all', 'hot', 'warm', 'cold'] as const).map((chip) => (
              <button
                key={chip}
                onClick={() => setTagFilter(chip)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                  tagFilter === chip
                    ? 'bg-white text-[#1C1B19] shadow-xs'
                    : 'text-[#5F5C55] hover:text-[#1C1B19]'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E0] bg-white text-xs font-medium text-[#1C1B19]"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="follow_up">Follow-up</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E0] bg-white text-xs font-medium text-[#1C1B19]"
            aria-label="Sort leads"
          >
            <option value="score">Sort: Priority score</option>
            <option value="newest">Sort: Newest first</option>
            <option value="followup">Sort: Follow-up date</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads match your filters"
          description="Add a new lead or load the 8 realistic Indian real-estate sample leads."
          onAddLead={() => navigate('/new')}
          onLoadSamples={loadSampleLeads}
          loadingSamples={loadingSamples}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-[#E7E5E0] rounded-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E5E0] bg-[#F7F7F5] text-[11px] font-semibold uppercase tracking-wider text-[#5F5C55]">
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Lead</th>
                  <th className="py-3 px-4">Requirement</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Timeline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Next Action</th>
                  <th className="py-3 px-4">Follow-up</th>
                  <th className="py-3 px-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E0] text-sm">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="hover:bg-[#F7F7F5]/70 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ScoreRing score={lead.priority_score} size={36} />
                        <PriorityBadge tag={lead.priority_tag} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-[#1C1B19]">
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
                      {formatBudgetDisplay(
                        lead.budget_min_inr,
                        lead.budget_max_inr,
                        lead.budget_text
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5F5C55]">
                      {lead.timeline || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F7F7F5] border border-[#E7E5E0] text-[#1C1B19]">
                        {formatStatusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate text-xs text-[#5F5C55]">
                      {lead.analysis?.recommended_next_action?.action || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5F5C55]">
                      {formatDateShort(lead.follow_up_date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#8C8980]">
                      {formatRelativeTime(lead.created_at)}
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
                className="bg-white border border-[#E7E5E0] rounded-[10px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-2 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScoreRing score={lead.priority_score} size={38} />
                    <div>
                      <div className="font-semibold text-[#1C1B19] text-sm">{lead.name}</div>
                      <div className="text-xs text-[#5F5C55]">{lead.location}</div>
                    </div>
                  </div>
                  <PriorityBadge tag={lead.priority_tag} />
                </div>
                <div className="text-xs text-[#5F5C55] flex flex-wrap gap-2 pt-1">
                  <span>{lead.property_requirement || 'No requirement'}</span>
                  <span>•</span>
                  <span className="font-medium text-[#1C1B19]">
                    {formatBudgetDisplay(
                      lead.budget_min_inr,
                      lead.budget_max_inr,
                      lead.budget_text
                    )}
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