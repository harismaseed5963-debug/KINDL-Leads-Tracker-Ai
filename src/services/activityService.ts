import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { LeadActivity, UserProfile } from '../types';

const ACTIVITIES_COLLECTION = 'leadActivities';

export async function logLeadActivity(params: {
  leadId: string;
  leadName?: string;
  action: string;
  user: UserProfile;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, ACTIVITIES_COLLECTION), {
      leadId: params.leadId,
      leadName: params.leadName || '',
      action: params.action,
      performedBy: params.user.uid,
      performedByName: params.user.name || params.user.email,
      timestamp: serverTimestamp(),
      details: params.details,
    });
  } catch (err) {
    // Log diagnostic details without breaking primary user workflow if activity write fails
    console.warn('Activity log error:', err);
  }
}

export function subscribeToActivities(
  maxItems: number,
  onData: (activities: LeadActivity[]) => void,
  onError?: (err: Error) => void,
  leadIdFilter?: string
) {
  const colRef = collection(db, ACTIVITIES_COLLECTION);
  const q = leadIdFilter
    ? query(colRef, where('leadId', '==', leadIdFilter), orderBy('timestamp', 'desc'), limit(maxItems))
    : query(colRef, orderBy('timestamp', 'desc'), limit(maxItems));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LeadActivity[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          leadId: data.leadId || '',
          leadName: data.leadName || '',
          action: data.action || '',
          performedBy: data.performedBy || '',
          performedByName: data.performedByName || 'Team Member',
          timestamp: data.timestamp,
          details: data.details || '',
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, ACTIVITIES_COLLECTION);
      } catch {
        // handled via callback
      }
    }
  );
}
