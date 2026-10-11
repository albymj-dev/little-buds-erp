import { collection, doc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ChartOfAccountItem, FinanceTransaction, Fee } from '../types';
import { logActivity, removeUndefinedFields } from './api';

export const DEFAULT_CHART_OF_ACCOUNTS: Omit<ChartOfAccountItem, 'id'>[] = [
  // 1000 - ASSETS
  {
    code: '1010',
    name: 'Operating Bank Account (Federal Bank / Current)',
    type: 'Asset',
    subtype: 'Cash & Bank',
    normalBalance: 'Debit',
    description: 'Primary operating account for tuition fees, vendor payments, UPI & digital receipts',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Bank Transfer'
  },
  {
    code: '1020',
    name: 'Petty Cash & Physical Cash Drawer',
    type: 'Asset',
    subtype: 'Cash & Bank',
    normalBalance: 'Debit',
    description: 'Physical cash held on premises for daily center consumables and walk-in cash receipts',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Cash'
  },
  {
    code: '1200',
    name: 'Child Care Tuition & Activity Fees Receivable',
    type: 'Asset',
    subtype: 'Accounts Receivable',
    normalBalance: 'Debit',
    description: 'Accrued pending and overdue fee balances owed by enrolled children and families',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Tuition Fees'
  },
  {
    code: '1300',
    name: 'Security Deposits Paid (Current Asset)',
    type: 'Asset',
    subtype: 'Current Asset',
    normalBalance: 'Debit',
    description: 'Refundable security deposits placed for premises rental lease, electricity board, utility meters, and vendor contracts',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Security Deposit'
  },
  {
    code: '1510',
    name: 'Learning & Play Equipment',
    type: 'Asset',
    subtype: 'Fixed Asset',
    normalBalance: 'Debit',
    description: 'Indoor play structures, active learning equipment, gross motor play kits, and sensory play modules',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Learning & Play Equipment'
  },
  {
    code: '1520',
    name: 'Centre Furniture & Classroom Fixtures',
    type: 'Asset',
    subtype: 'Fixed Asset',
    normalBalance: 'Debit',
    description: 'Ergonomic child-safe seating, activity tables, reading nooks, and storage cubbies',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Furniture & Fixtures'
  },
  {
    code: '1530',
    name: 'IT, Tablets & Electronics Infrastructure',
    type: 'Asset',
    subtype: 'Fixed Asset',
    normalBalance: 'Debit',
    description: 'Administrative tablets, learning computers, audio-visual educational equipment',
    isSystem: true,
    isActive: true,
    linkedCategory: 'IT & Electronics'
  },
  {
    code: '1540',
    name: 'Educational & Activity Toolkits',
    type: 'Asset',
    subtype: 'Fixed Asset',
    normalBalance: 'Debit',
    description: 'Standardized early learning curricula, activity sets, developmental milestone toolkits',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Assessment Kits'
  },
  {
    code: '1550',
    name: 'Facility & Play Area Improvements',
    type: 'Asset',
    subtype: 'Fixed Asset',
    normalBalance: 'Debit',
    description: 'Padded acoustic walls, reinforced child-safe fixtures, safety flooring and soft play surfaces',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Facility Improvements'
  },
  {
    code: '1600',
    name: 'Accumulated Depreciation (All Fixed Assets)',
    type: 'Asset',
    subtype: 'Contra-Asset',
    normalBalance: 'Credit',
    description: 'Cumulative non-cash depreciation amortized across capital child care assets',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Depreciation'
  },

  // 2000 - LIABILITIES
  {
    code: '2010',
    name: 'Accounts Payable (Vendors & Suppliers)',
    type: 'Liability',
    subtype: 'Current Liability',
    normalBalance: 'Credit',
    description: 'Invoices owed to child care equipment suppliers, activity vendors, maintenance contractors, and utilities',
    isSystem: true,
    isActive: true
  },
  {
    code: '2020',
    name: 'Advance Tuition Fees Received (Unearned)',
    type: 'Liability',
    subtype: 'Current Liability',
    normalBalance: 'Credit',
    description: 'Tuition and care fees collected in advance for upcoming terms or sessions',
    isSystem: true,
    isActive: true
  },
  {
    code: '2030',
    name: 'Accrued Staff Salaries & Caregiver Fees',
    type: 'Liability',
    subtype: 'Current Liability',
    normalBalance: 'Credit',
    description: 'Salaries and professional care allowances earned by educators and care staff awaiting payout',
    isSystem: true,
    isActive: true
  },
  {
    code: '2500',
    name: 'Long-Term Centre Financing & Loans',
    type: 'Liability',
    subtype: 'Non-Current Liability',
    normalBalance: 'Credit',
    description: 'Long-term loans and equipment financing facilities',
    isSystem: true,
    isActive: true
  },

  // 3000 - EQUITY
  {
    code: '3010',
    name: 'Partner Capital Fund (Founders & Partners)',
    type: 'Equity',
    subtype: 'Partner Capital',
    normalBalance: 'Credit',
    description: 'Capital investments contributed by centre partners (Alby Mathew, etc.)',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Partner Investment'
  },
  {
    code: '3020',
    name: 'Retained Operating Reserves & General Fund',
    type: 'Equity',
    subtype: 'Retained Earnings',
    normalBalance: 'Credit',
    description: 'Accumulated net surplus from prior operations reinvested in the centre',
    isSystem: true,
    isActive: true
  },
  {
    code: '3030',
    name: 'Current Period Operating Surplus / Net Profit',
    type: 'Equity',
    subtype: 'Current Surplus',
    normalBalance: 'Credit',
    description: 'Net operating surplus or deficit earned in the current fiscal period',
    isSystem: true,
    isActive: true
  },

  // 4000 - REVENUE
  {
    code: '4010',
    name: 'Monthly Child Care & Tuition Fees',
    type: 'Revenue',
    subtype: 'Operating Revenue',
    normalBalance: 'Credit',
    description: 'Monthly tuition and child care fees billed for enrolled children',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Monthly Tuition'
  },
  {
    code: '4020',
    name: 'Specialized Child Care & Activity Session Fees',
    type: 'Revenue',
    subtype: 'Operating Revenue',
    normalBalance: 'Credit',
    description: 'Direct billing for specialized early learning, daycare, and developmental care sessions',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Care Session'
  },
  {
    code: '4030',
    name: 'Child Admission & Registration Fees',
    type: 'Revenue',
    subtype: 'Operating Revenue',
    normalBalance: 'Credit',
    description: 'One-time admission registration, intake assessment, and enrolment fees',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Registration'
  },
  {
    code: '4090',
    name: 'Miscellaneous Operational Income & Grants',
    type: 'Revenue',
    subtype: 'Other Income',
    normalBalance: 'Credit',
    description: 'Grants, donations, workshop fees, and other auxiliary receipts',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Other'
  },

  // 5000 - OPERATING EXPENSES
  {
    code: '5010',
    name: 'Teacher, Caregiver & Staff Salaries',
    type: 'Expense',
    subtype: 'Staffing',
    normalBalance: 'Debit',
    description: 'Payroll for early childhood educators, caregivers, activity coordinators, and care staff',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Salaries'
  },
  {
    code: '5020',
    name: 'Centre Rent & Facility Lease',
    type: 'Expense',
    subtype: 'Premises',
    normalBalance: 'Debit',
    description: 'Monthly facility lease for child care rooms, play zones, and outdoor activity spaces',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Rent'
  },
  {
    code: '5030',
    name: 'Electricity, Water & Utilities',
    type: 'Expense',
    subtype: 'Utilities',
    normalBalance: 'Debit',
    description: 'Electricity, air conditioning, drinking water, and high-speed centre internet',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Utilities'
  },
  {
    code: '5040',
    name: 'Care Consumables & Activity Materials',
    type: 'Expense',
    subtype: 'Care Materials',
    normalBalance: 'Debit',
    description: 'Daily consumable sensory materials, tactile craft kits, activity reinforcers',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Supplies'
  },
  {
    code: '5050',
    name: 'Food, Snacks & Child Nutrition',
    type: 'Expense',
    subtype: 'Nutrition',
    normalBalance: 'Debit',
    description: 'Nutritious snacks, allergen-safe dietary substitutes, and pantry items',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Food & Snacks'
  },
  {
    code: '5060',
    name: 'Centre Maintenance, Sanitization & Repairs',
    type: 'Expense',
    subtype: 'Facilities',
    normalBalance: 'Debit',
    description: 'Child-safe sanitization, hygiene supplies, HVAC servicing, play area repairs',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Maintenance'
  },
  {
    code: '5070',
    name: 'Marketing, Branding & Parent Outreach',
    type: 'Expense',
    subtype: 'Marketing',
    normalBalance: 'Debit',
    description: 'Information brochures, family referrals, awareness events, website hosting',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Marketing'
  },
  {
    code: '5080',
    name: 'Software, Communication & IT Subscriptions',
    type: 'Expense',
    subtype: 'Administrative',
    normalBalance: 'Debit',
    description: 'Centre management software, parent communication portal, secure cloud storage',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Software'
  },
  {
    code: '5090',
    name: 'Staff Training & Professional Development',
    type: 'Expense',
    subtype: 'Professional Development',
    normalBalance: 'Debit',
    description: 'Early childhood development workshops, pediatric emergency care, child safety seminars',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Training'
  },
  {
    code: '5100',
    name: 'Bank, Gateway & Financial Charges',
    type: 'Expense',
    subtype: 'Financial',
    normalBalance: 'Debit',
    description: 'UPI transaction charges, bank account maintenance, payment gateway fees',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Bank Charges'
  },
  {
    code: '5120',
    name: 'Capital Asset Depreciation Expense',
    type: 'Expense',
    subtype: 'Non-Cash Expense',
    normalBalance: 'Debit',
    description: 'Periodic non-cash depreciation computed on capital learning, play, and facility assets',
    isSystem: true,
    isActive: true,
    linkedCategory: 'Depreciation'
  }
];

const STORAGE_KEY = 'little_buds_chart_of_accounts_v1';

export const getChartOfAccounts = async (): Promise<ChartOfAccountItem[]> => {
  try {
    const q = query(collection(db, 'chartOfAccounts'), orderBy('code', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChartOfAccountItem));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return items;
    }
  } catch (error) {
    console.warn('Firestore chartOfAccounts fetch fallback:', error);
  }

  // Fallback to local storage or defaults
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore error
  }

  // Seed default accounts in memory
  const defaultItems: ChartOfAccountItem[] = DEFAULT_CHART_OF_ACCOUNTS.map((acc, index) => ({
    ...acc,
    id: `default-${acc.code}-${index}`,
    createdAt: new Date().toISOString()
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultItems));
  return defaultItems;
};

export const addChartOfAccount = async (account: Omit<ChartOfAccountItem, 'id'>): Promise<string> => {
  const payload = removeUndefinedFields({
    ...account,
    createdAt: new Date().toISOString()
  });

  let newId = `coa-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, 'chartOfAccounts'), payload);
    newId = docRef.id;
  } catch (error) {
    console.warn('Firestore addDoc fallback to local cache:', error);
  }

  // Update local cache
  const existing = await getChartOfAccounts();
  const updated = [...existing, { id: newId, ...payload }].sort((a, b) => a.code.localeCompare(b.code));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  await logActivity('Created Account Head', `Added GL account ${account.code} - ${account.name} (${account.type})`);
  return newId;
};

export const updateChartOfAccount = async (id: string, data: Partial<ChartOfAccountItem>): Promise<void> => {
  const cleanedData = removeUndefinedFields(data);
  try {
    if (!id.startsWith('default-')) {
      await updateDoc(doc(db, 'chartOfAccounts', id), cleanedData);
    }
  } catch (error) {
    console.warn('Firestore updateDoc fallback:', error);
  }

  const existing = await getChartOfAccounts();
  const updated = existing.map(item => item.id === id ? { ...item, ...data } : item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  await logActivity('Updated Account Head', `Updated GL account ID ${id}`);
};

export const deleteChartOfAccount = async (id: string): Promise<void> => {
  try {
    if (!id.startsWith('default-')) {
      await deleteDoc(doc(db, 'chartOfAccounts', id));
    }
  } catch (error) {
    console.warn('Firestore deleteDoc fallback:', error);
  }

  const existing = await getChartOfAccounts();
  const updated = existing.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  await logActivity('Deleted Account Head', `Deleted GL account ID ${id}`);
};

/**
 * Calculates live real-time ledger balance for each account in the Chart of Accounts
 */
export const calculateAccountLedgerBalances = (
  accounts: ChartOfAccountItem[],
  transactions: FinanceTransaction[],
  fees: Fee[],
  liquidStats: { bankBalance: number; cashBalance: number; totalReceipts: number; totalPayments: number; depreciationTotal: number }
): Record<string, { balance: number; debitTotal: number; creditTotal: number; entryCount: number }> => {
  const result: Record<string, { balance: number; debitTotal: number; creditTotal: number; entryCount: number }> = {};

  // Initialize
  accounts.forEach(acc => {
    result[acc.code] = { balance: 0, debitTotal: 0, creditTotal: 0, entryCount: 0 };
  });

  // Calculate live balances:
  // 1010 - Bank
  if (result['1010']) {
    result['1010'].balance = liquidStats.bankBalance;
    result['1010'].debitTotal = Math.max(0, liquidStats.bankBalance);
    result['1010'].entryCount = transactions.filter(t => t.paymentMode !== 'Cash').length;
  }

  // 1020 - Cash
  if (result['1020']) {
    result['1020'].balance = liquidStats.cashBalance;
    result['1020'].debitTotal = Math.max(0, liquidStats.cashBalance);
    result['1020'].entryCount = transactions.filter(t => t.paymentMode === 'Cash').length;
  }

  // 1200 - Student Fees Receivable
  const pendingFeesTotal = fees
    .filter(f => f.status === 'Pending' || f.status === 'Overdue' || f.status === 'Partially Paid')
    .reduce((acc, f) => acc + (f.amount - (f.amountPaid || 0)), 0);
  if (result['1200']) {
    result['1200'].balance = pendingFeesTotal;
    result['1200'].debitTotal = pendingFeesTotal;
    result['1200'].entryCount = fees.filter(f => f.status !== 'Paid').length;
  }

  // 1300 - Security Deposits Paid (Current Asset)
  const depositTransactions = transactions.filter(t => 
    t.type === 'Deposit' || 
    t.purchaseType === 'Deposit' || 
    (t.category && t.category.toLowerCase().includes('deposit'))
  );
  const totalSecurityDeposits = depositTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  if (result['1300']) {
    result['1300'].balance = totalSecurityDeposits;
    result['1300'].debitTotal = totalSecurityDeposits;
    result['1300'].entryCount = depositTransactions.length;
  }

  // Fixed Assets: 1510, 1520, 1530, 1540, 1550 (excluding Security Deposits & Investments)
  const isDepositTx = (t: FinanceTransaction) => 
    t.type === 'Deposit' || t.purchaseType === 'Deposit' || (t.category && t.category.toLowerCase().includes('deposit'));
  const isInvestmentTx = (t: FinanceTransaction) => 
    t.type === 'Investment' || t.purchaseType === 'Investment' || (t.category && t.category.toLowerCase().includes('partner capital'));

  const assetTransactions = transactions.filter(t => 
    (t.type === 'Asset' || t.purchaseType === 'Asset') && !isDepositTx(t) && !isInvestmentTx(t)
  );
  
  const assetCategoryToCode: Record<string, string> = {
    'Therapy & Sensory Equipment': '1510',
    'Furniture & Fixtures': '1520',
    'IT & Electronics': '1530',
    'Assessment Kits': '1540',
    'Facility Improvements': '1550'
  };

  assetTransactions.forEach(tx => {
    const cat = tx.assetDetails?.category || tx.category;
    const code = assetCategoryToCode[cat] || '1510';
    if (result[code]) {
      result[code].balance += tx.amount;
      result[code].debitTotal += tx.amount;
      result[code].entryCount += 1;
    }
  });

  // 1600 - Accumulated Depreciation
  if (result['1600']) {
    result['1600'].balance = liquidStats.depreciationTotal;
    result['1600'].creditTotal = liquidStats.depreciationTotal;
    result['1600'].entryCount = assetTransactions.length;
  }

  // 3010 - Partner Capital
  const partnerTransactions = transactions.filter(t => t.type === 'Investment' || t.purchaseType === 'Investment');
  const totalPartnerCapital = partnerTransactions.reduce((acc, t) => acc + t.amount, 0);
  if (result['3010']) {
    result['3010'].balance = totalPartnerCapital;
    result['3010'].creditTotal = totalPartnerCapital;
    result['3010'].entryCount = partnerTransactions.length;
  }

  // 4010, 4020, 4030 - Revenues from fees and incomes
  fees.forEach(f => {
    const paid = f.amountPaid || 0;
    if (paid > 0) {
      if (f.type === 'Therapy Session' && result['4020']) {
        result['4020'].balance += paid;
        result['4020'].creditTotal += paid;
        result['4020'].entryCount += 1;
      } else if (f.type === 'Registration' && result['4030']) {
        result['4030'].balance += paid;
        result['4030'].creditTotal += paid;
        result['4030'].entryCount += 1;
      } else if (result['4010']) {
        result['4010'].balance += paid;
        result['4010'].creditTotal += paid;
        result['4010'].entryCount += 1;
      }
    }
  });

  // Other incomes
  const incomeTransactions = transactions.filter(t => t.type === 'Income');
  incomeTransactions.forEach(tx => {
    if (result['4090']) {
      result['4090'].balance += tx.amount;
      result['4090'].creditTotal += tx.amount;
      result['4090'].entryCount += 1;
    }
  });

  // 5000 Expenses: map transactions
  const expenseTransactions = transactions.filter(t => t.type === 'Expense' && t.purchaseType !== 'Asset' && t.purchaseType !== 'Investment');
  
  const expenseCategoryToCode: Record<string, string> = {
    'Salaries': '5010',
    'Rent': '5020',
    'Utilities': '5030',
    'Supplies': '5040',
    'Food & Snacks': '5050',
    'Maintenance': '5060',
    'Marketing': '5070',
    'Software': '5080',
    'Training': '5090',
    'Bank Charges': '5100'
  };

  expenseTransactions.forEach(tx => {
    const code = expenseCategoryToCode[tx.category] || '5040';
    if (result[code]) {
      result[code].balance += tx.amount;
      result[code].debitTotal += tx.amount;
      result[code].entryCount += 1;
    }
  });

  // 5120 - Depreciation Expense
  if (result['5120']) {
    result['5120'].balance = liquidStats.depreciationTotal;
    result['5120'].debitTotal = liquidStats.depreciationTotal;
    result['5120'].entryCount = assetTransactions.length;
  }

  // 3030 - Current Surplus (Revenues - Expenses)
  const totalRev = (result['4010']?.balance || 0) + (result['4020']?.balance || 0) + (result['4030']?.balance || 0) + (result['4090']?.balance || 0);
  const totalExp = Object.keys(result)
    .filter(code => code.startsWith('5'))
    .reduce((sum, code) => sum + (result[code]?.balance || 0), 0);
  const netSurplus = totalRev - totalExp;

  if (result['3030']) {
    result['3030'].balance = netSurplus;
    if (netSurplus >= 0) {
      result['3030'].creditTotal = netSurplus;
    } else {
      result['3030'].debitTotal = Math.abs(netSurplus);
    }
  }

  return result;
};
