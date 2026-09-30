import React, { useState } from 'react';
import { RotateCcw, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Lead, UserProfile } from '../types';
import { permanentlyDeleteLead, restoreDeletedLeads } from '../services/leadsService';
import { formatTimestamp, getRolePermissions } from '../utils/permissions';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';

interface TrashViewProps {
  deletedLeads: Lead[];
  currentUser: UserProfile;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  deletedLeads,
  currentUser,
  onToast,
}) => {
  const perms = getRolePermissions(currentUser.role);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPurgeLead, setConfirmPurgeLead] = useState<Lead | null>(null);

  const handleRestore = async (leadsToRestore: Lead[]) => {
    if (leadsToRestore.length === 0) return;
    setBusyId(leadsToRestore.length === 1 ? leadsToRestore[0].id : 'BULK');
    try {
      await restoreDeletedLeads(leadsToRestore, currentUser);
      onToast(
        `Restored ${
          leadsToRestore.length === 1
            ? `"${leadsToRestore[0].Full_Name}"`
            : `${leadsToRestore.length} leads`
        }`,
        'success'
      );
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      await permanentlyDeleteLead(lead, currentUser);
      onToast(`Permanently deleted "${lead.Full_Name}"`, 'info');
      setConfirmPurgeLead(null);
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED4C3] pb-4">
        <div>
          <h1 className="font-serif-editorial text-2xl font-bold text-[#261C15]">
            Deleted Leads Recovery Area
          </h1>
          <p className="text-sm text-[#6E5D50]">
            Soft-deleted leads are safely retained here so authorized Admins and Managers can
            restore accidental deletions.
          </p>
        </div>

        {deletedLeads.length > 0 && (
          <button
            type="button"
            disabled={busyId === 'BULK'}
            onClick={() => handleRestore(deletedLeads)}
            className="self-start sm:self-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-mono-tech text-xs uppercase font-semibold rounded flex items-center gap-1.5 cursor-pointer"
          >
            {busyId === 'BULK' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            Restore All ({deletedLeads.length})
          </button>
        )}
      </div>

      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded overflow-x-auto">
        {deletedLeads.length === 0 ? (
          <div className="py-12 text-center font-mono-tech text-xs text-[#6E5D50]">
            No deleted leads in the recovery area.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F0E9DC] font-mono-tech text-[11px] uppercase text-[#6E5D50]">
              <tr>
                <th className="py-2.5 px-4 border-b border-[#DED4C3]">Full Name</th>
                <th className="py-2.5 px-4 border-b border-[#DED4C3]">Phone</th>
                <th className="py-2.5 px-4 border-b border-[#DED4C3]">Status / Category</th>
                <th className="py-2.5 px-4 border-b border-[#DED4C3]">Deleted By</th>
                <th className="py-2.5 px-4 border-b border-[#DED4C3]">Deleted At</th>
                <th className="py-2.5 px-4 border-b border-[#DED4C3] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E9DC] font-sans-ui">
              {deletedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F7F3EB]/60">
                  <td className="py-2.5 px-4 font-medium text-[#261C15]">{lead.Full_Name}</td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#261C15]">{lead.Phone_Number}</td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#6E5D50]">
                    {lead.Status} • {lead.Lead_Category}
                  </td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#6E5D50]">
                    {lead.deletedByName || 'Team Member'}
                  </td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#6E5D50]">
                    {formatTimestamp(lead.deletedAt)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() => handleRestore([lead])}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-mono-tech text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>

                      {perms.canPurgeLeads && (
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() => setConfirmPurgeLead(lead)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 rounded font-mono-tech text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Purge Permanently
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Dialog for Permanent Purge */}
      {confirmPurgeLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded-md max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" />
              <div>
                <h3 className="font-serif-editorial text-lg font-bold text-[#261C15]">
                  Permanently Delete Lead?
                </h3>
                <p className="text-xs text-[#6E5D50] mt-1">
                  This will permanently remove{' '}
                  <strong className="text-[#261C15]">{confirmPurgeLead.Full_Name}</strong> (
                  {confirmPurgeLead.Phone_Number}) from Firestore. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPurgeLead(null)}
                className="px-3.5 py-1.5 border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePermanentDelete(confirmPurgeLead)}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-mono-tech text-xs uppercase font-semibold rounded cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
