export type Role = 'Admin' | 'Teacher' | 'Staff' | 'Billing' | 'Therapist';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  username?: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
  name: string;
  email: string;
  role: Role;
  updatedAt: string;
}

export interface Student {
  id?: string;
  name: string;
  dob: string;
  guardianName: string;
  guardianContact: string;
  admissionDate: string;
  // Child care profile: developmental focus area / program
  primaryDiagnosis?: string; // Kept for backwards compatibility
  developmentalFocus?: string; // Child care terminology
  // Health & care notes (replaces medical history)
  medicalHistory?: string; // Kept for backwards compatibility
  careNotes?: string; // Child care terminology: health, dietary, care notes
  allergies: string;
  iepGoals?: string; // Kept for backwards compatibility
  developmentalGoals?: string; // Child care terminology: milestones and goals
  createdAt?: string;
}

export type FeeStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid';

export interface Fee {
  id?: string;
  studentId: string;
  studentName: string;
  type: 'Monthly Tuition' | 'Activity Session' | 'Registration' | 'Therapy Session';
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: FeeStatus;
  paymentMode?: string;
  createdAt?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late';
export type TherapyType = 'Speech' | 'OT' | 'Behavioral';
export type ActivityType = 'Speech & Communication' | 'Motor & Physical Play' | 'Social & Behavioral';

export interface Attendance {
  id?: string;
  studentId: string;
  studentName: string;
  date: string;
  status: AttendanceStatus;
  therapyType?: TherapyType | string; // Keep for backwards compatibility
  therapyTypes?: (TherapyType | string)[]; // Supports multiple activity sessions
  notes?: string;
  createdAt?: string;
}

export type TransactionType = 'Income' | 'Expense' | 'Asset' | 'Investment' | 'Deposit';
export type PurchaseType = 'Expense' | 'Asset' | 'Investment' | 'Deposit';

export interface AssetDetails {
  assetName: string;
  category: string; // e.g. 'Play & Learning Equipment', 'Furniture & Fixtures', 'IT & Electronics', 'Facility Improvements', 'Learning Kits'
  purchaseDate?: string;
  cost: number;
  usefulLifeYears?: number;
  locationOrRoom?: string;
  serialNumber?: string;
  condition?: 'Brand New' | 'Good' | 'Refurbished' | 'Fair';
  notes?: string;
}

export interface DepositDetails {
  depositCategory: string; // e.g. 'Premises & Building Lease Deposit', 'Electricity Board (KSEB) Deposit', 'Water / Utility Deposit'
  payeeName: string; // Landlord, Electricity Board, Vendor
  premisesOrAccount?: string; // Location or consumer meter number
  refundable?: boolean; // Default true (100% refundable asset)
  referenceNumber?: string; // Lease deed or receipt reference
  termsOrDuration?: string; // E.g. '3-Year Lease', 'Refundable upon vacancy'
  notes?: string;
}

export interface FinanceTransaction {
  id?: string;
  date: string;
  type: TransactionType;
  purchaseType?: PurchaseType; // Distinguishes between Operating Expense, Capital Asset purchase, Partner Investment, or Security Deposit
  category: string;
  amount: number;
  description: string;
  partnerName?: string; // Name of partner who invested
  paymentMode?: string; // e.g. 'Bank Transfer', 'Cheque', 'UPI', 'Cash'
  assetDetails?: AssetDetails;
  depositDetails?: DepositDetails;
  createdAt?: string;
}

export interface ActivityLog {
  id?: string;
  action: string;
  description: string;
  userEmail: string;
  timestamp: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type AccountNormalBalance = 'Debit' | 'Credit';

export interface ChartOfAccountItem {
  id?: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  normalBalance: AccountNormalBalance;
  description: string;
  isSystem?: boolean;
  isActive: boolean;
  linkedCategory?: string;
  createdAt?: string;
}
