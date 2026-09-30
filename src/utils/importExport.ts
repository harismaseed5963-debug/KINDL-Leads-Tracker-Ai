import * as XLSX from 'xlsx';
import { ImportRowResult, Lead, LeadFormInput } from '../types';
import { validateAndFormatPhone } from './phone';

/**
 * Maps flexible header variations from CSV / JSON / Excel files or legacy `leads_tracker_v1`
 * localStorage objects into the canonical KINDL Lead fields.
 */
function extractField(row: Record<string, any>, candidates: string[], fallback = ''): string {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const exactMatch = keys.find((k) => k.trim().toLowerCase() === candidate.toLowerCase());
    if (exactMatch !== undefined && row[exactMatch] !== null && row[exactMatch] !== undefined) {
      return String(row[exactMatch]).trim();
    }
  }
  return fallback;
}

export function mapRawObjectToLeadInput(raw: Record<string, any>): LeadFormInput {
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return {
    Full_Name: extractField(raw, ['Full_Name', 'full_name', 'fullName', 'Name', 'name', 'Full Name', 'Lead Name']),
    Phone_Number: extractField(raw, ['Phone_Number', 'phone_number', 'phoneNumber', 'Phone', 'phone', 'Phone Number', 'Mobile', 'Contact']),
    Age: extractField(raw, ['Age', 'age']),
    City: extractField(raw, ['City', 'city', 'Location']),
    Source: extractField(raw, ['Source', 'source', 'Lead Source', 'Channel'], 'Direct'),
    Lead_Role: extractField(raw, ['Lead_Role', 'lead_role', 'leadRole', 'Lead Role', 'Role', 'role'], 'Student'),
    Program: extractField(raw, ['Program', 'program', 'Course', 'Track'], 'General'),
    Lead_Category: extractField(raw, ['Lead_Category', 'lead_category', 'leadCategory', 'Lead Category', 'Category', 'category'], 'Warm'),
    Status: extractField(raw, ['Status', 'status', 'Lead Status', 'Stage'], 'New'),
    Follow_Up_Time: extractField(raw, ['Follow_Up_Time', 'follow_up_time', 'followUpTime', 'Follow-Up', 'Follow Up', 'Follow_Up', 'Follow Up Time']),
    WhatsApp_Message: extractField(raw, ['WhatsApp_Message', 'whatsapp_message', 'whatsappMessage', 'WhatsApp Message', 'WhatsApp', 'Message']),
    Time: extractField(raw, ['Time', 'time', 'Date', 'Created', 'Created At'], nowStr),
    Description: extractField(raw, ['Description', 'description', 'Notes', 'notes', 'Comment', 'Remarks']),
    assignedTo: extractField(raw, ['assignedTo', 'Assigned_To_UID'], ''),
    assignedToName: extractField(raw, ['assignedToName', 'Assigned To', 'Assigned_To', 'Owner'], ''),
  };
}

/**
 * Parses a CSV, JSON, or Excel (.xlsx / .xls) file into raw row objects.
 */
export async function parseImportFile(file: File): Promise<Record<string, any>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.leads)) return parsed.leads;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    throw new Error('JSON file must contain an array of lead objects.');
  }

  // Use SheetJS (xlsx) for CSV, XLSX, XLS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file contains no sheets or rows.');
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  return rows;
}

/**
 * Validates and classifies raw rows against existing leads in Firestore and internal file duplicates.
 */
export function validateImportRows(
  rawRows: Record<string, any>[],
  existingPhoneMap: Map<string, string> // phoneNormalized -> Full_Name
): ImportRowResult[] {
  const seenInFile = new Map<string, number>(); // phoneNormalized -> first rowNumber
  const results: ImportRowResult[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const mapped = mapRawObjectToLeadInput(raw);

    if (!mapped.Full_Name) {
      results.push({
        rowNumber,
        raw,
        status: 'invalid',
        reason: 'Missing Full Name',
      });
      return;
    }

    const phoneCheck = validateAndFormatPhone(mapped.Phone_Number);
    if (!phoneCheck.valid) {
      results.push({
        rowNumber,
        raw,
        status: 'invalid',
        reason: phoneCheck.error || 'Invalid Phone Number',
      });
      return;
    }

    // Check against existing leads in Firestore
    const existingOwner = existingPhoneMap.get(phoneCheck.normalized);
    if (existingOwner) {
      results.push({
        rowNumber,
        raw,
        lead: { ...mapped, Phone_Number: phoneCheck.formatted, phoneNormalized: phoneCheck.normalized },
        status: 'duplicate',
        existingOwnerName: existingOwner,
        reason: `Phone number already belongs to ${existingOwner}`,
      });
      return;
    }

    // Check against earlier row in the same import file
    const firstRow = seenInFile.get(phoneCheck.normalized);
    if (firstRow !== undefined) {
      results.push({
        rowNumber,
        raw,
        lead: { ...mapped, Phone_Number: phoneCheck.formatted, phoneNormalized: phoneCheck.normalized },
        status: 'duplicate',
        reason: `Duplicate of Row #${firstRow} within this file`,
      });
      return;
    }

    seenInFile.set(phoneCheck.normalized, rowNumber);
    results.push({
      rowNumber,
      raw,
      lead: {
        ...mapped,
        Phone_Number: phoneCheck.formatted,
        phoneNormalized: phoneCheck.normalized,
      },
      status: 'valid',
    });
  });

  return results;
}

/**
 * Exports an array of Leads to CSV, JSON, or Excel (.xlsx).
 */
export function exportLeadsFile(leads: Lead[], format: 'csv' | 'json' | 'xlsx', filenamePrefix = 'KINDL_Leads') {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const cleanRows = leads.map((lead) => ({
    Full_Name: lead.Full_Name || '',
    Phone_Number: lead.Phone_Number || '',
    Age: lead.Age || '',
    City: lead.City || '',
    Source: lead.Source || '',
    Lead_Role: lead.Lead_Role || '',
    Program: lead.Program || '',
    Lead_Category: lead.Lead_Category || '',
    Status: lead.Status || '',
    Follow_Up_Time: lead.Follow_Up_Time || '',
    Assigned_To: lead.assignedToName || '',
    WhatsApp_Message: lead.WhatsApp_Message || '',
    Time: lead.Time || '',
    Description: lead.Description || '',
    Updated_By: lead.updatedByName || '',
  }));

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(cleanRows, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${filenamePrefix}_${dateStamp}.json`);
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(cleanRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'KINDL Leads');

  if (format === 'csv') {
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${filenamePrefix}_${dateStamp}.csv`);
    return;
  }

  // Excel (.xlsx)
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStamp}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
