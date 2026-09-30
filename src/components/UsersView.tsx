import React, { useState } from 'react';
import {
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  adminCreateUserAccount,
  adminSendPasswordReset,
  adminToggleUserActive,
  adminUpdateUserRole,
} from '../services/usersService';
import { formatRoleLabel, formatTimestamp } from '../utils/permissions';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';

interface UsersViewProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, currentUser, onToast }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [sendReset, setSendReset] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-8 bg-[#FFFDF9] border border-[#C5B69F] rounded text-center">
        <p className="font-mono-tech text-sm text-red-800">
          You do not have permission to access User Management. Admin role is required.
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newName.trim() || !newEmail.trim() || newPassword.length < 6) {
      setCreateError('Please enter name, email, and a temporary password (min 6 chars).');
      return;
    }

    setCreating(true);
    try {
      await adminCreateUserAccount({
        name: newName,
        email: newEmail,
        tempPassword: newPassword,
        role: newRole,
        sendResetLink: sendReset,
        adminUser: currentUser,
      });
      onToast(`Created account for ${newName} (${newEmail})`, 'success');
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('member');
      setShowCreateModal(false);
    } catch (err) {
      setCreateError(getFriendlyErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (target: UserProfile, role: UserRole) => {
    if (target.uid === currentUser.uid) {
      onToast('You cannot downgrade your own Admin account.', 'error');
      return;
    }
    setBusyUid(target.uid);
    try {
      await adminUpdateUserRole({
        targetUser: target,
        newRole: role,
        adminUser: currentUser,
      });
      onToast(`Updated role for ${target.name} to ${formatRoleLabel(role)}`, 'success');
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleActive = async (target: UserProfile) => {
    if (target.uid === currentUser.uid) {
      onToast('You cannot deactivate your own Admin account.', 'error');
      return;
    }
    setBusyUid(target.uid);
    try {
      const nextActive = !target.active;
      await adminToggleUserActive({
        targetUser: target,
        active: nextActive,
        adminUser: currentUser,
      });
      onToast(
        `${nextActive ? 'Activated' : 'Deactivated'} ${target.name}`,
        nextActive ? 'success' : 'info'
      );
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handlePasswordReset = async (target: UserProfile) => {
    setBusyUid(target.uid);
    try {
      await adminSendPasswordReset(target.email, currentUser);
      onToast(`Password reset email sent to ${target.email}`, 'success');
    } catch (err) {
      onToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED4C3] pb-4">
        <div>
          <h1 className="font-serif-editorial text-2xl font-bold text-[#261C15]">
            Admin User Management
          </h1>
          <p className="text-sm text-[#6E5D50]">
            Manage KINDL team members, assign roles (Admin, Manager, Team Member), control account
            status, and trigger Firebase password resets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto px-4 py-2 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-xs uppercase tracking-wider font-semibold rounded flex items-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create / Invite User</span>
        </button>
      </div>

      {/* Role Permissions Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 bg-[#FFFDF9] border border-[#C5B69F] rounded">
          <div className="flex items-center gap-1.5 font-mono-tech font-semibold text-[#D95D24] uppercase">
            <Shield className="w-3.5 h-3.5" /> Admin
          </div>
          <p className="text-[#6E5D50] mt-1">
            Full access to leads, bulk WhatsApp, import/export, deleted leads recovery, audit logs,
            and User Management.
          </p>
        </div>
        <div className="p-3.5 bg-[#FFFDF9] border border-[#C5B69F] rounded">
          <div className="flex items-center gap-1.5 font-mono-tech font-semibold text-amber-800 uppercase">
            <Shield className="w-3.5 h-3.5" /> Manager
          </div>
          <p className="text-[#6E5D50] mt-1">
            Can view, create, edit, assign, import, and export leads, run WhatsApp workflows, and
            view team activity. Cannot manage Admins or users.
          </p>
        </div>
        <div className="p-3.5 bg-[#FFFDF9] border border-[#C5B69F] rounded">
          <div className="flex items-center gap-1.5 font-mono-tech font-semibold text-[#261C15] uppercase">
            <Shield className="w-3.5 h-3.5" /> Team Member
          </div>
          <p className="text-[#6E5D50] mt-1">
            Can view, add, edit, filter leads, update statuses/notes, and run WhatsApp workflows.
            Cannot manage users or export the entire database.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#F0E9DC] font-mono-tech text-[11px] uppercase text-[#6E5D50]">
            <tr>
              <th className="py-3 px-4 border-b border-[#DED4C3]">User</th>
              <th className="py-3 px-4 border-b border-[#DED4C3]">Email</th>
              <th className="py-3 px-4 border-b border-[#DED4C3]">Role</th>
              <th className="py-3 px-4 border-b border-[#DED4C3]">Status</th>
              <th className="py-3 px-4 border-b border-[#DED4C3]">Created</th>
              <th className="py-3 px-4 border-b border-[#DED4C3]">Last Active</th>
              <th className="py-3 px-4 border-b border-[#DED4C3] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0E9DC] font-sans-ui">
            {users.map((u) => {
              const isSelf = u.uid === currentUser.uid;
              const isBusy = busyUid === u.uid;
              return (
                <tr key={u.uid} className="hover:bg-[#F7F3EB]/60">
                  <td className="py-2.5 px-4 font-medium text-[#261C15]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#261C15] text-white font-mono-tech text-[11px] flex items-center justify-center uppercase">
                        {(u.name || 'U').charAt(0)}
                      </div>
                      <span>{u.name}</span>
                      {isSelf && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-[#F0E9DC] border border-[#C5B69F] rounded">
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#6E5D50]">{u.email}</td>
                  <td className="py-2.5 px-4">
                    <select
                      value={u.role}
                      disabled={isSelf || isBusy}
                      onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                      className="px-2 py-1 bg-[#F7F3EB] border border-[#C5B69F] rounded font-mono-tech text-xs disabled:opacity-60"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="member">Team Member</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-4 font-mono-tech">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-300 text-red-900 text-[11px]">
                        <XCircle className="w-3 h-3" /> Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#6E5D50]">
                    {formatTimestamp(u.createdAt)}
                  </td>
                  <td className="py-2.5 px-4 font-mono-tech text-[#6E5D50]">
                    {formatTimestamp(u.lastLoginAt)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handlePasswordReset(u)}
                        className="px-2.5 py-1 bg-[#F7F3EB] hover:bg-[#F0E9DC] border border-[#C5B69F] rounded font-mono-tech text-[11px] text-[#261C15] flex items-center gap-1 cursor-pointer"
                        title="Send Firebase Password Reset Email"
                      >
                        <KeyRound className="w-3 h-3" />
                        Reset Password
                      </button>

                      {!isSelf && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-1 rounded font-mono-tech text-[11px] border cursor-pointer ${
                            u.active
                              ? 'bg-red-50 hover:bg-red-100 border-red-300 text-red-900'
                              : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                          }`}
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Invite User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] border border-[#C5B69F] rounded-md max-w-md w-full shadow-xl overflow-hidden">
            <div className="bg-[#F0E9DC] px-5 py-3.5 border-b border-[#DED4C3]">
              <h3 className="font-serif-editorial text-lg font-bold text-[#261C15]">
                Create / Invite Team Member
              </h3>
              <p className="text-xs text-[#6E5D50]">
                Provisions a Firebase Authentication credential and assigns their role in Firestore.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
              {createError && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Abdullah Tariq"
                  required
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="abdullah@kindl.org"
                  required
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Initial Password (min 6 chars) *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Temporary password"
                  required
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] uppercase text-[#6E5D50] mb-1">
                  Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui"
                >
                  <option value="member">Team Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-mono-tech text-[#6E5D50] pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendReset}
                  onChange={(e) => setSendReset(e.target.checked)}
                  className="accent-[#D95D24]"
                />
                Also send password reset email so user can choose their own password
              </label>

              <div className="pt-3 border-t border-[#DED4C3] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-3.5 py-1.5 border border-[#C5B69F] rounded font-mono-tech text-xs text-[#261C15] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-xs uppercase font-semibold rounded flex items-center gap-1.5 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
