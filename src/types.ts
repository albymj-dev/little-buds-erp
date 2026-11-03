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

export type TransactionType = 'Income' | 'Expense' | 'Asset' | 'Investment' | 'Deposit' | 'Transfer' | 'Salary' | 'Accrual' | 'AccrualSettlement' | 'Custom';
export type PurchaseType = 'Expense' | 'Asset' | 'Investment' | 'Deposit' | 'Transfer' | 'Salary' | 'Accrual' | 'AccrualSettlement' | 'Custom';

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

export interface TransferDetails {
  transferType: 'CashToBank' | 'BankToCash';
  fromAccount: string; // e.g. 'Cash in Hand (Account 1010)'
  toAccount: string;   // e.g. 'Primary Bank Account (Account 1020)'
  bankName?: string;
  depositSlipNumber?: string;
  depositedBy?: string;
  notes?: string;
}

export interface SalaryDetails {
  staffName: string;
  designation?: string;
  salaryMonth: string; // e.g. "October 2026" or "2026-10"
  totalSalary: number; // Agreed/scheduled salary amount
  amountPaid: number;  // Amount paid
  balanceDue: number;  // Outstanding salary balance
  advanceAmount?: number; // Advance paid if any
  isPartial?: boolean;
  notes?: string;
}

export interface StaffSalary {
  id?: string;
  staffName: string;
  designation?: string;
  salaryMonth: string; // e.g. "October 2026"
  totalSalary: number; // Scheduled monthly salary
  amountPaid: number;  // Amount paid so far
  balanceDue: number;  // Outstanding salary payable
  advanceAmount?: number; // Advance amount if paid more than scheduled
  status: 'Paid' | 'Partially Paid' | 'Pending' | 'Advance';
  paymentDate: string; // DD/MM/YYYY or YYYY-MM-DD
  paymentMode: string; // 'Bank Transfer', 'Cash', 'UPI', 'Cheque'
  description?: string;
  ledgerAccountCode?: string; // Default '5010'
  liabilityAccountCode?: string; // Default '2030'
  transactionId?: string; // Linked FinanceTransaction ID
  paymentHistory?: SalaryPaymentRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryPaymentRecord {
  id?: string;
  salaryId?: string;
  staffName: string;
  salaryMonth: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
  description?: string;
  transactionId?: string;
  createdAt?: string;
}

export interface AccrualDetails {
  accrualId?: string;
  vendorOrRecipient: string;
  incurredDate?: string;
  dueDate?: string;
  isSettlement?: boolean;
  originalAccrualAmount?: number;
  remainingBalance?: number;
  invoiceNumber?: string;
}

export interface AccruedExpense {
  id?: string;
  category: string; // Expense category (e.g. Rent, Utilities, Consumables, or custom)
  vendorOrRecipient: string; // Landlord, vendor, service provider, consultant
  amount: number; // Incurred amount
  amountPaid: number; // Amount settled so far
  balanceDue: number; // Remaining outstanding liability
  status: 'Pending' | 'Partially Paid' | 'Settled';
  incurredDate: string; // Date expense was incurred
  dueDate: string; // Due date for payment
  description?: string;
  invoiceNumber?: string;
  expenseAccountCode: string; // e.g. '5020' or custom
  liabilityAccountCode: string; // e.g. '2010'
  transactionId?: string; // Linked accrual transaction
  settlementHistory?: AccrualSettlementRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AccrualSettlementRecord {
  id?: string;
  accrualId: string;
  vendorOrRecipient: string;
  category: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
  description?: string;
  transactionId?: string;
  createdAt?: string;
}

export interface CustomCategory {
  id?: string;
  name: string;
  type: 'Expense' | 'Income';
  defaultLedgerCode?: string;
  description?: string;
  createdAt?: string;
}

export interface FinanceTransaction {
  id?: string;
  date: string;
  type: TransactionType;
  purchaseType?: PurchaseType; // Distinguishes between Expense, Asset, Investment, Deposit, Transfer, Salary, Accrual, AccrualSettlement, or Custom
  category: string;
  amount: number;
  description: string;
  partnerName?: string; // Name of partner who invested
  paymentMode?: string; // e.g. 'Bank Transfer', 'Cheque', 'UPI', 'Cash', 'Cash to Bank Deposit'
  assetDetails?: AssetDetails;
  depositDetails?: DepositDetails;
  transferDetails?: TransferDetails;
  salaryDetails?: SalaryDetails;
  accrualDetails?: AccrualDetails;
  ledgerAccountCode?: string; // General ledger account code (e.g. '5010', '2010', custom)
  contraAccountCode?: string; // Counter balancing account code
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
