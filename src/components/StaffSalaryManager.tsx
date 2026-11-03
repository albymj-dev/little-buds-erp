import React, { useState } from 'react';
import { 
  Users, Plus, DollarSign, Calendar, Clock, AlertCircle, CheckCircle2, 
  Trash2, Eye, History, ChevronRight, X, ArrowUpRight, Search, Filter, 
  CreditCard, Banknote, Landmark, FileText, Check, AlertTriangle
} from 'lucide-react';
import { StaffSalary, SalaryPaymentRecord, ChartOfAccountItem } from '../types';
import { addStaffSalary, recordSalaryPayment, deleteStaffSalary } from '../services/accountingService';
import { formatDate } from '../utils/dateUtils';
import { format } from 'date-fns';

interface StaffSalaryManagerProps {
  salaries: StaffSalary[];
  accounts: ChartOfAccountItem[];
  onRefresh: () => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  onOpenNewLedgerModal?: () => void;
}

const PAYMENT_MODES = [
  'Bank Transfer / NEFT / IMPS',
  'UPI / Online Payment',
  'Cash',
  'Cheque',
  'Direct Bank Deposit'
];

export const StaffSalaryManager: React.FC<StaffSalaryManagerProps> = ({
  salaries,
  accounts,
  onRefresh,
  onToast,
  onOpenNewLedgerModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'Paid' | 'Partially Paid' | 'Pending' | 'Advance'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<StaffSalary | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<StaffSalary | null>(null);
  const [salaryToDelete, setSalaryToDelete] = useState<StaffSalary | null>(null);

  // Add Salary Form
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const [newSalary, setNewSalary] = useState({
    staffName: '',
    designation: 'Child Care Educator',
    salaryMonth: currentMonthStr,
    totalSalary: '',
    amountPaid: '',
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMode: PAYMENT_MODES[0],
    ledgerAccountCode: '5010',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Partial Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Available unique months
  const availableMonths = (Array.from(new Set(salaries.map(s => s.salaryMonth))) as string[]).sort().reverse();

  // Filtered Salaries
  const filteredSalaries = salaries.filter(s => {
    const matchesSearch = s.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.designation && s.designation.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesMonth = selectedMonth === 'ALL' || s.salaryMonth === selectedMonth;
    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
    return matchesSearch && matchesMonth && matchesStatus;
  });

  // KPI calculations
  const totalSalariesPaidAllTime = salaries.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const totalOutstandingBalances = salaries.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
  const totalAdvancesGiven = salaries.reduce((sum, s) => sum + (s.advanceAmount || 0), 0);
  const uniqueStaffCount = new Set(salaries.map(s => s.staffName.trim().toLowerCase())).size;

  // Handlers
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(newSalary.totalSalary);
    const paid = newSalary.amountPaid ? parseFloat(newSalary.amountPaid) : 0;

    if (!newSalary.staffName.trim()) {
      onToast('error', 'Please enter staff name.');
      return;
    }
    if (isNaN(total) || total <= 0) {
      onToast('error', 'Please enter a valid total salary amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addStaffSalary({
        staffName: newSalary.staffName.trim(),
        designation: newSalary.designation?.trim() || undefined,
        salaryMonth: newSalary.salaryMonth,
        totalSalary: total,
        amountPaid: paid,
        paymentDate: paid > 0 ? newSalary.paymentDate : undefined,
        paymentMode: paid > 0 ? newSalary.paymentMode : undefined,
        ledgerAccountCode: newSalary.ledgerAccountCode || '5010',
        description: newSalary.description?.trim() || undefined
      });

      onToast('success', `Staff salary record for ${newSalary.staffName} added successfully.`);
      setShowAddModal(false);
      setNewSalary({
        staffName: '',
        designation: 'Child Care Educator',
        salaryMonth: currentMonthStr,
        totalSalary: '',
        amountPaid: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMode: PAYMENT_MODES[0],
        ledgerAccountCode: '5010',
        description: ''
      });
      onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to add staff salary');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPayModal = (salary: StaffSalary) => {
    setShowPayModal(salary);
    setPaymentAmount(salary.balanceDue ? salary.balanceDue.toString() : '');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentMode(PAYMENT_MODES[0]);
    setPaymentRef('');
    setPaymentRemarks('');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      onToast('error', 'Please enter a valid payment amount.');
      return;
    }

    setIsPaying(true);
    try {
      await recordSalaryPayment(showPayModal.id, {
        amount: amt,
        paymentDate,
        paymentMode,
        referenceNumber: paymentRef.trim() || undefined,
        description: paymentRemarks.trim() || undefined
      });

      onToast('success', `Recorded salary payment of ₹${amt.toLocaleString('en-IN')} for ${showPayModal.staffName}`);
      setShowPayModal(null);
      onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to record salary payment');
    } finally {
      setIsPaying(false);
    }
  };

  const handleDeleteSalary = async () => {
    if (!salaryToDelete) return;
    try {
      await deleteStaffSalary(salaryToDelete.id);
      onToast('success', `Salary record for ${salaryToDelete.staffName} deleted.`);
      setSalaryToDelete(null);
      onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to delete salary record');
    }
  };

  const formatMonthLabel = (m: string) => {
    try {
      const [year, month] = m.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, 'MMMM yyyy');
    } catch {
      return m;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Staff Salaries Management</h2>
              <p className="text-xs text-gray-500">Record staff monthly payroll, partial payouts, advances & ledger postings</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Record Staff Salary</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Salaries Paid</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 font-mono">
            ₹{totalSalariesPaidAllTime.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Total cumulative payroll disbursed</p>
        </div>

        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Outstanding Balances</span>
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            ₹{totalOutstandingBalances.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-rose-600 font-medium mt-1">Pending unpaid salary liabilities</p>
        </div>

        <div className="bg-white rounded-xl border border-purple-200/80 p-4 shadow-xs bg-purple-50/20">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Total Advances</span>
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 font-mono">
            ₹{totalAdvancesGiven.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-purple-600 font-medium mt-1">Pre-paid salary advances</p>
        </div>

        <div className="bg-white rounded-xl border border-blue-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Active Staff Members</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-900 font-mono">
            {uniqueStaffCount}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Staff across payroll registry</p>
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
            placeholder="Search staff name or role..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-gray-600">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span>Month:</span>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">All Months</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-1.5 text-xs text-gray-600 ml-2">
            <span>Status:</span>
          </div>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as any)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="Paid">Fully Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Pending">Pending / Unpaid</option>
            <option value="Advance">Advance</option>
          </select>
        </div>
      </div>

      {/* Salary Registry Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member & Role</th>
                <th className="py-3 px-4">Salary Month</th>
                <th className="py-3 px-4 text-right">Total Salary (₹)</th>
                <th className="py-3 px-4 text-right">Paid (₹)</th>
                <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Latest Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 italic">
                    No staff salary records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map(salary => {
                  const isPartiallyPaid = salary.status === 'Partially Paid';
                  const isPending = salary.status === 'Pending';
                  const isAdvance = salary.status === 'Advance';
                  const isPaid = salary.status === 'Paid';

                  return (
                    <tr key={salary.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{salary.staffName}</div>
                        <div className="text-[11px] text-gray-500">{salary.designation || 'Staff Member'}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        {formatMonthLabel(salary.salaryMonth)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        ₹{salary.totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        ₹{(salary.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {salary.balanceDue > 0 ? (
                          <span className="text-rose-600 font-extrabold">
                            ₹{salary.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : isAdvance ? (
                          <span className="text-purple-600 font-semibold">
                            +₹{(salary.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Adv
                          </span>
                        ) : (
                          <span className="text-gray-400">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          isPartiallyPaid ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          isAdvance ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {salary.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {salary.paymentDate ? (
                          <div>
                            <span className="font-medium text-gray-700">{formatDate(salary.paymentDate)}</span>
                            {salary.paymentMode && (
                              <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{salary.paymentMode}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unpaid</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          {salary.balanceDue > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(salary)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1"
                              title="Record payment against outstanding balance"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Settle</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowHistoryModal(salary)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Payment History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSalaryToDelete(salary)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete salary record"
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

      {/* ---------------- MODAL 1: ADD SALARY ---------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Record Monthly Staff Salary</h3>
                  <p className="text-xs text-indigo-100">Supports full settlement, partial payouts, and advances</p>
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
                    Staff Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSalary.staffName}
                    onChange={e => setNewSalary({ ...newSalary, staffName: e.target.value })}
                    placeholder="e.g. Anjali Nair, Priya Kurian..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Role / Designation
                  </label>
                  <input
                    type="text"
                    value={newSalary.designation}
                    onChange={e => setNewSalary({ ...newSalary, designation: e.target.value })}
                    placeholder="e.g. Lead Teacher, Caregiver..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Salary Month *
                  </label>
                  <input
                    type="month"
                    required
                    value={newSalary.salaryMonth}
                    onChange={e => setNewSalary({ ...newSalary, salaryMonth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Total Scheduled Salary (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={newSalary.totalSalary}
                    onChange={e => {
                      const val = e.target.value;
                      setNewSalary({ ...newSalary, totalSalary: val, amountPaid: newSalary.amountPaid || val });
                    }}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Payment Payout Details</span>
                  <button
                    type="button"
                    onClick={() => setNewSalary({ ...newSalary, amountPaid: newSalary.totalSalary })}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Pay Full Amount
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Amount Paid Now (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newSalary.amountPaid}
                      onChange={e => setNewSalary({ ...newSalary, amountPaid: e.target.value })}
                      placeholder="Enter ₹ amount paid..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {parseFloat(newSalary.amountPaid || '0') < parseFloat(newSalary.totalSalary || '0') && parseFloat(newSalary.amountPaid || '0') > 0 ? (
                        <span className="text-amber-600 font-semibold">
                          Partial payout: Balance of ₹{(parseFloat(newSalary.totalSalary || '0') - parseFloat(newSalary.amountPaid || '0')).toLocaleString('en-IN')} will be accrued as liability.
                        </span>
                      ) : parseFloat(newSalary.amountPaid || '0') > parseFloat(newSalary.totalSalary || '0') ? (
                        <span className="text-purple-600 font-semibold">
                          Advance payout: Extra ₹{(parseFloat(newSalary.amountPaid || '0') - parseFloat(newSalary.totalSalary || '0')).toLocaleString('en-IN')} recorded as advance.
                        </span>
                      ) : parseFloat(newSalary.amountPaid || '0') === 0 ? (
                        <span className="text-rose-600 font-semibold">
                          Zero payment: Full ₹{parseFloat(newSalary.totalSalary || '0').toLocaleString('en-IN')} will remain as unpaid accrued liability.
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Full settlement.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Payment Date (DD/MM/YYYY)
                    </label>
                    <input
                      type="date"
                      value={newSalary.paymentDate}
                      onChange={e => setNewSalary({ ...newSalary, paymentDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={newSalary.paymentMode}
                      onChange={e => setNewSalary({ ...newSalary, paymentMode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      {PAYMENT_MODES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-600">
                        General Ledger Account
                      </label>
                      {onOpenNewLedgerModal && (
                        <button
                          type="button"
                          onClick={onOpenNewLedgerModal}
                          className="text-[10px] text-indigo-600 font-bold hover:underline"
                        >
                          + New
                        </button>
                      )}
                    </div>
                    <select
                      value={newSalary.ledgerAccountCode}
                      onChange={e => setNewSalary({ ...newSalary, ledgerAccountCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="5010">5010 - Teacher, Caregiver & Staff Salaries</option>
                      {accounts.filter(a => a.type === 'Expense' && a.code !== '5010').map(a => (
                        <option key={a.code} value={a.code}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newSalary.description}
                  onChange={e => setNewSalary({ ...newSalary, description: e.target.value })}
                  placeholder="e.g. Regular monthly payroll for full attendance..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <span>Saving...</span> : <span>Record Salary Entry</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: SETTLE BALANCE / PARTIAL PAYMENT ---------------- */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Settle Salary Balance</h3>
                  <p className="text-xs text-emerald-100">{showPayModal.staffName} • {formatMonthLabel(showPayModal.salaryMonth)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Current Balance Due</div>
                  <div className="text-xl font-black text-emerald-900 font-mono">
                    ₹{showPayModal.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(showPayModal.balanceDue.toString())}
                  className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-200/80 hover:bg-emerald-200 rounded-lg transition-colors"
                >
                  Pay Remaining Full
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
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
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
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
                  Transaction / Cheque Ref # (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. UTR / IMPS ref #..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={paymentRemarks}
                  onChange={e => setPaymentRemarks(e.target.value)}
                  placeholder="e.g. Final balance payout for month"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPayModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-50"
                >
                  {isPaying ? <span>Recording...</span> : <span>Confirm Payout</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: PAYMENT HISTORY ---------------- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gray-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Salary Payment Timeline</h3>
                  <p className="text-xs text-gray-400">{showHistoryModal.staffName} • {formatMonthLabel(showHistoryModal.salaryMonth)}</p>
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
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Total Salary</div>
                  <div className="text-base font-extrabold text-gray-900 font-mono">
                    ₹{showHistoryModal.totalSalary.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Paid So Far</div>
                  <div className="text-base font-extrabold text-emerald-700 font-mono">
                    ₹{(showHistoryModal.amountPaid || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase">Balance Due</div>
                  <div className="text-base font-extrabold text-rose-700 font-mono">
                    ₹{showHistoryModal.balanceDue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                  Payment Installments
                </h4>
                {(!showHistoryModal.paymentHistory || showHistoryModal.paymentHistory.length === 0) ? (
                  <div className="p-6 text-center text-gray-400 italic text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No payment transactions recorded yet for this salary.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {showHistoryModal.paymentHistory.map((rec, i) => (
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
                          <span className="text-[10px] text-gray-400">Installment #{i + 1}</span>
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
      {salaryToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900">Delete Salary Record?</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete the salary record for <strong>{salaryToDelete.staffName}</strong> ({formatMonthLabel(salaryToDelete.salaryMonth)})? Any linked accounting entries will also be reversed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSalaryToDelete(null)}
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSalary}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
