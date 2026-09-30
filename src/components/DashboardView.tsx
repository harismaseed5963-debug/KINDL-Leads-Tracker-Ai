import React, { useMemo } from 'react';
import {
  Users,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  CalendarClock,
  Trophy,
  XCircle,
  ArrowRight,
  MapPin,
  Layers,
  Share2,
  Flame,
} from 'lucide-react';
import { Lead, NavTab } from '../types';

interface DashboardViewProps {
  leads: Lead[];
  onNavigate: (tab: NavTab, presetFilter?: { status?: string; category?: string }) => void;
}

function getLeadDate(lead: Lead): Date | null {
  if (lead.createdAt) {
    if (typeof lead.createdAt.toDate === 'function') return lead.createdAt.toDate();
    if (typeof lead.createdAt.seconds === 'number') return new Date(lead.createdAt.seconds * 1000);
  }
  if (lead.Time) {
    const d = new Date(lead.Time);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ leads, onNavigate }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    let newCount = 0;
    let contactedCount = 0;
    let qualifiedCount = 0;
    let followUpCount = 0;
    let convertedCount = 0;
    let lostCount = 0;

    let addedToday = 0;
    let addedThisWeek = 0;
    let followUpsDueToday = 0;

    const bySource: Record<string, number> = {};
    const byProgram: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    leads.forEach((lead) => {
      const st = (lead.Status || 'New').toLowerCase();
      if (st === 'new') newCount++;
      else if (st === 'contacted') contactedCount++;
      else if (st === 'qualified') qualifiedCount++;
      else if (st === 'follow-up' || st === 'followup') followUpCount++;
      else if (st === 'convert' || st === 'converted') convertedCount++;
      else if (st === 'lost') lostCount++;

      const createdDate = getLeadDate(lead);
      if (createdDate) {
        if (createdDate >= startOfToday) addedToday++;
        if (createdDate >= startOfWeek) addedThisWeek++;
      }

      if (lead.Follow_Up_Time) {
        const fuDatePart = lead.Follow_Up_Time.slice(0, 10);
        if (fuDatePart <= todayStr && st !== 'convert' && st !== 'converted' && st !== 'lost') {
          followUpsDueToday++;
        }
      }

      const src = lead.Source?.trim() || 'Unspecified';
      bySource[src] = (bySource[src] || 0) + 1;

      const prog = lead.Program?.trim() || 'Unspecified';
      byProgram[prog] = (byProgram[prog] || 0) + 1;

      const city = lead.City?.trim() || 'Unspecified';
      byCity[city] = (byCity[city] || 0) + 1;

      const cat = lead.Lead_Category?.trim() || 'Warm';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const sortEntries = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    return {
      total: leads.length,
      newCount,
      contactedCount,
      qualifiedCount,
      followUpCount,
      convertedCount,
      lostCount,
      addedToday,
      addedThisWeek,
      followUpsDueToday,
      bySource: sortEntries(bySource),
      byProgram: sortEntries(byProgram),
      byCity: sortEntries(byCity),
      byCategory: sortEntries(byCategory),
    };
  }, [leads]);

  const statusCards = [
    {
      label: 'Total Leads',
      value: stats.total,
      icon: <Users className="w-4 h-4 text-[#261C15]" />,
      border: 'border-[#C5B69F]',
      bg: 'bg-[#FFFDF9]',
      onClick: () => onNavigate('leads', { status: 'ALL' }),
    },
    {
      label: 'New Leads',
      value: stats.newCount,
      icon: <Sparkles className="w-4 h-4 text-sky-700" />,
      border: 'border-sky-300',
      bg: 'bg-sky-50/50',
      onClick: () => onNavigate('leads', { status: 'New' }),
    },
    {
      label: 'Contacted',
      value: stats.contactedCount,
      icon: <PhoneCall className="w-4 h-4 text-amber-700" />,
      border: 'border-amber-300',
      bg: 'bg-amber-50/50',
      onClick: () => onNavigate('leads', { status: 'Contacted' }),
    },
    {
      label: 'Qualified',
      value: stats.qualifiedCount,
      icon: <CheckCircle2 className="w-4 h-4 text-indigo-700" />,
      border: 'border-indigo-300',
      bg: 'bg-indigo-50/50',
      onClick: () => onNavigate('leads', { status: 'Qualified' }),
    },
    {
      label: 'Follow-Up',
      value: stats.followUpCount,
      icon: <CalendarClock className="w-4 h-4 text-[#D95D24]" />,
      border: 'border-[#D95D24]/50',
      bg: 'bg-orange-50/60',
      onClick: () => onNavigate('leads', { status: 'Follow-Up' }),
    },
    {
      label: 'Converted',
      value: stats.convertedCount,
      icon: <Trophy className="w-4 h-4 text-emerald-700" />,
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/50',
      onClick: () => onNavigate('leads', { status: 'Convert' }),
    },
    {
      label: 'Lost',
      value: stats.lostCount,
      icon: <XCircle className="w-4 h-4 text-stone-500" />,
      border: 'border-stone-300',
      bg: 'bg-stone-100/70',
      onClick: () => onNavigate('leads', { status: 'Lost' }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED4C3] pb-4">
        <div>
          <h1 className="font-serif-editorial text-2xl font-bold text-[#261C15]">
            Team Pipeline Overview
          </h1>
          <p className="text-sm text-[#6E5D50]">
            Real-time snapshot of the shared KINDL lead database across all active team members.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('leads')}
          className="self-start sm:self-auto px-4 py-2 bg-[#D95D24] hover:bg-[#B84A18] text-[#FFFDF9] font-mono-tech text-xs uppercase tracking-wider font-semibold rounded flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>Open Leads Workspace</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statusCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className={`p-3.5 rounded border ${card.border} ${card.bg} text-left hover:shadow-xs transition-all cursor-pointer group`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6E5D50] group-hover:text-[#261C15]">
                {card.label}
              </span>
              {card.icon}
            </div>
            <div className="font-mono-tech text-2xl font-bold text-[#261C15]">{card.value}</div>
          </button>
        ))}
      </div>

      {/* Velocity & Follow-up Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded bg-[#FFFDF9] border border-[#C5B69F] flex items-center justify-between">
          <div>
            <p className="font-mono-tech text-xs uppercase tracking-wider text-[#6E5D50]">
              Leads Added Today
            </p>
            <p className="font-mono-tech text-3xl font-bold text-[#261C15] mt-1">
              {stats.addedToday}
            </p>
            <p className="text-xs text-[#6E5D50] mt-1">New prospects recorded since midnight</p>
          </div>
          <div className="w-10 h-10 rounded bg-[#F0E9DC] flex items-center justify-center font-mono-tech text-sm font-bold text-[#D95D24]">
            24h
          </div>
        </div>

        <div className="p-4 rounded bg-[#FFFDF9] border border-[#C5B69F] flex items-center justify-between">
          <div>
            <p className="font-mono-tech text-xs uppercase tracking-wider text-[#6E5D50]">
              Leads Added This Week
            </p>
            <p className="font-mono-tech text-3xl font-bold text-[#261C15] mt-1">
              {stats.addedThisWeek}
            </p>
            <p className="text-xs text-[#6E5D50] mt-1">Rolling 7-day team intake velocity</p>
          </div>
          <div className="w-10 h-10 rounded bg-[#F0E9DC] flex items-center justify-center font-mono-tech text-sm font-bold text-[#261C15]">
            7d
          </div>
        </div>

        <div className="p-4 rounded bg-[#FFFDF9] border border-[#D95D24] flex items-center justify-between">
          <div>
            <p className="font-mono-tech text-xs uppercase tracking-wider text-[#D95D24] font-semibold">
              Follow-Ups Due Today / Overdue
            </p>
            <p className="font-mono-tech text-3xl font-bold text-[#261C15] mt-1">
              {stats.followUpsDueToday}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('followups')}
              className="mt-1 font-mono-tech text-xs text-[#D95D24] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Review scheduled follow-ups →
            </button>
          </div>
          <div className="w-10 h-10 rounded bg-[#D95D24]/15 flex items-center justify-center text-[#D95D24]">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4 Breakdown Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Leads by Category */}
        <BreakdownPanel
          title="Leads by Category"
          icon={<Flame className="w-4 h-4 text-[#D95D24]" />}
          items={stats.byCategory}
          total={stats.total}
          onSelect={(cat) => onNavigate('leads', { category: cat })}
        />

        {/* Leads by Source */}
        <BreakdownPanel
          title="Leads by Source"
          icon={<Share2 className="w-4 h-4 text-[#6E5D50]" />}
          items={stats.bySource}
          total={stats.total}
        />

        {/* Leads by Program */}
        <BreakdownPanel
          title="Leads by Program"
          icon={<Layers className="w-4 h-4 text-[#6E5D50]" />}
          items={stats.byProgram}
          total={stats.total}
        />

        {/* Leads by City */}
        <BreakdownPanel
          title="Leads by City"
          icon={<MapPin className="w-4 h-4 text-[#6E5D50]" />}
          items={stats.byCity}
          total={stats.total}
        />
      </div>
    </div>
  );
};

interface BreakdownPanelProps {
  title: string;
  icon: React.ReactNode;
  items: [string, number][];
  total: number;
  onSelect?: (label: string) => void;
}

const BreakdownPanel: React.FC<BreakdownPanelProps> = ({
  title,
  icon,
  items,
  total,
  onSelect,
}) => {
  return (
    <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-[#F0E9DC] pb-2.5 mb-3">
          <h3 className="font-mono-tech text-xs uppercase tracking-wider font-semibold text-[#261C15]">
            {title}
          </h3>
          {icon}
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-[#6E5D50] py-6 text-center font-mono-tech">No leads recorded yet</p>
        ) : (
          <div className="space-y-2.5">
            {items.map(([label, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div
                  key={label}
                  onClick={onSelect ? () => onSelect(label) : undefined}
                  className={onSelect ? 'cursor-pointer group' : ''}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-sans-ui font-medium text-[#261C15] group-hover:text-[#D95D24] truncate max-w-[160px]">
                      {label}
                    </span>
                    <span className="font-mono-tech text-[11px] text-[#6E5D50]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#F0E9DC] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#D95D24] rounded-full"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
