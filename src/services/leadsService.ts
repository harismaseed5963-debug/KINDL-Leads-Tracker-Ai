import {
  collection,
  doc,
  runTransaction,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  ConnectionStatus,
  CustomOptions,
  ImportRowResult,
  Lead,
  LeadFormInput,
  UserProfile,
} from '../types';
import { validateAndFormatPhone } from '../utils/phone';
import { logLeadActivity } from './activityService';

const LEADS_COLLECTION = 'leads';
const PHONE_INDEX_COLLECTION = 'phoneIndex';
const SETTINGS_COLLECTION = 'settings';
const CUSTOM_OPTIONS_DOC = 'customOptions';

export const DEFAULT_CUSTOM_OPTIONS: CustomOptions = {
  sources: ['WhatsApp', 'Instagram', 'Facebook Ads', 'Referral', 'Website', 'Walk-In', 'LinkedIn', 'Event'],
  roles: ['Student', 'Parent', 'Professional', 'Entrepreneur', 'Teacher', 'Other'],
  programs: ['KINDL Foundations', 'KINDL Fellowship', 'AI & Tech Bootcamp', 'Leadership Track', 'Career Accelerator', 'Summer Intensive'],
  categories: ['Hot', 'Warm', 'Cold'],
  statuses: ['New', 'Contacted', 'Qualified', 'Follow-Up', 'Convert', 'Lost'],
};

/**
 * Subscribes to the shared `leads` collection in real time and reports connection state
 * (🟢 Live / 🟡 Reconnecting / 🔴 Offline).
 */
export function subscribeToLeads(
  onLeads: (leads: Lead[]) => void,
  onStatusChange: (status: ConnectionStatus) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, LEADS_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!navigator.onLine) {
        onStatusChange('offline');
      } else if (snapshot.metadata.fromCache && snapshot.metadata.hasPendingWrites) {
        onStatusChange('reconnecting');
      } else {
        onStatusChange('live');
      }

      const items: Lead[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          Full_Name: d.Full_Name || '',
          Phone_Number: d.Phone_Number || '',
          phoneNormalized: d.phoneNormalized || '',
          Age: d.Age || '',
          City: d.City || '',
          Source: d.Source || '',
          Lead_Role: d.Lead_Role || '',
          Program: d.Program || '',
          Lead_Category: d.Lead_Category || 'Warm',
          Status: d.Status || 'New',
          Follow_Up_Time: d.Follow_Up_Time || '',
          WhatsApp_Message: d.WhatsApp_Message || '',
          Time: d.Time || '',
          Description: d.Description || '',
          assignedTo: d.assignedTo || '',
          assignedToName: d.assignedToName || '',
          activeWorkflowBy: d.activeWorkflowBy || '',
          activeWorkflowByName: d.activeWorkflowByName || '',
          activeWorkflowAt: d.activeWorkflowAt || '',
          deleted: Boolean(d.deleted),
          deletedAt: d.deletedAt || '',
          deletedBy: d.deletedBy || '',
          deletedByName: d.deletedByName || '',
          createdBy: d.createdBy || '',
          createdByName: d.createdByName || '',
          createdAt: d.createdAt,
          updatedBy: d.updatedBy || '',
          updatedByName: d.updatedByName || '',
          updatedAt: d.updatedAt,
          version: typeof d.version === 'number' ? d.version : 1,
        };
      });

      onLeads(items);
    },
    (error) => {
      onStatusChange('offline');
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, LEADS_COLLECTION);
      } catch {
        // handled via callback
      }
    }
  );
}

/**
 * Creates a new Lead atomically while enforcing unique `phoneNormalized` via `phoneIndex/{phoneNormalized}`.
 */
export async function createLead(input: LeadFormInput, user: UserProfile): Promise<string> {
  const cleanName = input.Full_Name.trim();
  if (!cleanName) {
    throw new Error('Please enter a valid Full Name.');
  }

  const phoneCheck = validateAndFormatPhone(input.Phone_Number);
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.error || 'Please enter a valid Phone Number.');
  }

  if (input.Status === 'Follow-Up' && !input.Follow_Up_Time?.trim()) {
    throw new Error('Follow-Up date/time is required when Status is set to Follow-Up.');
  }

  const newLeadRef = doc(collection(db, LEADS_COLLECTION));
  const phoneIndexRef = doc(db, PHONE_INDEX_COLLECTION, phoneCheck.normalized);
  const nowDisplay = input.Time?.trim() || new Date().toISOString().slice(0, 16).replace('T', ' ');

  await runTransaction(db, async (tx) => {
    const existingPhoneSnap = await tx.get(phoneIndexRef);
    if (existingPhoneSnap.exists()) {
      const existingData = existingPhoneSnap.data();
      const existingLeadRef = doc(db, LEADS_COLLECTION, existingData.leadId);
      const existingLeadSnap = await tx.get(existingLeadRef);
      if (existingLeadSnap.exists() && !existingLeadSnap.data().deleted) {
        const ownerName = existingLeadSnap.data().Full_Name || existingData.Full_Name || 'another lead';
        throw new Error(`This phone number already belongs to ${ownerName}.`);
      }
    }

    const leadDocData = {
      id: newLeadRef.id,
      Full_Name: cleanName,
      Phone_Number: phoneCheck.formatted,
      phoneNormalized: phoneCheck.normalized,
      Age: (input.Age || '').trim(),
      City: (input.City || '').trim(),
      Source: (input.Source || 'Direct').trim(),
      Lead_Role: (input.Lead_Role || 'Student').trim(),
      Program: (input.Program || 'General').trim(),
      Lead_Category: (input.Lead_Category || 'Warm').trim(),
      Status: (input.Status || 'New').trim(),
      Follow_Up_Time: (input.Follow_Up_Time || '').trim(),
      WhatsApp_Message: (input.WhatsApp_Message || '').trim(),
      Time: nowDisplay,
      Description: (input.Description || '').trim(),
      assignedTo: input.assignedTo || user.uid,
      assignedToName: input.assignedToName || user.name,
      activeWorkflowBy: '',
      activeWorkflowByName: '',
      activeWorkflowAt: '',
      deleted: false,
      deletedAt: '',
      deletedBy: '',
      deletedByName: '',
      createdBy: user.uid,
      createdByName: user.name,
      createdAt: serverTimestamp(),
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: serverTimestamp(),
      version: 1,
    };

    tx.set(newLeadRef, leadDocData);
    tx.set(phoneIndexRef, {
      phoneNormalized: phoneCheck.normalized,
      leadId: newLeadRef.id,
      Full_Name: cleanName,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  });

  await logLeadActivity({
    leadId: newLeadRef.id,
    leadName: cleanName,
    action: 'LEAD_CREATED',
    user,
    details: `Created lead ${cleanName} (${phoneCheck.formatted}) • Status: ${input.Status} • Category: ${input.Lead_Category}`,
  });

  return newLeadRef.id;
}

/**
 * Updates an existing Lead with optimistic concurrency control (`expectedVersion`)
 * and atomic phone number uniqueness verification if the phone number changed.
 */
export async function updateLead(params: {
  leadId: string;
  updates: Partial<LeadFormInput>;
  expectedVersion?: number;
  forceOverwrite?: boolean;
  user: UserProfile;
}): Promise<void> {
  const { leadId, updates, expectedVersion, forceOverwrite, user } = params;
  const leadRef = doc(db, LEADS_COLLECTION, leadId);

  let auditSummary = '';
  let targetLeadName = '';

  await runTransaction(db, async (tx) => {
    const leadSnap = await tx.get(leadRef);
    if (!leadSnap.exists()) {
      throw new Error('This lead no longer exists.');
    }

    const current = leadSnap.data() as Lead;
    targetLeadName = updates.Full_Name?.trim() || current.Full_Name;

    // Optimistic concurrency check
    if (
      !forceOverwrite &&
      expectedVersion !== undefined &&
      current.version !== undefined &&
      current.version > expectedVersion &&
      current.updatedBy !== user.uid
    ) {
      throw new Error(
        `CONCURRENCY_CONFLICT:${current.updatedByName || 'another team member'}`
      );
    }

    const nextStatus = updates.Status !== undefined ? updates.Status.trim() : current.Status;
    const nextFollowUp =
      updates.Follow_Up_Time !== undefined ? updates.Follow_Up_Time.trim() : current.Follow_Up_Time;

    if (nextStatus === 'Follow-Up' && !nextFollowUp) {
      throw new Error('Follow-Up date/time is required when Status is set to Follow-Up.');
    }

    let nextPhoneFormatted = current.Phone_Number;
    let nextPhoneNormalized = current.phoneNormalized;

    if (updates.Phone_Number !== undefined && updates.Phone_Number.trim() !== current.Phone_Number) {
      const phoneCheck = validateAndFormatPhone(updates.Phone_Number);
      if (!phoneCheck.valid) {
        throw new Error(phoneCheck.error || 'Please enter a valid Phone Number.');
      }
      nextPhoneFormatted = phoneCheck.formatted;
      nextPhoneNormalized = phoneCheck.normalized;

      if (nextPhoneNormalized !== current.phoneNormalized) {
        const newPhoneIndexRef = doc(db, PHONE_INDEX_COLLECTION, nextPhoneNormalized);
        const existingPhoneSnap = await tx.get(newPhoneIndexRef);

        if (existingPhoneSnap.exists() && existingPhoneSnap.data().leadId !== leadId) {
          const otherLeadRef = doc(db, LEADS_COLLECTION, existingPhoneSnap.data().leadId);
          const otherLeadSnap = await tx.get(otherLeadRef);
          if (otherLeadSnap.exists() && !otherLeadSnap.data().deleted) {
            const ownerName =
              otherLeadSnap.data().Full_Name || existingPhoneSnap.data().Full_Name || 'another lead';
            throw new Error(`This phone number already belongs to ${ownerName}.`);
          }
        }

        // Remove old phone index and set new one
        if (current.phoneNormalized) {
          const oldPhoneIndexRef = doc(db, PHONE_INDEX_COLLECTION, current.phoneNormalized);
          tx.delete(oldPhoneIndexRef);
        }
        tx.set(newPhoneIndexRef, {
          phoneNormalized: nextPhoneNormalized,
          leadId,
          Full_Name: targetLeadName,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Build change descriptions for audit trail
    const changes: string[] = [];
    if (updates.Full_Name !== undefined && updates.Full_Name.trim() !== current.Full_Name) {
      changes.push(`Name: ${current.Full_Name} → ${updates.Full_Name.trim()}`);
    }
    if (nextPhoneNormalized !== current.phoneNormalized) {
      changes.push(`Phone: ${current.Phone_Number} → ${nextPhoneFormatted}`);
    }
    if (updates.Status !== undefined && updates.Status !== current.Status) {
      changes.push(`Status: ${current.Status} → ${updates.Status}`);
    }
    if (updates.Lead_Category !== undefined && updates.Lead_Category !== current.Lead_Category) {
      changes.push(`Category: ${current.Lead_Category} → ${updates.Lead_Category}`);
    }
    if (updates.assignedTo !== undefined && updates.assignedTo !== current.assignedTo) {
      changes.push(
        `Assigned to: ${current.assignedToName || 'Unassigned'} → ${updates.assignedToName || 'Unassigned'}`
      );
    }
    if (updates.Follow_Up_Time !== undefined && updates.Follow_Up_Time !== current.Follow_Up_Time) {
      changes.push(`Follow-Up: ${current.Follow_Up_Time || 'None'} → ${updates.Follow_Up_Time || 'Cleared'}`);
    }
    if (updates.Description !== undefined && updates.Description !== current.Description) {
      changes.push('Description updated');
    }
    if (updates.WhatsApp_Message !== undefined && updates.WhatsApp_Message !== current.WhatsApp_Message) {
      changes.push('WhatsApp message prepared');
    }

    auditSummary = changes.length > 0 ? changes.join(' • ') : 'Updated lead details';

    const payload: Record<string, any> = {
      Full_Name: targetLeadName,
      Phone_Number: nextPhoneFormatted,
      phoneNormalized: nextPhoneNormalized,
      Age: updates.Age !== undefined ? updates.Age.trim() : current.Age,
      City: updates.City !== undefined ? updates.City.trim() : current.City,
      Source: updates.Source !== undefined ? updates.Source.trim() : current.Source,
      Lead_Role: updates.Lead_Role !== undefined ? updates.Lead_Role.trim() : current.Lead_Role,
      Program: updates.Program !== undefined ? updates.Program.trim() : current.Program,
      Lead_Category: updates.Lead_Category !== undefined ? updates.Lead_Category.trim() : current.Lead_Category,
      Status: nextStatus,
      Follow_Up_Time: nextFollowUp,
      WhatsApp_Message:
        updates.WhatsApp_Message !== undefined ? updates.WhatsApp_Message : current.WhatsApp_Message,
      Time: updates.Time !== undefined ? updates.Time : current.Time,
      Description: updates.Description !== undefined ? updates.Description.trim() : current.Description,
      assignedTo: updates.assignedTo !== undefined ? updates.assignedTo : current.assignedTo || '',
      assignedToName:
        updates.assignedToName !== undefined ? updates.assignedToName : current.assignedToName || '',
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: serverTimestamp(),
      version: (current.version || 1) + 1,
    };

    tx.update(leadRef, payload);
  });

  if (auditSummary) {
    let actionType = 'LEAD_UPDATED';
    if (auditSummary.startsWith('Status:')) actionType = 'STATUS_CHANGED';
    else if (auditSummary.startsWith('Category:')) actionType = 'CATEGORY_CHANGED';
    else if (auditSummary.startsWith('Assigned to:')) actionType = 'LEAD_ASSIGNED';
    else if (auditSummary.startsWith('WhatsApp message')) actionType = 'WHATSAPP_PREPARED';

    await logLeadActivity({
      leadId,
      leadName: targetLeadName,
      action: actionType,
      user,
      details: auditSummary,
    });
  }
}

/**
 * Bulk updates a specific field across multiple selected leads (e.g., Status, Category, Assigned To, or WhatsApp Message).
 */
export async function bulkUpdateLeads(params: {
  leads: Lead[];
  updates: Partial<LeadFormInput>;
  actionLabel: string;
  user: UserProfile;
}): Promise<void> {
  const { leads, updates, actionLabel, user } = params;
  if (leads.length === 0) return;

  const CHUNK_SIZE = 200;
  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    const slice = leads.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    slice.forEach((lead) => {
      const ref = doc(db, LEADS_COLLECTION, lead.id);
      batch.update(ref, {
        ...updates,
        updatedBy: user.uid,
        updatedByName: user.name,
        updatedAt: serverTimestamp(),
        version: (lead.version || 1) + 1,
      });
    });

    await batch.commit();
  }

  await logLeadActivity({
    leadId: leads.length === 1 ? leads[0].id : 'BULK_ACTION',
    leadName: leads.length === 1 ? leads[0].Full_Name : `${leads.length} Leads`,
    action: 'BULK_UPDATE',
    user,
    details: `${actionLabel} (${leads.length} lead${leads.length === 1 ? '' : 's'})`,
  });
}

/**
 * Soft-deletes one or more leads (`deleted: true`, `deletedAt`, `deletedBy`) and releases their phoneIndex lock.
 * Returns the list of soft-deleted leads so the UI can offer immediate 1-click Undo.
 */
export async function softDeleteLeads(leadsToDelete: Lead[], user: UserProfile): Promise<void> {
  if (leadsToDelete.length === 0) return;
  const nowIso = new Date().toISOString();

  const CHUNK_SIZE = 150;
  for (let i = 0; i < leadsToDelete.length; i += CHUNK_SIZE) {
    const slice = leadsToDelete.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    slice.forEach((lead) => {
      const leadRef = doc(db, LEADS_COLLECTION, lead.id);
      batch.update(leadRef, {
        deleted: true,
        deletedAt: nowIso,
        deletedBy: user.uid,
        deletedByName: user.name,
        updatedBy: user.uid,
        updatedByName: user.name,
        updatedAt: serverTimestamp(),
        version: (lead.version || 1) + 1,
      });

      if (lead.phoneNormalized) {
        const phoneRef = doc(db, PHONE_INDEX_COLLECTION, lead.phoneNormalized);
        batch.delete(phoneRef);
      }
    });

    await batch.commit();
  }

  await logLeadActivity({
    leadId: leadsToDelete.length === 1 ? leadsToDelete[0].id : 'BULK_DELETE',
    leadName:
      leadsToDelete.length === 1 ? leadsToDelete[0].Full_Name : `${leadsToDelete.length} Leads`,
    action: 'LEAD_DELETED',
    user,
    details:
      leadsToDelete.length === 1
        ? `Moved lead "${leadsToDelete[0].Full_Name}" to Deleted Leads`
        : `Moved ${leadsToDelete.length} leads to Deleted Leads`,
  });
}

/**
 * Restores soft-deleted leads (`deleted: false`) and re-registers their `phoneIndex`.
 */
export async function restoreDeletedLeads(leadsToRestore: Lead[], user: UserProfile): Promise<void> {
  if (leadsToRestore.length === 0) return;

  const CHUNK_SIZE = 150;
  for (let i = 0; i < leadsToRestore.length; i += CHUNK_SIZE) {
    const slice = leadsToRestore.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    slice.forEach((lead) => {
      const leadRef = doc(db, LEADS_COLLECTION, lead.id);
      batch.update(leadRef, {
        deleted: false,
        deletedAt: '',
        deletedBy: '',
        deletedByName: '',
        updatedBy: user.uid,
        updatedByName: user.name,
        updatedAt: serverTimestamp(),
        version: (lead.version || 1) + 1,
      });

      if (lead.phoneNormalized) {
        const phoneRef = doc(db, PHONE_INDEX_COLLECTION, lead.phoneNormalized);
        batch.set(phoneRef, {
          phoneNormalized: lead.phoneNormalized,
          leadId: lead.id,
          Full_Name: lead.Full_Name,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  }

  await logLeadActivity({
    leadId: leadsToRestore.length === 1 ? leadsToRestore[0].id : 'BULK_RESTORE',
    leadName:
      leadsToRestore.length === 1 ? leadsToRestore[0].Full_Name : `${leadsToRestore.length} Leads`,
    action: 'LEAD_RESTORED',
    user,
    details:
      leadsToRestore.length === 1
        ? `Restored lead "${leadsToRestore[0].Full_Name}"`
        : `Restored ${leadsToRestore.length} leads`,
  });
}

/**
 * Permanently deletes a lead from Firestore (Admin only).
 */
export async function permanentlyDeleteLead(lead: Lead, user: UserProfile): Promise<void> {
  await deleteDoc(doc(db, LEADS_COLLECTION, lead.id));
  if (lead.phoneNormalized) {
    try {
      await deleteDoc(doc(db, PHONE_INDEX_COLLECTION, lead.phoneNormalized));
    } catch {
      // ignore
    }
  }
  await logLeadActivity({
    leadId: lead.id,
    leadName: lead.Full_Name,
    action: 'LEAD_PURGED',
    user,
    details: `Permanently purged lead "${lead.Full_Name}" (${lead.Phone_Number})`,
  });
}

/**
 * Batched multi-user import for CSV / JSON / Excel / Migration rows.
 * Reports live progress (`onProgress(completed, total)`) without freezing the browser.
 */
export async function batchImportValidatedLeads(params: {
  validRows: ImportRowResult[];
  user: UserProfile;
  sourceLabel: string;
  onProgress?: (completed: number, total: number) => void;
}): Promise<number> {
  const { validRows, user, sourceLabel, onProgress } = params;
  const actionable = validRows.filter((r) => r.status === 'valid' && r.lead);
  if (actionable.length === 0) return 0;

  // Each lead writes 2 docs (lead + phoneIndex), so 150 leads = 300 writes per batch (well under 500 limit)
  const CHUNK_SIZE = 150;
  let completed = 0;

  for (let i = 0; i < actionable.length; i += CHUNK_SIZE) {
    const slice = actionable.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    slice.forEach((item) => {
      const leadInput = item.lead!;
      const newLeadRef = doc(collection(db, LEADS_COLLECTION));
      const phoneRef = doc(db, PHONE_INDEX_COLLECTION, leadInput.phoneNormalized);

      batch.set(newLeadRef, {
        id: newLeadRef.id,
        Full_Name: leadInput.Full_Name,
        Phone_Number: leadInput.Phone_Number,
        phoneNormalized: leadInput.phoneNormalized,
        Age: leadInput.Age || '',
        City: leadInput.City || '',
        Source: leadInput.Source || 'Import',
        Lead_Role: leadInput.Lead_Role || 'Student',
        Program: leadInput.Program || 'General',
        Lead_Category: leadInput.Lead_Category || 'Warm',
        Status: leadInput.Status || 'New',
        Follow_Up_Time: leadInput.Follow_Up_Time || '',
        WhatsApp_Message: leadInput.WhatsApp_Message || '',
        Time: leadInput.Time || new Date().toISOString().slice(0, 16).replace('T', ' '),
        Description: leadInput.Description || '',
        assignedTo: leadInput.assignedTo || user.uid,
        assignedToName: leadInput.assignedToName || user.name,
        activeWorkflowBy: '',
        activeWorkflowByName: '',
        activeWorkflowAt: '',
        deleted: false,
        deletedAt: '',
        deletedBy: '',
        deletedByName: '',
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: user.name,
        updatedAt: serverTimestamp(),
        version: 1,
      });

      batch.set(phoneRef, {
        phoneNormalized: leadInput.phoneNormalized,
        leadId: newLeadRef.id,
        Full_Name: leadInput.Full_Name,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    completed += slice.length;
    if (onProgress) {
      onProgress(completed, actionable.length);
    }
  }

  await logLeadActivity({
    leadId: 'BULK_IMPORT',
    leadName: `${completed} Leads`,
    action: 'LEADS_IMPORTED',
    user,
    details: `Imported ${completed} leads via ${sourceLabel}`,
  });

  return completed;
}

/**
 * Lightweight multi-user WhatsApp workflow lock so other team members see
 * "Currently being handled by [Name]" in real time.
 */
export async function setLeadWhatsAppLock(
  leadId: string,
  user: UserProfile | null
): Promise<void> {
  try {
    const leadRef = doc(db, LEADS_COLLECTION, leadId);
    await updateDoc(leadRef, {
      activeWorkflowBy: user ? user.uid : '',
      activeWorkflowByName: user ? user.name : '',
      activeWorkflowAt: user ? new Date().toISOString() : '',
      updatedBy: user ? user.uid : undefined,
    });
  } catch {
    // Non-blocking lock hint
  }
}

/**
 * Records a WhatsApp workflow outcome (Sent or Failed/Skipped) on a lead and logs it to activity history.
 */
export async function recordWhatsAppOutcome(params: {
  lead: Lead;
  outcome: 'sent' | 'failed';
  markContactedOnSend: boolean;
  user: UserProfile;
}): Promise<void> {
  const { lead, outcome, markContactedOnSend, user } = params;
  const leadRef = doc(db, LEADS_COLLECTION, lead.id);

  const nextStatus =
    outcome === 'sent' && markContactedOnSend && lead.Status === 'New'
      ? 'Contacted'
      : lead.Status;

  await updateDoc(leadRef, {
    Status: nextStatus,
    activeWorkflowBy: '',
    activeWorkflowByName: '',
    activeWorkflowAt: '',
    updatedBy: user.uid,
    updatedByName: user.name,
    updatedAt: serverTimestamp(),
    version: (lead.version || 1) + 1,
  });

  await logLeadActivity({
    leadId: lead.id,
    leadName: lead.Full_Name,
    action: outcome === 'sent' ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
    user,
    details:
      outcome === 'sent'
        ? `WhatsApp message marked SENT to ${lead.Full_Name} (${lead.Phone_Number})${
            nextStatus !== lead.Status ? ` • Status: ${lead.Status} → ${nextStatus}` : ''
          }`
        : `WhatsApp message marked FAILED / SKIPPED for ${lead.Full_Name} (${lead.Phone_Number})`,
  });
}

/**
 * Subscribes to shared custom dropdown values (`sources`, `roles`, `programs`, `categories`, `statuses`).
 */
export function subscribeToCustomOptions(onOptions: (options: CustomOptions) => void) {
  const docRef = doc(db, SETTINGS_COLLECTION, CUSTOM_OPTIONS_DOC);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onOptions(DEFAULT_CUSTOM_OPTIONS);
        return;
      }
      const data = snap.data();
      onOptions({
        sources: Array.from(new Set([...DEFAULT_CUSTOM_OPTIONS.sources, ...(data.sources || [])])),
        roles: Array.from(new Set([...DEFAULT_CUSTOM_OPTIONS.roles, ...(data.roles || [])])),
        programs: Array.from(new Set([...DEFAULT_CUSTOM_OPTIONS.programs, ...(data.programs || [])])),
        categories: Array.from(
          new Set([...DEFAULT_CUSTOM_OPTIONS.categories, ...(data.categories || [])])
        ),
        statuses: Array.from(new Set([...DEFAULT_CUSTOM_OPTIONS.statuses, ...(data.statuses || [])])),
      });
    },
    () => {
      onOptions(DEFAULT_CUSTOM_OPTIONS);
    }
  );
}

export async function addCustomDropdownOption(
  field: keyof CustomOptions,
  newValue: string,
  currentOptions: CustomOptions,
  user: UserProfile
): Promise<void> {
  const trimmed = newValue.trim();
  if (!trimmed) return;
  const updatedList = Array.from(new Set([...(currentOptions[field] || []), trimmed]));
  const docRef = doc(db, SETTINGS_COLLECTION, CUSTOM_OPTIONS_DOC);
  await setDoc(
    docRef,
    {
      ...currentOptions,
      [field]: updatedList,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
