import React from 'react';
import {
  LayoutDashboard,
  Users,
  Table2,
  CalendarClock,
  History,
  Settings,
  LogOut,
  Trash2,
  DatabaseBackup,
} from 'lucide-react';
import { ConnectionStatus, NavTab, UserProfile } from '../types';
import { formatRoleLabel, getRolePermissions } from '../utils/permissions';

interface HeaderProps {
  user: UserProfile;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  connectionStatus: ConnectionStatus;
  activeLeadsCount: number;
  dueFollowUpsCount: number;
  deletedLeadsCount: number;
  hasLocalLegacyData: boolean;
  onOpenMigration: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  connectionStatus,
  activeLeadsCount,
  dueFollowUpsCount,
  deletedLeadsCount,
  hasLocalLegacyData,
  onOpenMigration,
  onLogout,
}) => {
  const perms = getRolePermissions(user.role);

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeTone?: 'default' | 'orange' | 'muted';
    visible: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
      visible: true,
    },
    {
      id: 'leads',
      label: 'Leads',
      icon: <Table2 className="w-3.5 h-3.5" />,
      badge: activeLeadsCount,
      badgeTone: 'default',
      visible: true,
    },
    {
      id: 'followups',
      label: 'Follow-Ups',
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      badge: dueFollowUpsCount > 0 ? dueFollowUpsCount : undefined,
      badgeTone: 'orange',
      visible: true,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <History className="w-3.5 h-3.5" />,
      visible: perms.canViewActivityLogs,
    },
    {
      id: 'users',
      label: 'Users',
      icon: <Users className="w-3.5 h-3.5" />,
      visible: perms.canManageUsers,
    },
    {
      id: 'trash',
      label: 'Deleted',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      badge: deletedLeadsCount > 0 ? deletedLeadsCount : undefined,
      badgeTone: 'muted',
      visible: perms.canViewDeletedLeads,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-3.5 h-3.5" />,
      visible: true,
    },
  ];

  return (
    <header className="bg-[#FFFDF9] border-b border-[#C5B69F] sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between py-2.5 gap-3">
          {/* Brand & Live Status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectTab('leads')}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded bg-[#D95D24] group-hover:bg-[#B84A18] transition-colors text-[#FFFDF9] flex items-center justify-center font-mono-tech font-bold text-base">
                K
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif-editorial font-bold text-lg leading-none text-[#261C15]">
                    KINDL Leads Tracker
                  </span>
                  <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono-tech uppercase tracking-wider bg-[#F0E9DC] border border-[#C5B69F] text-[#6E5D50] rounded">
                    Team Edition
                  </span>
                </div>
                <p className="text-[11px] font-mono-tech text-[#6E5D50] mt-0.5">
                  Shared Cloud Lead Database & WhatsApp Workflow
                </p>
              </div>
            </button>

            {/* Real-time Connection Indicator */}
            <div
              className={`ml-1 px-2.5 py-1 rounded border text-[11px] font-mono-tech font-medium flex items-center gap-1.5 ${
                connectionStatus === 'live'
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                  : 'bg-red-50/80 border-red-300 text-red-900'
              }`}
              title={
                connectionStatus === 'live'
                  ? 'Connected to Cloud Firestore in real time'
                  : connectionStatus === 'reconnecting'
                  ? 'Syncing local changes with Cloud Firestore...'
                  : 'Offline mode active — changes are cached and will sync when online'
              }
            >
              <span>
                {connectionStatus === 'live' && '🟢 Live'}
                {connectionStatus === 'reconnecting' && '🟡 Reconnecting'}
                {connectionStatus === 'offline' && '🔴 Offline'}
              </span>
            </div>

            {/* Legacy localStorage Migration Banner Button if detected */}
            {hasLocalLegacyData && (
              <button
                type="button"
                onClick={onOpenMigration}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 font-mono-tech text-[11px] font-semibold cursor-pointer transition-colors"
                title="Local leads_tracker_v1 data detected in this browser. Click to migrate safely to Firestore."
              >
                <DatabaseBackup className="w-3.5 h-3.5 text-[#D95D24]" />
                Migrate Local Leads
              </button>
            )}
          </div>

          {/* Right User Profile & Logout */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[#F7F3EB] border border-[#DED4C3] rounded">
              <div className="w-6 h-6 rounded-full bg-[#261C15] text-[#FFFDF9] font-mono-tech text-xs font-semibold flex items-center justify-center uppercase">
                {(user.name || user.email || 'U').charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-sans-ui font-semibold text-[#261C15] leading-none">
                    {user.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono-tech uppercase rounded border ${
                      user.role === 'admin'
                        ? 'bg-[#D95D24]/15 border-[#D95D24] text-[#B84A18] font-semibold'
                        : user.role === 'manager'
                        ? 'bg-amber-100 border-amber-400 text-amber-900 font-semibold'
                        : 'bg-[#F0E9DC] border-[#C5B69F] text-[#6E5D50]'
                    }`}
                  >
                    {formatRoleLabel(user.role)}
                  </span>
                </div>
                <p className="text-[10px] font-mono-tech text-[#6E5D50] leading-tight truncate max-w-[160px]">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-2.5 py-1.5 bg-[#F7F3EB] hover:bg-red-50 text-[#261C15] hover:text-red-800 border border-[#C5B69F] hover:border-red-300 rounded font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sign out of KINDL Leads Tracker"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-[#F0E9DC]">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3.5 py-2 font-mono-tech text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-[#D95D24] text-[#D95D24] font-semibold bg-[#F7F3EB]/60'
                      : 'border-transparent text-[#6E5D50] hover:text-[#261C15] hover:bg-[#F7F3EB]/40'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] rounded font-mono-tech ${
                        item.badgeTone === 'orange'
                          ? 'bg-[#D95D24] text-[#FFFDF9] font-semibold'
                          : item.badgeTone === 'muted'
                          ? 'bg-[#DED4C3] text-[#261C15]'
                          : 'bg-[#F0E9DC] border border-[#C5B69F] text-[#261C15]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>
    </header>
  );
};
