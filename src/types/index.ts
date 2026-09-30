export type UserRole = 'admin' | 'manager' | 'member';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: any;
  lastLoginAt: any;
}

export interface Lead {
  id: string;
  Full_Name: string;
  Phone_Number: string;
  phoneNormalized: string;
  Age: string;
  City: string;
  Source: string;
  Lead_Role: string;
  Program: string;
  Lead_Category: string;
  Status: string;
  Follow_Up_Time: string;
  WhatsApp_Message: string;
  Time: string;
  Description: string;
  assignedTo?: string;
  assignedToName?: string;
  activeWorkflowBy?: string;
  activeWorkflowByName?: string;
  activeWorkflowAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedByName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedBy: string;
  updatedByName: string;
  updatedAt: any;
  version: number;
}

export interface LeadFormInput {
  Full_Name: string;
  Phone_Number: string;
  Age: string;
  City: string;
  Source: string;
  Lead_Role: string;
  Program: string;
  Lead_Category: string;
  Status: string;
  Follow_Up_Time: string;
  WhatsApp_Message: string;
  Time: string;
  Description: string;
  assignedTo?: string;
  assignedToName?: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  leadName?: string;
  action: string;
  performedBy: string;
  performedByName: string;
  timestamp: any;
  details: string;
}

export interface CustomOptions {
  sources: string[];
  roles: string[];
  programs: string[];
  categories: string[];
  statuses: string[];
}

export type ConnectionStatus = 'live' | 'reconnecting' | 'offline';

export type NavTab = 'dashboard' | 'leads' | 'followups' | 'activity' | 'users' | 'trash' | 'settings';

export type LeadFieldKey =
  | 'all'
  | 'Full_Name'
  | 'Phone_Number'
  | 'Age'
  | 'City'
  | 'Source'
  | 'Lead_Role'
  | 'Program'
  | 'Lead_Category'
  | 'Status'
  | 'Follow_Up_Time'
  | 'WhatsApp_Message'
  | 'Time'
  | 'Description'
  | 'assignedToName';

export interface ColumnConfig {
  key: keyof Lead;
  label: string;
  visible: boolean;
}

export interface ImportRowResult {
  rowNumber: number;
  raw: Record<string, any>;
  lead?: LeadFormInput & { phoneNormalized: string };
  status: 'valid' | 'duplicate' | 'invalid';
  reason?: string;
  existingOwnerName?: string;
}
