import React, { useState } from 'react';
import { Plus, DatabaseBackup, ShieldCheck, Server } from 'lucide-react';
import { CustomOptions, UserProfile } from '../types';
import { addCustomDropdownOption } from '../services/leadsService';
import { firebaseConfig, firestoreDatabaseId } from '../firebase/config';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';

interface SettingsViewProps {
  customOptions: CustomOptions;
  currentUser: UserProfile;
  onOpenMigrationModal: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  customOptions,
  currentUser,
  onOpenMigrationModal,
  onToast,
}) => {
  const [inputs, setInputs] = useState<Record<keyof CustomOptions, string>>({
    statuses: '',
    categories: '',
    sources: '',
    roles: '',
    programs: '',
  });

  const handleAddOption = async (field: keyof CustomOptions) => {
    const val = inputs[field].trim();
    if (!val) return;
    try {
      await addCustomDropdownOption(field, val, customOptions, currentUser);
      setInputs((prev) => ({ ...prev, [field]: '' }));
      onToast(`Added custom option "${val}" to ${field}`, 'success');
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const sections: { key: keyof CustomOptions; label: string; desc: string }[] = [
    {
      key: 'statuses',
      label: 'Lead Statuses',
      desc: 'Default: New, Contacted, Qualified, Follow-Up, Convert, Lost',
    },
    {
      key: 'categories',
      label: 'Lead Categories',
      desc: 'Default: Hot, Warm, Cold',
    },
    {
      key: 'programs',
      label: 'KINDL Programs',
      desc: 'Programs available in Add/Edit Lead dropdowns',
    },
    {
      key: 'sources',
      label: 'Lead Sources',
      desc: 'Acquisition channels (WhatsApp, Instagram, Referral, etc.)',
    },
    {
      key: 'roles',
      label: 'Lead Roles',
      desc: 'Applicant or contact persona (Student, Parent, Professional, etc.)',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DED4C3] pb-4">
        <h1 className="font-serif-editorial text-2xl font-bold text-[#261C15]">
          Workspace Settings & Migration
        </h1>
        <p className="text-sm text-[#6E5D50]">
          Configure shared custom dropdown options, migrate legacy browser leads, and inspect
          Firebase Cloud connectivity.
        </p>
      </div>

      {/* Legacy Migration Card */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono-tech text-xs uppercase text-[#D95D24] font-semibold">
            <DatabaseBackup className="w-4 h-4" />
            <span>Single-User to Multi-User Data Migration (`leads_tracker_v1`)</span>
          </div>
          <h3 className="font-serif-editorial text-lg font-bold text-[#261C15]">
            Migrate Existing LocalStorage Leads to Cloud Firestore
          </h3>
          <p className="text-xs text-[#6E5D50] max-w-2xl">
            If you previously used the standalone HTML KINDL Leads Tracker in this browser, click
            below to scan `leads_tracker_v1`, validate Pakistani phone numbers against duplicates,
            and upload your leads into the shared team database. Your local copy is never
            automatically deleted.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenMigrationModal}
          className="shrink-0 px-4 py-2.5 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-xs uppercase font-semibold rounded cursor-pointer"
        >
          Open Migration Wizard
        </button>
      </div>

      {/* Shared Custom Dropdown Values */}
      <div className="space-y-3">
        <h2 className="font-serif-editorial text-xl font-bold text-[#261C15]">
          Shared Custom Dropdown Values
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((sec) => (
            <div
              key={sec.key}
              className="bg-[#FFFDF9] border border-[#C5B69F] rounded p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <h3 className="font-mono-tech text-xs uppercase tracking-wider font-semibold text-[#261C15]">
                  {sec.label}
                </h3>
                <p className="text-[11px] text-[#6E5D50] mt-0.5">{sec.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {customOptions[sec.key].map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 bg-[#F0E9DC] border border-[#C5B69F] rounded font-mono-tech text-[11px] text-[#261C15]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-[#F0E9DC]">
                <input
                  type="text"
                  value={inputs[sec.key]}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [sec.key]: e.target.value }))}
                  placeholder={`Add custom ${sec.label.toLowerCase()}...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption(sec.key);
                    }
                  }}
                  className="flex-1 px-2.5 py-1 bg-[#F7F3EB] border border-[#C5B69F] rounded text-xs font-sans-ui"
                />
                <button
                  type="button"
                  onClick={() => handleAddOption(sec.key)}
                  className="px-2.5 py-1 bg-[#261C15] hover:bg-[#3d2e23] text-white font-mono-tech text-xs rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Firebase Environment Info */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded p-5 space-y-3">
        <div className="flex items-center gap-2 font-mono-tech text-xs uppercase text-[#1E7E48] font-semibold">
          <Server className="w-4 h-4" />
          <span>Connected Firebase Environment Configuration</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono-tech text-xs">
          <div className="p-3 bg-[#F7F3EB] border border-[#DED4C3] rounded">
            <span className="text-[10px] uppercase text-[#6E5D50] block">Project ID</span>
            <strong className="text-[#261C15]">{firebaseConfig.projectId}</strong>
          </div>
          <div className="p-3 bg-[#F7F3EB] border border-[#DED4C3] rounded">
            <span className="text-[10px] uppercase text-[#6E5D50] block">Auth Domain</span>
            <strong className="text-[#261C15]">{firebaseConfig.authDomain}</strong>
          </div>
          <div className="p-3 bg-[#F7F3EB] border border-[#DED4C3] rounded">
            <span className="text-[10px] uppercase text-[#6E5D50] block">Firestore Database</span>
            <strong className="text-[#261C15] truncate block">{firestoreDatabaseId}</strong>
          </div>
        </div>
        <p className="text-xs text-[#6E5D50] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#1E7E48]" />
          Configuration file location: <code className="font-mono-tech">src/firebase/config.ts</code>{' '}
          &amp; <code className="font-mono-tech">firebase-applet-config.json</code> (with{' '}
          <code className="font-mono-tech">.env</code> override support).
        </p>
      </div>
    </div>
  );
};
