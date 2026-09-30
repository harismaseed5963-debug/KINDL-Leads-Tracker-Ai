import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  RotateCcw,
  X,
  Loader2,
  WifiOff,
} from 'lucide-react';
import { auth, db } from './firebase/config';
import {
  ConnectionStatus,
  CustomOptions,
  Lead,
  NavTab,
  UserProfile,
} from './types';
import { ensureUserProfile, logoutUser } from './services/authService';
import {
  DEFAULT_CUSTOM_OPTIONS,
  restoreDeletedLeads,
  subscribeToCustomOptions,
  subscribeToLeads,
} from './services/leadsService';
import { subscribeToUsers } from './services/usersService';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LeadsWorkspace } from './components/LeadsWorkspace';
import { ActivityView } from './components/ActivityView';
import { UsersView } from './components/UsersView';
import { TrashView } from './components/TrashView';
import { SettingsView } from './components/SettingsView';
import { LeadEditModal } from './components/LeadEditModal';
import { ImportModal } from './components/ImportModal';
import { getFriendlyErrorMessage } from './firebase/errorHandler';

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  undoLeads?: Lead[];
}

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [deactivatedMessage, setDeactivatedMessage] = useState<string | null>(null);

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<NavTab>('leads');
  const [presetFilter, setPresetFilter] = useState<{
    status?: string;
    category?: string;
  } | null>(null);

  // Shared Firestore State
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customOptions, setCustomOptions] = useState<CustomOptions>(DEFAULT_CUSTOM_OPTIONS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('live');

  // Modals State
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [importModalState, setImportModalState] = useState<{
    open: boolean;
    mode: 'file' | 'migration';
  }>({ open: false, mode: 'file' });

  // Toast / Undo State
  const [toast, setToast] = useState<ToastState | null>(null);

  // Detect legacy `leads_tracker_v1` in localStorage (non-destructively)
  const [hasLocalLegacyData, setHasLocalLegacyData] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('leads_tracker_v1');
      if (raw && raw.length > 5) {
        setHasLocalLegacyData(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' | 'info' = 'info', undoLeads?: Lead[]) => {
      setToast({
        id: Date.now(),
        message,
        tone,
        undoLeads,
      });
    },
    []
  );

  // Auto-dismiss normal toasts after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Browser online/offline listener
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('live');
    const handleOffline = () => setConnectionStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 1. Firebase Auth State Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setAuthChecking(false);
        return;
      }

      try {
        const profile = await ensureUserProfile(fbUser);
        if (!profile.active) {
          setDeactivatedMessage(
            'Your KINDL account has been deactivated by an Administrator. Please contact your team lead.'
          );
          await logoutUser();
          setCurrentUser(null);
        } else {
          setDeactivatedMessage(null);
          setCurrentUser(profile);
        }
      } catch (err) {
        console.error('Auth profile verification error:', err);
      } finally {
        setAuthChecking(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Live Profile Role & Active Status Listener + Shared Collections Listeners
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Watch current user's document in case role or active status changes live
    const unsubSelf = onSnapshot(doc(db, 'users', currentUser.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data.active === false) {
          setDeactivatedMessage('Your account was deactivated by an Administrator.');
          await logoutUser();
          setCurrentUser(null);
          return;
        }
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                name: data.name || prev.name,
                role: data.role || prev.role,
                active: data.active !== false,
              }
            : prev
        );
      }
    });

    setLeadsLoading(true);
    const unsubLeads = subscribeToLeads(
      (items) => {
        setAllLeads(items);
        setLeadsLoading(false);
      },
      (status) => setConnectionStatus(status),
      (err) => {
        setLeadsLoading(false);
        showToast(getFriendlyErrorMessage(err), 'error');
      }
    );

    const unsubUsers = subscribeToUsers((teamUsers) => {
      setUsers(teamUsers);
    });

    const unsubOptions = subscribeToCustomOptions((opts) => {
      setCustomOptions(opts);
    });

    return () => {
      unsubSelf();
      unsubLeads();
      unsubUsers();
      unsubOptions();
    };
  }, [currentUser?.uid, showToast]);

  const activeLeads = useMemo(() => allLeads.filter((l) => !l.deleted), [allLeads]);
  const deletedLeads = useMemo(() => allLeads.filter((l) => Boolean(l.deleted)), [allLeads]);

  const leadsMap = useMemo(() => {
    const map = new Map<string, Lead>();
    allLeads.forEach((l) => map.set(l.id, l));
    return map;
  }, [allLeads]);

  const dueFollowUpsCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return activeLeads.filter((l) => {
      const st = (l.Status || '').toLowerCase();
      if (st === 'convert' || st === 'converted' || st === 'lost') return false;
      if (l.Follow_Up_Time && l.Follow_Up_Time.slice(0, 10) <= todayStr) return true;
      return st === 'follow-up';
    }).length;
  }, [activeLeads]);

  const handleUndoDelete = async () => {
    if (!toast?.undoLeads || !currentUser) return;
    const toRestore = toast.undoLeads;
    setToast(null);
    try {
      await restoreDeletedLeads(toRestore, currentUser);
      showToast(
        `Restored ${
          toRestore.length === 1 ? `"${toRestore[0].Full_Name}"` : `${toRestore.length} leads`
        }`,
        'success'
      );
    } catch (err) {
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleNavigate = (
    tab: NavTab,
    filter?: { status?: string; category?: string }
  ) => {
    if (filter) {
      setPresetFilter(filter);
    }
    setActiveTab(tab);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F7F3EB] text-[#261C15] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#D95D24]" />
        <p className="font-mono-tech text-xs uppercase tracking-wider text-[#6E5D50]">
          Verifying KINDL Team Session...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onAuthenticated={(profile) => setCurrentUser(profile)}
        deactivatedReason={deactivatedMessage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#261C15] flex flex-col">
      {/* Offline Mode Warning Banner */}
      {connectionStatus === 'offline' && (
        <div className="bg-red-900 text-white px-4 py-1.5 font-mono-tech text-xs flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            Offline mode active — Your changes are cached locally and will automatically sync to
            Cloud Firestore when connection returns.
          </span>
        </div>
      )}

      {/* Top Navigation Header */}
      <Header
        user={currentUser}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        connectionStatus={connectionStatus}
        activeLeadsCount={activeLeads.length}
        dueFollowUpsCount={dueFollowUpsCount}
        deletedLeadsCount={deletedLeads.length}
        hasLocalLegacyData={hasLocalLegacyData}
        onOpenMigration={() => setImportModalState({ open: true, mode: 'migration' })}
        onLogout={logoutUser}
      />

      {/* Main Content Workspace */}
      <main className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-5 flex-1">
        {leadsLoading ? (
          <div className="py-16 bg-[#FFFDF9] border border-[#C5B69F] rounded flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#D95D24]" />
            <span className="font-mono-tech text-xs text-[#6E5D50]">
              Loading leads from Cloud Firestore...
            </span>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView leads={activeLeads} onNavigate={handleNavigate} />
            )}

            {(activeTab === 'leads' || activeTab === 'followups') && (
              <LeadsWorkspace
                leads={activeLeads}
                leadsMap={leadsMap}
                users={users}
                currentUser={currentUser}
                customOptions={customOptions}
                viewMode={activeTab === 'followups' ? 'followups' : 'leads'}
                presetFilter={presetFilter}
                onClearPresetFilter={() => setPresetFilter(null)}
                onOpenEditModal={(id) => setEditingLeadId(id)}
                onOpenImportModal={() => setImportModalState({ open: true, mode: 'file' })}
                onDeleteWithUndo={(deletedList, msg) =>
                  showToast(msg, 'info', deletedList)
                }
                onToast={(msg, tone) => showToast(msg, tone)}
              />
            )}

            {activeTab === 'activity' && <ActivityView />}

            {activeTab === 'users' && (
              <UsersView
                users={users}
                currentUser={currentUser}
                onToast={(msg, tone) => showToast(msg, tone)}
              />
            )}

            {activeTab === 'trash' && (
              <TrashView
                deletedLeads={deletedLeads}
                currentUser={currentUser}
                onToast={(msg, tone) => showToast(msg, tone)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                customOptions={customOptions}
                currentUser={currentUser}
                onOpenMigrationModal={() =>
                  setImportModalState({ open: true, mode: 'migration' })
                }
                onToast={(msg, tone) => showToast(msg, tone)}
              />
            )}
          </>
        )}
      </main>

      {/* Edit Lead & Audit History Modal */}
      {editingLeadId && (
        <LeadEditModal
          leadId={editingLeadId}
          leadsMap={leadsMap}
          users={users}
          currentUser={currentUser}
          customOptions={customOptions}
          onClose={() => setEditingLeadId(null)}
          onSaved={(msg) => showToast(msg, 'success')}
        />
      )}

      {/* Import / Migration Modal */}
      {importModalState.open && (
        <ImportModal
          existingLeads={allLeads}
          currentUser={currentUser}
          initialMode={importModalState.mode}
          onClose={() => setImportModalState({ open: false, mode: 'file' })}
          onImportComplete={(summary) => showToast(summary, 'success')}
        />
      )}

      {/* Floating Toast & Undo Bar */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-[#261C15] text-[#FFFDF9] border border-[#D95D24] rounded shadow-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-sans-ui">
            {toast.tone === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            {toast.tone === 'error' && (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            {toast.tone === 'info' && <Info className="w-4 h-4 text-amber-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toast.undoLeads && toast.undoLeads.length > 0 && (
              <button
                type="button"
                onClick={handleUndoDelete}
                className="px-2.5 py-1 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-[11px] uppercase font-semibold rounded flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#DED4C3] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
