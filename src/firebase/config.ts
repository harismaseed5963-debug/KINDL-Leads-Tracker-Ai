import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

/**
 * ============================================================================
 * FIREBASE CONFIGURATION
 * ============================================================================
 * By default, this application loads credentials from `firebase-applet-config.json`
 * (provisioned in Google AI Studio) OR from Vite environment variables (`VITE_FIREBASE_*`).
 *
 * When deploying to your own external Firebase project / GitHub repository, you can either:
 * 1. Set the `VITE_FIREBASE_*` variables in your `.env` file, OR
 * 2. Paste your Firebase Web App configuration directly into `firebase-applet-config.json`.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};

export const firestoreDatabaseId: string =
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  (appletConfig as any).firestoreDatabaseId ||
  '(default)';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('YOUR_')
);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Enable multi-tab offline persistence for safe temporary offline state & real-time sync
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, firestoreDatabaseId);
}

export const db = firestoreInstance;

/**
 * Creates a temporary secondary Firebase App instance so an Admin can create/invite
 * a new Firebase Authentication user (email/password) without signing out their own session.
 */
export async function createSecondaryAuthUser(
  email: string,
  tempPassword: string
): Promise<{ uid: string; cleanup: () => Promise<void> }> {
  const { createUserWithEmailAndPassword, getAuth: getSecondaryAuth, signOut } = await import(
    'firebase/auth'
  );
  const secondaryAppName = `admin_provision_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getSecondaryAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    const uid = cred.user.uid;
    const cleanup = async () => {
      try {
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
      } catch {
        // Ignore cleanup errors
      }
    };
    return { uid, cleanup };
  } catch (err) {
    try {
      await deleteApp(secondaryApp);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}
