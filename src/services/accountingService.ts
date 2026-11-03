import { collection, doc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { StaffSalary, SalaryPaymentRecord, AccruedExpense, AccrualSettlementRecord, CustomCategory, FinanceTransaction } from '../types';
import { logActivity, removeUndefinedFields, addTransaction, deleteTransaction, updateTransaction } from './api';

const STORAGE_SALARIES_KEY = 'little_buds_staff_salaries_v1';
const STORAGE_ACCRUALS_KEY = 'little_buds_accruals_v1';
const STORAGE_CATEGORIES_KEY = 'little_buds_custom_categories_v1';

// -------------------------------------------------------------
// 1. STAFF SALARY MANAGEMENT
// -------------------------------------------------------------

export const getStaffSalaries = async (): Promise<StaffSalary[]> => {
  try {
    const q = query(collection(db, 'staffSalaries'), orderBy('salaryMonth', 'desc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StaffSalary));
      localStorage.setItem(STORAGE_SALARIES_KEY, JSON.stringify(items));
      return items;
    }
  } catch (error) {
    console.warn('Firestore staffSalaries fetch fallback:', error);
  }

  try {
    const cached = localStorage.getItem(STORAGE_SALARIES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }

  return [];
};

export const addStaffSalary = async (
  salaryData: Omit<StaffSalary, 'id' | 'createdAt' | 'updatedAt' | 'balanceDue' | 'status'>
): Promise<{ salaryId: string; transactionId?: string }> => {
  const total = Number(salaryData.totalSalary) || 0;
  const paid = Number(salaryData.amountPaid) || 0;
  let balanceDue = 0;
  let advanceAmount = Number(salaryData.advanceAmount) || 0;

  let status: StaffSalary['status'] = 'Paid';
  if (paid === 0) {
    status = 'Pending';
    balanceDue = total;
  } else if (paid < total) {
    status = 'Partially Paid';
    balanceDue = total - paid;
  } else if (paid > total) {
    status = 'Advance';
    advanceAmount = paid - total;
    balanceDue = 0;
  } else {
    status = 'Paid';
    balanceDue = 0;
  }

  let transactionId: string | undefined;

  // If money was paid (fully, partially, or advance), record accounting expense transaction
  if (paid > 0) {
    try {
      const txPayload: Omit<FinanceTransaction, 'id'> = {
        date: salaryData.paymentDate || new Date().toISOString().split('T')[0],
        type: 'Expense',
        purchaseType: 'Salary',
        category: 'Salaries',
        amount: paid,
        paymentMode: salaryData.paymentMode || 'Bank Transfer',
        description: salaryData.description?.trim() || `Staff Salary: ${salaryData.staffName} (${salaryData.salaryMonth}) - ${status === 'Partially Paid' ? `Partial Paid (₹${paid.toLocaleString('en-IN')}) of ₹${total.toLocaleString('en-IN')}` : status === 'Advance' ? `Advance Payout of ₹${paid.toLocaleString('en-IN')}` : 'Full Settlement'}`,
        ledgerAccountCode: salaryData.ledgerAccountCode || '5010',
        contraAccountCode: salaryData.paymentMode?.toLowerCase().includes('cash') ? '1020' : '1010',
        salaryDetails: {
          staffName: salaryData.staffName,
          designation: salaryData.designation,
          salaryMonth: salaryData.salaryMonth,
          totalSalary: total,
          amountPaid: paid,
          balanceDue,
          advanceAmount,
          isPartial: balanceDue > 0
        }
      };
      transactionId = await addTransaction(txPayload);
    } catch (txErr) {
      console.warn('Failed to auto-add salary transaction:', txErr);
    }
  }

  const initialPaymentHistory: SalaryPaymentRecord[] = paid > 0 ? [{
    id: `pay-${Date.now()}`,
    staffName: salaryData.staffName,
    salaryMonth: salaryData.salaryMonth,
    amount: paid,
    paymentDate: salaryData.paymentDate,
    paymentMode: salaryData.paymentMode,
    description: `Initial ${status === 'Partially Paid' ? 'partial' : status === 'Advance' ? 'advance' : 'full'} payment`,
    transactionId,
    createdAt: new Date().toISOString()
  }] : [];

  const payload: Omit<StaffSalary, 'id'> = removeUndefinedFields({
    ...salaryData,
    totalSalary: total,
    amountPaid: paid,
    balanceDue,
    advanceAmount,
    status,
    transactionId,
    paymentHistory: initialPaymentHistory,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  let salaryId = `sal-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, 'staffSalaries'), payload);
    salaryId = docRef.id;
  } catch (error) {
    console.warn('Firestore addStaffSalary fallback to local:', error);
  }

  // Update local storage cache
  const existing = await getStaffSalaries();
  const updated = [{ id: salaryId, ...payload }, ...existing];
  localStorage.setItem(STORAGE_SALARIES_KEY, JSON.stringify(updated));

  await logActivity('Recorded Staff Salary', `Recorded salary of ₹${total} for ${salaryData.staffName} (${salaryData.salaryMonth}) [Paid: ₹${paid}, Due: ₹${balanceDue}]`);
  return { salaryId, transactionId };
};

export const recordSalaryPayment = async (
  salaryId: string,
  payment: {
    amount: number;
    paymentDate: string;
    paymentMode: string;
    referenceNumber?: string;
    description?: string;
  }
): Promise<{ paymentId: string; transactionId?: string }> => {
  const existing = await getStaffSalaries();
  const target = existing.find(s => s.id === salaryId);
  if (!target) throw new Error('Staff salary record not found');

  const paymentAmount = Number(payment.amount);
  if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');

  const newAmountPaid = (target.amountPaid || 0) + paymentAmount;
  let newBalanceDue = 0;
  let newAdvance = target.advanceAmount || 0;

  let newStatus: StaffSalary['status'] = 'Paid';
  if (newAmountPaid >= target.totalSalary) {
    newBalanceDue = 0;
    if (newAmountPaid > target.totalSalary) {
      newAdvance = newAmountPaid - target.totalSalary;
      newStatus = 'Advance';
    } else {
      newStatus = 'Paid';
    }
  } else {
    newBalanceDue = target.totalSalary - newAmountPaid;
    newStatus = 'Partially Paid';
  }

  let transactionId: string | undefined;
  try {
    const txPayload: Omit<FinanceTransaction, 'id'> = {
      date: payment.paymentDate,
      type: 'Expense',
      purchaseType: 'Salary',
      category: 'Salaries',
      amount: paymentAmount,
      paymentMode: payment.paymentMode,
      description: payment.description?.trim() || `Salary Settlement for ${target.staffName} (${target.salaryMonth}) [Payment: ₹${paymentAmount.toLocaleString('en-IN')}, Remaining: ₹${newBalanceDue.toLocaleString('en-IN')}]`,
      ledgerAccountCode: target.ledgerAccountCode || '5010',
      contraAccountCode: payment.paymentMode?.toLowerCase().includes('cash') ? '1020' : '1010',
      salaryDetails: {
        staffName: target.staffName,
        designation: target.designation,
        salaryMonth: target.salaryMonth,
        totalSalary: target.totalSalary,
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        advanceAmount: newAdvance,
        isPartial: newBalanceDue > 0
      }
    };
    transactionId = await addTransaction(txPayload);
  } catch (err) {
    console.warn('Failed to record partial salary transaction:', err);
  }

  const paymentRecord: SalaryPaymentRecord = {
    id: `pay-${Date.now()}`,
    salaryId,
    staffName: target.staffName,
    salaryMonth: target.salaryMonth,
    amount: paymentAmount,
    paymentDate: payment.paymentDate,
    paymentMode: payment.paymentMode,
    referenceNumber: payment.referenceNumber,
    description: payment.description,
    transactionId,
    createdAt: new Date().toISOString()
  };

  const updatedHistory = [...(target.paymentHistory || []), paymentRecord];

  const updateData: Partial<StaffSalary> = removeUndefinedFields({
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    advanceAmount: newAdvance,
    status: newStatus,
    paymentHistory: updatedHistory,
    updatedAt: new Date().toISOString()
  });

  try {
    if (!salaryId.startsWith('sal-')) {
      await updateDoc(doc(db, 'staffSalaries', salaryId), updateData);
    }
  } catch (error) {
    console.warn('Firestore recordSalaryPayment fallback:', error);
  }

  const updatedList = existing.map(s => s.id === salaryId ? { ...s, ...updateData } : s);
  localStorage.setItem(STORAGE_SALARIES_KEY, JSON.stringify(updatedList));

  await logActivity('Staff Salary Payment', `Recorded additional salary payment of ₹${paymentAmount} for ${target.staffName} (${target.salaryMonth})`);
  return { paymentId: paymentRecord.id!, transactionId };
};

export const deleteStaffSalary = async (salaryId: string): Promise<void> => {
  const existing = await getStaffSalaries();
  const target = existing.find(s => s.id === salaryId);

  try {
    if (!salaryId.startsWith('sal-')) {
      await deleteDoc(doc(db, 'staffSalaries', salaryId));
    }
  } catch (err) {
    console.warn('Firestore deleteStaffSalary error:', err);
  }

  // If target has linked transaction, delete it
  if (target?.transactionId) {
    try {
      await deleteTransaction(target.transactionId);
    } catch (e) {
      console.warn('Failed to delete linked salary transaction:', e);
    }
  }

  const updated = existing.filter(s => s.id !== salaryId);
  localStorage.setItem(STORAGE_SALARIES_KEY, JSON.stringify(updated));
  await logActivity('Deleted Staff Salary', `Deleted salary record for ${target?.staffName || salaryId}`);
};

// -------------------------------------------------------------
// 2. ACCRUAL ENTRY & ACCRUED EXPENSE MANAGEMENT
// -------------------------------------------------------------

export const getAccruedExpenses = async (): Promise<AccruedExpense[]> => {
  try {
    const q = query(collection(db, 'accruals'), orderBy('incurredDate', 'desc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AccruedExpense));
      localStorage.setItem(STORAGE_ACCRUALS_KEY, JSON.stringify(items));
      return items;
    }
  } catch (error) {
    console.warn('Firestore accruals fetch fallback:', error);
  }

  try {
    const cached = localStorage.getItem(STORAGE_ACCRUALS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }

  return [];
};

export const addAccruedExpense = async (
  accrualData: Omit<AccruedExpense, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'balanceDue' | 'status'>
): Promise<{ accrualId: string; transactionId?: string }> => {
  const amount = Number(accrualData.amount) || 0;
  if (amount <= 0) throw new Error('Accrual amount must be greater than zero');

  let transactionId: string | undefined;

  // Accrual Entry: Record expense now (debit expense head, credit 2010 accounts payable)
  try {
    const txPayload: Omit<FinanceTransaction, 'id'> = {
      date: accrualData.incurredDate || new Date().toISOString().split('T')[0],
      type: 'Expense',
      purchaseType: 'Accrual',
      category: accrualData.category || 'Accrued Expenses',
      amount,
      paymentMode: 'Accrual / Accounts Payable (Unpaid)',
      description: accrualData.description?.trim() || `Accrued Expense: ${accrualData.category} owed to ${accrualData.vendorOrRecipient} (Due: ${accrualData.dueDate})`,
      ledgerAccountCode: accrualData.expenseAccountCode || '5020',
      contraAccountCode: accrualData.liabilityAccountCode || '2010',
      accrualDetails: {
        vendorOrRecipient: accrualData.vendorOrRecipient,
        incurredDate: accrualData.incurredDate,
        dueDate: accrualData.dueDate,
        isSettlement: false,
        originalAccrualAmount: amount,
        remainingBalance: amount,
        invoiceNumber: accrualData.invoiceNumber
      }
    };
    transactionId = await addTransaction(txPayload);
  } catch (err) {
    console.warn('Failed to add accrual accounting transaction:', err);
  }

  const payload: Omit<AccruedExpense, 'id'> = removeUndefinedFields({
    ...accrualData,
    amount,
    amountPaid: 0,
    balanceDue: amount,
    status: 'Pending',
    transactionId,
    settlementHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  let accrualId = `acc-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, 'accruals'), payload);
    accrualId = docRef.id;
  } catch (error) {
    console.warn('Firestore addAccruedExpense fallback to local:', error);
  }

  const existing = await getAccruedExpenses();
  const updated = [{ id: accrualId, ...payload }, ...existing];
  localStorage.setItem(STORAGE_ACCRUALS_KEY, JSON.stringify(updated));

  await logActivity('Recorded Accrual Entry', `Recorded accrued liability of ₹${amount} for ${accrualData.category} to ${accrualData.vendorOrRecipient} (Due: ${accrualData.dueDate})`);
  return { accrualId, transactionId };
};

export const settleAccrual = async (
  accrualId: string,
  settlement: {
    amount: number;
    paymentDate: string;
    paymentMode: string;
    referenceNumber?: string;
    description?: string;
  }
): Promise<{ settlementId: string; transactionId?: string }> => {
  const existing = await getAccruedExpenses();
  const target = existing.find(a => a.id === accrualId);
  if (!target) throw new Error('Accrual record not found');

  const paymentAmount = Number(settlement.amount);
  if (paymentAmount <= 0) throw new Error('Settlement amount must be greater than zero');

  const newAmountPaid = (target.amountPaid || 0) + paymentAmount;
  const newBalanceDue = Math.max(0, target.amount - newAmountPaid);
  const newStatus: AccruedExpense['status'] = newBalanceDue === 0 ? 'Settled' : 'Partially Paid';

  let transactionId: string | undefined;

  // Accrual Settlement Payment:
  // Debit 2010 (Accounts Payable) to reduce liability
  // Credit Bank/Cash (1010/1020) for actual cash outflow
  // CRITICAL: Marked as purchaseType: 'AccrualSettlement' so P&L is NOT hit twice!
  try {
    const txPayload: Omit<FinanceTransaction, 'id'> = {
      date: settlement.paymentDate || new Date().toISOString().split('T')[0],
      type: 'Expense',
      purchaseType: 'AccrualSettlement',
      category: 'Accrual Settlement',
      amount: paymentAmount,
      paymentMode: settlement.paymentMode || 'Bank Transfer',
      description: settlement.description?.trim() || `Payment against Accrued ${target.category} to ${target.vendorOrRecipient} (Ref #${target.invoiceNumber || accrualId.slice(-6).toUpperCase()})`,
      ledgerAccountCode: '2010', // Debits liability account
      contraAccountCode: settlement.paymentMode?.toLowerCase().includes('cash') ? '1020' : '1010', // Credits cash or bank
      accrualDetails: {
        accrualId,
        vendorOrRecipient: target.vendorOrRecipient,
        isSettlement: true,
        remainingBalance: newBalanceDue,
        invoiceNumber: target.invoiceNumber
      }
    };
    transactionId = await addTransaction(txPayload);
  } catch (err) {
    console.warn('Failed to record accrual settlement transaction:', err);
  }

  const settlementRecord: AccrualSettlementRecord = {
    id: `set-${Date.now()}`,
    accrualId,
    vendorOrRecipient: target.vendorOrRecipient,
    category: target.category,
    amount: paymentAmount,
    paymentDate: settlement.paymentDate,
    paymentMode: settlement.paymentMode,
    referenceNumber: settlement.referenceNumber,
    description: settlement.description,
    transactionId,
    createdAt: new Date().toISOString()
  };

  const updatedHistory = [...(target.settlementHistory || []), settlementRecord];

  const updateData: Partial<AccruedExpense> = removeUndefinedFields({
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    status: newStatus,
    settlementHistory: updatedHistory,
    updatedAt: new Date().toISOString()
  });

  try {
    if (!accrualId.startsWith('acc-')) {
      await updateDoc(doc(db, 'accruals', accrualId), updateData);
    }
  } catch (error) {
    console.warn('Firestore settleAccrual fallback:', error);
  }

  const updatedList = existing.map(a => a.id === accrualId ? { ...a, ...updateData } : a);
  localStorage.setItem(STORAGE_ACCRUALS_KEY, JSON.stringify(updatedList));

  await logActivity('Settled Accrual', `Settled ₹${paymentAmount} of accrued ${target.category} owed to ${target.vendorOrRecipient} (Balance Remaining: ₹${newBalanceDue})`);
  return { settlementId: settlementRecord.id!, transactionId };
};

export const deleteAccruedExpense = async (accrualId: string): Promise<void> => {
  const existing = await getAccruedExpenses();
  const target = existing.find(a => a.id === accrualId);

  try {
    if (!accrualId.startsWith('acc-')) {
      await deleteDoc(doc(db, 'accruals', accrualId));
    }
  } catch (err) {
    console.warn('Firestore deleteAccruedExpense error:', err);
  }

  if (target?.transactionId) {
    try {
      await deleteTransaction(target.transactionId);
    } catch (e) {
      console.warn('Failed to delete linked accrual transaction:', e);
    }
  }

  const updated = existing.filter(a => a.id !== accrualId);
  localStorage.setItem(STORAGE_ACCRUALS_KEY, JSON.stringify(updated));
  await logActivity('Deleted Accrual', `Deleted accrued expense for ${target?.category || accrualId} (${target?.vendorOrRecipient})`);
};

// -------------------------------------------------------------
// 3. CUSTOM CATEGORIES MANAGEMENT
// -------------------------------------------------------------

export const getCustomCategories = async (): Promise<CustomCategory[]> => {
  try {
    const q = query(collection(db, 'accountingCategories'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomCategory));
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(items));
      return items;
    }
  } catch (error) {
    console.warn('Firestore custom categories fetch fallback:', error);
  }

  try {
    const cached = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }

  return [];
};

export const addCustomCategory = async (
  category: Omit<CustomCategory, 'id' | 'createdAt'>
): Promise<CustomCategory> => {
  const name = category.name.trim();
  if (!name) throw new Error('Category name cannot be empty');

  const payload: Omit<CustomCategory, 'id'> = removeUndefinedFields({
    name,
    type: category.type,
    defaultLedgerCode: category.defaultLedgerCode,
    description: category.description?.trim(),
    createdAt: new Date().toISOString()
  });

  let id = `cat-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, 'accountingCategories'), payload);
    id = docRef.id;
  } catch (err) {
    console.warn('Firestore addCustomCategory fallback to local:', err);
  }

  const newItem: CustomCategory = { id, ...payload };
  const existing = await getCustomCategories();
  const updated = [...existing.filter(c => c.name.toLowerCase() !== name.toLowerCase()), newItem].sort((a, b) => a.name.localeCompare(b.name));
  localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(updated));

  await logActivity('Added Custom Category', `Added new ${category.type} category: ${name}`);
  return newItem;
};
