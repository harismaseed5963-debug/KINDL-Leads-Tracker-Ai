import React, { useEffect, useState } from 'react';
import {
  X,
  Save,
  AlertTriangle,
  History,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { CustomOptions, Lead, LeadActivity, LeadFormInput, UserProfile } from '../types';
import { updateLead } from '../services/leadsService';
import { subscribeToActivities } from '../services/activityService';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';
import { formatTimestamp, getRolePermissions } from '../utils/permissions';
import { buildWhatsAppUrl } from '../utils/whatsapp';

interface LeadEditModalProps {
  leadId: string;
  leadsMap: Map<string, Lead>;
  users: UserProfile[];
  currentUser: UserProfile;
  customOptions: CustomOptions;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const LeadEditModal: React.FC<LeadEditModalProps> = ({
  leadId,
  leadsMap,
  users,
  currentUser,
  customOptions,
  onClose,
  onSaved,
}) => {
  const liveLead = leadsMap.get(leadId);
  const perms = getRolePermissions(currentUser.role);

  const [initialVersion, setInitialVersion] = useState<number>(liveLead?.version || 1);
  const [form, setForm] = useState<LeadFormInput>(() => ({
    Full_Name: liveLead?.Full_Name || '',
    Phone_Number: liveLead?.Phone_Number || '',
    Age: liveLead?.Age || '',
    City: liveLead?.City || '',
    Source: liveLead?.Source || 'WhatsApp',
    Lead_Role: liveLead?.Lead_Role || 'Student',
    Program: liveLead?.Program || 'General',
    Lead_Category: liveLead?.Lead_Category || 'Warm',
    Status: liveLead?.Status || 'New',
    Follow_Up_Time: liveLead?.Follow_Up_Time || '',
    WhatsApp_Message: liveLead?.WhatsApp_Message || '',
    Time: liveLead?.Time || '',
    Description: liveLead?.Description || '',
    assignedTo: liveLead?.assignedTo || '',
    assignedToName: liveLead?.assignedToName || '',
  }));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictEditor, setConflictEditor] = useState<string | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);

  // Detect live concurrent edits while modal is open
  const hasRemoteUpdate =
    liveLead &&
    liveLead.version > initialVersion &&
    liveLead.updatedBy !== currentUser.uid;

  useEffect(() => {
    const unsub = subscribeToActivities(30, setActivities, undefined, leadId);
    return () => unsub();
  }, [leadId]);

  if (!liveLead) return null;

  const handleReloadLatest = () => {
    setForm({
      Full_Name: liveLead.Full_Name || '',
      Phone_Number: liveLead.Phone_Number || '',
      Age: liveLead.Age || '',
      City: liveLead.City || '',
      Source: liveLead.Source || '',
      Lead_Role: liveLead.Lead_Role || '',
      Program: liveLead.Program || '',
      Lead_Category: liveLead.Lead_Category || 'Warm',
      Status: liveLead.Status || 'New',
      Follow_Up_Time: liveLead.Follow_Up_Time || '',
      WhatsApp_Message: liveLead.WhatsApp_Message || '',
      Time: liveLead.Time || '',
      Description: liveLead.Description || '',
      assignedTo: liveLead.assignedTo || '',
      assignedToName: liveLead.assignedToName || '',
    });
    setInitialVersion(liveLead.version || 1);
    setConflictEditor(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent, forceOverwrite = false) => {
    e.preventDefault();
    setError(null);

    if (hasRemoteUpdate && !forceOverwrite) {
      setConflictEditor(liveLead.updatedByName || 'another team member');
      return;
    }

    setSaving(true);
    try {
      await updateLead({
        leadId,
        updates: form,
        expectedVersion: initialVersion,
        forceOverwrite,
        user: currentUser,
      });
      onSaved(`Updated lead "${form.Full_Name}"`);
      onClose();
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      if (msg.startsWith('CONCURRENCY_CONFLICT:')) {
        const editor = msg.split(':')[1] || 'another user';
        setConflictEditor(editor);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded-md max-w-5xl w-full shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#F0E9DC] px-5 py-3.5 border-b border-[#DED4C3] flex items-center justify-between">
          <div>
            <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#D95D24] font-semibold">
              Edit Lead & Audit History • Version #{liveLead.version || 1}
            </span>
            <h2 className="font-serif-editorial text-xl font-bold text-[#261C15]">
              {liveLead.Full_Name} ({liveLead.Phone_Number})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#DED4C3]/60 text-[#6E5D50] hover:text-[#261C15] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Concurrent Edit Conflict Banner */}
        {(hasRemoteUpdate || conflictEditor) && (
          <div className="bg-amber-50 border-b border-amber-300 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  This lead was updated by{' '}
                  {conflictEditor || liveLead.updatedByName || 'another user'} while you were
                  editing it.
                </p>
                <p className="text-[11px] text-amber-800">
                  Review the latest version before saving to avoid overwriting your teammate&apos;s
                  changes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReloadLatest}
                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-mono-tech text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Load Latest Version
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="px-3 py-1.5 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-xs font-semibold rounded cursor-pointer"
              >
                Overwrite & Save Mine
              </button>
            </div>
          </div>
        )}

        {/* Body Grid: Form Left (7 cols) + Lead History Right (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1 divide-y lg:divide-y-0 lg:divide-x divide-[#DED4C3]">
          {/* Edit Form */}
          <form onSubmit={(e) => handleSubmit(e, false)} className="lg:col-span-7 p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-300 rounded text-xs text-red-900">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.Full_Name}
                  onChange={(e) => setForm({ ...form, Full_Name: e.target.value })}
                  required
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  value={form.Phone_Number}
                  onChange={(e) => setForm({ ...form, Phone_Number: e.target.value })}
                  required
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Status
                </label>
                <select
                  value={form.Status}
                  onChange={(e) => setForm({ ...form, Status: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                >
                  {customOptions.statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Lead Category
                </label>
                <select
                  value={form.Lead_Category}
                  onChange={(e) => setForm({ ...form, Lead_Category: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                >
                  {customOptions.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Follow-Up Time {form.Status === 'Follow-Up' ? '*' : ''}
                </label>
                <input
                  type="datetime-local"
                  value={form.Follow_Up_Time ? form.Follow_Up_Time.replace(' ', 'T').slice(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, Follow_Up_Time: e.target.value })}
                  required={form.Status === 'Follow-Up'}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Assigned To (Owner)
                </label>
                <select
                  value={form.assignedTo || ''}
                  disabled={!perms.canAssignAnyLead && Boolean(form.assignedTo && form.assignedTo !== currentUser.uid)}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const found = users.find((u) => u.uid === uid);
                    setForm({
                      ...form,
                      assignedTo: uid,
                      assignedToName: found ? found.name : '',
                    });
                  }}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Age
                </label>
                <input
                  type="text"
                  value={form.Age}
                  onChange={(e) => setForm({ ...form, Age: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.City}
                  onChange={(e) => setForm({ ...form, City: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Source
                </label>
                <select
                  value={form.Source}
                  onChange={(e) => setForm({ ...form, Source: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                >
                  {customOptions.sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Lead Role
                </label>
                <select
                  value={form.Lead_Role}
                  onChange={(e) => setForm({ ...form, Lead_Role: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                >
                  {customOptions.roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Program
                </label>
                <select
                  value={form.Program}
                  onChange={(e) => setForm({ ...form, Program: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                >
                  {customOptions.programs.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono-tech text-[11px] uppercase text-[#6E5D50]">
                  WhatsApp Message Template (Use &#123;name&#125; for personalization)
                </label>
                <a
                  href={buildWhatsAppUrl(
                    form.Phone_Number,
                    form.WhatsApp_Message,
                    form.Full_Name
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-tech text-[11px] text-[#1E7E48] hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Test in WhatsApp
                </a>
              </div>
              <textarea
                rows={2}
                value={form.WhatsApp_Message}
                onChange={(e) => setForm({ ...form, WhatsApp_Message: e.target.value })}
                placeholder="Assalam-o-Alaikum {name}, ..."
                className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                Description / Notes
              </label>
              <textarea
                rows={3}
                value={form.Description}
                onChange={(e) => setForm({ ...form, Description: e.target.value })}
                placeholder="Add call notes, qualification details, or next steps..."
                className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#DED4C3]">
              <div className="text-[11px] font-mono-tech text-[#6E5D50]">
                Created by {liveLead.createdByName || 'Team'} • Last updated by{' '}
                {liveLead.updatedByName || 'Team'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] hover:bg-[#F0E9DC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#D95D24] hover:bg-[#B84A18] disabled:opacity-60 text-white font-mono-tech text-xs uppercase font-semibold rounded flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Right Column: Per-Lead Audit Trail */}
          <div className="lg:col-span-5 bg-[#F7F3EB] p-5 flex flex-col">
            <div className="flex items-center gap-2 pb-3 border-b border-[#DED4C3]">
              <History className="w-4 h-4 text-[#D95D24]" />
              <h3 className="font-mono-tech text-xs uppercase tracking-wider font-semibold text-[#261C15]">
                Lead Activity & Audit History
              </h3>
            </div>

            <div className="mt-3 space-y-3 overflow-y-auto max-h-[460px] pr-1">
              {activities.length === 0 ? (
                <p className="text-xs font-mono-tech text-[#6E5D50] py-8 text-center">
                  No activity recorded for this lead yet.
                </p>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded bg-[#FFFDF9] border border-[#DED4C3] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono-tech text-[11px] text-[#6E5D50]">
                      <span className="font-semibold text-[#261C15]">{act.performedByName}</span>
                      <span>{formatTimestamp(act.timestamp)}</span>
                    </div>
                    <p className="font-sans-ui text-[#261C15] leading-snug">{act.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
