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
  age?: number;
  guardianName: string;
  guardianContact: string;
  emergencyContact?: string;
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
  address?: string; // Residential address / location
  createdAt?: string;
}

export type FeeStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid';
export type FeeBillingBasis = 'fixed' | 'hourly' | 'per_session' | 'custom';
export type FeeType =
  | 'Monthly Tuition'
  | 'Activity Session'
  | 'Registration'
  | 'Therapy Session'
  | 'Care / Activity Session'
  | 'Hourly Daycare'
  | 'Per Session'
  | 'Custom'
  | string;

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface BusinessFinancialDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: 'Current' | 'Savings' | 'Overdraft' | 'Other' | '';
  upiId: string;
  qrCodeUrl?: string;
  paymentNotes?: string;
  updatedAt?: string;
}

export interface BusinessSettings {
  centreName: string;
  tagline: string;
  subName?: string;
  address: string;
  phone: string;
  email: string;
  regNumber?: string;
  financial: BusinessFinancialDetails;
  terms?: string;
  accentColor?: string;
}

export interface Fee {
  id?: string;
  invoiceNumber?: string;
  issueDate?: string; // YYYY-MM-DD
  studentId: string;
  studentName: string;
  // Customer & child info overrides (fully editable)
  guardianName?: string;
  guardianContact?: string;
  address?: string;
  classOrAge?: string;
  parentName?: string;
  // Items and pricing
  type: FeeType;
  customTypeName?: string;
  billingBasis?: FeeBillingBasis;
  rate?: number;
  units?: number;
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  amount: number; // Total amount / Grand Total
  amountPaid: number;
  dueDate: string;
  status: FeeStatus;
  paymentMode?: string;
  notes?: string;
  terms?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late';
export type TherapyType = 'Speech' | 'OT' | 'Behavioral' | 'Special Education';
export type ActivityType = 'Speech & Language' | 'Motor & Sensory Play' | 'Special Education';

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

export interface LedgerEntry {
  id: string;
  date: string;
  voucherNumber?: string;
  accountCode: string;
  accountName: string;
  counterAccountCode?: string;
  counterAccountName?: string;
  particulars: string;
  paymentMode?: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: 'Dr' | 'Cr';
  transactionType?: string;
  rawItem?: any;
}

export interface AccountLedgerReport {
  account: ChartOfAccountItem;
  periodLabel: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  openingBalanceType: 'Dr' | 'Cr';
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  netMovement: number;
  closingBalance: number;
  closingBalanceType: 'Dr' | 'Cr';
}
