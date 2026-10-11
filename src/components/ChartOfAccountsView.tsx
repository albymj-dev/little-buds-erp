import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Download,
  Printer,
  Edit2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Scale,
  Landmark,
  Layers,
  HelpCircle,
  X,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ChartOfAccountItem, AccountType, AccountNormalBalance, FinanceTransaction, Fee } from '../types';
import { addChartOfAccount, updateChartOfAccount, deleteChartOfAccount, calculateAccountLedgerBalances } from '../services/chartOfAccountsService';

interface ChartOfAccountsViewProps {
  accounts: ChartOfAccountItem[];
  transactions: FinanceTransaction[];
  fees: Fee[];
  liquidStats: {
    bankBalance: number;
    cashBalance: number;
    totalReceipts: number;
    totalPayments: number;
    depreciationTotal: number;
  };
  onAccountsUpdated: () => void;
  onRecordTransactionForAccount?: (account: ChartOfAccountItem) => void;
}

export const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = ({
  accounts,
  transactions,
  fees,
  liquidStats,
  onAccountsUpdated,
  onRecordTransactionForAccount
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'Asset' as AccountType,
    subtype: 'Current Asset',
    normalBalance: 'Debit' as AccountNormalBalance,
    description: '',
    linkedCategory: ''
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Calculate live balances for all accounts
  const accountBalances = useMemo(() => {
    return calculateAccountLedgerBalances(accounts, transactions, fees, liquidStats);
  }, [accounts, transactions, fees, liquidStats]);

  // Account Type configuration map
  const typeConfig: Record<AccountType, { badge: string; border: string; bg: string; icon: any; defaultNormal: AccountNormalBalance }> = {
    Asset: {
      badge: 'bg-blue-50 text-blue-800 border-blue-200',
      border: 'border-l-blue-600',
      bg: 'bg-blue-50/20',
      icon: Landmark,
      defaultNormal: 'Debit'
    },
    Liability: {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      border: 'border-l-amber-600',
      bg: 'bg-amber-50/20',
      icon: Scale,
      defaultNormal: 'Credit'
    },
    Equity: {
      badge: 'bg-purple-50 text-purple-800 border-purple-200',
      border: 'border-l-purple-600',
      bg: 'bg-purple-50/20',
      icon: Layers,
      defaultNormal: 'Credit'
    },
    Revenue: {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      border: 'border-l-emerald-600',
      bg: 'bg-emerald-50/20',
      icon: TrendingUp,
      defaultNormal: 'Credit'
    },
    Expense: {
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      border: 'border-l-rose-600',
      bg: 'bg-rose-50/20',
      icon: TrendingDown,
      defaultNormal: 'Debit'
    }
  };

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const assets = accounts.filter(a => a.type === 'Asset');
    const liabilities = accounts.filter(a => a.type === 'Liability');
    const equity = accounts.filter(a => a.type === 'Equity');
    const revenues = accounts.filter(a => a.type === 'Revenue');
    const expenses = accounts.filter(a => a.type === 'Expense');

    const totalAssetBalance = assets.reduce((sum, a) => {
      if (a.subtype === 'Contra-Asset') {
        return sum - (accountBalances[a.code]?.balance || 0);
      }
      return sum + (accountBalances[a.code]?.balance || 0);
    }, 0);

    const totalRevenueBalance = revenues.reduce((sum, a) => sum + (accountBalances[a.code]?.balance || 0), 0);
    const totalExpenseBalance = expenses.reduce((sum, a) => sum + (accountBalances[a.code]?.balance || 0), 0);
    const totalEquityBalance = equity.reduce((sum, a) => sum + (accountBalances[a.code]?.balance || 0), 0);

    return {
      totalAccounts: accounts.length,
      assetCount: assets.length,
      totalAssetBalance,
      liabilityCount: liabilities.length,
      equityCount: equity.length,
      totalEquityBalance,
      revenueCount: revenues.length,
      totalRevenueBalance,
      expenseCount: expenses.length,
      totalExpenseBalance
    };
  }, [accounts, accountBalances]);

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter(a => {
        if (!showInactive && !a.isActive) return false;
        if (selectedType !== 'ALL' && a.type !== selectedType) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            a.code.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.subtype.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [accounts, selectedType, searchQuery, showInactive]);

  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setFormData({
      code: '',
      name: '',
      type: 'Asset',
      subtype: 'Current Asset',
      normalBalance: 'Debit',
      description: '',
      linkedCategory: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (account: ChartOfAccountItem) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      normalBalance: account.normalBalance,
      description: account.description || '',
      linkedCategory: account.linkedCategory || ''
    });
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: AccountType) => {
    let defaultSubtype = 'Current Asset';
    let defaultNormal: AccountNormalBalance = 'Debit';

    if (newType === 'Asset') {
      defaultSubtype = 'Current Asset';
      defaultNormal = 'Debit';
    } else if (newType === 'Liability') {
      defaultSubtype = 'Current Liability';
      defaultNormal = 'Credit';
    } else if (newType === 'Equity') {
      defaultSubtype = 'Partner Capital';
      defaultNormal = 'Credit';
    } else if (newType === 'Revenue') {
      defaultSubtype = 'Operating Revenue';
      defaultNormal = 'Credit';
    } else if (newType === 'Expense') {
      defaultSubtype = 'Operating Expense';
      defaultNormal = 'Debit';
    }

    setFormData(prev => ({
      ...prev,
      type: newType,
      subtype: defaultSubtype,
      normalBalance: defaultNormal
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      showToast('Please fill in both Account Code and Account Name.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount && editingAccount.id) {
        await updateChartOfAccount(editingAccount.id, {
          name: formData.name.trim(),
          subtype: formData.subtype.trim(),
          normalBalance: formData.normalBalance,
          description: formData.description.trim(),
          linkedCategory: formData.linkedCategory.trim() || undefined
        });
        showToast(`Account ${formData.code} updated successfully.`);
      } else {
        // Check for duplicate code
        if (accounts.some(a => a.code === formData.code.trim())) {
          showToast(`Account code ${formData.code} already exists.`);
          setIsSubmitting(false);
          return;
        }

        await addChartOfAccount({
          code: formData.code.trim(),
          name: formData.name.trim(),
          type: formData.type,
          subtype: formData.subtype.trim(),
          normalBalance: formData.normalBalance,
          description: formData.description.trim(),
          isSystem: false,
          isActive: true,
          linkedCategory: formData.linkedCategory.trim() || undefined
        });
        showToast(`Account ${formData.code} - ${formData.name} created successfully.`);
      }

      setIsModalOpen(false);
      onAccountsUpdated();
    } catch (error) {
      console.error('Error saving account:', error);
      showToast('Failed to save account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (account: ChartOfAccountItem) => {
    if (!account.id) return;
    try {
      await updateChartOfAccount(account.id, { isActive: !account.isActive });
      showToast(`Account ${account.code} marked as ${!account.isActive ? 'Active' : 'Inactive'}.`);
      onAccountsUpdated();
    } catch (error) {
      console.error('Error toggling account status:', error);
      showToast('Failed to change status.');
    }
  };

  const handleDeleteAccount = async (account: ChartOfAccountItem) => {
    if (!account.id) return;
    if (account.isSystem) {
      showToast('Standard system accounts cannot be deleted to preserve financial audit integrity.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete custom account "${account.code} - ${account.name}"?`)) {
      try {
        await deleteChartOfAccount(account.id);
        showToast(`Account ${account.code} deleted.`);
        onAccountsUpdated();
      } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Failed to delete account.');
      }
    }
  };

  const handleExportCOA = () => {
    const exportData = filteredAccounts.map(a => {
      const liveData = accountBalances[a.code] || { balance: 0, entryCount: 0 };
      return {
        'Account Code': a.code,
        'Account Name': a.name,
        'Classification': a.type,
        'Subtype': a.subtype,
        'Normal Balance': a.normalBalance,
        'Live Balance (₹)': liveData.balance,
        'Transactions / Entries': liveData.entryCount,
        'Status': a.isActive ? 'Active' : 'Inactive',
        'Description': a.description || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chart of Accounts');
    XLSX.writeFile(workbook, `LittleBuds_Chart_of_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Chart of Accounts exported to Excel successfully.');
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner with High-Level Financial Ledger Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Accounts</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-gray-900 mt-1">{summaryMetrics.totalAccounts}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Active General Ledger</div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-blue-100 shadow-xs bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">1000 Assets</span>
            <Landmark className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-blue-900 mt-1">₹{summaryMetrics.totalAssetBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="text-[10px] text-blue-600 font-medium mt-0.5">{summaryMetrics.assetCount} Accounts (Bank, Cash, Fixed)</div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-amber-100 shadow-xs bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">2000 Liabilities</span>
            <Scale className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-900 mt-1">{summaryMetrics.liabilityCount} Heads</div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">Payables & Advances</div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-purple-100 shadow-xs bg-gradient-to-br from-white to-purple-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">3000 Equity</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-purple-900 mt-1">₹{summaryMetrics.totalEquityBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="text-[10px] text-purple-600 font-medium mt-0.5">{summaryMetrics.equityCount} Partner & Reserves Heads</div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-emerald-100 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">4000 Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-900 mt-1">₹{summaryMetrics.totalRevenueBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">{summaryMetrics.revenueCount} Inflow Streams</div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-rose-100 shadow-xs bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">5000 Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-900 mt-1">₹{summaryMetrics.totalExpenseBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">{summaryMetrics.expenseCount} Overhead Categories</div>
        </div>
      </div>

      {/* Main Control Strip */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Account Classification Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'All Accounts' },
            { id: 'Asset', label: '1000 Assets' },
            { id: 'Liability', label: '2000 Liabilities' },
            { id: 'Equity', label: '3000 Equity' },
            { id: 'Revenue', label: '4000 Revenue' },
            { id: 'Expense', label: '5000 Expenses' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedType === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Status Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search code or account..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <label className="flex items-center space-x-1.5 text-xs text-gray-600 cursor-pointer select-none px-2 py-1 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span>Include Inactive</span>
          </label>

          <button
            onClick={handleExportCOA}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Export Excel
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs"
            title="Print Chart of Accounts"
          >
            <Printer className="w-3.5 h-3.5 mr-1 text-gray-500" />
            Print
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Ledger Account
          </button>
        </div>
      </div>

      {/* Main Accounts Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50/80 text-xs font-bold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-24">Code</th>
                <th className="py-3.5 px-4 min-w-[220px]">Account Name & Description</th>
                <th className="py-3.5 px-4 w-32">Classification</th>
                <th className="py-3.5 px-4 w-36">Subtype</th>
                <th className="py-3.5 px-4 text-center w-28">Normal Balance</th>
                <th className="py-3.5 px-4 text-right min-w-[150px]">Live Balance (₹)</th>
                <th className="py-3.5 px-4 text-center w-28">Status</th>
                <th className="py-3.5 px-4 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No accounts found matching your criteria.</p>
                    <p className="text-xs text-gray-400 mt-1">Try resetting search filters or add a new account.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(account => {
                  const cfg = typeConfig[account.type] || typeConfig.Asset;
                  const live = accountBalances[account.code] || { balance: 0, entryCount: 0 };
                  const isContra = account.subtype === 'Contra-Asset';

                  return (
                    <tr
                      key={account.id || account.code}
                      className={`hover:bg-gray-50/70 transition-colors ${!account.isActive ? 'opacity-60 bg-gray-50/40' : ''}`}
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-bold text-xs text-indigo-950">
                        <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                          {account.code}
                        </span>
                      </td>

                      {/* Name & Description */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 text-sm flex items-center space-x-2">
                          <span>{account.name}</span>
                          {account.isSystem && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded">
                              System
                            </span>
                          )}
                        </div>
                        {account.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{account.description}</p>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.badge}`}>
                          {account.type}
                        </span>
                      </td>

                      {/* Subtype */}
                      <td className="py-3 px-4 text-xs font-medium text-gray-600">
                        {account.subtype}
                      </td>

                      {/* Normal Balance */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            account.normalBalance === 'Debit'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {account.normalBalance}
                        </span>
                      </td>

                      {/* Live Balance */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-sm text-gray-900 tabular-nums">
                          {isContra && live.balance > 0 && '-'}
                          ₹{live.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {live.entryCount} {live.entryCount === 1 ? 'entry' : 'entries'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(account)}
                          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                            account.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                          title={account.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {account.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(account)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Edit Account Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!account.isSystem && (
                            <button
                              onClick={() => handleDeleteAccount(account)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete Account"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Accounting Reference Guide Footnote */}
      <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 text-xs text-indigo-950 flex items-start space-x-3">
        <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Chart of Accounts & General Ledger Structure</p>
          <p className="text-indigo-800 leading-relaxed">
            The Chart of Accounts organizes Little Buds Child Care Centre's double-entry general ledger.
            <strong> 1000s</strong> represent Assets (including separate liquid accounts for Bank and Physical Cash),
            <strong> 2000s</strong> represent Liabilities,
            <strong> 3000s</strong> represent Partner Capital & Retained General Reserves,
            <strong> 4000s</strong> represent Child Care Tuition & Activity Revenue, and
            <strong> 5000s</strong> track Operating Overheads and Depreciation. Real-time balances reconcile with transaction entries and student fee payments automatically.
          </p>
        </div>
      </div>

      {/* ADD / EDIT ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-gray-600/70 transition-opacity" onClick={() => setIsModalOpen(false)}></div>

            <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all">
              <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-indigo-200" />
                  <h3 className="text-base font-bold">
                    {editingAccount ? `Edit Account: ${editingAccount.code}` : 'Add New General Ledger Account'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-indigo-200 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Account Code *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingAccount}
                      placeholder="e.g. 1030, 5130"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono disabled:bg-gray-100"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">1xxx Asset, 2xxx Liab, 3xxx Equity, 4xxx Rev, 5xxx Exp</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Classification *
                    </label>
                    <select
                      value={formData.type}
                      disabled={!!editingAccount}
                      onChange={e => handleTypeChange(e.target.value as AccountType)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                    >
                      <option value="Asset">Asset (1000)</option>
                      <option value="Liability">Liability (2000)</option>
                      <option value="Equity">Equity (3000)</option>
                      <option value="Revenue">Revenue (4000)</option>
                      <option value="Expense">Expense (5000)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Secondary Bank Account (HDFC), Speech Assessment Kits"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Account Subtype *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cash & Bank, Fixed Asset, Current Liability"
                      value={formData.subtype}
                      onChange={e => setFormData({ ...formData, subtype: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Normal Balance *
                    </label>
                    <select
                      value={formData.normalBalance}
                      onChange={e => setFormData({ ...formData, normalBalance: e.target.value as AccountNormalBalance })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Debit">Debit (Standard for Assets & Expenses)</option>
                      <option value="Credit">Credit (Standard for Liabilities, Equity, Revenues)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Description & Accounting Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Purpose of this account and types of transactions recorded here..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingAccount ? 'Update Account' : 'Create Account Head'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccountsView;
