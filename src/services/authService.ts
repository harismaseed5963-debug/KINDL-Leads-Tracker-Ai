import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types';

const BOOTSTRAP_ADMIN_EMAIL = 'azlanmaseed5963@gmail.com';

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserProfile(credential.user);
}

export async function registerFirstOrSelfAccount(
  name: string,
  email: string,
  password: string
): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserProfile(credential.user, name.trim());
}

export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return ensureUserProfile(credential.user);
}

export async function triggerPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Ensures the authenticated Firebase User has a corresponding `users/{uid}` document
 * in Firestore and updates `lastLoginAt`.
 */
export async function ensureUserProfile(
  firebaseUser: User,
  preferredName?: string
): Promise<UserProfile> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);

  const emailLower = (firebaseUser.email || '').toLowerCase();
  const isBootstrap = emailLower === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    const updatedRole: UserRole = isBootstrap ? 'admin' : data.role || 'member';
    const updatedActive = isBootstrap ? true : data.active !== false;

    try {
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        ...(isBootstrap ? { role: 'admin', active: true } : {}),
      });
    } catch {
      // Ignore if deactivated user cannot update their own doc
    }

    return {
      ...data,
      uid: firebaseUser.uid,
      role: updatedRole,
      active: updatedActive,
    };
  }

  // Create profile for first-time login
  const displayName =
    preferredName ||
    firebaseUser.displayName ||
    (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Team Member');

  const assignedRole: UserRole = isBootstrap ? 'admin' : 'member';
  const newProfile: UserProfile = {
    uid: firebaseUser.uid,
    name: displayName,
    email: firebaseUser.email || '',
    role: assignedRole,
    active: true,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(userRef, newProfile);
  return newProfile;
}
