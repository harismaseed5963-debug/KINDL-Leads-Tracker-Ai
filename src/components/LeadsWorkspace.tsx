import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  Columns,
  Upload,
  Download,
  Trash2,
  MessageSquare,
  Edit3,
  ExternalLink,
  CheckSquare,
  Square,
  ArrowUpDown,
  Calendar,
  AlertTriangle,
  Loader2,
  UserCheck,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  ColumnConfig,
  CustomOptions,
  Lead,
  LeadFieldKey,
  LeadFormInput,
  UserProfile,
} from '../types';
import {
  addCustomDropdownOption,
  bulkUpdateLeads,
  createLead,
  softDeleteLeads,
  updateLead,
} from '../services/leadsService';
import { logLeadActivity } from '../services/activityService';
import { exportLeadsFile } from '../utils/importExport';
import { buildWhatsAppUrl } from '../utils/whatsapp';
import { getRolePermissions } from '../utils/permissions';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';
import { WhatsAppQueueBar } from './WhatsAppQueueBar';

interface LeadsWorkspaceProps {
  leads: Lead[];
  leadsMap: Map<string, Lead>;
  users: UserProfile[];
  currentUser: UserProfile;
  customOptions: CustomOptions;
  viewMode: 'leads' | 'followups';
  presetFilter?: { status?: string; category?: string } | null;
  onClearPresetFilter?: () => void;
  onOpenEditModal: (leadId: string) => void;
  onOpenImportModal: () => void;
  onDeleteWithUndo: (deletedLeads: Lead[], message: string) => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'Full_Name', label: 'Full Name', visible: true },
  { key: 'Phone_Number', label: 'Phone', visible: true },
  { key: 'Age', label: 'Age', visible: true },
  { key: 'City', label: 'City', visible: true },
  { key: 'Source', label: 'Source', visible: true },
  { key: 'Lead_Role', label: 'Lead Role', visible: true },
  { key: 'Program', label: 'Program', visible: true },
  { key: 'Lead_Category', label: 'Category', visible: true },
  { key: 'Status', label: 'Status', visible: true },
  { key: 'Follow_Up_Time', label: 'Follow-Up', visible: true },
  { key: 'assignedToName', label: 'Assigned To', visible: true },
  { key: 'WhatsApp_Message', label: 'WhatsApp Message', visible: true },
  { key: 'Time', label: 'Time', visible: true },
  { key: 'Description', label: 'Description', visible: true },
];

export const LeadsWorkspace: React.FC<LeadsWorkspaceProps> = ({
  leads,
  leadsMap,
  users,
  currentUser,
  customOptions,
  viewMode,
  presetFilter,
  onClearPresetFilter,
  onOpenEditModal,
  onOpenImportModal,
  onDeleteWithUndo,
  onToast,
}) => {
  const perms = getRolePermissions(currentUser.role);

  // Harmless UI state in localStorage (collapsed panels, columns, page size)
  const [addPanelOpen, setAddPanelOpen] = useState<boolean>(() => {
    return localStorage.getItem('kindl_ui_add_open') !== 'false';
  });

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('kindl_ui_columns_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_COLUMNS;
  });

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSelectByFieldMenu, setShowSelectByFieldMenu] = useState(false);

  // Add Lead Form State
  const [form, setForm] = useState<LeadFormInput>({
    Full_Name: '',
    Phone_Number: '',
    Age: '',
    City: '',
    Source: 'WhatsApp',
    Lead_Role: 'Student',
    Program: 'KINDL Foundations',
    Lead_Category: 'Warm',
    Status: 'New',
    Follow_Up_Time: '',
    WhatsApp_Message:
      'Assalam-o-Alaikum {name}, thank you for your interest in KINDL! Let us know when is a good time to connect.',
    Time: '',
    Description: '',
    assignedTo: currentUser.uid,
    assignedToName: currentUser.name,
  });
  const [creatingLead, setCreatingLead] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<LeadFieldKey>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [followUpSubTab, setFollowUpSubTab] = useState<'due' | 'upcoming' | 'all'>('due');

  // Apply dashboard preset filter if passed
  useEffect(() => {
    if (presetFilter) {
      if (presetFilter.status) setStatusFilter(presetFilter.status);
      if (presetFilter.category) setCategoryFilter(presetFilter.category);
      if (onClearPresetFilter) onClearPresetFilter();
    }
  }, [presetFilter, onClearPresetFilter]);

  // Sorting State
  const [sortField, setSortField] = useState<keyof Lead | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection & Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState(
    'Assalam-o-Alaikum {name}, following up regarding your application at KINDL.'
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const [activeWhatsAppQueue, setActiveWhatsAppQueue] = useState<string[]>([]);

  // Confirmation Dialog State
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Pagination for 500+ / 5,000+ leads performance
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleAddPanel = () => {
    const next = !addPanelOpen;
    setAddPanelOpen(next);
    localStorage.setItem('kindl_ui_add_open', String(next));
  };

  const toggleColumn = (key: keyof Lead) => {
    const updated = columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
    setColumns(updated);
    localStorage.setItem('kindl_ui_columns_v2', JSON.stringify(updated));
  };

  // Filtered & Sorted Leads
  const filteredLeads = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const q = searchQuery.trim().toLowerCase();

    return leads.filter((lead) => {
      // Follow-Ups view mode filter
      if (viewMode === 'followups') {
        const hasFollowUp = Boolean(lead.Follow_Up_Time) || lead.Status === 'Follow-Up';
        if (!hasFollowUp) return false;
        const fuDate = (lead.Follow_Up_Time || '').slice(0, 10);
        if (followUpSubTab === 'due') {
          if (fuDate && fuDate > todayStr) return false;
        } else if (followUpSubTab === 'upcoming') {
          if (!fuDate || fuDate <= todayStr) return false;
        }
      }

      if (statusFilter !== 'ALL' && lead.Status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && lead.Lead_Category !== categoryFilter) return false;
      if (ownerFilter !== 'ALL') {
        if (ownerFilter === 'UNASSIGNED' && lead.assignedTo) return false;
        if (ownerFilter !== 'UNASSIGNED' && lead.assignedTo !== ownerFilter) return false;
      }

      // Date Range Filtering (checks Follow_Up_Time if searchField === 'Follow_Up_Time', else checks Time / Follow_Up_Time)
      if (dateFrom || dateTo) {
        const targetDateStr =
          searchField === 'Follow_Up_Time'
            ? (lead.Follow_Up_Time || '').slice(0, 10)
            : (lead.Time || lead.Follow_Up_Time || '').slice(0, 10);
        if (!targetDateStr) return false;
        if (dateFrom && targetDateStr < dateFrom) return false;
        if (dateTo && targetDateStr > dateTo) return false;
      }

      // Text Search
      if (q) {
        if (searchField === 'all') {
          const hay = [
            lead.Full_Name,
            lead.Phone_Number,
            lead.phoneNormalized,
            lead.Age,
            lead.City,
            lead.Source,
            lead.Lead_Role,
            lead.Program,
            lead.Lead_Category,
            lead.Status,
            lead.Follow_Up_Time,
            lead.assignedToName,
            lead.WhatsApp_Message,
            lead.Time,
            lead.Description,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        } else {
          const fieldVal = String((lead as any)[searchField] || '').toLowerCase();
          if (!fieldVal.includes(q)) return false;
        }
      }

      return true;
    });
  }, [
    leads,
    viewMode,
    followUpSubTab,
    statusFilter,
    categoryFilter,
    ownerFilter,
    dateFrom,
    dateTo,
    searchQuery,
    searchField,
  ]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    arr.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'createdAt') {
        valA = a.createdAt?.seconds || (a.Time ? new Date(a.Time).getTime() / 1000 : 0);
        valB = b.createdAt?.seconds || (b.Time ? new Date(b.Time).getTime() / 1000 : 0);
      } else if (sortField === 'Age') {
        valA = parseFloat(a.Age) || 0;
        valB = parseFloat(b.Age) || 0;
      } else {
        valA = String(a[sortField] || '').toLowerCase();
        valB = String(b[sortField] || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredLeads, sortField, sortDirection]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchField, statusFilter, categoryFilter, ownerFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  const handleSort = (field: keyof Lead | 'createdAt') => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Add Lead Submission
  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setCreatingLead(true);

    try {
      await createLead(form, currentUser);
      onToast('Lead added successfully.', 'success');
      setForm((prev) => ({
        ...prev,
        Full_Name: '',
        Phone_Number: '',
        Age: '',
        City: '',
        Follow_Up_Time: '',
        Description: '',
      }));
    } catch (err) {
      setAddError(getFriendlyErrorMessage(err));
    } finally {
      setCreatingLead(false);
    }
  };

  const handlePromptCustomOption = async (field: keyof CustomOptions, label: string) => {
    const val = window.prompt(`Enter new custom ${label}:`);
    if (!val || !val.trim()) return;
    try {
      await addCustomDropdownOption(field, val.trim(), customOptions, currentUser);
      onToast(`Added "${val.trim()}" to ${label} options`, 'success');
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  // Selection Helpers
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = sortedLeads.map((l) => l.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const selectByCriterion = (field: keyof Lead, value: string) => {
    const matching = sortedLeads.filter((l) => String(l[field] || '') === value).map((l) => l.id);
    setSelectedIds(new Set(matching));
    setShowSelectByFieldMenu(false);
    onToast(`Selected ${matching.length} leads where ${field} = ${value}`, 'info');
  };

  const selectedLeadsList = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

  // Bulk WhatsApp & Field Operations
  const handleApplyBulkMessage = async () => {
    if (selectedLeadsList.length === 0 || !bulkMessage.trim()) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeads({
        leads: selectedLeadsList,
        updates: { WhatsApp_Message: bulkMessage.trim() },
        actionLabel: 'Prepared bulk WhatsApp message template',
        user: currentUser,
      });
      onToast(
        `Applied WhatsApp message template to ${selectedLeadsList.length} lead(s).`,
        'success'
      );
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleStartWhatsAppWorkflow = async () => {
    const targetList = selectedLeadsList.length > 0 ? selectedLeadsList : sortedLeads;
    if (targetList.length === 0) {
      onToast('No leads available to start WhatsApp workflow.', 'error');
      return;
    }

    // If user typed a bulk message, apply it to leads that don't have one or apply to selected
    if (selectedLeadsList.length > 0 && bulkMessage.trim()) {
      await bulkUpdateLeads({
        leads: selectedLeadsList,
        updates: { WhatsApp_Message: bulkMessage.trim() },
        actionLabel: 'Prepared WhatsApp message for queue',
        user: currentUser,
      });
    }

    setActiveWhatsAppQueue(targetList.map((l) => l.id));
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!newStatus || selectedLeadsList.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeads({
        leads: selectedLeadsList,
        updates: { Status: newStatus },
        actionLabel: `Bulk changed Status to ${newStatus}`,
        user: currentUser,
      });
      onToast(`Updated Status to "${newStatus}" for ${selectedLeadsList.length} leads`, 'success');
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkCategoryChange = async (newCategory: string) => {
    if (!newCategory || selectedLeadsList.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeads({
        leads: selectedLeadsList,
        updates: { Lead_Category: newCategory },
        actionLabel: `Bulk changed Category to ${newCategory}`,
        user: currentUser,
      });
      onToast(
        `Updated Category to "${newCategory}" for ${selectedLeadsList.length} leads`,
        'success'
      );
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkAssignChange = async (targetUid: string) => {
    if (!targetUid || selectedLeadsList.length === 0) return;
    const foundUser = users.find((u) => u.uid === targetUid);
    if (!foundUser) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeads({
        leads: selectedLeadsList,
        updates: { assignedTo: foundUser.uid, assignedToName: foundUser.name },
        actionLabel: `Bulk assigned leads to ${foundUser.name}`,
        user: currentUser,
      });
      onToast(`Assigned ${selectedLeadsList.length} leads to ${foundUser.name}`, 'success');
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDeleteLeads = async (targets: Lead[]) => {
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      await softDeleteLeads(targets, currentUser);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
      setConfirmBulkDelete(false);
      setConfirmClearAll(false);
      onDeleteWithUndo(
        targets,
        targets.length === 1
          ? `Deleted "${targets[0].Full_Name}"`
          : `Deleted ${targets.length} leads`
      );
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = async (scope: 'all' | 'filtered', format: 'csv' | 'json' | 'xlsx') => {
    const dataset = scope === 'all' ? leads : sortedLeads;
    if (dataset.length === 0) {
      onToast('No leads to export.', 'error');
      return;
    }
    exportLeadsFile(
      dataset,
      format,
      scope === 'all' ? 'KINDL_All_Leads' : 'KINDL_Filtered_Leads'
    );
    setShowExportMenu(false);

    await logLeadActivity({
      leadId: 'EXPORT_DATA',
      leadName: `${dataset.length} Leads`,
      action: 'LEADS_EXPORTED',
      user: currentUser,
      details: `Exported ${dataset.length} (${scope}) leads as ${format.toUpperCase()} by ${
        currentUser.name
      } on ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    });

    onToast(`Exported ${dataset.length} leads to ${format.toUpperCase()}.`, 'success');
  };

  const handleQuickInlineChange = async (
    lead: Lead,
    updates: Partial<LeadFormInput>
  ) => {
    try {
      await updateLead({
        leadId: lead.id,
        updates,
        user: currentUser,
      });
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Active Sequential WhatsApp Queue Runner */}
      {activeWhatsAppQueue.length > 0 && (
        <WhatsAppQueueBar
          queueIds={activeWhatsAppQueue}
          leadsMap={leadsMap}
          currentUser={currentUser}
          onCloseQueue={() => setActiveWhatsAppQueue([])}
          onToast={onToast}
        />
      )}

      {/* Follow-Ups Mode Header Banner */}
      {viewMode === 'followups' && (
        <div className="bg-[#FFFDF9] border border-[#D95D24] rounded p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif-editorial text-xl font-bold text-[#261C15]">
              Scheduled Follow-Ups Queue
            </h1>
            <p className="text-xs text-[#6E5D50]">
              Focused view of all leads requiring follow-up calls or WhatsApp outreach.
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-mono-tech text-xs">
            <button
              type="button"
              onClick={() => setFollowUpSubTab('due')}
              className={`px-3 py-1.5 rounded cursor-pointer ${
                followUpSubTab === 'due'
                  ? 'bg-[#D95D24] text-white font-semibold'
                  : 'bg-[#F0E9DC] text-[#261C15]'
              }`}
            >
              Due Today / Overdue
            </button>
            <button
              type="button"
              onClick={() => setFollowUpSubTab('upcoming')}
              className={`px-3 py-1.5 rounded cursor-pointer ${
                followUpSubTab === 'upcoming'
                  ? 'bg-[#D95D24] text-white font-semibold'
                  : 'bg-[#F0E9DC] text-[#261C15]'
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setFollowUpSubTab('all')}
              className={`px-3 py-1.5 rounded cursor-pointer ${
                followUpSubTab === 'all'
                  ? 'bg-[#D95D24] text-white font-semibold'
                  : 'bg-[#F0E9DC] text-[#261C15]'
              }`}
            >
              All Follow-Ups
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Add Lead Panel */}
      {viewMode === 'leads' && perms.canCreateLead && (
        <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={toggleAddPanel}
            className="w-full bg-[#F0E9DC] px-4 py-2.5 border-b border-[#DED4C3] flex items-center justify-between text-left cursor-pointer hover:bg-[#EAE1D0] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#D95D24]" />
              <span className="font-mono-tech text-xs uppercase tracking-wider font-semibold text-[#261C15]">
                Add New Lead to Shared Database
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono-tech text-[11px] text-[#6E5D50]">
              <span>{addPanelOpen ? 'Collapse' : 'Expand'}</span>
              {addPanelOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {addPanelOpen && (
            <form onSubmit={handleAddLeadSubmit} className="p-4 space-y-3.5">
              {addError && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="lg:col-span-1">
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.Full_Name}
                    onChange={(e) => setForm({ ...form, Full_Name: e.target.value })}
                    placeholder="e.g., Ahmed Khan"
                    required
                    className="w-full px-2.5 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui focus:outline-none focus:border-[#D95D24]"
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    value={form.Phone_Number}
                    onChange={(e) => setForm({ ...form, Phone_Number: e.target.value })}
                    placeholder="03001234567"
                    required
                    className="w-full px-2.5 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-mono-tech focus:outline-none focus:border-[#D95D24]"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    Age
                  </label>
                  <input
                    type="text"
                    value={form.Age}
                    onChange={(e) => setForm({ ...form, Age: e.target.value })}
                    placeholder="e.g., 21"
                    className="w-full px-2.5 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-mono-tech focus:outline-none focus:border-[#D95D24]"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.City}
                    onChange={(e) => setForm({ ...form, City: e.target.value })}
                    placeholder="Lahore / Karachi"
                    className="w-full px-2.5 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui focus:outline-none focus:border-[#D95D24]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono-tech text-[10px] uppercase text-[#6E5D50]">
                      Source
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePromptCustomOption('sources', 'Source')}
                      className="font-mono-tech text-[10px] text-[#D95D24] hover:underline cursor-pointer"
                    >
                      +Custom
                    </button>
                  </div>
                  <select
                    value={form.Source}
                    onChange={(e) => setForm({ ...form, Source: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  >
                    {customOptions.sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono-tech text-[10px] uppercase text-[#6E5D50]">
                      Lead Role
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePromptCustomOption('roles', 'Lead Role')}
                      className="font-mono-tech text-[10px] text-[#D95D24] hover:underline cursor-pointer"
                    >
                      +Custom
                    </button>
                  </div>
                  <select
                    value={form.Lead_Role}
                    onChange={(e) => setForm({ ...form, Lead_Role: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  >
                    {customOptions.roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono-tech text-[10px] uppercase text-[#6E5D50]">
                      Program
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePromptCustomOption('programs', 'Program')}
                      className="font-mono-tech text-[10px] text-[#D95D24] hover:underline cursor-pointer"
                    >
                      +Custom
                    </button>
                  </div>
                  <select
                    value={form.Program}
                    onChange={(e) => setForm({ ...form, Program: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  >
                    {customOptions.programs.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono-tech text-[10px] uppercase text-[#6E5D50]">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePromptCustomOption('categories', 'Category')}
                      className="font-mono-tech text-[10px] text-[#D95D24] hover:underline cursor-pointer"
                    >
                      +Custom
                    </button>
                  </div>
                  <select
                    value={form.Lead_Category}
                    onChange={(e) => setForm({ ...form, Lead_Category: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  >
                    {customOptions.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono-tech text-[10px] uppercase text-[#6E5D50]">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePromptCustomOption('statuses', 'Status')}
                      className="font-mono-tech text-[10px] text-[#D95D24] hover:underline cursor-pointer"
                    >
                      +Custom
                    </button>
                  </div>
                  <select
                    value={form.Status}
                    onChange={(e) => setForm({ ...form, Status: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  >
                    {customOptions.statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    Follow-Up Time {form.Status === 'Follow-Up' ? '*' : ''}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.Follow_Up_Time}
                    onChange={(e) => setForm({ ...form, Follow_Up_Time: e.target.value })}
                    required={form.Status === 'Follow-Up'}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-mono-tech"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    Assigned To
                  </label>
                  <select
                    value={form.assignedTo || currentUser.uid}
                    onChange={(e) => {
                      const uid = e.target.value;
                      const found = users.find((u) => u.uid === uid);
                      setForm({
                        ...form,
                        assignedTo: uid,
                        assignedToName: found ? found.name : currentUser.name,
                      });
                    }}
                    className="w-full px-2 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  >
                    {users
                      .filter((u) => u.active)
                      .map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-[#6E5D50] mb-1">
                    WhatsApp Template (&#123;name&#125;)
                  </label>
                  <input
                    type="text"
                    value={form.WhatsApp_Message}
                    onChange={(e) => setForm({ ...form, WhatsApp_Message: e.target.value })}
                    placeholder="Assalam-o-Alaikum {name}..."
                    className="w-full px-2.5 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <input
                  type="text"
                  value={form.Description}
                  onChange={(e) => setForm({ ...form, Description: e.target.value })}
                  placeholder="Description / Notes (optional context, background, or call summary)..."
                  className="flex-1 px-2.5 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
                />

                <button
                  type="submit"
                  disabled={creatingLead}
                  className="px-5 py-2 bg-[#D95D24] hover:bg-[#B84A18] disabled:opacity-60 text-white font-mono-tech text-xs uppercase tracking-wider font-semibold rounded flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {creatingLead ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Lead
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Search, Filter, Column Controls & Import/Export Bar */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search + Field Selector */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#6E5D50] absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads by name, phone, city, notes..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#F7F3EB] border border-[#C5B69F] rounded text-xs font-sans-ui focus:outline-none focus:border-[#D95D24]"
              />
            </div>

            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as LeadFieldKey)}
              className="px-2.5 py-1.5 bg-[#F7F3EB] border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15]"
              title="Select specific field to search"
            >
              <option value="all">All Fields</option>
              <option value="Full_Name">Full Name</option>
              <option value="Phone_Number">Phone Number</option>
              <option value="Age">Age</option>
              <option value="City">City</option>
              <option value="Source">Source</option>
              <option value="Lead_Role">Lead Role</option>
              <option value="Program">Program</option>
              <option value="Lead_Category">Lead Category</option>
              <option value="Status">Status</option>
              <option value="Follow_Up_Time">Follow-Up Time</option>
              <option value="assignedToName">Assigned To</option>
              <option value="WhatsApp_Message">WhatsApp Message</option>
              <option value="Time">Time</option>
              <option value="Description">Description</option>
            </select>
          </div>

          {/* Right Toolbar Buttons: Columns, Import, Export, Clear All */}
          <div className="flex flex-wrap items-center gap-2 font-mono-tech text-xs">
            {/* Column Visibility Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnMenu((s) => !s)}
                className="px-2.5 py-1.5 bg-[#F7F3EB] hover:bg-[#F0E9DC] border border-[#C5B69F] rounded flex items-center gap-1.5 text-[#261C15] cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5 text-[#6E5D50]" />
                <span>Columns</span>
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-[#FFFDF9] border border-[#C5B69F] rounded shadow-lg p-2.5 z-40 space-y-1.5">
                  <div className="text-[10px] uppercase text-[#6E5D50] border-b border-[#F0E9DC] pb-1 mb-1">
                    Toggle Visible Columns
                  </div>
                  {columns.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-xs text-[#261C15] cursor-pointer hover:bg-[#F7F3EB] px-1 py-0.5 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumn(col.key)}
                        className="accent-[#D95D24]"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Import Button */}
            {perms.canImportLeads && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="px-2.5 py-1.5 bg-[#F7F3EB] hover:bg-[#F0E9DC] border border-[#C5B69F] rounded flex items-center gap-1.5 text-[#261C15] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#D95D24]" />
                <span>Import</span>
              </button>
            )}

            {/* Export Dropdown */}
            {perms.canExportLeads && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((s) => !s)}
                  className="px-2.5 py-1.5 bg-[#F7F3EB] hover:bg-[#F0E9DC] border border-[#C5B69F] rounded flex items-center gap-1.5 text-[#261C15] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#1E7E48]" />
                  <span>Export</span>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-[#FFFDF9] border border-[#C5B69F] rounded shadow-lg p-2 z-40 space-y-1 text-xs">
                    <div className="px-2 py-1 text-[10px] uppercase text-[#6E5D50] font-semibold">
                      Export Filtered ({sortedLeads.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExport('filtered', 'csv')}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      Filtered → CSV (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('filtered', 'xlsx')}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      Filtered → Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('filtered', 'json')}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      Filtered → JSON (.json)
                    </button>

                    <div className="border-t border-[#DED4C3] my-1 pt-1 px-2 text-[10px] uppercase text-[#6E5D50] font-semibold">
                      Export All Leads ({leads.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExport('all', 'csv')}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      All Leads → CSV (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('all', 'xlsx')}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      All Leads → Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('all', 'json')}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      All Leads → JSON (.json)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Clear All (Admin Only) */}
            {perms.canClearAllLeads && leads.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 rounded flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Bar: Status, Category, Owner, Date Range */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F0E9DC] font-mono-tech text-xs">
          <div className="flex items-center gap-1 text-[#6E5D50]">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 bg-[#F7F3EB] border border-[#C5B69F] rounded"
          >
            <option value="ALL">Status: All</option>
            {customOptions.statuses.map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1 bg-[#F7F3EB] border border-[#C5B69F] rounded"
          >
            <option value="ALL">Category: All</option>
            {customOptions.categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-2 py-1 bg-[#F7F3EB] border border-[#C5B69F] rounded"
          >
            <option value="ALL">Owner: All Team</option>
            <option value={currentUser.uid}>Assigned to Me ({currentUser.name})</option>
            <option value="UNASSIGNED">Unassigned</option>
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                Owner: {u.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 ml-auto">
            <Calendar className="w-3.5 h-3.5 text-[#6E5D50]" />
            <span className="text-[11px] text-[#6E5D50]">Date Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-0.5 bg-[#F7F3EB] border border-[#C5B69F] rounded text-[11px]"
              title="From Date"
            />
            <span className="text-[#6E5D50]">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-0.5 bg-[#F7F3EB] border border-[#C5B69F] rounded text-[11px]"
              title="To Date"
            />
            {(searchQuery ||
              statusFilter !== 'ALL' ||
              categoryFilter !== 'ALL' ||
              ownerFilter !== 'ALL' ||
              dateFrom ||
              dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setOwnerFilter('ALL');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2 py-0.5 text-[#D95D24] hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Selection & WhatsApp Outreach Preparation Bar */}
      <div className="bg-[#F0E9DC] border border-[#C5B69F] rounded p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Selection Controls */}
          <div className="flex flex-wrap items-center gap-2 font-mono-tech text-xs">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="px-2.5 py-1 bg-[#FFFDF9] hover:bg-[#F7F3EB] border border-[#C5B69F] rounded flex items-center gap-1.5 text-[#261C15] cursor-pointer"
            >
              {sortedLeads.length > 0 &&
              sortedLeads.every((l) => selectedIds.has(l.id)) ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#D95D24]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-[#6E5D50]" />
              )}
              <span>Select All Visible ({sortedLeads.length})</span>
            </button>

            {/* Select by Field Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSelectByFieldMenu((s) => !s)}
                className="px-2.5 py-1 bg-[#FFFDF9] hover:bg-[#F7F3EB] border border-[#C5B69F] rounded flex items-center gap-1 text-[#261C15] cursor-pointer"
              >
                <span>Select by Field ▾</span>
              </button>
              {showSelectByFieldMenu && (
                <div className="absolute left-0 mt-1 w-60 bg-[#FFFDF9] border border-[#C5B69F] rounded shadow-lg p-2 z-40 space-y-1 text-xs max-h-72 overflow-y-auto">
                  <div className="px-2 py-0.5 text-[10px] uppercase text-[#6E5D50] font-semibold">
                    By Status
                  </div>
                  {customOptions.statuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => selectByCriterion('Status', s)}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      Select Status = {s}
                    </button>
                  ))}
                  <div className="border-t border-[#DED4C3] my-1 pt-1 px-2 text-[10px] uppercase text-[#6E5D50] font-semibold">
                    By Category
                  </div>
                  {customOptions.categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => selectByCriterion('Lead_Category', c)}
                      className="w-full text-left px-2 py-1 hover:bg-[#F0E9DC] rounded cursor-pointer"
                    >
                      Select Category = {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedIds.size > 0 && (
              <>
                <span className="px-2 py-0.5 bg-[#D95D24] text-white rounded font-semibold">
                  {selectedIds.size} Selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[#6E5D50] hover:text-[#261C15] underline cursor-pointer"
                >
                  Clear Selection
                </button>
              </>
            )}
          </div>

          {/* Bulk Field Mutators when leads are selected */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 font-mono-tech text-xs">
              <select
                defaultValue=""
                disabled={bulkBusy}
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusChange(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="px-2 py-1 bg-[#FFFDF9] border border-[#C5B69F] rounded"
              >
                <option value="">Bulk Status...</option>
                {customOptions.statuses.map((s) => (
                  <option key={s} value={s}>
                    Set Status → {s}
                  </option>
                ))}
              </select>

              <select
                defaultValue=""
                disabled={bulkBusy}
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkCategoryChange(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="px-2 py-1 bg-[#FFFDF9] border border-[#C5B69F] rounded"
              >
                <option value="">Bulk Category...</option>
                {customOptions.categories.map((c) => (
                  <option key={c} value={c}>
                    Set Category → {c}
                  </option>
                ))}
              </select>

              {perms.canAssignAnyLead && (
                <select
                  defaultValue=""
                  disabled={bulkBusy}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAssignChange(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-2 py-1 bg-[#FFFDF9] border border-[#C5B69F] rounded"
                >
                  <option value="">Assign Selected To...</option>
                  {users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.uid} value={u.uid}>
                        Assign → {u.name}
                      </option>
                    ))}
                </select>
              )}

              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setConfirmBulkDelete(true)}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 rounded flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.size})
              </button>
            </div>
          )}
        </div>

        {/* WhatsApp Bulk Personalization & Sequential Runner Launcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 pt-2 border-t border-[#DED4C3]">
          <div className="flex items-center gap-1.5 font-mono-tech text-xs text-[#1E7E48] font-semibold shrink-0">
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp Workflow:</span>
          </div>

          <div className="flex-1 flex items-center gap-1.5">
            <input
              type="text"
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Write WhatsApp message template... Use {name} to personalize with Lead's Full Name"
              className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs font-sans-ui"
            />
            <button
              type="button"
              onClick={() => setBulkMessage((m) => `${m} {name}`)}
              className="px-2 py-1.5 bg-[#FFFDF9] hover:bg-[#F7F3EB] border border-[#C5B69F] rounded font-mono-tech text-[11px] text-[#D95D24] shrink-0 cursor-pointer"
              title="Insert {name} placeholder"
            >
              +&#123;name&#125;
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={selectedIds.size === 0 || bulkBusy}
              onClick={handleApplyBulkMessage}
              className="px-3 py-1.5 bg-[#FFFDF9] hover:bg-[#F7F3EB] disabled:opacity-50 border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
            >
              Apply Message to Selected ({selectedIds.size})
            </button>

            <button
              type="button"
              disabled={sortedLeads.length === 0 || bulkBusy}
              onClick={handleStartWhatsAppWorkflow}
              className="px-3.5 py-1.5 bg-[#1E7E48] hover:bg-[#166338] disabled:opacity-50 text-white font-mono-tech text-xs uppercase font-semibold rounded flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>
                Send Message Workflow (
                {selectedIds.size > 0 ? `${selectedIds.size} Selected` : `${sortedLeads.length} Visible`}
                )
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KINDL Compact Leads Data Table */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F0E9DC] font-mono-tech text-[11px] uppercase text-[#6E5D50] border-b border-[#C5B69F]">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      sortedLeads.length > 0 &&
                      sortedLeads.every((l) => selectedIds.has(l.id))
                    }
                    onChange={toggleSelectAllVisible}
                    className="accent-[#D95D24] cursor-pointer"
                  />
                </th>
                {columns
                  .filter((c) => c.visible)
                  .map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="py-2.5 px-3 cursor-pointer hover:text-[#261C15] whitespace-nowrap select-none"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{col.label}</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                  ))}
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F0E9DC] font-sans-ui">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.filter((c) => c.visible).length + 2}
                    className="py-12 text-center font-mono-tech text-xs text-[#6E5D50]"
                  >
                    No leads match your current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  const activeHandler =
                    lead.activeWorkflowBy && lead.activeWorkflowBy !== currentUser.uid
                      ? lead.activeWorkflowByName || 'Teammate'
                      : null;

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-[#F7F3EB] transition-colors ${
                        isSelected ? 'bg-orange-50/70' : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(lead.id)}
                          className="accent-[#D95D24] cursor-pointer"
                        />
                      </td>

                      {columns
                        .filter((c) => c.visible)
                        .map((col) => {
                          if (col.key === 'Full_Name') {
                            return (
                              <td
                                key={col.key}
                                className="py-2 px-3 font-serif-editorial font-semibold text-sm text-[#261C15] whitespace-nowrap"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>{lead.Full_Name}</span>
                                  {lead.activeWorkflowBy && (
                                    <span
                                      className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-amber-100 border border-amber-400 text-amber-950 rounded flex items-center gap-1"
                                      title={`WhatsApp workflow active by ${
                                        lead.activeWorkflowByName || 'team member'
                                      }`}
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-[#D95D24]" />
                                      {activeHandler
                                        ? `Handled by ${activeHandler}`
                                        : 'In Queue'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'Phone_Number') {
                            return (
                              <td
                                key={col.key}
                                className="py-2 px-3 font-mono-tech text-xs text-[#261C15] whitespace-nowrap"
                              >
                                {lead.Phone_Number}
                              </td>
                            );
                          }

                          if (col.key === 'Lead_Category') {
                            const cat = lead.Lead_Category || 'Warm';
                            const badgeStyle =
                              cat.toLowerCase() === 'hot'
                                ? 'bg-red-100 border-red-300 text-red-900'
                                : cat.toLowerCase() === 'warm'
                                ? 'bg-amber-100 border-amber-300 text-amber-900'
                                : cat.toLowerCase() === 'cold'
                                ? 'bg-sky-100 border-sky-300 text-sky-900'
                                : 'bg-[#F0E9DC] border-[#C5B69F] text-[#261C15]';

                            return (
                              <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                                <select
                                  value={cat}
                                  onChange={(e) =>
                                    handleQuickInlineChange(lead, {
                                      Lead_Category: e.target.value,
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded border font-mono-tech text-[11px] font-medium cursor-pointer ${badgeStyle}`}
                                >
                                  {customOptions.categories.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }

                          if (col.key === 'Status') {
                            const st = lead.Status || 'New';
                            const stStyle =
                              st === 'Convert'
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                : st === 'Follow-Up'
                                ? 'bg-orange-100 border-[#D95D24] text-[#B84A18]'
                                : st === 'Lost'
                                ? 'bg-stone-200 border-stone-300 text-stone-700'
                                : 'bg-[#F0E9DC] border-[#C5B69F] text-[#261C15]';

                            return (
                              <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                                <select
                                  value={st}
                                  onChange={(e) => {
                                    const nextSt = e.target.value;
                                    if (nextSt === 'Follow-Up' && !lead.Follow_Up_Time) {
                                      onOpenEditModal(lead.id);
                                      onToast(
                                        'Please select a Follow-Up date/time for this lead.',
                                        'info'
                                      );
                                      return;
                                    }
                                    handleQuickInlineChange(lead, { Status: nextSt });
                                  }}
                                  className={`px-2 py-0.5 rounded border font-mono-tech text-[11px] font-medium cursor-pointer ${stStyle}`}
                                >
                                  {customOptions.statuses.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }

                          if (col.key === 'assignedToName') {
                            return (
                              <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                                {perms.canAssignAnyLead ? (
                                  <select
                                    value={lead.assignedTo || ''}
                                    onChange={(e) => {
                                      const uid = e.target.value;
                                      const found = users.find((u) => u.uid === uid);
                                      handleQuickInlineChange(lead, {
                                        assignedTo: uid,
                                        assignedToName: found ? found.name : '',
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-[#F7F3EB] border border-[#C5B69F] rounded font-mono-tech text-[11px] text-[#261C15]"
                                  >
                                    <option value="">Unassigned</option>
                                    {users
                                      .filter((u) => u.active)
                                      .map((u) => (
                                        <option key={u.uid} value={u.uid}>
                                          {u.name}
                                        </option>
                                      ))}
                                  </select>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-mono-tech text-[11px] text-[#261C15]">
                                    <UserCheck className="w-3 h-3 text-[#6E5D50]" />
                                    {lead.assignedToName || 'Unassigned'}
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (col.key === 'Follow_Up_Time') {
                            return (
                              <td
                                key={col.key}
                                className="py-2 px-3 font-mono-tech text-[11px] text-[#261C15] whitespace-nowrap"
                              >
                                {lead.Follow_Up_Time ? (
                                  <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-200 rounded text-[#B84A18]">
                                    {lead.Follow_Up_Time.replace('T', ' ')}
                                  </span>
                                ) : (
                                  <span className="text-[#6E5D50]">—</span>
                                )}
                              </td>
                            );
                          }

                          if (col.key === 'WhatsApp_Message' || col.key === 'Description') {
                            const textVal = String(lead[col.key] || '');
                            return (
                              <td
                                key={col.key}
                                className="py-2 px-3 max-w-[200px] truncate text-[#6E5D50]"
                                title={textVal}
                              >
                                {textVal || '—'}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={col.key}
                              className="py-2 px-3 whitespace-nowrap text-[#261C15]"
                            >
                              {String(lead[col.key] || '—')}
                            </td>
                          );
                        })}

                      {/* Row Actions: WhatsApp Link, Edit & Audit History, Delete */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={buildWhatsAppUrl(
                              lead.phoneNormalized || lead.Phone_Number,
                              lead.WhatsApp_Message || bulkMessage,
                              lead.Full_Name
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              logLeadActivity({
                                leadId: lead.id,
                                leadName: lead.Full_Name,
                                action: 'WHATSAPP_LINK_OPENED',
                                user: currentUser,
                                details: `Opened manual WhatsApp chat for ${lead.Full_Name} (${lead.Phone_Number})`,
                              });
                            }}
                            className="px-2 py-1 rounded bg-[#1E7E48] hover:bg-[#166338] text-white font-mono-tech text-[11px] inline-flex items-center gap-1"
                            title="Open in WhatsApp with personalized {name} message"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>WA</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => onOpenEditModal(lead.id)}
                            className="p-1.5 rounded bg-[#F0E9DC] hover:bg-[#DED4C3] text-[#261C15] cursor-pointer"
                            title="Edit Lead & View Activity History"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {perms.canDeleteLead && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLeads([lead])}
                              className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-800 cursor-pointer"
                              title="Delete Lead (with Undo)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <div className="bg-[#F0E9DC] px-4 py-2.5 border-t border-[#C5B69F] flex flex-wrap items-center justify-between gap-3 font-mono-tech text-xs text-[#6E5D50]">
          <div>
            Showing{' '}
            <strong className="text-[#261C15]">
              {sortedLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            –{' '}
            <strong className="text-[#261C15]">
              {Math.min(currentPage * pageSize, sortedLeads.length)}
            </strong>{' '}
            of <strong className="text-[#261C15]">{sortedLeads.length}</strong> filtered leads (
            {leads.length} total in cloud database)
          </div>

          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-0.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-xs text-[#261C15]"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-[#FFFDF9] border border-[#C5B69F] rounded disabled:opacity-40 text-[#261C15] cursor-pointer"
            >
              ← Prev
            </button>
            <span className="text-[#261C15]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-[#FFFDF9] border border-[#C5B69F] rounded disabled:opacity-40 text-[#261C15] cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Bulk Delete */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded-md max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" />
              <div>
                <h3 className="font-serif-editorial text-lg font-bold text-[#261C15]">
                  Delete {selectedLeadsList.length} Selected Leads?
                </h3>
                <p className="text-xs text-[#6E5D50] mt-1">
                  These leads will be moved to the Deleted Leads area and can be restored via Undo
                  or by an Admin/Manager.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="px-3.5 py-1.5 border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleDeleteLeads(selectedLeadsList)}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-mono-tech text-xs uppercase font-semibold rounded cursor-pointer"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clear All */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded-md max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" />
              <div>
                <h3 className="font-serif-editorial text-lg font-bold text-[#261C15]">
                  Clear All {leads.length} Active Leads?
                </h3>
                <p className="text-xs text-[#6E5D50] mt-1">
                  This will move all {leads.length} active leads into the Deleted Leads recovery
                  area. You can Undo immediately or restore them from the Deleted tab.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="px-3.5 py-1.5 border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => handleDeleteLeads(leads)}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-mono-tech text-xs uppercase font-semibold rounded cursor-pointer"
              >
                Confirm Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
