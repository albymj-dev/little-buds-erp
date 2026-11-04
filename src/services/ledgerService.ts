import { ChartOfAccountItem, FinanceTransaction, Fee, LedgerEntry, AccountLedgerReport } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatDate } from '../utils/dateUtils';
import {
  EXCEL_COLORS,
  NUMBER_FORMATS,
  BORDERS,
  styleHeaderRow,
  styleDataRow,
  styleSectionHeaderRow,
  styleTotalRow,
  autoFitWorksheetColumns,
  setupSheetViews
} from '../utils/excelFormatters';

// Helper to determine cash vs non-cash payment mode
export const isCashMode = (mode?: string): boolean => {
  if (!mode) return false;
  const m = mode.trim().toLowerCase();
  return m === 'cash' || m.startsWith('cash') || m.includes('cash');
};

// Safe number parsing
const safeNum = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Map transaction categories to account codes
const EXPENSE_CATEGORY_TO_CODE: Record<string, string> = {
  'Salaries & Staff Welfare': '5010',
  'Salaries': '5010',
  'Rent & Premises': '5020',
  'Rent': '5020',
  'Utilities & Electricity': '5030',
  'Utilities': '5030',
  'Learning Consumables, Toys & Craft Materials': '5040',
  'Supplies': '5040',
  'Food, Snacks & Child Nutrition': '5050',
  'Food & Snacks': '5050',
  'Repairs & Maintenance': '5060',
  'Cleaning & Hygiene': '5060',
  'Maintenance': '5060',
  'Marketing & Outreach': '5070',
  'Marketing': '5070',
  'Software & Subscriptions': '5080',
  'Software': '5080',
  'Staff Welfare & Training': '5090',
  'Training': '5090',
  'Office & Printing Supplies': '5040',
  'Bank Charges': '5100',
  'Taxi & General Conveyance': '5130',
  'Conveyance': '5130',
  'Documentation & Registration': '5140',
  'Registration': '5140',
  'Stationary Expenses': '5150',
  'Stationery Expenses': '5150',
  'Stationary': '5150',
  'Stationery': '5150',
  'Mobile & Internet Expenses': '5160',
  'Mobile & Internet': '5160',
  'Canteen Expenses': '5170',
  'Canteen': '5170',
  'Refreshment Expenses': '5180',
  'Refreshments': '5180',
  'Other Operational Expense': '5040'
};

const ASSET_CATEGORY_TO_CODE: Record<string, string> = {
  'Play & Learning Equipment': '1510',
  'Learning & Play Equipment': '1510',
  'Classroom Furniture & Fixtures': '1520',
  'Furniture & Fixtures': '1520',
  'IT & Electronic Hardware': '1530',
  'IT & Electronics': '1530',
  'Child Development & Learning Kits': '1540',
  'Assessment Kits': '1540',
  'Facility & Safety Infrastructure': '1550',
  'Facility Improvements': '1550',
  'Vehicle & Transport': '1550',
  'Other Capital Assets': '1510'
};

/**
 * Indian Financial Year Structure & Calculations
 * Indian FY runs strictly from April 1 to March 31 of the subsequent year.
 */
export interface IndianFYInfo {
  fyStartYear: number;
  fyEndYear: number;
  fyStartDate: string; // 'YYYY-04-01'
  fyEndDate: string; // 'YYYY-03-31'
  fyLabel: string; // 'FY 2026-2027'
  quarterNumber: number; // 1, 2, 3, or 4
  quarterLabel: string; // 'Q3 FY 2026-2027'
  quarterStartDate: string;
  quarterEndDate: string;
  elapsedMonthsYTD: number; // 1 to 12
}

export const getIndianFYInfo = (dateInput: Date | string = new Date()): IndianFYInfo => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const m = validDate.getMonth(); // 0 = Jan, 3 = Apr, 11 = Dec
  const y = validDate.getFullYear();

  const fyStartYear = m >= 3 ? y : y - 1;
  const fyEndYear = fyStartYear + 1;
  const fyStartDate = `${fyStartYear}-04-01`;
  const fyEndDate = `${fyEndYear}-03-31`;
  const fyLabel = `FY ${fyStartYear}-${fyEndYear}`;

  let quarterNumber = 1;
  let quarterStartDate = `${fyStartYear}-04-01`;
  let quarterEndDate = `${fyStartYear}-06-30`;

  if (m >= 3 && m <= 5) {
    quarterNumber = 1;
    quarterStartDate = `${fyStartYear}-04-01`;
    quarterEndDate = `${fyStartYear}-06-30`;
  } else if (m >= 6 && m <= 8) {
    quarterNumber = 2;
    quarterStartDate = `${fyStartYear}-07-01`;
    quarterEndDate = `${fyStartYear}-09-30`;
  } else if (m >= 9 && m <= 11) {
    quarterNumber = 3;
    quarterStartDate = `${fyStartYear}-10-01`;
    quarterEndDate = `${fyStartYear}-12-31`;
  } else {
    quarterNumber = 4;
    quarterStartDate = `${fyEndYear}-01-01`;
    quarterEndDate = `${fyEndYear}-03-31`;
  }

  const quarterLabel = `Q${quarterNumber} ${fyLabel}`;

  // In Indian FY (Apr-Mar):
  // Apr (3): 1, May (4): 2, ..., Dec (11): 9, Jan (0): 10, Feb (1): 11, Mar (2): 12
  const elapsedMonthsYTD = m >= 3 ? (m - 3 + 1) : (m + 9 + 1);

  return {
    fyStartYear,
    fyEndYear,
    fyStartDate,
    fyEndDate,
    fyLabel,
    quarterNumber,
    quarterLabel,
    quarterStartDate,
    quarterEndDate,
    elapsedMonthsYTD
  };
};

/**
 * Calculates Accumulated Depreciation (Account 1600) and Current Indian FY Depreciation Expense (Account 5120)
 * for a list of capital asset transactions.
 */
export const calculateAssetDepreciationBreakdown = (
  assetTransactions: FinanceTransaction[],
  asOfDate: Date | string = new Date()
) => {
  const asOf = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
  const validAsOf = isNaN(asOf.getTime()) ? new Date() : asOf;
  const asOfIso = validAsOf.toISOString().split('T')[0];
  const fyInfo = getIndianFYInfo(validAsOf);

  let totalAccumulatedDepreciation = 0;
  let currentFYDepreciationYTD = 0;

  const perAsset = assetTransactions.map(t => {
    const cost = safeNum(t.amount);
    const usefulYears = safeNum(t.assetDetails?.usefulLifeYears) || 5;
    const usefulMonths = usefulYears * 12;
    const monthlyDep = usefulMonths > 0 ? cost / usefulMonths : 0;
    const purchaseDate = t.date || asOfIso;

    let assetAccumulatedDep = 0;
    let assetFYDep = 0;
    let totalMonthsActive = 0;
    let fyMonthsActive = 0;

    if (purchaseDate <= asOfIso) {
      const pDate = new Date(purchaseDate);
      // Total elapsed calendar months from purchase month up to the as-of reporting month
      const elapsedAll = Math.max(1, (validAsOf.getFullYear() - pDate.getFullYear()) * 12 + (validAsOf.getMonth() - pDate.getMonth()) + 1);
      totalMonthsActive = Math.min(usefulMonths, elapsedAll);
      assetAccumulatedDep = Math.min(cost, Math.round(totalMonthsActive * monthlyDep));

      // Calculate months active within the Indian Financial Year (cumulative from April 1 to as-of month)
      const serviceStartThisFY = purchaseDate > fyInfo.fyStartDate ? purchaseDate : fyInfo.fyStartDate;
      if (serviceStartThisFY <= asOfIso) {
        const sDate = new Date(serviceStartThisFY);
        const elapsedFY = Math.max(1, (validAsOf.getFullYear() - sDate.getFullYear()) * 12 + (validAsOf.getMonth() - sDate.getMonth()) + 1);

        // Months elapsed before this FY began (prior to April 1)
        const priorMonths = purchaseDate < fyInfo.fyStartDate
          ? Math.max(0, (fyInfo.fyStartYear - pDate.getFullYear()) * 12 + (3 - pDate.getMonth()))
          : 0;
        const remainingMonths = Math.max(0, usefulMonths - priorMonths);
        fyMonthsActive = Math.min(remainingMonths, elapsedFY);
        const priorDep = Math.round(priorMonths * monthlyDep);
        assetFYDep = Math.min(Math.max(0, cost - priorDep), Math.round(fyMonthsActive * monthlyDep));
        if (assetFYDep < 0) assetFYDep = 0;
      }
    }

    totalAccumulatedDepreciation += assetAccumulatedDep;
    currentFYDepreciationYTD += assetFYDep;

    return {
      transaction: t,
      cost,
      usefulYears,
      monthlyDep,
      purchaseDate,
      totalMonthsActive,
      fyMonthsActive,
      assetAccumulatedDep,
      assetFYDep,
      bookValue: Math.max(0, cost - assetAccumulatedDep)
    };
  });

  return {
    totalAccumulatedDepreciation,
    currentFYDepreciationYTD,
    fyInfo,
    perAsset
  };
};

/**
 * Generates monthly periodic depreciation entries for Account 1600 (Accumulated Depreciation)
 * or Account 5120 (Depreciation Expense) through the end of the Indian Financial Year (March 31).
 */
export const generateAssetDepreciationEntries = (
  accountCode: '1600' | '5120',
  accountName: string,
  assetTransactions: FinanceTransaction[]
): Omit<LedgerEntry, 'balance' | 'balanceType'>[] => {
  const result: Omit<LedgerEntry, 'balance' | 'balanceType'>[] = [];
  const now = new Date();
  const fyInfo = getIndianFYInfo(now);
  // Cumulative Financial Year runs through March 31 of fyEndYear
  const endYear = fyInfo.fyEndYear;
  const endMonth = 2; // March (0-indexed: 0=Jan, 1=Feb, 2=Mar)

  assetTransactions.forEach(t => {
    const cost = safeNum(t.amount);
    if (cost <= 0) return;
    const usefulYears = safeNum(t.assetDetails?.usefulLifeYears) || 5;
    const usefulMonths = usefulYears * 12;
    if (usefulMonths <= 0) return;
    const monthlyDep = cost / usefulMonths;
    const pDate = new Date(t.date || now.toISOString().split('T')[0]);
    if (isNaN(pDate.getTime())) return;

    const assetName = t.assetDetails?.assetName || t.description || 'Capital Asset';
    const assetIdShort = t.id ? t.id.slice(-6).toUpperCase() : 'AST';

    let curYear = pDate.getFullYear();
    let curMonth = pDate.getMonth(); // 0-11
    let monthCount = 0;
    let cumDep = 0;

    while ((curYear < endYear || (curYear === endYear && curMonth <= endMonth)) && monthCount < usefulMonths) {
      monthCount++;
      const lastDay = new Date(curYear, curMonth + 1, 0).getDate();
      const entryDate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const monthDate = new Date(curYear, curMonth, 1);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });
      const fy = getIndianFYInfo(monthDate);

      let monthAmt = Math.round(monthlyDep);
      if (monthCount === usefulMonths || cumDep + monthAmt > cost) {
        monthAmt = Math.max(0, cost - cumDep);
      }
      cumDep += monthAmt;

      if (monthAmt > 0) {
        if (accountCode === '1600') {
          result.push({
            id: `deprec-1600-${t.id || 'ast'}-${curYear}-${curMonth}`,
            date: entryDate,
            voucherNumber: `DEP-${curYear}${String(curMonth + 1).padStart(2, '0')}-${assetIdShort}`,
            accountCode: '1600',
            accountName,
            counterAccountCode: '5120',
            counterAccountName: 'Capital Asset Depreciation Expense',
            particulars: `Monthly Amortization: ${assetName} (${usefulYears} yr life) - ${monthName} ${curYear} [${fy.fyLabel}]`,
            paymentMode: 'Non-Cash Amortization',
            debit: 0,
            credit: monthAmt,
            transactionType: 'Depreciation Provision',
            rawItem: t
          });
        } else {
          result.push({
            id: `deprec-5120-${t.id || 'ast'}-${curYear}-${curMonth}`,
            date: entryDate,
            voucherNumber: `DEP-EXP-${curYear}${String(curMonth + 1).padStart(2, '0')}-${assetIdShort}`,
            accountCode: '5120',
            accountName,
            counterAccountCode: '1600',
            counterAccountName: 'Accumulated Depreciation (All Fixed Assets)',
            particulars: `Depreciation Charge: ${assetName} (${usefulYears} yr life) - ${monthName} ${curYear} [${fy.fyLabel}]`,
            paymentMode: 'Non-Cash Charge',
            debit: monthAmt,
            credit: 0,
            transactionType: 'Depreciation Charge',
            rawItem: t
          });
        }
      }

      curMonth++;
      if (curMonth > 11) {
        curMonth = 0;
        curYear++;
      }
    }
  });

  return result;
};

/**
 * Transaction Classification Helpers
 * Standardized single source of truth across Ledgers, Reports, Balance Sheet, and P&L.
 */

export const isCashToBankTx = (t: FinanceTransaction): boolean => {
  if (t.transferDetails?.transferType === 'CashToBank') return true;
  if (t.transferDetails?.transferType === 'BankToCash') return false;

  const cat = (t.category || '').trim().toLowerCase();
  const desc = (t.description || '').trim().toLowerCase();
  const mode = (t.paymentMode || '').trim().toLowerCase();

  // Explicit security deposit categories must not match
  if (cat.includes('security deposit') || cat.includes('rental deposit') || cat.includes('caution deposit')) {
    return false;
  }

  // Matches all variations of Cash Deposit to Bank
  if (
    cat === 'cash deposit to bank' ||
    cat === 'cash to bank transfer' ||
    cat === 'cash to bank' ||
    cat === 'cash deposit' ||
    cat === 'deposit to bank' ||
    cat === 'deposit in bank' ||
    cat === 'deposit cash to bank' ||
    cat === 'deposit cash in bank' ||
    cat === 'deposit cash' ||
    cat === 'cash in hand to bank' ||
    (cat.includes('deposit') && (cat.includes('cash') || cat.includes('to bank') || cat.includes('bank')))
  ) {
    return true;
  }

  if (mode === 'cash to bank deposit' || mode === 'cash to bank') return true;
  if (
    desc.includes('cash in hand deposited to bank') ||
    desc.includes('cash deposited to bank') ||
    desc.includes('convert cash in hand to bank') ||
    desc.includes('deposited to bank')
  ) {
    return true;
  }

  if (t.type === 'Transfer' || t.purchaseType === 'Transfer') {
    if (t.transferDetails?.fromAccount?.toLowerCase().includes('cash') || t.transferDetails?.toAccount?.toLowerCase().includes('bank')) {
      return true;
    }
    if (!cat.includes('withdraw') && !desc.includes('withdraw')) {
      return true;
    }
  }

  return false;
};

export const isBankToCashTx = (t: FinanceTransaction): boolean => {
  if (t.transferDetails?.transferType === 'BankToCash') return true;
  if (t.transferDetails?.transferType === 'CashToBank') return false;

  const cat = (t.category || '').trim().toLowerCase();
  const desc = (t.description || '').trim().toLowerCase();
  const mode = (t.paymentMode || '').trim().toLowerCase();

  if (
    cat === 'cash withdrawal from bank' ||
    cat === 'bank to cash withdrawal' ||
    cat === 'bank withdrawal to cash' ||
    cat === 'cash withdrawal' ||
    cat === 'withdraw cash' ||
    cat === 'withdrawal from bank' ||
    cat === 'bank to cash' ||
    cat === 'bank withdrawal' ||
    cat === 'atm withdrawal' ||
    cat === 'cash from bank' ||
    cat.includes('withdraw') ||
    cat.includes('bank to cash') ||
    cat.includes('cash from bank')
  ) {
    return true;
  }

  if (mode === 'bank to cash withdrawal' || mode === 'bank to cash') return true;
  if (
    desc.includes('cash withdrawn from bank') ||
    desc.includes('withdrawn from bank') ||
    desc.includes('withdraw cash') ||
    desc.includes('cash withdrawal')
  ) {
    return true;
  }

  if (t.type === 'Transfer' || t.purchaseType === 'Transfer') {
    if (t.transferDetails?.fromAccount?.toLowerCase().includes('bank') || t.transferDetails?.toAccount?.toLowerCase().includes('cash')) {
      return true;
    }
  }

  return false;
};

export const isTransferTx = (t: FinanceTransaction): boolean => {
  return t.type === 'Transfer' || 
         t.purchaseType === 'Transfer' || 
         isCashToBankTx(t) || 
         isBankToCashTx(t);
};

export const isDepositTx = (t: FinanceTransaction): boolean => {
  // CRITICAL: Cash in hand deposited to bank is an internal Contra Transfer between Bank and Cash,
  // NOT a security deposit asset (Account 1300)!
  if (isTransferTx(t) || isCashToBankTx(t) || isBankToCashTx(t)) return false;

  const cat = (t.category || '').trim().toLowerCase();
  const desc = (t.description || '').trim().toLowerCase();

  // Prevent any cash to bank deposit from matching
  if (cat.includes('cash') || cat.includes('to bank') || desc.includes('to bank')) {
    return false;
  }

  return t.type === 'Deposit' || 
         t.purchaseType === 'Deposit' || 
         cat.includes('security deposit') ||
         cat.includes('rental deposit') ||
         cat.includes('utility deposit') ||
         cat.includes('caution deposit') ||
         cat.includes('lease deposit') ||
         (!!t.depositDetails && !t.transferDetails);
};

export const isInvestmentTx = (t: FinanceTransaction): boolean => {
  if (isTransferTx(t) || isDepositTx(t)) return false;
  const cat = (t.category || '').trim().toLowerCase();
  return t.type === 'Investment' || 
         t.purchaseType === 'Investment' || 
         cat.includes('partner capital') ||
         cat.includes('partner investment') ||
         !!t.partnerName;
};

export const isAssetTx = (t: FinanceTransaction): boolean => {
  if (isTransferTx(t) || isDepositTx(t) || isInvestmentTx(t)) return false;
  return t.type === 'Asset' || t.purchaseType === 'Asset' || !!t.assetDetails;
};

export const isExpenseTx = (t: FinanceTransaction): boolean => {
  // CRITICAL: Cash withdrawal and Cash deposit contra transactions
  // MUST NEVER be treated as operating expenses!
  if (isTransferTx(t) || isCashToBankTx(t) || isBankToCashTx(t)) return false;
  if (isDepositTx(t) || isInvestmentTx(t) || isAssetTx(t)) return false;

  const cat = (t.category || '').trim().toLowerCase();
  const desc = (t.description || '').trim().toLowerCase();

  // Strict barrier: any transfer/contra/withdrawal keyword must never become an expense
  if (
    cat.includes('withdraw') ||
    cat.includes('contra') ||
    (cat.includes('deposit') && !cat.includes('security') && !cat.includes('rental') && !cat.includes('caution')) ||
    desc.includes('withdrawn from bank') ||
    desc.includes('deposited to bank')
  ) {
    return false;
  }

  if (t.purchaseType === 'AccrualSettlement') return false;

  return t.type === 'Expense' || 
         t.purchaseType === 'Expense' || 
         t.purchaseType === 'Salary' || 
         t.purchaseType === 'Accrual';
};

export const isIncomeTx = (t: FinanceTransaction): boolean => {
  if (isTransferTx(t) || isDepositTx(t) || isInvestmentTx(t) || isAssetTx(t) || isExpenseTx(t)) return false;
  return t.type === 'Income';
};

/**
 * Returns all raw ledger entries generated across all time for a specific account.
 */
export const getRawEntriesForAccount = (
  account: ChartOfAccountItem,
  transactions: FinanceTransaction[],
  fees: Fee[],
  allAccounts: ChartOfAccountItem[]
): Omit<LedgerEntry, 'balance' | 'balanceType'>[] => {
  const entries: Omit<LedgerEntry, 'balance' | 'balanceType'>[] = [];
  const code = account.code;

  const findAccountName = (c: string): string => {
    const found = allAccounts.find(a => a.code === c);
    return found ? found.name : c;
  };

  // ----------------------------------------------------
  // 1. BANK ACCOUNT (1010)
  // ----------------------------------------------------
  if (code === '1010') {
    // Fee payments via digital / bank
    fees.forEach(f => {
      const paid = safeNum(f.amountPaid);
      if (paid > 0 && !isCashMode(f.paymentMode)) {
        const date = f.dueDate || (f.createdAt ? f.createdAt.split('T')[0] : '2026-01-01');
        entries.push({
          id: `fee-${f.id || Math.random()}`,
          date,
          voucherNumber: `FEE-${f.id ? f.id.slice(-6).toUpperCase() : 'REC'}`,
          accountCode: '1010',
          accountName: account.name,
          counterAccountCode: '4010',
          counterAccountName: 'Tuition & Child Care Revenue',
          particulars: `Fee Collection: ${f.studentName} - ${f.type || 'Child Care Fee'}${f.notes ? ` (${f.notes})` : ''}`,
          paymentMode: f.paymentMode || 'Bank / Online Transfer',
          debit: paid,
          credit: 0,
          transactionType: 'Fee Receipt',
          rawItem: f
        });
      }
    });

    // Incomes via bank
    transactions.filter(t => isIncomeTx(t) && !isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-inc-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `INC-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: '4090',
        counterAccountName: 'Other Incomes & Subsidies',
        particulars: `${t.description || t.category} (${t.category})`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: amt,
        credit: 0,
        transactionType: 'Income',
        rawItem: t
      });
    });

    // Partner Capital contributions via bank
    transactions.filter(t => isInvestmentTx(t) && !isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-inv-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CAP-${t.id ? t.id.slice(-6).toUpperCase() : 'INV'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: '3010',
        counterAccountName: `Partner Capital (${t.partnerName || 'Partner'})`,
        particulars: `Capital Contribution from ${t.partnerName || 'Partner'}: ${t.description || t.category}`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: amt,
        credit: 0,
        transactionType: 'Partner Capital',
        rawItem: t
      });
    });

    // Operating expenses paid via bank
    transactions.filter(t => isExpenseTx(t) && !isCashMode(t.paymentMode)).forEach(t => {
      // Exclude unpaid accruals from bank outflow
      if (t.purchaseType === 'Accrual') return;

      const amt = safeNum(t.amount);
      const targetExpCode = t.ledgerAccountCode || EXPENSE_CATEGORY_TO_CODE[t.category] || (t.purchaseType === 'Salary' ? '5010' : '5040');
      const txnTypeLabel = t.purchaseType === 'Salary'
        ? 'Salary Payment'
        : t.purchaseType === 'AccrualSettlement'
        ? 'Accrual Settlement'
        : 'Expense Payment';

      entries.push({
        id: `txn-exp-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: t.purchaseType === 'Salary' ? `SAL-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}` : `EXP-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: targetExpCode,
        counterAccountName: findAccountName(targetExpCode),
        particulars: `${t.description || t.category} [${t.category}]`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: 0,
        credit: amt,
        transactionType: txnTypeLabel,
        rawItem: t
      });
    });

    // Capital Asset purchases paid via bank
    transactions.filter(t => isAssetTx(t) && !isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      const targetAssetCode = ASSET_CATEGORY_TO_CODE[t.assetDetails?.category || t.category] || '1510';
      entries.push({
        id: `txn-ast-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `AST-${t.id ? t.id.slice(-6).toUpperCase() : 'CAP'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: targetAssetCode,
        counterAccountName: findAccountName(targetAssetCode),
        particulars: `Asset Purchase: ${t.assetDetails?.assetName || t.description || 'Capital Asset'} (${t.category})`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: 0,
        credit: amt,
        transactionType: 'Capital Asset Purchase',
        rawItem: t
      });
    });

    // Security Deposits paid via bank
    transactions.filter(t => isDepositTx(t) && !isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-dep-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `DEP-${t.id ? t.id.slice(-6).toUpperCase() : 'SEC'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: '1300',
        counterAccountName: 'Security Deposits Paid',
        particulars: `Security Deposit Paid: ${t.depositDetails?.depositCategory || t.category} (${t.depositDetails?.payeeName || t.description || 'Landlord/Authority'})`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: 0,
        credit: amt,
        transactionType: 'Security Deposit',
        rawItem: t
      });
    });

    // Contra: Cash in Hand deposited to Bank (Bank DEBIT, increases bank balance)
    transactions.filter(t => isCashToBankTx(t)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-cnt-dep-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CNT-DEP-${t.id ? t.id.slice(-6).toUpperCase() : 'BNK'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: '1020',
        counterAccountName: 'Petty Cash & Physical Cash Drawer',
        particulars: `Contra Deposit: Cash deposited to Bank ${t.transferDetails?.depositSlipNumber ? `(Slip #${t.transferDetails.depositSlipNumber})` : ''}`,
        paymentMode: t.paymentMode || 'Cash to Bank Deposit',
        debit: amt,
        credit: 0,
        transactionType: 'Contra Transfer',
        rawItem: t
      });
    });

    // Contra: Cash Withdrawn from Bank (Bank CREDIT, decreases bank balance)
    transactions.filter(t => isBankToCashTx(t)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-cnt-wth-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CNT-WTH-${t.id ? t.id.slice(-6).toUpperCase() : 'CSH'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: '1020',
        counterAccountName: 'Petty Cash & Physical Cash Drawer',
        particulars: `Contra Withdrawal: Cash withdrawn from Bank for Cash Drawer ${t.transferDetails?.depositSlipNumber ? `(Cheque/Ref #${t.transferDetails.depositSlipNumber})` : ''}`,
        paymentMode: t.paymentMode || 'Bank to Cash Withdrawal',
        debit: 0,
        credit: amt,
        transactionType: 'Contra Transfer',
        rawItem: t
      });
    });

  }

  // ----------------------------------------------------
  // 2. CASH DRAWER / PETTY CASH (1020)
  // ----------------------------------------------------
  else if (code === '1020') {
    // Contra: Cash in Hand deposited to Bank (Cash CREDIT, decreases physical cash)
    transactions.filter(t => isCashToBankTx(t)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-cnt-csh-dep-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CNT-DEP-${t.id ? t.id.slice(-6).toUpperCase() : 'CSH'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: '1010',
        counterAccountName: 'Operating Bank Account (Primary Bank Account)',
        particulars: `Contra Deposit: Cash deposited to ${t.transferDetails?.bankName || 'Bank'} ${t.transferDetails?.depositSlipNumber ? `(Slip #${t.transferDetails.depositSlipNumber})` : ''}`,
        paymentMode: 'Cash to Bank Deposit',
        debit: 0,
        credit: amt,
        transactionType: 'Contra Transfer',
        rawItem: t
      });
    });

    // Contra: Cash Withdrawn from Bank (Cash DEBIT, increases physical cash)
    transactions.filter(t => isBankToCashTx(t)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-cnt-csh-wth-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CNT-WTH-${t.id ? t.id.slice(-6).toUpperCase() : 'CSH'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: '1010',
        counterAccountName: 'Operating Bank Account (Primary Bank Account)',
        particulars: `Contra Withdrawal: Cash withdrawn from ${t.transferDetails?.bankName || 'Bank'} to Cash Drawer ${t.transferDetails?.depositSlipNumber ? `(Ref #${t.transferDetails.depositSlipNumber})` : ''}`,
        paymentMode: 'Bank to Cash Withdrawal',
        debit: amt,
        credit: 0,
        transactionType: 'Contra Transfer',
        rawItem: t
      });
    });
    // Fee payments via physical cash
    fees.forEach(f => {
      const paid = safeNum(f.amountPaid);
      if (paid > 0 && isCashMode(f.paymentMode)) {
        const date = f.dueDate || (f.createdAt ? f.createdAt.split('T')[0] : '2026-01-01');
        entries.push({
          id: `fee-cash-${f.id || Math.random()}`,
          date,
          voucherNumber: `CSH-${f.id ? f.id.slice(-6).toUpperCase() : 'REC'}`,
          accountCode: '1020',
          accountName: account.name,
          counterAccountCode: '4010',
          counterAccountName: 'Tuition & Child Care Revenue',
          particulars: `Walk-in Cash Fee: ${f.studentName} - ${f.type || 'Child Care Fee'}`,
          paymentMode: 'Cash',
          debit: paid,
          credit: 0,
          transactionType: 'Fee Receipt',
          rawItem: f
        });
      }
    });

    // Incomes via cash
    transactions.filter(t => isIncomeTx(t) && isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-inc-csh-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `INC-CSH-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: '4090',
        counterAccountName: 'Other Incomes & Subsidies',
        particulars: `Cash Income: ${t.description || t.category}`,
        paymentMode: 'Cash',
        debit: amt,
        credit: 0,
        transactionType: 'Income',
        rawItem: t
      });
    });

    // Partner Capital contributions via cash
    transactions.filter(t => isInvestmentTx(t) && isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      entries.push({
        id: `txn-inv-csh-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CAP-CSH-${t.id ? t.id.slice(-6).toUpperCase() : 'INV'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: '3010',
        counterAccountName: `Partner Capital (${t.partnerName || 'Partner'})`,
        particulars: `Cash Capital Infusion by ${t.partnerName || 'Partner'}: ${t.description || t.category}`,
        paymentMode: 'Cash',
        debit: amt,
        credit: 0,
        transactionType: 'Partner Capital',
        rawItem: t
      });
    });

    // Expenses paid via cash
    transactions.filter(t => isExpenseTx(t) && isCashMode(t.paymentMode)).forEach(t => {
      // Exclude unpaid accruals from physical cash disbursement
      if (t.purchaseType === 'Accrual') return;

      const amt = safeNum(t.amount);
      const targetExpCode = t.ledgerAccountCode || EXPENSE_CATEGORY_TO_CODE[t.category] || (t.purchaseType === 'Salary' ? '5010' : '5040');
      const txnTypeLabel = t.purchaseType === 'Salary'
        ? 'Salary Payment'
        : t.purchaseType === 'AccrualSettlement'
        ? 'Accrual Settlement'
        : 'Expense Payment';

      entries.push({
        id: `txn-exp-csh-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: t.purchaseType === 'Salary' ? `SAL-CSH-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}` : `CSH-VOU-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: targetExpCode,
        counterAccountName: findAccountName(targetExpCode),
        particulars: `Petty Cash Disbursement: ${t.description || t.category} [${t.category}]`,
        paymentMode: 'Cash',
        debit: 0,
        credit: amt,
        transactionType: txnTypeLabel,
        rawItem: t
      });
    });

    // Capital Asset purchases paid via cash
    transactions.filter(t => isAssetTx(t) && isCashMode(t.paymentMode)).forEach(t => {
      const amt = safeNum(t.amount);
      const targetAssetCode = ASSET_CATEGORY_TO_CODE[t.assetDetails?.category || t.category] || '1510';
      entries.push({
        id: `txn-ast-csh-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `AST-CSH-${t.id ? t.id.slice(-6).toUpperCase() : 'CAP'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: targetAssetCode,
        counterAccountName: findAccountName(targetAssetCode),
        particulars: `Asset Cash Purchase: ${t.assetDetails?.assetName || t.description || 'Capital Asset'}`,
        paymentMode: 'Cash',
        debit: 0,
        credit: amt,
        transactionType: 'Capital Asset Purchase',
        rawItem: t
      });
    });
  }

  // ----------------------------------------------------
  // 3. TUITION & ACTIVITY FEES RECEIVABLE (1200)
  // ----------------------------------------------------
  else if (code === '1200') {
    fees.forEach(f => {
      const totalAmount = safeNum(f.amount);
      const paid = safeNum(f.amountPaid);
      const date = f.dueDate || (f.createdAt ? f.createdAt.split('T')[0] : '2026-01-01');

      // Debit: Fee invoiced (Accrual)
      if (totalAmount > 0) {
        entries.push({
          id: `recv-inv-${f.id || Math.random()}`,
          date,
          voucherNumber: `INV-${f.id ? f.id.slice(-6).toUpperCase() : 'FEE'}`,
          accountCode: '1200',
          accountName: account.name,
          counterAccountCode: '4010',
          counterAccountName: 'Tuition & Care Revenue',
          particulars: `Fee Invoiced: ${f.studentName} - ${f.type || 'Child Care Fee'} (Due: ${f.dueDate})`,
          paymentMode: f.paymentMode || 'Pending',
          debit: totalAmount,
          credit: 0,
          transactionType: 'Fee Invoiced',
          rawItem: f
        });
      }

      // Credit: Fee collection reducing receivable
      if (paid > 0) {
        const isCash = isCashMode(f.paymentMode);
        entries.push({
          id: `recv-paid-${f.id || Math.random()}`,
          date,
          voucherNumber: `REC-${f.id ? f.id.slice(-6).toUpperCase() : 'PAY'}`,
          accountCode: '1200',
          accountName: account.name,
          counterAccountCode: isCash ? '1020' : '1010',
          counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
          particulars: `Fee Received: ${f.studentName} via ${f.paymentMode || 'Payment'}`,
          paymentMode: f.paymentMode || 'Payment',
          debit: 0,
          credit: paid,
          transactionType: 'Fee Payment',
          rawItem: f
        });
      }
    });
  }

  // ----------------------------------------------------
  // 4. SECURITY DEPOSITS PAID (1300)
  // ----------------------------------------------------
  else if (code === '1300') {
    transactions.filter(isDepositTx).forEach(t => {
      const amt = safeNum(t.amount);
      const isCash = isCashMode(t.paymentMode);
      entries.push({
        id: `dep-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `DEP-${t.id ? t.id.slice(-6).toUpperCase() : 'VOU'}`,
        accountCode: '1300',
        accountName: account.name,
        counterAccountCode: isCash ? '1020' : '1010',
        counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
        particulars: `Refundable Security Deposit: ${t.depositDetails?.depositCategory || t.category} (${t.depositDetails?.payeeName || t.description || 'Authority'})`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: amt,
        credit: 0,
        transactionType: 'Security Deposit',
        rawItem: t
      });
    });
  }

  // ----------------------------------------------------
  // 5. FIXED ASSETS (1510 - 1550)
  // ----------------------------------------------------
  else if (['1510', '1520', '1530', '1540', '1550'].includes(code)) {
    transactions.filter(isAssetTx).forEach(t => {
      const targetCode = ASSET_CATEGORY_TO_CODE[t.assetDetails?.category || t.category] || '1510';
      if (targetCode === code) {
        const amt = safeNum(t.amount);
        const isCash = isCashMode(t.paymentMode);
        entries.push({
          id: `ast-${t.id || Math.random()}`,
          date: t.date,
          voucherNumber: `AST-${t.id ? t.id.slice(-6).toUpperCase() : 'PUR'}`,
          accountCode: code,
          accountName: account.name,
          counterAccountCode: isCash ? '1020' : '1010',
          counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
          particulars: `Capital Asset Addition: ${t.assetDetails?.assetName || t.description || 'Asset'} [${t.category}]`,
          paymentMode: t.paymentMode || 'Bank Transfer',
          debit: amt,
          credit: 0,
          transactionType: 'Capital Asset Purchase',
          rawItem: t
        });
      }
    });
  }

  // ----------------------------------------------------
  // 6. ACCUMULATED DEPRECIATION (1600 - Contra Asset)
  // ----------------------------------------------------
  else if (code === '1600') {
    const assetTxList = transactions.filter(isAssetTx);
    entries.push(...generateAssetDepreciationEntries('1600', account.name, assetTxList));
  }

  // ----------------------------------------------------
  // 7. PARTNER CAPITAL (3010)
  // ----------------------------------------------------
  else if (code === '3010') {
    transactions.filter(isInvestmentTx).forEach(t => {
      const amt = safeNum(t.amount);
      const isCash = isCashMode(t.paymentMode);
      entries.push({
        id: `cap-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CAP-${t.id ? t.id.slice(-6).toUpperCase() : 'CON'}`,
        accountCode: '3010',
        accountName: account.name,
        counterAccountCode: isCash ? '1020' : '1010',
        counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
        particulars: `Capital Contribution from ${t.partnerName || 'Partner'}: ${t.description || t.category} [${t.category}]`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: 0,
        credit: amt,
        transactionType: 'Partner Equity',
        rawItem: t
      });
    });
  }

  // ----------------------------------------------------
  // 8. REVENUE ACCOUNTS (4010, 4020, 4030)
  // ----------------------------------------------------
  else if (['4010', '4020', '4030'].includes(code)) {
    fees.forEach(f => {
      const paid = safeNum(f.amountPaid);
      if (paid > 0) {
        let matches = false;
        if (code === '4020' && (f.billingBasis === 'per_session' || f.type?.toLowerCase().includes('session') || f.type?.toLowerCase().includes('special education') || f.type?.toLowerCase().includes('speech') || f.type?.toLowerCase().includes('ot'))) {
          matches = true;
        } else if (code === '4030' && (f.type?.toLowerCase().includes('registration') || f.type?.toLowerCase().includes('admission'))) {
          matches = true;
        } else if (code === '4010') {
          // If not 4020 and not 4030, treat as general tuition revenue
          const isSession = f.billingBasis === 'per_session' || f.type?.toLowerCase().includes('session') || f.type?.toLowerCase().includes('special education') || f.type?.toLowerCase().includes('speech') || f.type?.toLowerCase().includes('ot');
          const isReg = f.type?.toLowerCase().includes('registration') || f.type?.toLowerCase().includes('admission');
          if (!isSession && !isReg) matches = true;
        }

        if (matches) {
          const isCash = isCashMode(f.paymentMode);
          const date = f.dueDate || (f.createdAt ? f.createdAt.split('T')[0] : '2026-01-01');
          entries.push({
            id: `rev-${code}-${f.id || Math.random()}`,
            date,
            voucherNumber: `REV-${f.id ? f.id.slice(-6).toUpperCase() : 'FEES'}`,
            accountCode: code,
            accountName: account.name,
            counterAccountCode: isCash ? '1020' : '1010',
            counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
            particulars: `Fee Revenue Earned: ${f.studentName} (${f.type || 'Child Care Fee'})`,
            paymentMode: f.paymentMode || 'Bank / Online',
            debit: 0,
            credit: paid,
            transactionType: 'Revenue',
            rawItem: f
          });
        }
      }
    });
  }

  // ----------------------------------------------------
  // 9. OTHER INCOMES & SUBSIDIES (4090)
  // ----------------------------------------------------
  else if (code === '4090') {
    transactions.filter(isIncomeTx).forEach(t => {
      const amt = safeNum(t.amount);
      const isCash = isCashMode(t.paymentMode);
      entries.push({
        id: `inc-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `INC-${t.id ? t.id.slice(-6).toUpperCase() : 'REV'}`,
        accountCode: '4090',
        accountName: account.name,
        counterAccountCode: isCash ? '1020' : '1010',
        counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
        particulars: `Operating Income: ${t.description || t.category} [${t.category}]`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: 0,
        credit: amt,
        transactionType: 'Income',
        rawItem: t
      });
    });
  }

  // ----------------------------------------------------
  // 10. OPERATING EXPENSES (5010 - 5100)
  // ----------------------------------------------------
  else if (code.startsWith('5') && code !== '5120') {
    transactions.filter(isExpenseTx).forEach(t => {
      const targetCode = EXPENSE_CATEGORY_TO_CODE[t.category] || '5040';
      // Match either direct mapping or custom linkedCategory
      const isMatch = targetCode === code || (account.linkedCategory && t.category.toLowerCase().includes(account.linkedCategory.toLowerCase()));
      if (isMatch) {
        const amt = safeNum(t.amount);
        const isCash = isCashMode(t.paymentMode);
        entries.push({
          id: `exp-${code}-${t.id || Math.random()}`,
          date: t.date,
          voucherNumber: `VOU-${t.id ? t.id.slice(-6).toUpperCase() : 'EXP'}`,
          accountCode: code,
          accountName: account.name,
          counterAccountCode: isCash ? '1020' : '1010',
          counterAccountName: isCash ? 'Petty Cash & Cash Drawer' : 'Operating Bank Account',
          particulars: `${t.description || t.category} [${t.category}]`,
          paymentMode: t.paymentMode || 'Bank Transfer',
          debit: amt,
          credit: 0,
          transactionType: 'Expense',
          rawItem: t
        });
      }
    });
  }

  // ----------------------------------------------------
  // 11. DEPRECIATION EXPENSE (5120)
  // ----------------------------------------------------
  else if (code === '5120') {
    const assetTxList = transactions.filter(isAssetTx);
    entries.push(...generateAssetDepreciationEntries('5120', account.name, assetTxList));
  }

  // ----------------------------------------------------
  // 12. ACCOUNTS PAYABLE / ACCRUED EXPENSES (2010)
  // ----------------------------------------------------
  else if (code === '2010') {
    // A. Accrual Created (Credit 2010 to record liability)
    transactions.filter(t => t.purchaseType === 'Accrual').forEach(t => {
      const amt = safeNum(t.amount);
      const expenseCode = t.ledgerAccountCode || '5020';
      entries.push({
        id: `acc-cr-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `ACCR-${t.id ? t.id.slice(-6).toUpperCase() : 'AP'}`,
        accountCode: '2010',
        accountName: account.name,
        counterAccountCode: expenseCode,
        counterAccountName: findAccountName(expenseCode),
        particulars: `Accrual Recorded: ${t.description || t.category} [${t.accrualDetails?.vendorOrRecipient || 'Vendor'}]`,
        paymentMode: 'Accrual (Unpaid)',
        debit: 0,
        credit: amt,
        transactionType: 'Accrual Liability Recognized',
        rawItem: t
      });
    });

    // B. Accrual Settled (Debit 2010 to reduce/extinguish liability)
    transactions.filter(t => t.purchaseType === 'AccrualSettlement').forEach(t => {
      const amt = safeNum(t.amount);
      const isCash = isCashMode(t.paymentMode);
      const bankCode = isCash ? '1020' : '1010';
      entries.push({
        id: `acc-dr-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `SET-${t.id ? t.id.slice(-6).toUpperCase() : 'AP'}`,
        accountCode: '2010',
        accountName: account.name,
        counterAccountCode: bankCode,
        counterAccountName: findAccountName(bankCode),
        particulars: `Accrual Payment/Settlement: ${t.description || t.category}`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: amt,
        credit: 0,
        transactionType: 'Accrual Settlement',
        rawItem: t
      });
    });
  }

  // ----------------------------------------------------
  // 13. ACCRUED STAFF SALARIES & CAREGIVER FEES (2030)
  // ----------------------------------------------------
  else if (code === '2030') {
    // Outstanding balance recorded for salaries
    transactions.filter(t => t.purchaseType === 'Salary' && t.salaryDetails?.balanceDue && t.salaryDetails.balanceDue > 0).forEach(t => {
      const balDue = safeNum(t.salaryDetails?.balanceDue);
      entries.push({
        id: `sal-due-cr-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `SAL-DUE-${t.id ? t.id.slice(-6).toUpperCase() : 'ACC'}`,
        accountCode: '2030',
        accountName: account.name,
        counterAccountCode: '5010',
        counterAccountName: findAccountName('5010'),
        particulars: `Unpaid Salary Accrual: ${t.salaryDetails?.staffName} (${t.salaryDetails?.salaryMonth})`,
        paymentMode: 'Salary Accrual',
        debit: 0,
        credit: balDue,
        transactionType: 'Salary Accrual',
        rawItem: t
      });
    });
  }

  // ----------------------------------------------------
  // 14. CUSTOM USER-CREATED LEDGER ACCOUNTS (ANY TYPE)
  // ----------------------------------------------------
  else {
    // Find all transactions that directly referenced this account code as ledger or contra
    transactions.forEach(t => {
      // Internal contra transfers (Cash Deposit to Bank, Cash Withdrawal) strictly affect only Bank (1010) and Cash (1020)
      if (isTransferTx(t)) return;
      const isPrimary = t.ledgerAccountCode === code;
      const isContra = t.contraAccountCode === code;
      const isCategoryMatch = account.linkedCategory && t.category && t.category.toLowerCase().includes(account.linkedCategory.toLowerCase());

      if (isPrimary || isContra || isCategoryMatch) {
        const amt = safeNum(t.amount);
        const isCash = isCashMode(t.paymentMode);
        const counterCode = isPrimary ? (t.contraAccountCode || (isCash ? '1020' : '1010')) : (t.ledgerAccountCode || '1010');

        let isDebit = false;
        if (account.normalBalance === 'Debit') {
          // Normal Debit accounts (Assets, Expenses) increase with Debit
          isDebit = isPrimary ? (t.type === 'Expense' || t.type === 'Asset') : (t.type === 'Income');
        } else {
          // Normal Credit accounts (Liabilities, Equity, Revenue) increase with Credit
          isDebit = isPrimary ? (t.type === 'Expense' && t.purchaseType === 'AccrualSettlement') : false;
        }

        entries.push({
          id: `cust-${code}-${t.id || Math.random()}`,
          date: t.date,
          voucherNumber: `VOU-${t.id ? t.id.slice(-6).toUpperCase() : 'CUST'}`,
          accountCode: code,
          accountName: account.name,
          counterAccountCode: counterCode,
          counterAccountName: findAccountName(counterCode),
          particulars: `${t.description || t.category} [${t.category}]`,
          paymentMode: t.paymentMode || 'Standard Entry',
          debit: isDebit ? amt : 0,
          credit: !isDebit ? amt : 0,
          transactionType: t.type || 'Custom Entry',
          rawItem: t
        });
      }
    });
  }

  // Sort all entries chronologically
  return entries.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Builds a complete Ledger Report for an individual account with Opening Balance,
 * running balance calculation, and Closing Balance.
 */
export const generateAccountLedgerReport = (
  account: ChartOfAccountItem,
  startDate: string,
  endDate: string,
  periodLabel: string,
  transactions: FinanceTransaction[],
  fees: Fee[],
  allAccounts: ChartOfAccountItem[]
): AccountLedgerReport => {
  const allRaw = getRawEntriesForAccount(account, transactions, fees, allAccounts);

  // 1. Calculate Opening Balance from all entries strictly before startDate
  let priorDebits = 0;
  let priorCredits = 0;

  allRaw.forEach(entry => {
    if (entry.date < startDate) {
      // In double-entry accounting under Indian GAAP, nominal accounts (Expense 5xxx, Revenue 4xxx)
      // reset to zero at the start of each Indian Financial Year (April 1).
      // Only entries in the SAME financial year prior to startDate form the opening balance.
      if (account.type === 'Expense' || account.type === 'Revenue' || account.code.startsWith('4') || account.code.startsWith('5')) {
        const entryFY = getIndianFYInfo(entry.date).fyStartYear;
        const startFY = getIndianFYInfo(startDate).fyStartYear;
        if (entryFY !== startFY) {
          return;
        }
      }
      priorDebits += entry.debit;
      priorCredits += entry.credit;
    }
  });

  const isDebitNormal = account.normalBalance === 'Debit';
  let openingNet = isDebitNormal ? (priorDebits - priorCredits) : (priorCredits - priorDebits);
  let openingBalanceType: 'Dr' | 'Cr' = openingNet >= 0
    ? (isDebitNormal ? 'Dr' : 'Cr')
    : (isDebitNormal ? 'Cr' : 'Dr');
  let openingBalance = Math.abs(openingNet);

  // 2. Filter entries within [startDate, endDate]
  const periodRaw = allRaw.filter(e => e.date >= startDate && e.date <= endDate);

  // 3. Compute running balance for each period entry
  let currentRunning = isDebitNormal ? (priorDebits - priorCredits) : (priorCredits - priorDebits);

  let totalDebit = 0;
  let totalCredit = 0;

  const entries: LedgerEntry[] = periodRaw.map(e => {
    totalDebit += e.debit;
    totalCredit += e.credit;

    if (isDebitNormal) {
      currentRunning = currentRunning + e.debit - e.credit;
    } else {
      currentRunning = currentRunning + e.credit - e.debit;
    }

    const bType: 'Dr' | 'Cr' = currentRunning >= 0
      ? (isDebitNormal ? 'Dr' : 'Cr')
      : (isDebitNormal ? 'Cr' : 'Dr');

    return {
      ...e,
      balance: Math.abs(currentRunning),
      balanceType: bType
    };
  });

  const netMovement = isDebitNormal ? (totalDebit - totalCredit) : (totalCredit - totalDebit);
  const closingNet = currentRunning;
  const closingBalanceType: 'Dr' | 'Cr' = closingNet >= 0
    ? (isDebitNormal ? 'Dr' : 'Cr')
    : (isDebitNormal ? 'Cr' : 'Dr');
  const closingBalance = Math.abs(closingNet);

  return {
    account,
    periodLabel,
    startDate,
    endDate,
    openingBalance,
    openingBalanceType,
    entries,
    totalDebit,
    totalCredit,
    netMovement,
    closingBalance,
    closingBalanceType
  };
};

export interface MasterLedgerSummaryItem {
  account: ChartOfAccountItem;
  openingBalance: number;
  openingBalanceType: 'Dr' | 'Cr';
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  closingBalanceType: 'Dr' | 'Cr';
  entryCount: number;
}

/**
 * Builds the Master Ledger Summary for all accounts across the given period
 */
export const generateMasterLedgerSummary = (
  accounts: ChartOfAccountItem[],
  startDate: string,
  endDate: string,
  periodLabel: string,
  transactions: FinanceTransaction[],
  fees: Fee[]
): {
  items: MasterLedgerSummaryItem[];
  totals: {
    totalOpeningDr: number;
    totalOpeningCr: number;
    totalPeriodDr: number;
    totalPeriodCr: number;
    totalClosingDr: number;
    totalClosingCr: number;
  };
} => {
  const items: MasterLedgerSummaryItem[] = [];
  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalPeriodDr = 0;
  let totalPeriodCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;

  accounts.forEach(acc => {
    const report = generateAccountLedgerReport(acc, startDate, endDate, periodLabel, transactions, fees, accounts);

    if (report.openingBalanceType === 'Dr') totalOpeningDr += report.openingBalance;
    else totalOpeningCr += report.openingBalance;

    totalPeriodDr += report.totalDebit;
    totalPeriodCr += report.totalCredit;

    if (report.closingBalanceType === 'Dr') totalClosingDr += report.closingBalance;
    else totalClosingCr += report.closingBalance;

    items.push({
      account: acc,
      openingBalance: report.openingBalance,
      openingBalanceType: report.openingBalanceType,
      periodDebit: report.totalDebit,
      periodCredit: report.totalCredit,
      closingBalance: report.closingBalance,
      closingBalanceType: report.closingBalanceType,
      entryCount: report.entries.length
    });
  });

  return {
    items,
    totals: {
      totalOpeningDr,
      totalOpeningCr,
      totalPeriodDr,
      totalPeriodCr,
      totalClosingDr,
      totalClosingCr
    }
  };
};

/**
 * Professional Excel Export for a Single Ledger Account
 */
export const exportSingleLedgerToExcel = async (report: AccountLedgerReport) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Little Buds Child Care Centre';
  workbook.created = new Date();

  const safeSheetName = `Ledger_${report.account.code}`.substring(0, 31);
  const sheet = workbook.addWorksheet(safeSheetName, {
    properties: { tabColor: { argb: 'FF312E81' } }
  });

  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };

  // Header Title Banner
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Little Buds Child Care Centre';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sheet.getRow(1).height = 28;

  sheet.mergeCells('A2:H2');
  const subCell = sheet.getCell('A2');
  subCell.value = `GENERAL LEDGER STATEMENT — ACCOUNT: ${report.account.code} : ${report.account.name.toUpperCase()}`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
  sheet.getRow(2).height = 22;

  // Metadata block
  const meta1 = sheet.addRow(['Statement Period:', report.periodLabel, '', '', 'Account Type:', `${report.account.type} (${report.account.subtype})`, '', '']);
  const meta2 = sheet.addRow(['Date Range:', `${formatDate(report.startDate)} to ${formatDate(report.endDate)}`, '', '', 'Normal Balance:', report.account.normalBalance, '', '']);
  const meta3 = sheet.addRow(['Exported On:', `${formatDate(new Date())} ${new Date().toLocaleTimeString('en-IN')}`, '', '', 'Currency:', 'INR (₹)', '', '']);
  [meta1, meta2, meta3].forEach(row => {
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    row.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    row.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    row.getCell(6).font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    row.height = 18;
  });
  sheet.addRow([]); // Blank spacer

  // Table Columns
  const headerRow = sheet.addRow([
    'Date (DD/MM/YYYY)',
    'Voucher / Ref #',
    'Particulars / Narration',
    'Opposite Account (Counterparty)',
    'Payment Mode',
    'Debit (Dr) ₹',
    'Credit (Cr) ₹',
    'Running Balance ₹'
  ]);
  styleHeaderRow(headerRow, 8, EXCEL_COLORS.navyHeader);
  headerRow.height = 24;

  // Opening Balance Row
  const opRow = sheet.addRow([
    formatDate(report.startDate),
    '—',
    `Opening Balance B/F (as of ${formatDate(report.startDate)})`,
    '—',
    '—',
    report.openingBalanceType === 'Dr' ? report.openingBalance : 0,
    report.openingBalanceType === 'Cr' ? report.openingBalance : 0,
    `${report.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${report.openingBalanceType}`
  ]);
  opRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = BORDERS.thin;
    if (colNumber === 6 || colNumber === 7) {
      cell.numFmt = NUMBER_FORMATS.currency;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 8) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 1 || colNumber === 2 || colNumber === 5) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // Transaction Rows
  report.entries.forEach((entry, idx) => {
    const row = sheet.addRow([
      formatDate(entry.date),
      entry.voucherNumber || '—',
      entry.particulars,
      `${entry.counterAccountCode ? `${entry.counterAccountCode} - ` : ''}${entry.counterAccountName || 'General'}`,
      entry.paymentMode || '—',
      entry.debit > 0 ? entry.debit : 0,
      entry.credit > 0 ? entry.credit : 0,
      `${entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${entry.balanceType}`
    ]);

    const isEven = idx % 2 === 0;
    styleDataRow(row, 8, isEven);
    row.getCell(6).numFmt = NUMBER_FORMATS.currency;
    row.getCell(7).numFmt = NUMBER_FORMATS.currency;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  if (report.entries.length === 0) {
    const emptyRow = sheet.addRow(['—', '—', 'No transactions recorded during this period.', '—', '—', 0, 0, `${report.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${report.openingBalanceType}`]);
    emptyRow.eachCell(c => {
      c.font = { italic: true, color: { argb: 'FF64748B' } };
      c.border = BORDERS.thin;
    });
  }

  // Period Totals Row
  const totalRow = sheet.addRow([
    '',
    '',
    `PERIOD TOTALS (${report.entries.length} Entries)`,
    '',
    '',
    report.totalDebit,
    report.totalCredit,
    `Net: ${Math.abs(report.netMovement).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${report.closingBalanceType}`
  ]);
  styleTotalRow(totalRow, 8);
  totalRow.getCell(6).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(7).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

  // Closing Balance Row
  const closeRow = sheet.addRow([
    formatDate(report.endDate),
    '—',
    `CLOSING BALANCE C/F (as of ${formatDate(report.endDate)})`,
    '—',
    '—',
    report.closingBalanceType === 'Dr' ? report.closingBalance : 0,
    report.closingBalanceType === 'Cr' ? report.closingBalance : 0,
    `${report.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${report.closingBalanceType}`
  ]);
  closeRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E1B4B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    cell.border = BORDERS.total;
    if (colNumber >= 6 && colNumber <= 7) {
      cell.numFmt = NUMBER_FORMATS.currency;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 8) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 1 || colNumber === 2 || colNumber === 5) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  setupSheetViews(sheet, 6);
  autoFitWorksheetColumns(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Ledger_${report.account.code}_${report.startDate}_to_${report.endDate}.xlsx`);
};

/**
 * Professional Excel Export for Master Ledger Summary (All Ledgers)
 */
export const exportMasterLedgerToExcel = async (
  summary: ReturnType<typeof generateMasterLedgerSummary>,
  periodLabel: string,
  startDate: string,
  endDate: string
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Little Buds Child Care Centre';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Master_Ledger_Summary', {
    properties: { tabColor: { argb: 'FF1E293B' } }
  });

  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };

  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Little Buds Child Care Centre';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sheet.getRow(1).height = 28;

  sheet.mergeCells('A2:G2');
  const subCell = sheet.getCell('A2');
  subCell.value = `MASTER GENERAL LEDGER SUMMARY REPORT — ${periodLabel.toUpperCase()}`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
  sheet.getRow(2).height = 22;

  const metaRow = sheet.addRow([
    'Period:', periodLabel,
    'Date Range:', `${formatDate(startDate)} to ${formatDate(endDate)}`,
    'Exported:', `${formatDate(new Date())} ${new Date().toLocaleTimeString('en-IN')}`,
    'Currency: INR (₹)'
  ]);
  metaRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
  metaRow.height = 18;
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'Account Code',
    'Account Title / Name',
    'Classification & Subtype',
    'Opening Balance (₹)',
    'Period Debits (Dr) ₹',
    'Period Credits (Cr) ₹',
    'Closing Balance (₹)'
  ]);
  styleHeaderRow(headerRow, 7, EXCEL_COLORS.navyHeader);
  headerRow.height = 24;

  // Group accounts by Type
  const types = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;

  let rowCounter = 0;
  types.forEach(type => {
    const typeItems = summary.items.filter(i => i.account.type === type);
    if (typeItems.length === 0) return;

    // Group header row
    const groupRow = sheet.addRow([`CLASSIFICATION: ${type.toUpperCase()}S`, '', '', '', '', '', '']);
    styleSectionHeaderRow(groupRow, 7, `CLASSIFICATION: ${type.toUpperCase()}S`, EXCEL_COLORS.indigoSubtle, 'FF1E1B4B');
    groupRow.height = 20;

    typeItems.forEach(item => {
      rowCounter++;
      const row = sheet.addRow([
        item.account.code,
        item.account.name,
        `${item.account.type} • ${item.account.subtype}`,
        `${item.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.openingBalanceType}`,
        item.periodDebit,
        item.periodCredit,
        `${item.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.closingBalanceType}`
      ]);
      const isEven = rowCounter % 2 === 0;
      styleDataRow(row, 7, isEven);
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(5).numFmt = NUMBER_FORMATS.currency;
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = NUMBER_FORMATS.currency;
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    });
  });

  // Grand Totals Row
  const totalRow = sheet.addRow([
    'GRAND TOTALS',
    `Active Accounts: ${summary.items.length}`,
    'Double-Entry Verification',
    `Dr: ${summary.totals.totalOpeningDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Cr: ${summary.totals.totalOpeningCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    summary.totals.totalPeriodDr,
    summary.totals.totalPeriodCr,
    `Dr: ${summary.totals.totalClosingDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Cr: ${summary.totals.totalClosingCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  ]);
  styleTotalRow(totalRow, 7);
  totalRow.height = 22;
  totalRow.getCell(5).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(6).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

  setupSheetViews(sheet, 5);
  autoFitWorksheetColumns(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Master_Ledger_Summary_${startDate}_to_${endDate}.xlsx`);
};
