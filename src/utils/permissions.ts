import { UserProfile, UserRole } from '../types';

export interface RolePermissions {
  canViewAllLeads: boolean;
  canCreateLead: boolean;
  canEditLead: boolean;
  canDeleteLead: boolean;
  canPurgeLeads: boolean;
  canClearAllLeads: boolean;
  canImportLeads: boolean;
  canExportLeads: boolean;
  canSendWhatsApp: boolean;
  canAssignAnyLead: boolean;
  canManageUsers: boolean;
  canViewActivityLogs: boolean;
  canViewDeletedLeads: boolean;
}

export function getRolePermissions(role?: UserRole): RolePermissions {
  switch (role) {
    case 'admin':
      return {
        canViewAllLeads: true,
        canCreateLead: true,
        canEditLead: true,
        canDeleteLead: true,
        canPurgeLeads: true,
        canClearAllLeads: true,
        canImportLeads: true,
        canExportLeads: true,
        canSendWhatsApp: true,
        canAssignAnyLead: true,
        canManageUsers: true,
        canViewActivityLogs: true,
        canViewDeletedLeads: true,
      };
    case 'manager':
      return {
        canViewAllLeads: true,
        canCreateLead: true,
        canEditLead: true,
        canDeleteLead: true,
        canPurgeLeads: false,
        canClearAllLeads: false,
        canImportLeads: true,
        canExportLeads: true,
        canSendWhatsApp: true,
        canAssignAnyLead: true,
        canManageUsers: false,
        canViewActivityLogs: true,
        canViewDeletedLeads: true,
      };
    case 'member':
    default:
      return {
        canViewAllLeads: true,
        canCreateLead: true,
        canEditLead: true,
        canDeleteLead: true, // Soft-delete with Undo
        canPurgeLeads: false,
        canClearAllLeads: false,
        canImportLeads: false,
        canExportLeads: false,
        canSendWhatsApp: true,
        canAssignAnyLead: false,
        canManageUsers: false,
        canViewActivityLogs: true,
        canViewDeletedLeads: false,
      };
  }
}

export function formatRoleLabel(role?: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return 'Team Member';
}

export function formatTimestamp(ts: any): string {
  if (!ts) return '—';
  try {
    if (typeof ts === 'string') {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return ts;
    }
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // fallback
  }
  return String(ts);
}
