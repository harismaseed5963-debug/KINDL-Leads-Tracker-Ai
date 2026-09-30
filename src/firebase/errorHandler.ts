import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Translates technical Firebase / Firestore errors into clear, user-friendly messages
 * without exposing raw stack traces to normal users.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';
  const rawMessage = error instanceof Error ? error.message : String(error);

  // Check if it is our custom business validation error
  if (
    rawMessage.startsWith('This phone number already belongs to') ||
    rawMessage.startsWith('CONCURRENCY_CONFLICT:') ||
    rawMessage.startsWith('Follow-Up date/time is required') ||
    rawMessage.startsWith('Please enter a valid')
  ) {
    return rawMessage;
  }

  // Try parsing structured FirestoreErrorInfo
  let innerError = rawMessage;
  if (rawMessage.startsWith('{') && rawMessage.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(rawMessage) as FirestoreErrorInfo;
      innerError = parsed.error || rawMessage;
    } catch {
      // ignore parse failure
    }
  }

  const lower = innerError.toLowerCase();

  if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
    return 'You do not have permission to perform this action.';
  }
  if (lower.includes('unavailable') || lower.includes('network-request-failed') || lower.includes('offline')) {
    return 'Unable to reach the server. Please check your internet connection.';
  }
  if (lower.includes('unauthenticated') || lower.includes('user-token-expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (
    lower.includes('invalid-credential') ||
    lower.includes('wrong-password') ||
    lower.includes('user-not-found') ||
    lower.includes('invalid-login-credentials')
  ) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }
  if (lower.includes('email-already-in-use')) {
    return 'An account with this email address already exists.';
  }
  if (lower.includes('weak-password')) {
    return 'Password should be at least 6 characters long.';
  }
  if (lower.includes('too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled in the Firebase Console yet. Enable it under Authentication → Sign-in method, or use Google Sign-In below.';
  }
  if (lower.includes('popup-closed-by-user')) {
    return 'Sign-in window was closed before completing authentication.';
  }

  return innerError.length < 160 ? innerError : 'An unexpected error occurred while processing your request.';
}
