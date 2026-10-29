import { ChartOfAccountItem, FinanceTransaction, Fee, LedgerEntry, AccountLedgerReport } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

  const isDepositTx = (t: FinanceTransaction) =>
    t.type === 'Deposit' || t.purchaseType === 'Deposit' || (t.category && t.category.toLowerCase().includes('deposit'));
  const isInvestmentTx = (t: FinanceTransaction) =>
    t.type === 'Investment' || t.purchaseType === 'Investment' || (t.category && t.category.toLowerCase().includes('partner'));
  const isAssetTx = (t: FinanceTransaction) =>
    (t.type === 'Asset' || t.purchaseType === 'Asset') && !isDepositTx(t) && !isInvestmentTx(t);
  const isExpenseTx = (t: FinanceTransaction) =>
    t.type === 'Expense' && !isAssetTx(t) && !isDepositTx(t) && !isInvestmentTx(t);
  const isIncomeTx = (t: FinanceTransaction) =>
    t.type === 'Income' && !isInvestmentTx(t);

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
      const amt = safeNum(t.amount);
      const targetExpCode = EXPENSE_CATEGORY_TO_CODE[t.category] || '5040';
      entries.push({
        id: `txn-exp-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `EXP-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}`,
        accountCode: '1010',
        accountName: account.name,
        counterAccountCode: targetExpCode,
        counterAccountName: findAccountName(targetExpCode),
        particulars: `${t.description || t.category} [${t.category}]`,
        paymentMode: t.paymentMode || 'Bank Transfer',
        debit: 0,
        credit: amt,
        transactionType: 'Expense Payment',
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
  }

  // ----------------------------------------------------
  // 2. CASH DRAWER / PETTY CASH (1020)
  // ----------------------------------------------------
  else if (code === '1020') {
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
      const amt = safeNum(t.amount);
      const targetExpCode = EXPENSE_CATEGORY_TO_CODE[t.category] || '5040';
      entries.push({
        id: `txn-exp-csh-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `CSH-VOU-${t.id ? t.id.slice(-6).toUpperCase() : 'TXN'}`,
        accountCode: '1020',
        accountName: account.name,
        counterAccountCode: targetExpCode,
        counterAccountName: findAccountName(targetExpCode),
        particulars: `Petty Cash Disbursement: ${t.description || t.category} [${t.category}]`,
        paymentMode: 'Cash',
        debit: 0,
        credit: amt,
        transactionType: 'Expense Payment',
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
    transactions.filter(isAssetTx).forEach(t => {
      const cost = safeNum(t.amount);
      const usefulYears = safeNum(t.assetDetails?.usefulLifeYears) || 5;
      const annualDepreciation = cost / usefulYears;
      entries.push({
        id: `deprec-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `DEP-EST-${t.id ? t.id.slice(-6).toUpperCase() : 'SCH'}`,
        accountCode: '1600',
        accountName: account.name,
        counterAccountCode: '5120',
        counterAccountName: 'Capital Asset Depreciation Expense',
        particulars: `Accumulated Depreciation Amortization on ${t.assetDetails?.assetName || t.description || 'Capital Asset'} (${usefulYears} yr life)`,
        paymentMode: 'Non-Cash Amortization',
        debit: 0,
        credit: Math.round(annualDepreciation),
        transactionType: 'Depreciation Provision',
        rawItem: t
      });
    });
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
    transactions.filter(isAssetTx).forEach(t => {
      const cost = safeNum(t.amount);
      const usefulYears = safeNum(t.assetDetails?.usefulLifeYears) || 5;
      const annualDepreciation = cost / usefulYears;
      entries.push({
        id: `exp-deprec-${t.id || Math.random()}`,
        date: t.date,
        voucherNumber: `DEP-EXP-${t.id ? t.id.slice(-6).toUpperCase() : 'SCH'}`,
        accountCode: '5120',
        accountName: account.name,
        counterAccountCode: '1600',
        counterAccountName: 'Accumulated Depreciation',
        particulars: `Depreciation Charge on ${t.assetDetails?.assetName || t.description || 'Capital Asset'} (${usefulYears} yr schedule)`,
        paymentMode: 'Non-Cash',
        debit: Math.round(annualDepreciation),
        credit: 0,
        transactionType: 'Depreciation Charge',
        rawItem: t
      });
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
  workbook.creator = 'Little Buds Child Care';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Ledger_${report.account.code}`);

  // Page setup
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };

  // Header Title
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'LITTLE BUDS CHILD CARE & LEARNING CENTRE';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } }; // Indigo-900

  sheet.mergeCells('A2:H2');
  const subCell = sheet.getCell('A2');
  subCell.value = `GENERAL LEDGER STATEMENT — ACCOUNT: ${report.account.code} : ${report.account.name.toUpperCase()}`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo-700

  // Metadata block
  sheet.addRow(['Statement Period:', report.periodLabel, '', '', 'Account Type:', `${report.account.type} (${report.account.subtype})`, '', '']);
  sheet.addRow(['Date Range:', `${report.startDate} to ${report.endDate}`, '', '', 'Normal Balance:', report.account.normalBalance, '', '']);
  sheet.addRow(['Exported On:', new Date().toLocaleString('en-IN'), '', '', 'Currency:', 'INR (₹)', '', '']);
  sheet.addRow([]); // Blank spacer

  // Table Columns
  const headerRow = sheet.addRow([
    'Date',
    'Voucher / Ref #',
    'Particulars / Narration',
    'Opposite Account (Counterparty)',
    'Payment Mode',
    'Debit (Dr) ₹',
    'Credit (Cr) ₹',
    'Running Balance ₹'
  ]);

  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Opening Balance Row
  const opRow = sheet.addRow([
    report.startDate,
    '—',
    `Opening Balance B/F (as of ${report.startDate})`,
    '—',
    '—',
    report.openingBalanceType === 'Dr' ? report.openingBalance : 0,
    report.openingBalanceType === 'Cr' ? report.openingBalance : 0,
    `${report.openingBalance.toLocaleString('en-IN')} ${report.openingBalanceType}`
  ]);
  opRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate-100
    if (colNumber >= 6 && colNumber <= 7) {
      cell.numFmt = '#,##0.00';
    }
  });

  // Transaction Rows
  report.entries.forEach(entry => {
    const row = sheet.addRow([
      entry.date,
      entry.voucherNumber || '—',
      entry.particulars,
      `${entry.counterAccountCode ? `${entry.counterAccountCode} - ` : ''}${entry.counterAccountName || 'General'}`,
      entry.paymentMode || '—',
      entry.debit > 0 ? entry.debit : 0,
      entry.credit > 0 ? entry.credit : 0,
      `${entry.balance.toLocaleString('en-IN')} ${entry.balanceType}`
    ]);

    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
  });

  if (report.entries.length === 0) {
    const emptyRow = sheet.addRow(['—', '—', 'No transactions recorded during this period.', '—', '—', 0, 0, `${report.openingBalance.toLocaleString('en-IN')} ${report.openingBalanceType}`]);
    emptyRow.eachCell(c => {
      c.font = { italic: true, color: { argb: 'FF64748B' } };
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
    `Net: ${Math.abs(report.netMovement).toLocaleString('en-IN')} ${report.closingBalanceType}`
  ]);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Slate-200
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' }
    };
    if (colNumber >= 6 && colNumber <= 7) {
      cell.numFmt = '#,##0.00';
    }
  });

  // Closing Balance Row
  const closeRow = sheet.addRow([
    report.endDate,
    '—',
    `CLOSING BALANCE C/F (as of ${report.endDate})`,
    '—',
    '—',
    report.closingBalanceType === 'Dr' ? report.closingBalance : 0,
    report.closingBalanceType === 'Cr' ? report.closingBalance : 0,
    `${report.closingBalance.toLocaleString('en-IN')} ${report.closingBalanceType}`
  ]);
  closeRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E1B4B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Indigo-100
    if (colNumber >= 6 && colNumber <= 7) {
      cell.numFmt = '#,##0.00';
    }
  });

  // Adjust column widths
  sheet.getColumn(1).width = 14; // Date
  sheet.getColumn(2).width = 18; // Voucher #
  sheet.getColumn(3).width = 38; // Particulars
  sheet.getColumn(4).width = 32; // Counter Account
  sheet.getColumn(5).width = 18; // Mode
  sheet.getColumn(6).width = 18; // Debit
  sheet.getColumn(7).width = 18; // Credit
  sheet.getColumn(8).width = 22; // Balance

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
  workbook.creator = 'Little Buds Child Care';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Master_Ledger_Summary');

  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'LITTLE BUDS CHILD CARE & LEARNING CENTRE';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };

  sheet.mergeCells('A2:G2');
  const subCell = sheet.getCell('A2');
  subCell.value = `MASTER GENERAL LEDGER SUMMARY REPORT — ${periodLabel.toUpperCase()}`;
  subCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

  sheet.addRow(['Period:', periodLabel, 'Date Range:', `${startDate} to ${endDate}`, 'Exported:', new Date().toLocaleString('en-IN'), 'Currency: INR (₹)']);
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

  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Group accounts by Type
  const types = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;

  types.forEach(type => {
    const typeItems = summary.items.filter(i => i.account.type === type);
    if (typeItems.length === 0) return;

    // Group header row
    const groupRow = sheet.addRow([`CLASSIFICATION: ${type.toUpperCase()}S`, '', '', '', '', '', '']);
    groupRow.eachCell(c => {
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E1B4B' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    });

    typeItems.forEach(item => {
      const row = sheet.addRow([
        item.account.code,
        item.account.name,
        `${item.account.type} • ${item.account.subtype}`,
        `${item.openingBalance.toLocaleString('en-IN')} ${item.openingBalanceType}`,
        item.periodDebit,
        item.periodCredit,
        `${item.closingBalance.toLocaleString('en-IN')} ${item.closingBalanceType}`
      ]);
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '#,##0.00';
    });
  });

  // Grand Totals Row
  const totalRow = sheet.addRow([
    'GRAND TOTALS',
    `Active Accounts: ${summary.items.length}`,
    'Double-Entry Verification',
    `Dr: ${summary.totals.totalOpeningDr.toLocaleString('en-IN')} | Cr: ${summary.totals.totalOpeningCr.toLocaleString('en-IN')}`,
    summary.totals.totalPeriodDr,
    summary.totals.totalPeriodCr,
    `Dr: ${summary.totals.totalClosingDr.toLocaleString('en-IN')} | Cr: ${summary.totals.totalClosingCr.toLocaleString('en-IN')}`
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    if (colNumber === 5 || colNumber === 6) {
      cell.numFmt = '#,##0.00';
    }
  });

  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 42;
  sheet.getColumn(3).width = 30;
  sheet.getColumn(4).width = 22;
  sheet.getColumn(5).width = 22;
  sheet.getColumn(6).width = 22;
  sheet.getColumn(7).width = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Master_Ledger_Summary_${startDate}_to_${endDate}.xlsx`);
};
