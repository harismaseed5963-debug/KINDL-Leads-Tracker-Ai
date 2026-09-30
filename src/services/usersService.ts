import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, createSecondaryAuthUser } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { UserProfile, UserRole } from '../types';
import { logLeadActivity } from './activityService';

const USERS_COLLECTION = 'users';

export function subscribeToUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, USERS_COLLECTION), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: UserProfile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: docSnap.id,
          name: d.name || 'Team Member',
          email: d.email || '',
          role: (d.role as UserRole) || 'member',
          active: d.active !== false,
          createdAt: d.createdAt,
          lastLoginAt: d.lastLoginAt,
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      try {
        handleFirestoreError(err, OperationType.LIST, USERS_COLLECTION);
      } catch {
        // handled via callback
      }
    }
  );
}

/**
 * Allows an Admin to create/invite a new team member in Firebase Auth + Firestore `users/{uid}`
 * without signing out the currently logged-in Admin.
 */
export async function adminCreateUserAccount(params: {
  name: string;
  email: string;
  tempPassword: string;
  role: UserRole;
  sendResetLink: boolean;
  adminUser: UserProfile;
}): Promise<void> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.name.trim();

  const { uid, cleanup } = await createSecondaryAuthUser(cleanEmail, params.tempPassword);

  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await setDoc(userRef, {
      uid,
      name: cleanName,
      email: cleanEmail,
      role: params.role,
      active: true,
      createdAt: serverTimestamp(),
      lastLoginAt: null,
    });

    if (params.sendResetLink) {
      await sendPasswordResetEmail(auth, cleanEmail);
    }

    await logLeadActivity({
      leadId: 'SYSTEM_USER_MGMT',
      leadName: cleanName,
      action: 'USER_CREATED',
      user: params.adminUser,
      details: `Created user account for ${cleanName} (${cleanEmail}) with role: ${params.role.toUpperCase()}`,
    });
  } finally {
    await cleanup();
  }
}

export async function adminUpdateUserRole(params: {
  targetUser: UserProfile;
  newRole: UserRole;
  adminUser: UserProfile;
}): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, params.targetUser.uid);
  try {
    await updateDoc(userRef, {
      role: params.newRole,
    });
    await logLeadActivity({
      leadId: 'SYSTEM_USER_MGMT',
      leadName: params.targetUser.name,
      action: 'USER_ROLE_CHANGED',
      user: params.adminUser,
      details: `Changed role for ${params.targetUser.name} (${params.targetUser.email}): ${params.targetUser.role} → ${params.newRole}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUser.uid}`);
  }
}

export async function adminToggleUserActive(params: {
  targetUser: UserProfile;
  active: boolean;
  adminUser: UserProfile;
}): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, params.targetUser.uid);
  try {
    await updateDoc(userRef, {
      active: params.active,
    });
    await logLeadActivity({
      leadId: 'SYSTEM_USER_MGMT',
      leadName: params.targetUser.name,
      action: params.active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      user: params.adminUser,
      details: `${params.active ? 'Activated' : 'Deactivated'} user account: ${params.targetUser.name} (${params.targetUser.email})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUser.uid}`);
  }
}

export async function adminSendPasswordReset(email: string, adminUser: UserProfile): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
  await logLeadActivity({
    leadId: 'SYSTEM_USER_MGMT',
    leadName: email,
    action: 'PASSWORD_RESET_SENT',
    user: adminUser,
    details: `Triggered Firebase password reset email for ${email}`,
  });
}
