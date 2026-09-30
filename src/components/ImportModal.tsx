import React, { useEffect, useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  DatabaseBackup,
  Download,
} from 'lucide-react';
import { ImportRowResult, Lead, UserProfile } from '../types';
import { parseImportFile, validateImportRows, exportLeadsFile } from '../utils/importExport';
import { batchImportValidatedLeads } from '../services/leadsService';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';

interface ImportModalProps {
  existingLeads: Lead[];
  currentUser: UserProfile;
  initialMode?: 'file' | 'migration';
  onClose: () => void;
  onImportComplete: (summary: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  existingLeads,
  currentUser,
  initialMode = 'file',
  onClose,
  onImportComplete,
}) => {
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [rows, setRows] = useState<ImportRowResult[]>([]);
  const [previewTab, setPreviewTab] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [completedReport, setCompletedReport] = useState<{
    imported: number;
    duplicates: number;
    invalid: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingPhoneMap = React.useMemo(() => {
    const map = new Map<string, string>();
    existingLeads.forEach((l) => {
      if (!l.deleted && l.phoneNormalized) {
        map.set(l.phoneNormalized, l.Full_Name);
      }
    });
    return map;
  }, [existingLeads]);

  // If opened in migration mode, automatically read localStorage `leads_tracker_v1`
  useEffect(() => {
    if (initialMode === 'migration') {
      loadFromLocalStorage();
    }
  }, [initialMode]);

  const loadFromLocalStorage = () => {
    setError(null);
    try {
      const rawStr = localStorage.getItem('leads_tracker_v1');
      if (!rawStr) {
        setError('No local data found under localStorage key "leads_tracker_v1".');
        return;
      }
      const parsed = JSON.parse(rawStr);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed.leads)
        ? parsed.leads
        : [];
      if (rawArray.length === 0) {
        setError('Local storage key "leads_tracker_v1" is empty.');
        return;
      }
      const validated = validateImportRows(rawArray, existingPhoneMap);
      setRows(validated);
      setSourceLabel('Browser Migration (leads_tracker_v1)');
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCompletedReport(null);
    setParsing(true);
    try {
      const rawRows = await parseImportFile(file);
      const validated = validateImportRows(rawRows, existingPhoneMap);
      setRows(validated);
      setSourceLabel(file.name);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setParsing(false);
    }
  };

  const validRows = rows.filter((r) => r.status === 'valid');
  const duplicateRows = rows.filter((r) => r.status === 'duplicate');
  const invalidRows = rows.filter((r) => r.status === 'invalid');

  const filteredPreview = rows.filter((r) => {
    if (previewTab === 'all') return true;
    return r.status === previewTab;
  });

  const handleCommitImport = async () => {
    if (validRows.length === 0 || importing) return;
    setError(null);
    setImporting(true);
    setProgress({ current: 0, total: validRows.length });

    try {
      const importedCount = await batchImportValidatedLeads({
        validRows,
        user: currentUser,
        sourceLabel: sourceLabel || 'File Import',
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
      });

      setCompletedReport({
        imported: importedCount,
        duplicates: duplicateRows.length,
        invalid: invalidRows.length,
      });

      onImportComplete(
        `Imported: ${importedCount} • Duplicates: ${duplicateRows.length} • Invalid: ${invalidRows.length}`
      );
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const handleBackupLocalToJson = () => {
    const rawStr = localStorage.getItem('leads_tracker_v1');
    if (!rawStr) return;
    const blob = new Blob([rawStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KINDL_local_backup_leads_tracker_v1_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded-md max-w-4xl w-full shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#F0E9DC] px-5 py-3.5 border-b border-[#DED4C3] flex items-center justify-between">
          <div>
            <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#D95D24] font-semibold">
              Multi-User Batch Import & Data Migration
            </span>
            <h2 className="font-serif-editorial text-xl font-bold text-[#261C15]">
              {initialMode === 'migration'
                ? 'Migrate Local KINDL Leads (leads_tracker_v1) to Cloud Firestore'
                : 'Import Leads (CSV, JSON, or Excel)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="p-1.5 rounded hover:bg-[#DED4C3]/60 text-[#6E5D50] hover:text-[#261C15] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-300 rounded text-xs text-red-900">
              {error}
            </div>
          )}

          {/* Completion Summary Screen */}
          {completedReport ? (
            <div className="p-6 bg-emerald-50/70 border border-emerald-300 rounded text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
              <div>
                <h3 className="font-serif-editorial text-2xl font-bold text-[#261C15]">
                  Import Completed Successfully
                </h3>
                <p className="text-xs font-mono-tech text-[#6E5D50] mt-1">
                  All valid leads are now live in the shared Firestore database and recorded in
                  Activity History.
                </p>
              </div>
              <div className="max-w-md mx-auto grid grid-cols-3 gap-3 font-mono-tech">
                <div className="p-3 bg-[#FFFDF9] border border-emerald-300 rounded">
                  <div className="text-[11px] text-[#6E5D50] uppercase">Imported</div>
                  <div className="text-2xl font-bold text-emerald-800">
                    {completedReport.imported}
                  </div>
                </div>
                <div className="p-3 bg-[#FFFDF9] border border-amber-300 rounded">
                  <div className="text-[11px] text-[#6E5D50] uppercase">Duplicates</div>
                  <div className="text-2xl font-bold text-amber-800">
                    {completedReport.duplicates}
                  </div>
                </div>
                <div className="p-3 bg-[#FFFDF9] border border-red-300 rounded">
                  <div className="text-[11px] text-[#6E5D50] uppercase">Invalid</div>
                  <div className="text-2xl font-bold text-red-800">{completedReport.invalid}</div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-xs uppercase font-semibold rounded cursor-pointer"
                >
                  Return to Workspace
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload / Migration Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="p-4 border-2 border-dashed border-[#C5B69F] hover:border-[#D95D24] rounded bg-[#F7F3EB]/60 flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-[#D95D24] mb-1.5" />
                  <span className="font-mono-tech text-xs font-semibold text-[#261C15]">
                    Select CSV, JSON, or Excel (.xlsx / .xls) File
                  </span>
                  <span className="text-[11px] text-[#6E5D50] mt-0.5">
                    Automatically normalizes Pakistani phone numbers & checks duplicates
                  </span>
                  <input
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={importing || parsing}
                    className="hidden"
                  />
                </label>

                <div className="p-4 border border-[#C5B69F] rounded bg-[#F7F3EB]/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-mono-tech text-xs font-semibold text-[#261C15]">
                      <DatabaseBackup className="w-4 h-4 text-[#D95D24]" />
                      <span>Legacy LocalStorage Migration (`leads_tracker_v1`)</span>
                    </div>
                    <p className="text-[11px] text-[#6E5D50] mt-1">
                      Safely preview and migrate existing single-user browser leads without
                      destroying your local backup.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={loadFromLocalStorage}
                      disabled={importing}
                      className="px-3 py-1.5 bg-[#261C15] hover:bg-[#3d2e23] text-[#FFFDF9] font-mono-tech text-[11px] rounded cursor-pointer"
                    >
                      Scan `leads_tracker_v1`
                    </button>
                    <button
                      type="button"
                      onClick={handleBackupLocalToJson}
                      className="px-3 py-1.5 bg-[#FFFDF9] hover:bg-[#F0E9DC] border border-[#C5B69F] text-[#261C15] font-mono-tech text-[11px] rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      Export Local Backup
                    </button>
                  </div>
                </div>
              </div>

              {parsing && (
                <div className="py-8 text-center font-mono-tech text-xs text-[#6E5D50] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D95D24]" />
                  Parsing and validating rows...
                </div>
              )}

              {/* Progress Bar during Batched Firestore Commit */}
              {importing && progress && (
                <div className="p-4 bg-[#F0E9DC] border border-[#D95D24] rounded space-y-2">
                  <div className="flex items-center justify-between font-mono-tech text-xs font-semibold text-[#261C15]">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D95D24]" />
                      Importing...
                    </span>
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#FFFDF9] rounded-full overflow-hidden border border-[#C5B69F]">
                    <div
                      className="h-full bg-[#D95D24] transition-all"
                      style={{
                        width: `${
                          progress.total > 0
                            ? Math.round((progress.current / progress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Validation Preview Table */}
              {rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F0E9DC] p-2.5 rounded border border-[#DED4C3]">
                    <div className="flex items-center gap-2 font-mono-tech text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-[#D95D24]" />
                      <span className="font-semibold">{sourceLabel}</span>
                      <span className="text-[#6E5D50]">({rows.length} total rows)</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono-tech text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('all')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${
                          previewTab === 'all'
                            ? 'bg-[#261C15] text-white'
                            : 'bg-[#FFFDF9] text-[#261C15] border border-[#C5B69F]'
                        }`}
                      >
                        All ({rows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('valid')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${
                          previewTab === 'valid'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        Successful / Ready ({validRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('duplicate')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${
                          previewTab === 'duplicate'
                            ? 'bg-amber-700 text-white'
                            : 'bg-amber-50 text-amber-900 border border-amber-300'
                        }`}
                      >
                        Duplicates ({duplicateRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('invalid')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${
                          previewTab === 'invalid'
                            ? 'bg-red-700 text-white'
                            : 'bg-red-50 text-red-900 border border-red-300'
                        }`}
                      >
                        Invalid ({invalidRows.length})
                      </button>
                    </div>
                  </div>

                  <div className="border border-[#C5B69F] rounded overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#F0E9DC] font-mono-tech text-[11px] uppercase text-[#6E5D50] sticky top-0">
                        <tr>
                          <th className="py-2 px-3 border-b border-[#DED4C3]">Row</th>
                          <th className="py-2 px-3 border-b border-[#DED4C3]">Validation</th>
                          <th className="py-2 px-3 border-b border-[#DED4C3]">Full Name</th>
                          <th className="py-2 px-3 border-b border-[#DED4C3]">Normalized Phone</th>
                          <th className="py-2 px-3 border-b border-[#DED4C3]">Status / Category</th>
                          <th className="py-2 px-3 border-b border-[#DED4C3]">Details / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0E9DC] font-sans-ui">
                        {filteredPreview.slice(0, 250).map((item) => (
                          <tr key={item.rowNumber} className="hover:bg-[#F7F3EB]">
                            <td className="py-1.5 px-3 font-mono-tech text-[#6E5D50]">
                              #{item.rowNumber}
                            </td>
                            <td className="py-1.5 px-3 font-mono-tech">
                              {item.status === 'valid' && (
                                <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              )}
                              {item.status === 'duplicate' && (
                                <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded text-[10px]">
                                  <AlertTriangle className="w-3 h-3" /> Duplicate
                                </span>
                              )}
                              {item.status === 'invalid' && (
                                <span className="inline-flex items-center gap-1 text-red-900 bg-red-50 border border-red-300 px-1.5 py-0.5 rounded text-[10px]">
                                  <XCircle className="w-3 h-3" /> Invalid
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 font-medium text-[#261C15]">
                              {item.lead?.Full_Name || String(item.raw?.Full_Name || item.raw?.Name || '—')}
                            </td>
                            <td className="py-1.5 px-3 font-mono-tech text-[#261C15]">
                              {item.lead?.Phone_Number || String(item.raw?.Phone_Number || item.raw?.Phone || '—')}
                            </td>
                            <td className="py-1.5 px-3 font-mono-tech text-[11px] text-[#6E5D50]">
                              {item.lead
                                ? `${item.lead.Status} • ${item.lead.Lead_Category}`
                                : '—'}
                            </td>
                            <td className="py-1.5 px-3 text-[#6E5D50]">
                              {item.reason || 'Valid lead ready for cloud import'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!completedReport && (
          <div className="bg-[#F0E9DC] px-5 py-3 border-t border-[#DED4C3] flex items-center justify-between">
            <span className="font-mono-tech text-xs text-[#6E5D50]">
              {validRows.length > 0
                ? `${validRows.length} valid row(s) ready to commit. ${duplicateRows.length} duplicate(s) and ${invalidRows.length} invalid row(s) will be skipped.`
                : 'Upload a CSV, JSON, or Excel file to preview before committing.'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-3.5 py-1.5 border border-[#C5B69F] bg-[#FFFDF9] hover:bg-[#F7F3EB] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={validRows.length === 0 || importing}
                onClick={handleCommitImport}
                className="px-4 py-1.5 bg-[#D95D24] hover:bg-[#B84A18] disabled:opacity-50 text-white font-mono-tech text-xs uppercase font-semibold rounded flex items-center gap-1.5 cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Commit Import ({validRows.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
