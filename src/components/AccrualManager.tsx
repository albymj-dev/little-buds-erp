import React, { useState } from 'react';
import { 
  FileText, Plus, DollarSign, Calendar, Clock, AlertCircle, CheckCircle2, 
  Trash2, Eye, History, ChevronRight, X, ArrowUpRight, Search, Filter, 
  CreditCard, Banknote, Landmark, Check, AlertTriangle, ShieldCheck, ArrowRight
} from 'lucide-react';
import { AccruedExpense, AccrualSettlementRecord, ChartOfAccountItem, CustomCategory } from '../types';
import { addAccruedExpense, settleAccrual, deleteAccruedExpense } from '../services/accountingService';
import { formatDate } from '../utils/dateUtils';
import { format } from 'date-fns';

interface AccrualManagerProps {
  accruals: AccruedExpense[];
  accounts: ChartOfAccountItem[];
  customCategories: CustomCategory[];
  onRefresh: () => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  onOpenNewCategoryModal?: () => void;
  onOpenNewLedgerModal?: () => void;
}

const DEFAULT_ACCRUAL_CATEGORIES = [
  'Rent & Premises',
  'Electricity & Power',
  'Water & Utilities',
  'Child Care Supplies & Equipment Lease',
  'Repairs & Building Maintenance',
  'Cleaning & Sanitization Services',
  'Marketing & Advertising Services',
  'Legal & Accounting Professional Fees',
  'Internet & Telecommunications',
  'Pantry & Snacks Supplier',
  'Other Operational Accrual'
];

const PAYMENT_MODES = [
  'Bank Transfer / NEFT / IMPS',
  'UPI / Online Payment',
  'Cheque',
  'Cash',
  'Demand Draft'
];

export const AccrualManager: React.FC<AccrualManagerProps> = ({
  accruals,
  accounts,
  customCategories,
  onRefresh,
  onToast,
  onOpenNewCategoryModal,
  onOpenNewLedgerModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'Pending' | 'Partially Paid' | 'Settled'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState<AccruedExpense | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<AccruedExpense | null>(null);
  const [accrualToDelete, setAccrualToDelete] = useState<AccruedExpense | null>(null);

  // Add Accrual Form
  const [newAccrual, setNewAccrual] = useState({
    category: DEFAULT_ACCRUAL_CATEGORIES[0],
    amount: '',
    incurredDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    vendorOrRecipient: '',
    description: '',
    expenseAccountCode: '5020',
    liabilityAccountCode: '2010',
    invoiceNumber: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settlement Form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [settlePaymentMode, setSettlePaymentMode] = useState(PAYMENT_MODES[0]);
  const [settleRef, setSettleRef] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  // All categories available
  const allCategories = Array.from(new Set([
    ...DEFAULT_ACCRUAL_CATEGORIES,
    ...customCategories.filter(c => c.type === 'Expense' || c.type === 'Liability').map(c => c.name)
  ]));

  // Filtered accruals
  const filteredAccruals = accruals.filter(a => {
    const matchesSearch = a.vendorOrRecipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.invoiceNumber && a.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === 'ALL' || a.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalOutstandingLiabilities = accruals
    .filter(a => a.status !== 'Settled')
    .reduce((sum, a) => sum + (a.balanceDue || 0), 0);
  const totalSettledAmount = accruals.reduce((sum, a) => sum + (a.amountPaid || 0), 0);
  const totalAccruedAllTime = accruals.reduce((sum, a) => sum + (a.amount || 0), 0);
  const pendingCount = accruals.filter(a => a.status === 'Pending' || a.status === 'Partially Paid').length;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const overdueCount = accruals.filter(a => a.status !== 'Settled' && a.dueDate < todayStr).length;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAccrual.amount);
    if (!newAccrual.vendorOrRecipient.trim()) {
      onToast('error', 'Please enter vendor or recipient name.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      onToast('error', 'Please enter a valid accrual amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addAccruedExpense({
        category: newAccrual.category,
        amount: amt,
        incurredDate: newAccrual.incurredDate,
        dueDate: newAccrual.dueDate,
        vendorOrRecipient: newAccrual.vendorOrRecipient.trim(),
        description: newAccrual.description?.trim() || undefined,
        expenseAccountCode: newAccrual.expenseAccountCode || '5020',
        liabilityAccountCode: newAccrual.liabilityAccountCode || '2010',
        invoiceNumber: newAccrual.invoiceNumber?.trim() || undefined
      });

      onToast('success', `Accrued expense of ₹${amt.toLocaleString('en-IN')} for ${newAccrual.vendorOrRecipient} recorded under Current Liabilities!`);
      setShowAddModal(false);
      setNewAccrual({
        category: DEFAULT_ACCRUAL_CATEGORIES[0],
        amount: '',
        incurredDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        vendorOrRecipient: '',
        description: '',
        expenseAccountCode: '5020',
        liabilityAccountCode: '2010',
        invoiceNumber: ''
      });
      onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to record accrued expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSettleModal = (accrual: AccruedExpense) => {
    setShowSettleModal(accrual);
    setSettleAmount(accrual.balanceDue ? accrual.balanceDue.toString() : accrual.amount.toString());
    setSettleDate(format(new Date(), 'yyyy-MM-dd'));
    setSettlePaymentMode(PAYMENT_MODES[0]);
    setSettleRef('');
    setSettleRemarks('');
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSettleModal) return;

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      onToast('error', 'Please enter a valid settlement payment amount.');
      return;
    }

    setIsSettling(true);
    try {
      await settleAccrual(showSettleModal.id, {
        amount: amt,
        paymentDate: settleDate,
        paymentMode: settlePaymentMode,
        referenceNumber: settleRef.trim() || undefined,
        description: settleRemarks.trim() || undefined
      });

      onToast('success', `Settled ₹${amt.toLocaleString('en-IN')} of accrued payable to ${showSettleModal.vendorOrRecipient}. (Zero duplicate hit to P&L)`);
      setShowSettleModal(null);
      onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to record accrual settlement');
    } finally {
      setIsSettling(false);
    }
  };

  const handleDeleteAccrual = async () => {
    if (!accrualToDelete) return;
    try {
      await deleteAccruedExpense(accrualToDelete.id);
      onToast('success', `Accrual entry for ${accrualToDelete.vendorOrRecipient} deleted.`);
      setAccrualToDelete(null);
      onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to delete accrual entry');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Accruals & Outstanding Payables</h2>
              <p className="text-xs text-gray-500">Record expenses incurred but not yet paid, track liabilities & settle without duplicate P&L impact</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-xs hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Accrual Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Outstanding Payables</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono">
            ₹{totalOutstandingLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Pending liability in Accounts Payable (2010)</p>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Settled Amounts</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            ₹{totalSettledAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Payments disbursed to discharge liabilities</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Accrued Expenses</span>
            <div className="p-2 bg-gray-100 text-gray-700 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">
            ₹{totalAccruedAllTime.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Total recognized on accrual basis</p>
        </div>

        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Pending / Overdue</span>
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {pendingCount} <span className="text-xs font-normal text-rose-600">({overdueCount} overdue)</span>
          </div>
          <p className="text-[11px] text-rose-600 font-medium mt-1">Outstanding bills awaiting payment</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search vendor, category, invoice #..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-600 font-medium">Status Filter:</span>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as any)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500 font-medium"
          >
            <option value="ALL">All Accruals</option>
            <option value="Pending">Pending / Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Settled">Fully Settled</option>
          </select>
        </div>
      </div>

      {/* Accruals Registry Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">Vendor / Recipient</th>
                <th className="py-3 px-4">Expense Category</th>
                <th className="py-3 px-4">Incurred Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Accrued Amount (₹)</th>
                <th className="py-3 px-4 text-right">Paid (₹)</th>
                <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredAccruals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500 italic">
                    No accrued expenses recorded. Click "+ Record Accrual Entry" to add one.
                  </td>
                </tr>
              ) : (
                filteredAccruals.map(accrual => {
                  const isSettled = accrual.status === 'Settled';
                  const isPartial = accrual.status === 'Partially Paid';
                  const isOverdue = !isSettled && accrual.dueDate < todayStr;

                  return (
                    <tr key={accrual.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{accrual.vendorOrRecipient}</div>
                        {accrual.invoiceNumber && (
                          <div className="text-[10px] text-gray-400 font-mono">Invoice #{accrual.invoiceNumber}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                          {accrual.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-medium">
                        {formatDate(accrual.incurredDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-gray-700'}`}>
                          {formatDate(accrual.dueDate)}
                        </span>
                        {isOverdue && (
                          <span className="ml-1.5 text-[10px] text-rose-500 font-semibold">(Overdue)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        ₹{accrual.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        ₹{(accrual.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {accrual.balanceDue > 0 ? (
                          <span className="text-rose-600 font-extrabold">
                            ₹{accrual.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-gray-400">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSettled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          isPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {accrual.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          {accrual.balanceDue > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleModal(accrual)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1"
                              title="Settle / Pay this accrued liability"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowHistoryModal(accrual)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Settlement History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccrualToDelete(accrual)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Accrual Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- MODAL 1: ADD ACCRUAL ENTRY ---------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Record Accrual Entry</h3>
                  <p className="text-xs text-amber-100">Recognizes expense now and credits Accounts Payable (2010)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Vendor / Recipient Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAccrual.vendorOrRecipient}
                    onChange={e => setNewAccrual({ ...newAccrual, vendorOrRecipient: e.target.value })}
                    placeholder="e.g. Building Landlord, CleanWell Services..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Invoice / Bill Reference #
                  </label>
                  <input
                    type="text"
                    value={newAccrual.invoiceNumber}
                    onChange={e => setNewAccrual({ ...newAccrual, invoiceNumber: e.target.value })}
                    placeholder="e.g. INV-2026-088"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Expense Category *
                    </label>
                    {onOpenNewCategoryModal && (
                      <button
                        type="button"
                        onClick={onOpenNewCategoryModal}
                        className="text-[10px] text-amber-700 font-bold hover:underline"
                      >
                        + New Category
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    list="accrual-category-options"
                    required
                    value={newAccrual.category}
                    onChange={e => setNewAccrual({ ...newAccrual, category: e.target.value })}
                    placeholder="Select or enter category..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <datalist id="accrual-category-options">
                    {allCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Accrued Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={newAccrual.amount}
                    onChange={e => setNewAccrual({ ...newAccrual, amount: e.target.value })}
                    placeholder="e.g. 45000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Transaction Date (DD/MM/YYYY) *
                  </label>
                  <input
                    type="date"
                    required
                    value={newAccrual.incurredDate}
                    onChange={e => setNewAccrual({ ...newAccrual, incurredDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Due Date (DD/MM/YYYY) *
                  </label>
                  <input
                    type="date"
                    required
                    value={newAccrual.dueDate}
                    onChange={e => setNewAccrual({ ...newAccrual, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                  Automated Double-Entry Posting
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block mb-0.5 font-medium">Debit Expense Head:</span>
                    <select
                      value={newAccrual.expenseAccountCode}
                      onChange={e => setNewAccrual({ ...newAccrual, expenseAccountCode: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value="5020">5020 - Centre Rent & Facility Lease</option>
                      <option value="5030">5030 - Electricity, Water & Utilities</option>
                      <option value="5040">5040 - Care Consumables & Activity Materials</option>
                      <option value="5050">5050 - Food, Snacks & Child Nutrition</option>
                      <option value="5060">5060 - Centre Maintenance & Repairs</option>
                      <option value="5070">5070 - Marketing & Parent Outreach</option>
                      <option value="5080">5080 - Software & IT Subscriptions</option>
                      <option value="5090">5090 - Staff Training & Professional Development</option>
                      {accounts.filter(a => a.type === 'Expense' && !['5020','5030','5040','5050','5060','5070','5080','5090'].includes(a.code)).map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-gray-500 block mb-0.5 font-medium">Credit Liability Head:</span>
                    <select
                      value={newAccrual.liabilityAccountCode}
                      onChange={e => setNewAccrual({ ...newAccrual, liabilityAccountCode: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value="2010">2010 - Accounts Payable (Vendors & Suppliers)</option>
                      <option value="2030">2030 - Accrued Staff Salaries & Caregiver Fees</option>
                      {accounts.filter(a => a.type === 'Liability' && !['2010','2030'].includes(a.code)).map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={newAccrual.description}
                  onChange={e => setNewAccrual({ ...newAccrual, description: e.target.value })}
                  placeholder="e.g. Monthly centre premises lease for current operating month..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <span>Recording...</span> : <span>Save Accrual Entry</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: SETTLE ACCRUAL PAYMENT ---------------- */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Settle Accrued Payable</h3>
                  <p className="text-xs text-emerald-100">{showSettleModal.vendorOrRecipient} • {showSettleModal.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleModal(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Outstanding Balance</div>
                  <div className="text-xl font-black text-emerald-900 font-mono">
                    ₹{showSettleModal.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettleAmount(showSettleModal.balanceDue.toString())}
                  className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-200/80 hover:bg-emerald-200 rounded-lg transition-colors"
                >
                  Pay Full Balance
                </button>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Accounting Integrity:</strong> This payout debits Accounts Payable (2010) and credits Bank/Cash. P&L expense was already recognized on accrual date and will NOT be duplicated.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Settlement Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={showSettleModal.balanceDue}
                  step="0.01"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Payment Date (DD/MM/YYYY) *
                  </label>
                  <input
                    type="date"
                    required
                    value={settleDate}
                    onChange={e => setSettleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={settlePaymentMode}
                    onChange={e => setSettlePaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {PAYMENT_MODES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Payment Reference / Cheque # (Optional)
                </label>
                <input
                  type="text"
                  value={settleRef}
                  onChange={e => setSettleRef(e.target.value)}
                  placeholder="e.g. UTR / Bank ref #..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Settlement Narration / Notes
                </label>
                <input
                  type="text"
                  value={settleRemarks}
                  onChange={e => setSettleRemarks(e.target.value)}
                  placeholder="e.g. Paid via digital transfer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-50"
                >
                  {isSettling ? <span>Processing...</span> : <span>Disburse Settlement</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: SETTLEMENT HISTORY ---------------- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Settlement Payment Timeline</h3>
                  <p className="text-xs text-gray-400">{showHistoryModal.vendorOrRecipient} • {showHistoryModal.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Original Accrual</div>
                  <div className="text-base font-extrabold text-gray-900 font-mono">
                    ₹{showHistoryModal.amount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Settled</div>
                  <div className="text-base font-extrabold text-emerald-700 font-mono">
                    ₹{(showHistoryModal.amountPaid || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase">Balance Remaining</div>
                  <div className="text-base font-extrabold text-rose-700 font-mono">
                    ₹{showHistoryModal.balanceDue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                  Payments Disbursed
                </h4>
                {(!showHistoryModal.settlementHistory || showHistoryModal.settlementHistory.length === 0) ? (
                  <div className="p-6 text-center text-gray-400 italic text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No settlement payments recorded yet for this accrual liability.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {showHistoryModal.settlementHistory.map((rec, i) => (
                      <div key={rec.id || i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-gray-900">
                            {formatDate(rec.paymentDate)} • {rec.paymentMode || 'Payment'}
                          </div>
                          {rec.description && (
                            <div className="text-gray-500 text-[11px] mt-0.5">{rec.description}</div>
                          )}
                          {rec.referenceNumber && (
                            <div className="text-gray-400 text-[10px] font-mono">Ref: {rec.referenceNumber}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold font-mono text-emerald-700 text-sm">
                            ₹{rec.amount.toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] text-gray-400">Payment #{i + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {accrualToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900">Delete Accrual Entry?</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete the accrual record of ₹{accrualToDelete.amount.toLocaleString('en-IN')} for <strong>{accrualToDelete.vendorOrRecipient}</strong>? The liability and linked ledger entries will be reversed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setAccrualToDelete(null)}
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccrual}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
