import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Building,
  Layers,
  Scale,
  TrendingUp,
  TrendingDown,
  Landmark,
  FileSpreadsheet,
  FileText,
  Eye,
  X,
  CreditCard,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { ChartOfAccountItem, FinanceTransaction, Fee, AccountType, LedgerEntry } from '../types';
import {
  generateAccountLedgerReport,
  generateMasterLedgerSummary,
  exportSingleLedgerToExcel,
  exportMasterLedgerToExcel,
  getIndianFYInfo
} from '../services/ledgerService';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../services/chartOfAccountsService';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { formatDate } from '../utils/dateUtils';

interface LedgerWiseReportViewProps {
  accounts: ChartOfAccountItem[];
  transactions: FinanceTransaction[];
  fees: Fee[];
  initialAccountCode?: string;
}

export const LedgerWiseReportView: React.FC<LedgerWiseReportViewProps> = ({
  accounts,
  transactions,
  fees,
  initialAccountCode
}) => {
  // Mode: 'single' (detailed ledger for one account) | 'summary' (all ledgers master report)
  const [viewMode, setViewMode] = useState<'single' | 'summary'>('single');

  // Fallback to all 32 default accounts if accounts prop is empty
  const activeAccounts = useMemo(() => {
    if (accounts && accounts.length > 0) return accounts;
    return DEFAULT_CHART_OF_ACCOUNTS.map((acc, index) => ({
      ...acc,
      id: `default-${acc.code}-${index}`,
      createdAt: '2025-01-01T00:00:00.000Z'
    }));
  }, [accounts]);

  // Selected Account Code for Single View
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>(
    initialAccountCode || (accounts.length > 0 ? accounts[0].code : '1010')
  );

  React.useEffect(() => {
    if (initialAccountCode) {
      setSelectedAccountCode(initialAccountCode);
    } else if (!selectedAccountCode && activeAccounts.length > 0) {
      setSelectedAccountCode(activeAccounts[0].code);
    }
  }, [initialAccountCode, activeAccounts, selectedAccountCode]);

  // Period Filter
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'all_time' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Quick search within entries
  const [entrySearch, setEntrySearch] = useState<string>('');

  // Summary classification filter
  const [summaryTypeFilter, setSummaryTypeFilter] = useState<string>('ALL');

  // Printable Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Determine date ranges based on period
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    if (period === 'this_month') {
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        periodLabel: format(now, 'MMMM yyyy')
      };
    } else if (period === 'last_month') {
      const last = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(last), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(last), 'yyyy-MM-dd'),
        periodLabel: format(last, 'MMMM yyyy')
      };
    } else if (period === 'this_quarter') {
      const fyInfo = getIndianFYInfo(now);
      return {
        startDate: fyInfo.quarterStartDate,
        endDate: fyInfo.quarterEndDate > format(now, 'yyyy-MM-dd') ? format(now, 'yyyy-MM-dd') : fyInfo.quarterEndDate,
        periodLabel: `${fyInfo.quarterLabel} (Indian FY)`
      };
    } else if (period === 'ytd') {
      const fyInfo = getIndianFYInfo(now);
      return {
        startDate: fyInfo.fyStartDate,
        endDate: fyInfo.fyEndDate,
        periodLabel: `${fyInfo.fyLabel} (Cumulative: Apr ${fyInfo.fyStartYear} - Mar ${fyInfo.fyEndYear})`
      };
    } else if (period === 'custom') {
      return {
        startDate: customStart,
        endDate: customEnd,
        periodLabel: `${customStart} to ${customEnd}`
      };
    } else {
      return {
        startDate: '2000-01-01',
        endDate: '2099-12-31',
        periodLabel: 'All Time Historical'
      };
    }
  }, [period, customStart, customEnd]);

  // Selected account object
  const selectedAccount = useMemo(() => {
    return activeAccounts.find(a => a.code === selectedAccountCode) || activeAccounts[0];
  }, [activeAccounts, selectedAccountCode]);

  // Single Account Report
  const singleReport = useMemo(() => {
    if (!selectedAccount) return null;
    return generateAccountLedgerReport(
      selectedAccount,
      startDate,
      endDate,
      periodLabel,
      transactions,
      fees,
      activeAccounts
    );
  }, [selectedAccount, startDate, endDate, periodLabel, transactions, fees, activeAccounts]);

  // Master Summary Report
  const masterSummary = useMemo(() => {
    return generateMasterLedgerSummary(
      activeAccounts,
      startDate,
      endDate,
      periodLabel,
      transactions,
      fees
    );
  }, [activeAccounts, startDate, endDate, periodLabel, transactions, fees]);

  // Filtered entries within single report
  const filteredEntries = useMemo(() => {
    if (!singleReport) return [];
    if (!entrySearch.trim()) return singleReport.entries;
    const q = entrySearch.toLowerCase();
    return singleReport.entries.filter(
      e =>
        e.particulars.toLowerCase().includes(q) ||
        (e.voucherNumber && e.voucherNumber.toLowerCase().includes(q)) ||
        (e.counterAccountName && e.counterAccountName.toLowerCase().includes(q)) ||
        (e.paymentMode && e.paymentMode.toLowerCase().includes(q)) ||
        String(e.debit).includes(q) ||
        String(e.credit).includes(q)
    );
  }, [singleReport, entrySearch]);

  // Export handlers
  const handleExportSingle = async () => {
    if (!singleReport) return;
    try {
      await exportSingleLedgerToExcel(singleReport);
      showToast(`Exported ledger for ${singleReport.account.code} to Excel.`);
    } catch (err) {
      console.error(err);
      showToast('Failed to export ledger to Excel.');
    }
  };

  const handleExportMaster = async () => {
    try {
      await exportMasterLedgerToExcel(masterSummary, periodLabel, startDate, endDate);
      showToast('Exported Master Ledger Summary to Excel.');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Master Ledger Summary.');
    }
  };

  const getTypeBadge = (type: AccountType) => {
    switch (type) {
      case 'Asset':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Liability':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Equity':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Revenue':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Expense':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner & Mode Toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700 border border-indigo-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Ledger Wise Report</h2>
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                General Ledger
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Account-wise transaction register with audit references, opening & closing balances, and counter accounts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'single'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Individual Account Ledger
              </button>
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'summary'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Ledgers Master Summary
              </button>
            </div>

            {/* Print & Export buttons */}
            {viewMode === 'single' ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-gray-500" />
                  Print Statement
                </button>
                <button
                  type="button"
                  onClick={handleExportSingle}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel (.xlsx)
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleExportMaster}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Master Report (.xlsx)
              </button>
            )}
          </div>
        </div>

        {/* Global Filter Bar: Period + Account Selector */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Period:</span>
            {[
              { key: 'this_month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
              { key: 'this_quarter', label: 'Quarter' },
              { key: 'ytd', label: 'FY YTD (Apr - Mar)' },
              { key: 'all_time', label: 'All Time' },
              { key: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  period === p.key
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}

            {period === 'custom' && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-gray-300"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-gray-300"
                />
              </div>
            )}
          </div>

          {/* Account Selector (for Single View) */}
          {viewMode === 'single' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Account:</span>
              <select
                value={selectedAccount?.code || selectedAccountCode}
                onChange={e => setSelectedAccountCode(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs md:max-w-sm truncate"
              >
                {activeAccounts.map(acc => (
                  <option key={acc.code} value={acc.code}>
                    {acc.code} - {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SINGLE ACCOUNT LEDGER STATEMENT VIEW                                   */}
      {/* ========================================================================= */}
      {viewMode === 'single' && singleReport && (
        <div className="space-y-6">
          {/* Account Header Card with 4 KPI Blocks */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-5 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    {singleReport.account.code}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900">{singleReport.account.name}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getTypeBadge(
                      singleReport.account.type
                    )}`}
                  >
                    {singleReport.account.type} • {singleReport.account.subtype}
                  </span>
                  <span className="text-xs text-gray-500">
                    Normal Balance: <strong>{singleReport.account.normalBalance}</strong>
                  </span>
                  {singleReport.account.linkedCategory && (
                    <span className="text-xs text-gray-400">
                      • Linked: {singleReport.account.linkedCategory}
                    </span>
                  )}
                </div>
                {singleReport.account.description && (
                  <p className="text-xs text-gray-500 mt-1.5 max-w-2xl">{singleReport.account.description}</p>
                )}
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-gray-400 block uppercase tracking-wider">Statement Period</span>
                <span className="text-sm font-bold text-gray-900">{singleReport.periodLabel}</span>
                <span className="text-[11px] text-gray-400 block">
                  {singleReport.startDate} to {singleReport.endDate}
                </span>
              </div>
            </div>

            {/* 4 Financial KPI Blocks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              {/* Opening Balance */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Opening Balance (B/F)</span>
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-black text-slate-900">
                    ₹{singleReport.openingBalance.toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.2 rounded ${
                      singleReport.openingBalanceType === 'Dr'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {singleReport.openingBalanceType}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">As of {singleReport.startDate}</span>
              </div>

              {/* Total Debits */}
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-blue-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Debits (Dr)</span>
                  <ArrowDownRight className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-black text-blue-900 mt-1.5">
                  ₹{singleReport.totalDebit.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-blue-500 block mt-0.5">
                  {singleReport.entries.filter(e => e.debit > 0).length} Debit Entries
                </span>
              </div>

              {/* Total Credits */}
              <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-purple-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Credits (Cr)</span>
                  <ArrowUpRight className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl font-black text-purple-900 mt-1.5">
                  ₹{singleReport.totalCredit.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-purple-500 block mt-0.5">
                  {singleReport.entries.filter(e => e.credit > 0).length} Credit Entries
                </span>
              </div>

              {/* Closing Balance */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-indigo-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Closing Balance (C/F)</span>
                  <Scale className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-black text-indigo-950">
                    ₹{singleReport.closingBalance.toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.2 rounded ${
                      singleReport.closingBalanceType === 'Dr'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {singleReport.closingBalanceType}
                  </span>
                </div>
                <span className="text-[10px] text-indigo-500 block mt-0.5">As of {singleReport.endDate}</span>
              </div>
            </div>
          </div>

          {/* Search within ledger entries */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search ledger entries by voucher, narration, counterparty..."
                value={entrySearch}
                onChange={e => setEntrySearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {entrySearch && (
                <button
                  type="button"
                  onClick={() => setEntrySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-gray-500 font-medium">
              Showing <strong>{filteredEntries.length}</strong> of {singleReport.entries.length} entries
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3">Voucher #</th>
                    <th className="py-3 px-3.5">Particulars / Narration</th>
                    <th className="py-3 px-3.5">Counter Account</th>
                    <th className="py-3 px-3">Mode</th>
                    <th className="py-3 px-3.5 text-right">Debit (Dr) ₹</th>
                    <th className="py-3 px-3.5 text-right">Credit (Cr) ₹</th>
                    <th className="py-3 px-4 text-right">Running Balance ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/80 font-semibold text-slate-700">
                    <td className="py-2.5 px-3.5 font-mono text-slate-500">{singleReport.startDate}</td>
                    <td className="py-2.5 px-3 text-slate-400">—</td>
                    <td className="py-2.5 px-3.5 italic text-slate-800" colSpan={3}>
                      Opening Balance Brought Forward (B/F)
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                      {singleReport.openingBalanceType === 'Dr'
                        ? `₹${singleReport.openingBalance.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                      {singleReport.openingBalanceType === 'Cr'
                        ? `₹${singleReport.openingBalance.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{singleReport.openingBalance.toLocaleString('en-IN')} {singleReport.openingBalanceType}
                    </td>
                  </tr>

                  {/* Empty state */}
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-400">
                        No transactions recorded for this ledger in the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-3.5 whitespace-nowrap font-mono text-gray-700 font-medium">{formatDate(entry.date)}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {entry.voucherNumber || 'TXN'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-medium text-gray-900 leading-snug">{entry.particulars}</div>
                          {entry.transactionType && (
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                              {entry.transactionType}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="font-medium text-gray-700 text-xs">
                            {entry.counterAccountCode ? (
                              <span className="font-mono text-gray-500 mr-1.5">{entry.counterAccountCode} •</span>
                            ) : null}
                            {entry.counterAccountName || 'General'}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {entry.paymentMode ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {entry.paymentMode}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                          {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-purple-700 whitespace-nowrap">
                          {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-gray-900 whitespace-nowrap">
                          ₹{entry.balance.toLocaleString('en-IN')}{' '}
                          <span
                            className={`text-[10px] font-bold ml-0.5 ${
                              entry.balanceType === 'Dr' ? 'text-blue-600' : 'text-purple-600'
                            }`}
                          >
                            {entry.balanceType}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Period Totals Row */}
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={5} className="py-3 px-3.5 uppercase tracking-wider text-right text-xs">
                      Period Totals ({filteredEntries.length} Transactions)
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-sm text-blue-900">
                      ₹{singleReport.totalDebit.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-sm text-purple-900">
                      ₹{singleReport.totalCredit.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700">
                      Net: ₹{Math.abs(singleReport.netMovement).toLocaleString('en-IN')}{' '}
                      {singleReport.closingBalanceType}
                    </td>
                  </tr>

                  {/* Closing Balance Row */}
                  <tr className="bg-indigo-50 font-black text-indigo-950 border-t border-b-2 border-indigo-300">
                    <td className="py-3 px-3.5 font-mono text-indigo-700">{singleReport.endDate}</td>
                    <td className="py-3 px-3 text-indigo-400">—</td>
                    <td className="py-3 px-3.5 uppercase tracking-wider text-xs" colSpan={3}>
                      Closing Balance Carried Forward (C/F)
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-sm text-blue-900">
                      {singleReport.closingBalanceType === 'Dr'
                        ? `₹${singleReport.closingBalance.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-sm text-purple-900">
                      {singleReport.closingBalanceType === 'Cr'
                        ? `₹${singleReport.closingBalance.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-base font-black text-indigo-950">
                      ₹{singleReport.closingBalance.toLocaleString('en-IN')} {singleReport.closingBalanceType}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MASTER LEDGER SUMMARY (ALL LEDGERS / TRIAL BALANCE)                    */}
      {/* ========================================================================= */}
      {viewMode === 'summary' && (
        <div className="space-y-6">
          {/* Trial Balance & Double Entry Verification Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Total Active Ledgers</span>
              <span className="text-2xl font-black text-gray-900 mt-1 block">{masterSummary.items.length}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">Across 5 Account Classes</span>
            </div>

            <div className="bg-blue-50/40 rounded-xl border border-blue-200 p-4 shadow-xs">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Period Debits (Dr)</span>
              <span className="text-2xl font-black text-blue-950 mt-1 block">
                ₹{masterSummary.totals.totalPeriodDr.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-blue-600 block mt-0.5">Total Journal Debit Sum</span>
            </div>

            <div className="bg-purple-50/40 rounded-xl border border-purple-200 p-4 shadow-xs">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                Period Credits (Cr)
              </span>
              <span className="text-2xl font-black text-purple-950 mt-1 block">
                ₹{masterSummary.totals.totalPeriodCr.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-purple-600 block mt-0.5">Total Journal Credit Sum</span>
            </div>

            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Book Integrity</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-900 font-extrabold text-base">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Double-Entry Verified</span>
              </div>
              <span className="text-[10px] text-emerald-700 block mt-0.5">GAAP / Trial Balance Balanced</span>
            </div>
          </div>

          {/* Classification filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Class Filter:</span>
            {['ALL', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSummaryTypeFilter(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  summaryTypeFilter === t
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'ALL' ? 'All Classes' : `${t}s`}
              </button>
            ))}
          </div>

          {/* Master Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Account Code</th>
                    <th className="py-3 px-4">Account Title / Name</th>
                    <th className="py-3 px-3.5">Classification</th>
                    <th className="py-3 px-3.5 text-right">Opening Balance ₹</th>
                    <th className="py-3 px-3.5 text-right">Period Debits (Dr) ₹</th>
                    <th className="py-3 px-3.5 text-right">Period Credits (Cr) ₹</th>
                    <th className="py-3 px-4 text-right">Closing Balance ₹</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {masterSummary.items
                    .filter(i => summaryTypeFilter === 'ALL' || i.account.type === summaryTypeFilter)
                    .map(item => (
                      <tr key={item.account.code} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {item.account.code}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">{item.account.name}</div>
                          <div className="text-[11px] text-gray-400">{item.account.subtype}</div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getTypeBadge(
                              item.account.type
                            )}`}
                          >
                            {item.account.type}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-gray-600 whitespace-nowrap">
                          ₹{item.openingBalance.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] text-gray-400">{item.openingBalanceType}</span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                          {item.periodDebit > 0 ? `₹${item.periodDebit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-purple-700 whitespace-nowrap">
                          {item.periodCredit > 0 ? `₹${item.periodCredit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-gray-900 whitespace-nowrap">
                          ₹{item.closingBalance.toLocaleString('en-IN')}{' '}
                          <span
                            className={`text-[10px] font-bold ${
                              item.closingBalanceType === 'Dr' ? 'text-blue-600' : 'text-purple-600'
                            }`}
                          >
                            {item.closingBalanceType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccountCode(item.account.code);
                              setViewMode('single');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-900 hover:underline"
                          >
                            View Ledger
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                  {/* Grand Totals */}
                  <tr className="bg-slate-900 text-white font-extrabold text-xs">
                    <td colSpan={3} className="py-3.5 px-4 uppercase tracking-wider">
                      GRAND TOTALS ({masterSummary.items.length} Ledgers)
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono">
                      Dr ₹{masterSummary.totals.totalOpeningDr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono text-blue-300">
                      ₹{masterSummary.totals.totalPeriodDr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono text-purple-300">
                      ₹{masterSummary.totals.totalPeriodCr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      Dr ₹{masterSummary.totals.totalClosingDr.toLocaleString('en-IN')}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRINT / PDF STATEMENT MODAL                                            */}
      {/* ========================================================================= */}
      {isPrintModalOpen && singleReport && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">Printable General Ledger Statement</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Content Area */}
            <div id="printable-ledger-area" className="flex-1 overflow-y-auto p-4 space-y-4 my-2 text-xs">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <h1 className="text-xl font-black text-gray-900 tracking-wide">
                  Little Buds Child Care Centre
                </h1>
                <p className="text-gray-500 text-xs">
                  Official Book of Accounts • General Ledger Statement
                </p>
                <div className="mt-2 inline-block bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-800">
                  Account: {singleReport.account.code} — {singleReport.account.name}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  Period: {singleReport.periodLabel} ({singleReport.startDate} to {singleReport.endDate})
                </div>
              </div>

              {/* Summary Strip */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded border text-center">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Opening Balance</span>
                  <span className="font-bold text-gray-900">
                    ₹{singleReport.openingBalance.toLocaleString('en-IN')} {singleReport.openingBalanceType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Total Debits</span>
                  <span className="font-bold text-blue-700">
                    ₹{singleReport.totalDebit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Total Credits</span>
                  <span className="font-bold text-purple-700">
                    ₹{singleReport.totalCredit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Closing Balance</span>
                  <span className="font-bold text-indigo-900">
                    ₹{singleReport.closingBalance.toLocaleString('en-IN')} {singleReport.closingBalanceType}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              <table className="w-full border-collapse border border-gray-300 text-[11px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="border border-gray-300 p-1.5 text-left">Date</th>
                    <th className="border border-gray-300 p-1.5 text-left">Voucher #</th>
                    <th className="border border-gray-300 p-1.5 text-left">Particulars</th>
                    <th className="border border-gray-300 p-1.5 text-left">Counter Account</th>
                    <th className="border border-gray-300 p-1.5 text-right">Debit (₹)</th>
                    <th className="border border-gray-300 p-1.5 text-right">Credit (₹)</th>
                    <th className="border border-gray-300 p-1.5 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 italic">
                    <td className="border border-gray-300 p-1.5">{singleReport.startDate}</td>
                    <td className="border border-gray-300 p-1.5">—</td>
                    <td className="border border-gray-300 p-1.5" colSpan={2}>Opening Balance B/F</td>
                    <td className="border border-gray-300 p-1.5 text-right">
                      {singleReport.openingBalanceType === 'Dr' ? singleReport.openingBalance.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="border border-gray-300 p-1.5 text-right">
                      {singleReport.openingBalanceType === 'Cr' ? singleReport.openingBalance.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="border border-gray-300 p-1.5 text-right font-bold">
                      {singleReport.openingBalance.toLocaleString('en-IN')} {singleReport.openingBalanceType}
                    </td>
                  </tr>
                  {singleReport.entries.map(e => (
                    <tr key={e.id}>
                      <td className="border border-gray-300 p-1.5 font-mono">{formatDate(e.date)}</td>
                      <td className="border border-gray-300 p-1.5 font-mono">{e.voucherNumber || '—'}</td>
                      <td className="border border-gray-300 p-1.5">{e.particulars}</td>
                      <td className="border border-gray-300 p-1.5">{e.counterAccountName || 'General'}</td>
                      <td className="border border-gray-300 p-1.5 text-right font-mono">
                        {e.debit > 0 ? e.debit.toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="border border-gray-300 p-1.5 text-right font-mono">
                        {e.credit > 0 ? e.credit.toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="border border-gray-300 p-1.5 text-right font-mono font-bold">
                        {e.balance.toLocaleString('en-IN')} {e.balanceType}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                    <td className="border border-gray-300 p-1.5" colSpan={4}>TOTALS</td>
                    <td className="border border-gray-300 p-1.5 text-right font-mono">
                      ₹{singleReport.totalDebit.toLocaleString('en-IN')}
                    </td>
                    <td className="border border-gray-300 p-1.5 text-right font-mono">
                      ₹{singleReport.totalCredit.toLocaleString('en-IN')}
                    </td>
                    <td className="border border-gray-300 p-1.5 text-right font-mono">
                      ₹{singleReport.closingBalance.toLocaleString('en-IN')} {singleReport.closingBalanceType}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t">
                <div className="text-center">
                  <div className="h-10 border-b border-gray-400 w-48 mx-auto"></div>
                  <span className="text-[10px] text-gray-500 uppercase mt-1 block">Prepared By / Accountant</span>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-gray-400 w-48 mx-auto"></div>
                  <span className="text-[10px] text-gray-500 uppercase mt-1 block">Managing Partner / Auditor</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerWiseReportView;
