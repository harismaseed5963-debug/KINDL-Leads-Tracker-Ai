import React, { useEffect, useMemo, useState } from 'react';
import { History, Search, Filter, User } from 'lucide-react';
import { LeadActivity } from '../types';
import { subscribeToActivities } from '../services/activityService';
import { formatTimestamp } from '../utils/permissions';

export const ActivityView: React.FC = () => {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [maxItems, setMaxItems] = useState(150);

  useEffect(() => {
    const unsub = subscribeToActivities(maxItems, setActivities);
    return () => unsub();
  }, [maxItems]);

  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.performedByName) set.add(a.performedByName);
    });
    return Array.from(set);
  }, [activities]);

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.action) set.add(a.action);
    });
    return Array.from(set);
  }, [activities]);

  const filtered = useMemo(() => {
    return activities.filter((act) => {
      if (actionFilter !== 'ALL' && act.action !== actionFilter) return false;
      if (userFilter !== 'ALL' && act.performedByName !== userFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLead = (act.leadName || '').toLowerCase().includes(q);
        const matchDetails = (act.details || '').toLowerCase().includes(q);
        const matchUser = (act.performedByName || '').toLowerCase().includes(q);
        if (!matchLead && !matchDetails && !matchUser) return false;
      }
      return true;
    });
  }, [activities, actionFilter, userFilter, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED4C3] pb-4">
        <div>
          <h1 className="font-serif-editorial text-2xl font-bold text-[#261C15]">
            Team Activity & Audit History
          </h1>
          <p className="text-sm text-[#6E5D50]">
            Chronological audit trail of every lead creation, status change, ownership assignment,
            import/export, and WhatsApp workflow action.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded p-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#6E5D50] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit history by lead name, user, or details..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#F7F3EB] border border-[#C5B69F] rounded text-xs font-sans-ui"
          />
        </div>

        <div className="flex items-center gap-2 font-mono-tech text-xs">
          <Filter className="w-3.5 h-3.5 text-[#6E5D50]" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F7F3EB] border border-[#C5B69F] rounded text-xs"
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 font-mono-tech text-xs">
          <User className="w-3.5 h-3.5 text-[#6E5D50]" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F7F3EB] border border-[#C5B69F] rounded text-xs"
          >
            <option value="ALL">All Team Members</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded divide-y divide-[#F0E9DC]">
        {filtered.length === 0 ? (
          <div className="py-12 text-center font-mono-tech text-xs text-[#6E5D50]">
            No matching activity logs found.
          </div>
        ) : (
          filtered.map((act) => (
            <div
              key={act.id}
              className="p-3.5 hover:bg-[#F7F3EB]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-tech text-xs font-semibold text-[#261C15]">
                    {formatTimestamp(act.timestamp)} — {act.performedByName}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono-tech uppercase bg-[#F0E9DC] border border-[#C5B69F] text-[#D95D24] font-semibold rounded">
                    {act.action}
                  </span>
                  {act.leadName && (
                    <span className="font-serif-editorial font-semibold text-sm text-[#261C15]">
                      • {act.leadName}
                    </span>
                  )}
                </div>
                <p className="text-xs font-sans-ui text-[#6E5D50]">{act.details}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {activities.length >= maxItems && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setMaxItems((m) => m + 150)}
            className="px-4 py-2 bg-[#FFFDF9] hover:bg-[#F0E9DC] border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
          >
            Load Older Activity Logs
          </button>
        </div>
      )}
    </div>
  );
};
