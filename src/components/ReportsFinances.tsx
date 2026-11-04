import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFees, getAttendanceByMonth, getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../services/api';
import { Fee, Attendance, FinanceTransaction, AssetDetails, DepositDetails, TransactionType, PurchaseType, ChartOfAccountItem } from '../types';
import { getChartOfAccounts, DEFAULT_CHART_OF_ACCOUNTS } from '../services/chartOfAccountsService';
import ChartOfAccountsView from './ChartOfAccountsView';
import LedgerWiseReportView from './LedgerWiseReportView';
import { FinancialDetailsSettingsTab } from './FinancialDetailsSettingsTab';
import { startOfMonth, endOfMonth, format, subMonths, parseISO } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Download, 
  Package, Search, Building, Eye, X, Tag, CheckCircle2, SlidersHorizontal, Layers,
  Scale, FileText, Printer, ArrowUpRight, ArrowDownRight, Sparkles, Percent, Calendar,
  PieChart as PieChartIcon, Landmark, Banknote, Users, HandCoins, Wallet, Pencil, ArrowUpDown,
  Filter, Check, BookOpen, Palette, ShieldCheck, ArrowRightLeft, Clock
} from 'lucide-react';
import { getStaffSalaries, getAccruedExpenses, getCustomCategories } from '../services/accountingService';
import { StaffSalary, AccruedExpense, CustomCategory } from '../types';
import { StaffSalaryManager } from './StaffSalaryManager';
import { AccrualManager } from './AccrualManager';
import { CustomCategoryModal } from './CustomCategoryModal';
import { CustomLedgerModal } from './CustomLedgerModal';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import DeleteConfirmModal from './DeleteConfirmModal';
import { PaymentVoucherModal } from './PaymentVoucherModal';
import { ToastContainer, ToastMessage } from './Toast';
import { useTypography } from '../contexts/TypographyContext';
import { StyledWordText } from './StyledWordText';
import { formatDate } from '../utils/dateUtils';
import {
  EXCEL_COLORS,
  NUMBER_FORMATS,
  BORDERS,
  addExecutiveReportHeader,
  styleHeaderRow,
  styleDataRow,
  styleSectionHeaderRow,
  styleTotalRow,
  autoFitWorksheetColumns,
  setupSheetViews
} from '../utils/excelFormatters';
import {
  isCashToBankTx,
  isBankToCashTx,
  isTransferTx,
  isDepositTx,
  isInvestmentTx,
  isAssetTx,
  isExpenseTx,
  isIncomeTx,
  calculateAssetDepreciationBreakdown,
  getIndianFYInfo
} from '../services/ledgerService';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PARTNER_COLORS = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#4b5563'];

const ASSET_CATEGORIES = [
  'Play & Learning Equipment',
  'Classroom Furniture & Fixtures',
  'IT & Electronic Hardware',
  'Child Development & Learning Kits',
  'Facility & Safety Infrastructure',
  'Vehicle & Transport',
  'Other Capital Assets'
];

const EXPENSE_CATEGORIES = [
  'Rent & Premises',
  'Utilities & Electricity',
  'Learning Consumables, Toys & Craft Materials',
  'Office & Printing Supplies',
  'Repairs & Maintenance',
  'Staff Welfare & Training',
  'Software & Subscriptions',
  'Cleaning & Hygiene',
  'Marketing & Outreach',
  'Taxi & General Conveyance',
  'Documentation & Registration',
  'Canteen Expenses',
  'Mobile & Internet Expenses',
  'Stationary Expenses',
  'Refreshment Expenses',
  'Other Operational Expense'
];

const INCOME_CATEGORIES = [
  'Grants & Subsidies',
  'Donations & Sponsorships',
  'Workshops & Training',
  'Bank Interest',
  'Other Income'
];

const PARTNER_INVESTMENT_CATEGORIES = [
  'Initial Capital Contribution',
  'Expansion & Infrastructure Fund',
  'Play Equipment & Classroom Fund',
  'Working Capital Infusion',
  'Additional Partner Equity',
  'Partner Loan / Capital Advance',
  'Other Capital Contribution'
];

const SECURITY_DEPOSIT_CATEGORIES = [
  'Premises & Building Rental Deposit (Landlord)',
  'Electricity Board (KSEB / Utility) Deposit',
  'Water & Municipal Corporation Deposit',
  'Learning & Activity Equipment Lease Deposit',
  'Telecommunications & Internet Caution Deposit',
  'Vendor / Maintenance Caution Deposit',
  'Other Refundable Current Asset Deposit'
];

const PAYMENT_MODES = [
  'Bank Transfer / NEFT / IMPS',
  'Cheque',
  'UPI / Online Payment',
  'Cash',
  'Direct Bank Deposit',
  'Demand Draft'
];

const ReportsFinances = () => {
  const {
    elementFontSizes,
    accentColor,
    secondaryAccentColor,
    pageHeadingWords,
    useCustomPageHeading,
    setIsCustomizerOpen,
  } = useTypography();

  const [fees, setFees] = useState<Fee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionToDelete, setTransactionToDelete] = useState<FinanceTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [viewAssetModal, setViewAssetModal] = useState<FinanceTransaction | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrlTab = searchParams.get('tab');
  const validTabs = ['dashboard', 'pnl', 'balance', 'ledger', 'accounts', 'partners', 'receipts', 'cashflow', 'salaries', 'accruals', 'financial'] as const;

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pnl' | 'balance' | 'ledger' | 'accounts' | 'partners' | 'receipts' | 'cashflow' | 'salaries' | 'accruals' | 'financial'>(
    validTabs.includes(initialUrlTab as any) ? (initialUrlTab as any) : 'dashboard'
  );

  const [selectedLedgerAccountCode, setSelectedLedgerAccountCode] = useState<string | undefined>(
    searchParams.get('account') || undefined
  );

  // Chart of Accounts general ledger state - Pre-initialized with all 32 system accounts
  const [accountsList, setAccountsList] = useState<ChartOfAccountItem[]>(() =>
    DEFAULT_CHART_OF_ACCOUNTS.map((acc, index) => ({
      ...acc,
      id: `default-${acc.code}-${index}`,
      createdAt: '2025-01-01T00:00:00.000Z'
    }))
  );
  // Staff Salaries & Accruals state
  const [salariesList, setSalariesList] = useState<StaffSalary[]>([]);
  const [accrualsList, setAccrualsList] = useState<AccruedExpense[]>([]);
  const [customCategoriesList, setCustomCategoriesList] = useState<CustomCategory[]>([]);

  // Custom Category & Custom Ledger Modals
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [customCategoryDefaultType, setCustomCategoryDefaultType] = useState<'Expense' | 'Income' | 'Asset' | 'Liability'>('Expense');
  const [showCustomLedgerModal, setShowCustomLedgerModal] = useState(false);
  const [customLedgerDefaultType, setCustomLedgerDefaultType] = useState<ChartOfAccountItem['type']>('Expense');

  const loadAccounts = async () => {
    try {
      const list = await getChartOfAccounts();
      setAccountsList(list);
    } catch (err) {
      console.error('Failed to load accounts list', err);
    }
  };

  // Profit & Loss Period Filter
  const [pnlPeriod, setPnlPeriod] = useState<'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'all_time' | 'custom'>('this_month');
  const [pnlCustomStart, setPnlCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [pnlCustomEnd, setPnlCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Balance Sheet Period Filter (Same options and structure as P&L)
  const [bsPeriod, setBsPeriod] = useState<'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'all_time' | 'custom'>('this_month');
  const [bsCustomStart, setBsCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [bsCustomEnd, setBsCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Partner filter and search in Partners tab
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');
  const [partnerSearchQuery, setPartnerSearchQuery] = useState<string>('');
  // Unified Transaction Editing State (for Expenses, Income, Assets, Deposits, Investments, Transfers)
  const [transactionToEdit, setTransactionToEdit] = useState<FinanceTransaction | null>(null);
  const [editTxData, setEditTxData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'Expense' as 'Expense' | 'Income' | 'Asset' | 'Investment' | 'Deposit' | 'Transfer',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    paymentMode: PAYMENT_MODES[0],
    description: '',
    // Partner investment
    partnerName: '',
    // Capital Asset
    assetName: '',
    usefulLifeYears: '5',
    locationOrRoom: 'Sensory Gym',
    condition: 'Good',
    serialNumber: '',
    assetNotes: '',
    // Security Deposit
    depositCategory: SECURITY_DEPOSIT_CATEGORIES[0],
    payeeName: '',
    premisesOrAccount: '',
    refundable: true,
    referenceNumber: '',
    termsOrDuration: '',
    // Cash to Bank Transfer details
    bankName: 'Primary Business Bank Account (Account #1020)',
    depositSlipNumber: '',
    depositedBy: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewReceiptModal, setViewReceiptModal] = useState<FinanceTransaction | null>(null);

  // Cash in Hand to Bank Deposit (Contra Entry) Modal State
  const [showCashDepositModal, setShowCashDepositModal] = useState(false);
  const [cashDepositFormData, setCashDepositFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    bankName: 'Primary Business Bank Account (Account #1010)',
    depositSlipNumber: '',
    depositedBy: '',
    description: 'Cash in hand deposited to bank'
  });
  const [isDepositingCash, setIsDepositingCash] = useState(false);

  // Bank to Cash Withdrawal (Contra Entry) Modal State
  const [showCashWithdrawalModal, setShowCashWithdrawalModal] = useState(false);
  const [cashWithdrawalFormData, setCashWithdrawalFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    bankName: 'Primary Business Bank Account (Account #1010)',
    referenceNumber: '',
    withdrawnBy: '',
    description: 'Cash withdrawn from bank for centre cash drawer'
  });
  const [isWithdrawingCash, setIsWithdrawingCash] = useState(false);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Transaction list filter (includes TRANSFER / CONTRA)
  const [txFilter, setTxFilter] = useState<'ALL' | 'EXPENSE' | 'ASSET' | 'DEPOSIT' | 'INCOME' | 'INVESTMENT' | 'TRANSFER'>('ALL');

  // Balance sheet asset register filters
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [selectedAssetCategoryFilter, setSelectedAssetCategoryFilter] = useState('ALL');

  // Balance sheet security deposit register filters & modal
  const [depositSearchQuery, setDepositSearchQuery] = useState('');
  const [selectedDepositCategoryFilter, setSelectedDepositCategoryFilter] = useState('ALL');
  const [viewDepositModal, setViewDepositModal] = useState<FinanceTransaction | null>(null);

  // Payment Voucher Print Modal
  const [selectedVoucherTx, setSelectedVoucherTx] = useState<FinanceTransaction | null>(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTransactionType, setFormTransactionType] = useState<TransactionType>('Expense');
  const [formPurchaseType, setFormPurchaseType] = useState<PurchaseType>('Expense');
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    description: '',
    // Partner investment details
    partnerName: '',
    paymentMode: PAYMENT_MODES[0],
    // Asset details
    assetName: '',
    assetCategory: ASSET_CATEGORIES[0],
    usefulLifeYears: '5',
    locationOrRoom: 'Sensory Gym',
    serialNumber: '',
    condition: 'Brand New' as 'Brand New' | 'Good' | 'Refurbished' | 'Fair',
    assetNotes: '',
    // Security Deposit details (Current Asset)
    depositCategory: SECURITY_DEPOSIT_CATEGORIES[0],
    payeeName: '',
    premisesOrAccount: '',
    refundable: true,
    referenceNumber: '',
    termsOrDuration: '',
    ledgerAccountCode: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(today, 5));
      const endOfThisMonth = endOfMonth(today);
      
      const results = await Promise.allSettled([
        getFees(),
        getAttendanceByMonth(format(sixMonthsAgo, 'yyyy-MM-dd'), format(endOfThisMonth, 'yyyy-MM-dd')),
        getTransactions(),
        getChartOfAccounts(),
        getStaffSalaries(),
        getAccruedExpenses(),
        getCustomCategories()
      ]);
      
      if (results[0].status === 'fulfilled') setFees(results[0].value);
      if (results[1].status === 'fulfilled') setAttendance(results[1].value);
      if (results[2].status === 'fulfilled') setTransactions(results[2].value);
      if (results[3].status === 'fulfilled' && results[3].value.length > 0) {
        setAccountsList(results[3].value);
      }
      if (results[4].status === 'fulfilled') setSalariesList(results[4].value);
      if (results[5].status === 'fulfilled') setAccrualsList(results[5].value);
      if (results[6].status === 'fulfilled') setCustomCategoriesList(results[6].value);
    } catch (error) {
      console.error("Failed to load reports data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const safeNum = (val: any) => Number.isNaN(Number(val)) ? 0 : Number(val);

  // Form Submission
  const handleOpenAddForm = (initialType: 'Expense' | 'Asset' | 'Investment' | 'Deposit' = 'Expense', defaultPartnerName?: string) => {
    if (initialType === 'Deposit') {
      setFormTransactionType('Deposit');
      setFormPurchaseType('Deposit');
      setFormData(prev => ({
        ...prev,
        category: SECURITY_DEPOSIT_CATEGORIES[0],
        depositCategory: SECURITY_DEPOSIT_CATEGORIES[0],
        payeeName: '',
        premisesOrAccount: '',
        refundable: true,
        referenceNumber: '',
        termsOrDuration: '',
        paymentMode: PAYMENT_MODES[0],
        amount: '',
        description: ''
      }));
    } else if (initialType === 'Investment') {
      setFormTransactionType('Investment');
      setFormPurchaseType('Investment');
      setFormData(prev => ({
        ...prev,
        category: PARTNER_INVESTMENT_CATEGORIES[0],
        partnerName: defaultPartnerName || prev.partnerName || '',
        paymentMode: PAYMENT_MODES[0],
        amount: '',
        description: ''
      }));
    } else if (initialType === 'Asset') {
      setFormTransactionType('Asset');
      setFormPurchaseType('Asset');
      setFormData(prev => ({
        ...prev,
        category: ASSET_CATEGORIES[0],
        assetCategory: ASSET_CATEGORIES[0],
        amount: '',
        description: ''
      }));
    } else {
      setFormTransactionType('Expense');
      setFormPurchaseType('Expense');
      setFormData(prev => ({
        ...prev,
        category: EXPENSE_CATEGORIES[0],
        amount: '',
        description: ''
      }));
    }
    setShowAddForm(true);
  };

  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.date || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid date and positive amount.");
      return;
    }

    try {
      let txToSave: Omit<FinanceTransaction, 'id'>;

      if (formTransactionType === 'Investment') {
        if (!formData.partnerName?.trim()) {
          alert("Please enter the name of the partner who made this investment.");
          return;
        }
        txToSave = {
          date: formData.date,
          type: 'Investment',
          purchaseType: 'Investment',
          category: formData.category || 'Initial Capital Contribution',
          amount: parsedAmount,
          partnerName: formData.partnerName.trim(),
          paymentMode: formData.paymentMode || PAYMENT_MODES[0],
          description: formData.description.trim() || `Capital investment by ${formData.partnerName.trim()}`
        };
      } else if (formTransactionType === 'Income') {
        txToSave = {
          date: formData.date,
          type: 'Income',
          category: formData.category || 'Other Income',
          amount: parsedAmount,
          paymentMode: formData.paymentMode || PAYMENT_MODES[0],
          description: formData.description
        };
      } else if (formPurchaseType === 'Deposit' || formTransactionType === 'Deposit') {
        const depositInfo: DepositDetails = {
          depositCategory: formData.depositCategory || SECURITY_DEPOSIT_CATEGORIES[0],
          payeeName: formData.payeeName?.trim() || 'Landlord / Authority',
          refundable: formData.refundable !== false
        };
        if (formData.premisesOrAccount?.trim()) {
          depositInfo.premisesOrAccount = formData.premisesOrAccount.trim();
        }
        if (formData.referenceNumber?.trim()) {
          depositInfo.referenceNumber = formData.referenceNumber.trim();
        }
        if (formData.termsOrDuration?.trim()) {
          depositInfo.termsOrDuration = formData.termsOrDuration.trim();
        }
        if (formData.description?.trim()) {
          depositInfo.notes = formData.description.trim();
        }

        txToSave = {
          date: formData.date,
          type: 'Deposit',
          purchaseType: 'Deposit',
          category: formData.depositCategory || 'Security Deposit',
          amount: parsedAmount,
          paymentMode: formData.paymentMode || PAYMENT_MODES[0],
          description: formData.description?.trim() || `Security Deposit paid to ${formData.payeeName?.trim() || 'Landlord'} (${formData.depositCategory || SECURITY_DEPOSIT_CATEGORIES[0]})`,
          depositDetails: depositInfo
        };
      } else if (formPurchaseType === 'Asset' || formTransactionType === 'Asset') {
        const assetInfo: AssetDetails = {
          assetName: formData.assetName.trim() || formData.description.trim() || formData.assetCategory,
          category: formData.assetCategory,
          purchaseDate: formData.date,
          cost: parsedAmount,
          usefulLifeYears: formData.usefulLifeYears ? parseInt(formData.usefulLifeYears) : 5,
          locationOrRoom: formData.locationOrRoom.trim() || 'Centre Facility',
          condition: formData.condition
        };
        if (formData.serialNumber?.trim()) {
          assetInfo.serialNumber = formData.serialNumber.trim();
        }
        const assetNote = formData.assetNotes.trim() || formData.description.trim();
        if (assetNote) {
          assetInfo.notes = assetNote;
        }

        txToSave = {
          date: formData.date,
          type: 'Asset',
          purchaseType: 'Asset',
          category: formData.assetCategory,
          amount: parsedAmount,
          paymentMode: formData.paymentMode || PAYMENT_MODES[0],
          description: formData.assetName ? `${formData.assetName} (${formData.assetCategory})` : formData.description,
          assetDetails: assetInfo
        };
      } else {
        txToSave = {
          date: formData.date,
          type: formTransactionType === 'Income' ? 'Income' : 'Expense',
          purchaseType: 'Expense',
          category: formData.category,
          amount: parsedAmount,
          paymentMode: formData.paymentMode || PAYMENT_MODES[0],
          ledgerAccountCode: formData.ledgerAccountCode?.trim() || undefined,
          description: formData.referenceNumber?.trim()
            ? `${formData.description?.trim() || formData.category} (Ref: ${formData.referenceNumber.trim()})`
            : formData.description
        };
      }

      await addTransaction(txToSave);
      setShowAddForm(false);
      addToast('success', formTransactionType === 'Deposit'
        ? `Security Deposit of ₹${parsedAmount.toLocaleString('en-IN')} paid to ${formData.payeeName?.trim() || 'Landlord'} recorded under Current Assets!`
        : formTransactionType === 'Investment'
        ? `Investment of ₹${parsedAmount.toLocaleString()} by ${formData.partnerName.trim()} recorded successfully!`
        : formTransactionType === 'Income'
        ? `Income entry of ₹${parsedAmount.toLocaleString('en-IN')} recorded successfully!`
        : 'Transaction recorded successfully!'
      );
      // Reset form
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: EXPENSE_CATEGORIES[0],
        amount: '',
        description: '',
        partnerName: '',
        paymentMode: PAYMENT_MODES[0],
        assetName: '',
        assetCategory: ASSET_CATEGORIES[0],
        usefulLifeYears: '5',
        locationOrRoom: 'Sensory Gym',
        serialNumber: '',
        condition: 'Brand New',
        assetNotes: '',
        depositCategory: SECURITY_DEPOSIT_CATEGORIES[0],
        payeeName: '',
        premisesOrAccount: '',
        refundable: true,
        referenceNumber: '',
        termsOrDuration: '',
        ledgerAccountCode: ''
      });
      loadData();
    } catch (error) {
      console.error("Error adding transaction", error);
      alert("Could not save transaction. Please check console.");
    }
  };

  const handleOpenCashDepositModal = () => {
    setCashDepositFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: rp.cashBalance > 0 ? rp.cashBalance.toString() : '',
      bankName: 'Primary Business Bank Account (Account #1010)',
      depositSlipNumber: '',
      depositedBy: '',
      description: 'Cash in hand deposited to bank'
    });
    setShowCashDepositModal(true);
  };

  const handleCashDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(cashDepositFormData.amount);
    if (!cashDepositFormData.date || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast('error', 'Please enter a valid deposit date and positive amount.');
      return;
    }

    setIsDepositingCash(true);
    try {
      const txToSave: Omit<FinanceTransaction, 'id'> = {
        date: cashDepositFormData.date,
        type: 'Transfer',
        purchaseType: 'Transfer',
        category: 'Cash Deposit to Bank',
        amount: parsedAmount,
        paymentMode: 'Cash to Bank Deposit',
        description: cashDepositFormData.description.trim() || `Cash deposited to ${cashDepositFormData.bankName}`,
        ledgerAccountCode: '1010',
        contraAccountCode: '1020',
        transferDetails: {
          transferType: 'CashToBank',
          fromAccount: 'Cash in Hand (Account 1020)',
          toAccount: cashDepositFormData.bankName.trim() || 'Primary Bank Account (Account 1010)',
          bankName: cashDepositFormData.bankName.trim(),
          depositSlipNumber: cashDepositFormData.depositSlipNumber?.trim() || undefined,
          depositedBy: cashDepositFormData.depositedBy?.trim() || undefined,
          notes: cashDepositFormData.description.trim()
        }
      };

      await addTransaction(txToSave);
      setShowCashDepositModal(false);
      addToast('success', `₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} deposited from Cash in Hand to Bank Account!`);
      loadData();
    } catch (err) {
      console.error("Error depositing cash to bank:", err);
      addToast('error', 'Failed to record cash deposit. Please try again.');
    } finally {
      setIsDepositingCash(false);
    }
  };

  const handleOpenCashWithdrawalModal = () => {
    setCashWithdrawalFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      bankName: 'Primary Business Bank Account (Account #1010)',
      referenceNumber: '',
      withdrawnBy: '',
      description: 'Cash withdrawn from bank for centre cash drawer'
    });
    setShowCashWithdrawalModal(true);
  };

  const handleCashWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(cashWithdrawalFormData.amount);
    if (!cashWithdrawalFormData.date || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast('error', 'Please enter a valid withdrawal date and positive amount.');
      return;
    }

    setIsWithdrawingCash(true);
    try {
      const txToSave: Omit<FinanceTransaction, 'id'> = {
        date: cashWithdrawalFormData.date,
        type: 'Transfer',
        purchaseType: 'Transfer',
        category: 'Cash Withdrawal from Bank',
        amount: parsedAmount,
        paymentMode: 'Bank to Cash Withdrawal',
        description: cashWithdrawalFormData.description.trim() || `Cash withdrawn from ${cashWithdrawalFormData.bankName}`,
        ledgerAccountCode: '1020',
        contraAccountCode: '1010',
        transferDetails: {
          transferType: 'BankToCash',
          fromAccount: cashWithdrawalFormData.bankName.trim() || 'Primary Bank Account (Account 1010)',
          toAccount: 'Cash in Hand (Account 1020)',
          bankName: cashWithdrawalFormData.bankName.trim(),
          depositSlipNumber: cashWithdrawalFormData.referenceNumber?.trim() || undefined,
          depositedBy: cashWithdrawalFormData.withdrawnBy?.trim() || undefined,
          notes: cashWithdrawalFormData.description.trim()
        }
      };

      await addTransaction(txToSave);
      setShowCashWithdrawalModal(false);
      addToast('success', `₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} withdrawn from Bank to Cash in Hand!`);
      loadData();
    } catch (err) {
      console.error("Error withdrawing cash from bank:", err);
      addToast('error', 'Failed to record cash withdrawal. Please try again.');
    } finally {
      setIsWithdrawingCash(false);
    }
  };

  const handleOpenEditTransaction = (tx: FinanceTransaction) => {
    let resolvedType: 'Expense' | 'Income' | 'Asset' | 'Investment' | 'Deposit' | 'Transfer' = 'Expense';
    if (isTransferTx(tx)) resolvedType = 'Transfer';
    else if (isInvestmentTx(tx)) resolvedType = 'Investment';
    else if (isAssetTx(tx)) resolvedType = 'Asset';
    else if (isDepositTx(tx)) resolvedType = 'Deposit';
    else if (isIncomeTx(tx)) resolvedType = 'Income';
    else resolvedType = 'Expense';

    const defaultCategory = resolvedType === 'Income'
      ? (INCOME_CATEGORIES.includes(tx.category) ? tx.category : INCOME_CATEGORIES[0])
      : resolvedType === 'Deposit'
      ? (SECURITY_DEPOSIT_CATEGORIES.includes(tx.category) ? tx.category : (tx.depositDetails?.depositCategory || SECURITY_DEPOSIT_CATEGORIES[0]))
      : resolvedType === 'Asset'
      ? (ASSET_CATEGORIES.includes(tx.category) ? tx.category : (tx.assetDetails?.category || ASSET_CATEGORIES[0]))
      : resolvedType === 'Investment'
      ? (PARTNER_INVESTMENT_CATEGORIES.includes(tx.category) ? tx.category : PARTNER_INVESTMENT_CATEGORIES[0])
      : resolvedType === 'Transfer'
      ? (isBankToCashTx(tx) ? 'Cash Withdrawal from Bank' : 'Cash Deposit to Bank')
      : (EXPENSE_CATEGORIES.includes(tx.category) ? tx.category : EXPENSE_CATEGORIES[0]);

    setTransactionToEdit(tx);
    setEditTxData({
      date: tx.date || format(new Date(), 'yyyy-MM-dd'),
      type: resolvedType,
      category: defaultCategory,
      amount: tx.amount ? tx.amount.toString() : '',
      paymentMode: tx.paymentMode || PAYMENT_MODES[0],
      description: tx.description || '',
      partnerName: tx.partnerName || '',
      assetName: tx.assetDetails?.assetName || tx.description || '',
      usefulLifeYears: tx.assetDetails?.usefulLifeYears ? tx.assetDetails.usefulLifeYears.toString() : '5',
      locationOrRoom: tx.assetDetails?.locationOrRoom || 'Sensory Gym',
      condition: tx.assetDetails?.condition || 'Good',
      serialNumber: tx.assetDetails?.serialNumber || '',
      assetNotes: tx.assetDetails?.notes || '',
      depositCategory: tx.depositDetails?.depositCategory || tx.category || SECURITY_DEPOSIT_CATEGORIES[0],
      payeeName: tx.depositDetails?.payeeName || '',
      premisesOrAccount: tx.depositDetails?.premisesOrAccount || '',
      refundable: tx.depositDetails?.refundable !== false,
      referenceNumber: tx.depositDetails?.referenceNumber || '',
      termsOrDuration: tx.depositDetails?.termsOrDuration || '',
      bankName: tx.transferDetails?.bankName || (isBankToCashTx(tx) ? tx.transferDetails?.fromAccount : tx.transferDetails?.toAccount) || 'Primary Business Bank Account (Account #1010)',
      depositSlipNumber: tx.transferDetails?.depositSlipNumber || '',
      depositedBy: tx.transferDetails?.depositedBy || ''
    });
  };

  const handleOpenEditInvestment = (tx: FinanceTransaction) => {
    handleOpenEditTransaction(tx);
  };

  const handleEditTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionToEdit?.id) return;

    const parsedAmount = parseFloat(editTxData.amount);
    if (!editTxData.date || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast('error', 'Please enter a valid date and positive amount.');
      return;
    }

    setIsUpdating(true);
    try {
      let updatedData: Partial<FinanceTransaction>;

      if (editTxData.type === 'Transfer') {
        const isWithdrawal = isBankToCashTx(transactionToEdit) || editTxData.category === 'Cash Withdrawal from Bank';
        if (isWithdrawal) {
          updatedData = {
            date: editTxData.date,
            amount: parsedAmount,
            category: 'Cash Withdrawal from Bank',
            paymentMode: 'Bank to Cash Withdrawal',
            description: editTxData.description.trim() || `Cash withdrawn from ${editTxData.bankName}`,
            type: 'Transfer',
            purchaseType: 'Transfer',
            ledgerAccountCode: '1020',
            contraAccountCode: '1010',
            transferDetails: {
              transferType: 'BankToCash',
              fromAccount: editTxData.bankName.trim() || 'Primary Bank Account (Account 1010)',
              toAccount: 'Cash in Hand (Account 1020)',
              bankName: editTxData.bankName.trim(),
              depositSlipNumber: editTxData.depositSlipNumber?.trim() || undefined,
              depositedBy: editTxData.depositedBy?.trim() || undefined,
              notes: editTxData.description.trim()
            }
          };
        } else {
          updatedData = {
            date: editTxData.date,
            amount: parsedAmount,
            category: 'Cash Deposit to Bank',
            paymentMode: 'Cash to Bank Deposit',
            description: editTxData.description.trim() || `Cash deposited to ${editTxData.bankName}`,
            type: 'Transfer',
            purchaseType: 'Transfer',
            ledgerAccountCode: '1010',
            contraAccountCode: '1020',
            transferDetails: {
              transferType: 'CashToBank',
              fromAccount: 'Cash in Hand (Account 1020)',
              toAccount: editTxData.bankName.trim() || 'Primary Bank Account (Account 1010)',
              bankName: editTxData.bankName.trim(),
              depositSlipNumber: editTxData.depositSlipNumber?.trim() || undefined,
              depositedBy: editTxData.depositedBy?.trim() || undefined,
              notes: editTxData.description.trim()
            }
          };
        }
      } else if (editTxData.type === 'Investment') {
        if (!editTxData.partnerName.trim()) {
          addToast('error', 'Please specify the partner name.');
          setIsUpdating(false);
          return;
        }
        updatedData = {
          date: editTxData.date,
          amount: parsedAmount,
          partnerName: editTxData.partnerName.trim(),
          category: editTxData.category || 'Initial Capital Contribution',
          paymentMode: editTxData.paymentMode || PAYMENT_MODES[0],
          description: editTxData.description.trim() || `Capital investment by ${editTxData.partnerName.trim()}`,
          type: 'Investment',
          purchaseType: 'Investment'
        };
      } else if (editTxData.type === 'Income') {
        updatedData = {
          date: editTxData.date,
          amount: parsedAmount,
          category: editTxData.category || 'Other Income',
          paymentMode: editTxData.paymentMode || PAYMENT_MODES[0],
          description: editTxData.description.trim(),
          type: 'Income',
          purchaseType: 'Expense'
        };
      } else if (editTxData.type === 'Deposit') {
        const depositInfo: DepositDetails = {
          depositCategory: editTxData.depositCategory || editTxData.category || SECURITY_DEPOSIT_CATEGORIES[0],
          payeeName: editTxData.payeeName?.trim() || 'Landlord / Authority',
          refundable: editTxData.refundable !== false
        };
        if (editTxData.premisesOrAccount?.trim()) {
          depositInfo.premisesOrAccount = editTxData.premisesOrAccount.trim();
        }
        if (editTxData.referenceNumber?.trim()) {
          depositInfo.referenceNumber = editTxData.referenceNumber.trim();
        }
        if (editTxData.termsOrDuration?.trim()) {
          depositInfo.termsOrDuration = editTxData.termsOrDuration.trim();
        }
        if (editTxData.description?.trim()) {
          depositInfo.notes = editTxData.description.trim();
        }

        updatedData = {
          date: editTxData.date,
          amount: parsedAmount,
          category: editTxData.depositCategory || editTxData.category || 'Security Deposit',
          paymentMode: editTxData.paymentMode || PAYMENT_MODES[0],
          type: 'Deposit',
          purchaseType: 'Deposit',
          description: editTxData.description?.trim() || `Security Deposit paid to ${editTxData.payeeName?.trim() || 'Landlord'} (${depositInfo.depositCategory})`,
          depositDetails: depositInfo
        };
      } else if (editTxData.type === 'Asset') {
        const assetInfo: AssetDetails = {
          assetName: editTxData.assetName.trim() || editTxData.description.trim() || editTxData.category,
          category: editTxData.category || ASSET_CATEGORIES[0],
          purchaseDate: editTxData.date,
          cost: parsedAmount,
          usefulLifeYears: editTxData.usefulLifeYears ? parseInt(editTxData.usefulLifeYears) : 5,
          locationOrRoom: editTxData.locationOrRoom.trim() || 'Centre Facility',
          condition: (editTxData.condition as any) || 'Good'
        };
        if (editTxData.serialNumber?.trim()) {
          assetInfo.serialNumber = editTxData.serialNumber.trim();
        }
        const assetNote = editTxData.assetNotes?.trim() || editTxData.description?.trim();
        if (assetNote) {
          assetInfo.notes = assetNote;
        }

        updatedData = {
          date: editTxData.date,
          amount: parsedAmount,
          category: editTxData.category || ASSET_CATEGORIES[0],
          paymentMode: editTxData.paymentMode || PAYMENT_MODES[0],
          type: 'Asset',
          purchaseType: 'Asset',
          description: editTxData.assetName ? `${editTxData.assetName} (${editTxData.category})` : editTxData.description,
          assetDetails: assetInfo
        };
      } else {
        // Operating Expense
        updatedData = {
          date: editTxData.date,
          amount: parsedAmount,
          category: editTxData.category || EXPENSE_CATEGORIES[0],
          paymentMode: editTxData.paymentMode || PAYMENT_MODES[0],
          type: 'Expense',
          purchaseType: 'Expense',
          description: editTxData.description.trim()
        };
      }

      await updateTransaction(transactionToEdit.id, updatedData);

      // Optimistically update local transactions
      setTransactions(prev => prev.map(t => t.id === transactionToEdit.id ? { ...t, ...updatedData } as FinanceTransaction : t));

      const typeLabel = editTxData.type === 'Expense'
        ? 'Operating Expense'
        : editTxData.type === 'Income'
        ? 'Income Record'
        : editTxData.type === 'Asset'
        ? 'Capital Asset'
        : editTxData.type === 'Deposit'
        ? 'Security Deposit'
        : editTxData.type === 'Transfer'
        ? 'Cash to Bank Transfer'
        : 'Partner Investment';

      addToast('success', `${typeLabel} updated successfully.`);
      setTransactionToEdit(null);
      loadData();
    } catch (error) {
      console.error("Error updating transaction:", error);
      addToast('error', 'Failed to update transaction. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete?.id) return;
    setIsDeleting(true);
    const target = transactionToDelete;
    try {
      // Optimistic delete
      setTransactions(prev => prev.filter(t => t.id !== target.id));
      await deleteTransaction(target.id);
      setTransactionToDelete(null);
      const isAsset = isAssetTx(target);
      const isInv = isInvestmentTx(target);
      const itemName = isInv
        ? `Partner Investment by ${target.partnerName || 'Partner'} (₹${target.amount})`
        : isAsset && target.assetDetails?.assetName 
        ? target.assetDetails.assetName 
        : `${target.category} (₹${target.amount})`;
      addToast('success', `${isInv ? 'Partner investment' : (isAsset ? 'Capital asset' : 'Transaction')} record "${itemName}" was deleted.`);
    } catch (error) {
      console.error("Error deleting transaction", error);
      addToast('error', 'Failed to delete transaction. Please try again.');
      loadData();
    } finally {
      setIsDeleting(false);
    }
  };

  // 1. Monthly Revenue vs Operating Expenses vs Capital Assets
  const processFinancialTrends = () => {
    const months: Record<string, { name: string; income: number; expense: number; assets: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i);
      const key = format(d, 'yyyy-MM');
      months[key] = { name: format(d, 'MMM'), income: 0, expense: 0, assets: 0 };
    }
    
    // Add Fees as Income
    fees.forEach(fee => {
      if (!fee.dueDate) return;
      const key = fee.dueDate.substring(0, 7);
      if (months[key] && fee.amountPaid) {
        months[key].income += safeNum(fee.amountPaid);
      }
    });
    
    // Add Transactions
    transactions.forEach(t => {
      if (!t.date) return;
      const key = t.date.substring(0, 7);
      if (months[key]) {
        if (isIncomeTx(t)) {
          months[key].income += safeNum(t.amount);
        } else if (isAssetTx(t)) {
          months[key].assets += safeNum(t.amount);
        } else if (isExpenseTx(t)) {
          months[key].expense += safeNum(t.amount);
        }
      }
    });
    
    return Object.values(months);
  };

  // 2. Attendance Trends
  const processAttendanceTrends = () => {
    const months: Record<string, { name: string; present: number; absent: number; late: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i);
      const key = format(d, 'yyyy-MM');
      months[key] = { name: format(d, 'MMM'), present: 0, absent: 0, late: 0 };
    }
    
    attendance.forEach(a => {
      if (!a.date) return;
      const key = a.date.substring(0, 7);
      if (months[key]) {
        if (a.status === 'Present') months[key].present += 1;
        else if (a.status === 'Absent') months[key].absent += 1;
        else if (a.status === 'Late') months[key].late += 1;
      }
    });
    
    return Object.values(months);
  };

  // 3. Operating Expense Breakdown (Current Month)
  const processExpenseBreakdown = () => {
    const currentMonthPrefix = format(new Date(), 'yyyy-MM');
    const breakdown: Record<string, number> = {};
    
    transactions.filter(t => isExpenseTx(t) && t.date.startsWith(currentMonthPrefix)).forEach(t => {
      const amt = safeNum(t.amount);
      breakdown[t.category] = (breakdown[t.category] || 0) + amt;
    });
    
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  };

  // 4. Therapy Sessions Breakdown (Current Month)
  const processTherapyBreakdown = () => {
    const currentMonthPrefix = format(new Date(), 'yyyy-MM');
    const breakdown: Record<string, number> = {};
    
    attendance.filter(a => a.date.startsWith(currentMonthPrefix) && (a.therapyType || (a.therapyTypes && a.therapyTypes.length > 0))).forEach(a => {
      const therapies = a.therapyTypes || (a.therapyType ? [a.therapyType] : []);
      therapies.forEach(t => {
        const key = (t === 'Behavioral' || t === 'Social Learning') ? 'Special Education' : t === 'Speech' ? 'Speech & Language' : t === 'OT' ? 'Motor & Sensory Play' : t;
        breakdown[key] = (breakdown[key] || 0) + 1;
      });
    });
    
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  };

  // Helper to distinguish physical cash vs bank/digital payment mode
  const isCashPaymentMode = (mode?: string): boolean => {
    if (!mode) return false;
    const m = mode.trim().toLowerCase();
    return m === 'cash' || m.startsWith('cash') || m.includes('cash');
  };

  // 5. Receipts and Payments Account (All Time)
  const processReceiptsAndPayments = (cutoffDate?: string) => {
    let totalReceipts = 0;
    let bankReceipts = 0;
    let cashReceipts = 0;

    let totalOperatingPayments = 0;
    let bankOperatingPayments = 0;
    let cashOperatingPayments = 0;

    let totalCapitalPayments = 0;
    let bankCapitalPayments = 0;
    let cashCapitalPayments = 0;

    let totalDepositPayments = 0;
    let bankDepositPayments = 0;
    let cashDepositPayments = 0;

    let totalPartnerInvestments = 0;
    let bankPartnerInvestments = 0;
    let cashPartnerInvestments = 0;

    let totalCashDepositedToBank = 0;
    let totalCashWithdrawnFromBank = 0;

    const receiptsByCategory: Record<string, number> = { 'Tuition Fees': 0 };
    const bankReceiptsByCategory: Record<string, number> = {};
    const cashReceiptsByCategory: Record<string, number> = {};
    const partnerInvestmentsByName: Record<string, number> = {};
    const operatingPaymentsByCategory: Record<string, number> = {};
    const capitalPaymentsByCategory: Record<string, number> = {};
    const depositPaymentsByCategory: Record<string, number> = {};

    fees.forEach(f => {
      const feeDate = f.dueDate || (f.createdAt ? f.createdAt.split('T')[0] : '');
      if (cutoffDate && feeDate && feeDate > cutoffDate) return;

      const paid = safeNum(f.amountPaid);
      if (paid > 0) {
        receiptsByCategory['Tuition Fees'] += paid;
        totalReceipts += paid;
        if (isCashPaymentMode(f.paymentMode)) {
          cashReceipts += paid;
          cashReceiptsByCategory['Tuition Fees (Cash)'] = (cashReceiptsByCategory['Tuition Fees (Cash)'] || 0) + paid;
        } else {
          bankReceipts += paid;
          bankReceiptsByCategory['Tuition Fees (Bank)'] = (bankReceiptsByCategory['Tuition Fees (Bank)'] || 0) + paid;
        }
      }
    });

    transactions.forEach(t => {
      if (cutoffDate && t.date && t.date > cutoffDate) return;
      const amt = safeNum(t.amount);
      const isCash = isCashPaymentMode(t.paymentMode);

      if (isTransferTx(t)) {
        // Internal Contra Transfer between Bank and Physical Cash
        // DOES NOT impact Operating Expenses, P&L, or Total Receipts/Payments
        if (isBankToCashTx(t)) {
          totalCashWithdrawnFromBank += amt;
        } else {
          totalCashDepositedToBank += amt;
        }
      } else if (isInvestmentTx(t)) {
        const pName = t.partnerName?.trim() || 'Partner Contribution';
        const label = `Partner Capital (${pName})`;
        receiptsByCategory[label] = (receiptsByCategory[label] || 0) + amt;
        totalReceipts += amt;
        totalPartnerInvestments += amt;
        partnerInvestmentsByName[pName] = (partnerInvestmentsByName[pName] || 0) + amt;
        if (isCash) {
          cashReceipts += amt;
          cashPartnerInvestments += amt;
        } else {
          bankReceipts += amt;
          bankPartnerInvestments += amt;
        }
      } else if (isIncomeTx(t)) {
        receiptsByCategory[t.category] = (receiptsByCategory[t.category] || 0) + amt;
        totalReceipts += amt;
        if (isCash) {
          cashReceipts += amt;
        } else {
          bankReceipts += amt;
        }
      } else if (isAssetTx(t)) {
        const catName = t.assetDetails?.category || t.category || 'Capital Asset';
        capitalPaymentsByCategory[catName] = (capitalPaymentsByCategory[catName] || 0) + amt;
        totalCapitalPayments += amt;
        if (isCash) {
          cashCapitalPayments += amt;
        } else {
          bankCapitalPayments += amt;
        }
      } else if (isDepositTx(t)) {
        const catName = t.depositDetails?.depositCategory || t.category || 'Security Deposit';
        depositPaymentsByCategory[catName] = (depositPaymentsByCategory[catName] || 0) + amt;
        totalDepositPayments += amt;
        if (isCash) {
          cashDepositPayments += amt;
        } else {
          bankDepositPayments += amt;
        }
      } else if (isExpenseTx(t)) {
        if (t.purchaseType === 'Accrual') return; // Unpaid accrual liability - no cash outflow
        operatingPaymentsByCategory[t.category] = (operatingPaymentsByCategory[t.category] || 0) + amt;
        totalOperatingPayments += amt;
        if (isCash) {
          cashOperatingPayments += amt;
        } else {
          bankOperatingPayments += amt;
        }
      }
    });

    const bankPayments = bankOperatingPayments + bankCapitalPayments + bankDepositPayments;
    const cashPayments = cashOperatingPayments + cashCapitalPayments + cashDepositPayments;
    const totalPayments = totalOperatingPayments + totalCapitalPayments + totalDepositPayments;

    const bankBalance = (bankReceipts - bankPayments) + totalCashDepositedToBank - totalCashWithdrawnFromBank;
    const cashBalance = (cashReceipts - cashPayments) - totalCashDepositedToBank + totalCashWithdrawnFromBank;
    const closingBalance = bankBalance + cashBalance;

    return { 
      totalReceipts, 
      bankReceipts,
      cashReceipts,
      totalPayments,
      bankPayments,
      cashPayments,
      totalOperatingPayments,
      bankOperatingPayments,
      cashOperatingPayments,
      totalCapitalPayments,
      bankCapitalPayments,
      cashCapitalPayments,
      totalDepositPayments,
      bankDepositPayments,
      cashDepositPayments,
      depositPaymentsByCategory,
      totalCashDepositedToBank,
      totalCashWithdrawnFromBank,
      totalPartnerInvestments,
      bankPartnerInvestments,
      cashPartnerInvestments,
      partnerInvestmentsByName,
      receiptsByCategory, 
      bankReceiptsByCategory,
      cashReceiptsByCategory,
      operatingPaymentsByCategory,
      capitalPaymentsByCategory,
      bankBalance,
      cashBalance,
      closingBalance 
    };
  };

  // 6. Cash Flow Statement (Current Month)
  const processCashFlow = () => {
    const currentMonthPrefix = format(new Date(), 'yyyy-MM');
    let openingBalance = 0;
    let openingBankBalance = 0;
    let openingCashBalance = 0;
    let inflows = 0;
    let bankInflows = 0;
    let cashInflows = 0;

    let operatingOutflows = 0;
    let bankOperatingOutflows = 0;
    let cashOperatingOutflows = 0;

    let capitalOutflows = 0;
    let bankCapitalOutflows = 0;
    let cashCapitalOutflows = 0;

    let financingInflows = 0;
    let bankFinancingInflows = 0;
    let cashFinancingInflows = 0;

    let monthCashDepositedToBank = 0;
    let monthCashWithdrawnFromBank = 0;
    
    // Calculate opening balance (all transactions before this month)
    fees.forEach(f => {
      const paid = safeNum(f.amountPaid);
      const isCash = isCashPaymentMode(f.paymentMode);
      if (paid > 0 && f.dueDate && !f.dueDate.startsWith(currentMonthPrefix) && f.dueDate < currentMonthPrefix) {
        openingBalance += paid;
        if (isCash) openingCashBalance += paid;
        else openingBankBalance += paid;
      } else if (paid > 0 && f.dueDate && f.dueDate.startsWith(currentMonthPrefix)) {
        inflows += paid;
        if (isCash) cashInflows += paid;
        else bankInflows += paid;
      }
    });

    transactions.forEach(t => {
      const amt = safeNum(t.amount);
      const isCash = isCashPaymentMode(t.paymentMode);

      if (t.date && !t.date.startsWith(currentMonthPrefix) && t.date < currentMonthPrefix) {
        if (isTransferTx(t)) {
          // Historical contra entry: only shifts funds between bank and cash, overall openingBalance is constant
          if (isBankToCashTx(t)) {
            openingBankBalance -= amt;
            openingCashBalance += amt;
          } else {
            openingBankBalance += amt;
            openingCashBalance -= amt;
          }
        } else if (isIncomeTx(t) || isInvestmentTx(t)) {
          openingBalance += amt;
          if (isCash) openingCashBalance += amt;
          else openingBankBalance += amt;
        } else {
          if (t.purchaseType !== 'Accrual') {
            openingBalance -= amt;
            if (isCash) openingCashBalance -= amt;
            else openingBankBalance -= amt;
          }
        }
      } else if (t.date && t.date.startsWith(currentMonthPrefix)) {
        if (isTransferTx(t)) {
          // Current month contra entry: internal liquidity transfer (Zero impact on operating P&L / expenses)
          if (isBankToCashTx(t)) {
            monthCashWithdrawnFromBank += amt;
          } else {
            monthCashDepositedToBank += amt;
          }
        } else if (isInvestmentTx(t)) {
          financingInflows += amt;
          inflows += amt;
          if (isCash) {
            cashFinancingInflows += amt;
            cashInflows += amt;
          } else {
            bankFinancingInflows += amt;
            bankInflows += amt;
          }
        } else if (isIncomeTx(t)) {
          inflows += amt;
          if (isCash) cashInflows += amt;
          else bankInflows += amt;
        } else if (isAssetTx(t)) {
          capitalOutflows += amt;
          if (isCash) cashCapitalOutflows += amt;
          else bankCapitalOutflows += amt;
        } else if (isDepositTx(t)) {
          capitalOutflows += amt;
          if (isCash) cashCapitalOutflows += amt;
          else bankCapitalOutflows += amt;
        } else if (isExpenseTx(t)) {
          if (t.purchaseType !== 'Accrual') {
            operatingOutflows += amt;
            if (isCash) cashOperatingOutflows += amt;
            else bankOperatingOutflows += amt;
          }
        }
      }
    });

    const monthContraBank = monthCashDepositedToBank - monthCashWithdrawnFromBank;
    const monthContraCash = monthCashWithdrawnFromBank - monthCashDepositedToBank;

    const bankOutflows = bankOperatingOutflows + bankCapitalOutflows;
    const cashOutflows = cashOperatingOutflows + cashCapitalOutflows;
    const totalOutflows = operatingOutflows + capitalOutflows;

    const netBankFlow = (bankInflows - bankOutflows) + monthContraBank;
    const netCashFlow = (cashInflows - cashOutflows) + monthContraCash;
    const netCashFlowTotal = inflows - totalOutflows;

    const closingBankBalance = openingBankBalance + netBankFlow;
    const closingCashBalance = openingCashBalance + netCashFlow;
    const closingBalance = openingBalance + netCashFlowTotal;

    return { 
      openingBalance, 
      openingBankBalance,
      openingCashBalance,
      inflows, 
      bankInflows,
      cashInflows,
      financingInflows,
      bankFinancingInflows,
      cashFinancingInflows,
      operatingOutflows, 
      bankOperatingOutflows,
      cashOperatingOutflows,
      capitalOutflows, 
      bankCapitalOutflows,
      cashCapitalOutflows,
      totalOutflows, 
      bankOutflows,
      cashOutflows,
      monthCashDepositedToBank,
      monthCashWithdrawnFromBank,
      monthContraBank,
      monthContraCash,
      netBankFlow,
      netCashFlow,
      netCashFlowTotal,
      closingBankBalance,
      closingCashBalance,
      closingBalance 
    };
  };

  // 7. Balance Sheet with Asset Details (Current Financial Position)
  const processBalanceSheet = () => {
    const now = new Date();
    let startDate: string;
    let endDate: string;
    let periodLabel: string;
    let asOfDate: string;

    if (bsPeriod === 'this_month') {
      startDate = format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = format(endOfMonth(now), 'yyyy-MM-dd');
      asOfDate = endDate > format(now, 'yyyy-MM-dd') ? format(now, 'yyyy-MM-dd') : endDate;
      periodLabel = `This Month (${format(now, 'MMMM yyyy')})`;
    } else if (bsPeriod === 'last_month') {
      const last = subMonths(now, 1);
      startDate = format(startOfMonth(last), 'yyyy-MM-dd');
      endDate = format(endOfMonth(last), 'yyyy-MM-dd');
      asOfDate = endDate;
      periodLabel = `Last Month (${format(last, 'MMMM yyyy')})`;
    } else if (bsPeriod === 'this_quarter') {
      const fyInfo = getIndianFYInfo(now);
      startDate = fyInfo.quarterStartDate;
      endDate = fyInfo.quarterEndDate > format(now, 'yyyy-MM-dd') ? format(now, 'yyyy-MM-dd') : fyInfo.quarterEndDate;
      asOfDate = endDate;
      periodLabel = `${fyInfo.quarterLabel} (Indian FY)`;
    } else if (bsPeriod === 'ytd') {
      const fyInfo = getIndianFYInfo(now);
      startDate = fyInfo.fyStartDate;
      endDate = fyInfo.fyEndDate;
      asOfDate = endDate;
      periodLabel = `${fyInfo.fyLabel} (Cumulative: Apr ${fyInfo.fyStartYear} - Mar ${fyInfo.fyEndYear})`;
    } else if (bsPeriod === 'custom') {
      startDate = bsCustomStart || format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = bsCustomEnd || format(now, 'yyyy-MM-dd');
      asOfDate = endDate;
      periodLabel = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else {
      startDate = '2000-01-01';
      endDate = '2099-12-31';
      asOfDate = format(now, 'yyyy-MM-dd');
      periodLabel = `All Time Historical (As of ${formatDate(now)})`;
    }

    const rp = processReceiptsAndPayments(endDate);
    
    // Accounts Receivable from pending fees up to endDate
    let accountsReceivable = 0;
    fees.forEach(f => {
      const feeDate = f.dueDate || (f.createdAt ? f.createdAt.split('T')[0] : '');
      if (feeDate && feeDate > endDate) return;
      if (safeNum(f.amount) > safeNum(f.amountPaid)) {
        accountsReceivable += (safeNum(f.amount) - safeNum(f.amountPaid));
      }
    });

    const bankBalance = rp.bankBalance;
    const cashBalance = rp.cashBalance;
    const cashAndBank = rp.closingBalance;

    // Security Deposits Paid (Refundable Current Assets) up to endDate
    const depositTransactions = transactions.filter(t => isDepositTx(t) && (!t.date || t.date <= endDate));
    let totalSecurityDeposits = 0;
    const depositsByCategory: Record<string, { total: number; count: number; items: FinanceTransaction[] }> = {};

    depositTransactions.forEach(t => {
      const cat = t.depositDetails?.depositCategory || t.category || 'Premises & Building Rental Deposit (Landlord)';
      const amt = safeNum(t.amount);
      totalSecurityDeposits += amt;
      if (!depositsByCategory[cat]) {
        depositsByCategory[cat] = { total: 0, count: 0, items: [] };
      }
      depositsByCategory[cat].total += amt;
      depositsByCategory[cat].count += 1;
      depositsByCategory[cat].items.push(t);
    });

    // Total Current Assets includes Bank, Cash, Fee Receivables AND Security Deposits!
    const currentAssets = cashAndBank + accountsReceivable + totalSecurityDeposits;

    // Fixed Assets (Capital Assets) up to endDate
    const assetTransactions = transactions.filter(t => isAssetTx(t) && (!t.date || t.date <= endDate));
    let totalFixedAssets = 0;
    const assetsByCategory: Record<string, { total: number; count: number; items: FinanceTransaction[] }> = {};

    assetTransactions.forEach(t => {
      const cat = t.assetDetails?.category || t.category || 'Play & Learning Equipment';
      const cost = safeNum(t.amount);
      totalFixedAssets += cost;
      if (!assetsByCategory[cat]) {
        assetsByCategory[cat] = { total: 0, count: 0, items: [] };
      }
      assetsByCategory[cat].total += cost;
      assetsByCategory[cat].count += 1;
      assetsByCategory[cat].items.push(t);
    });

    // Partner Capital contributions calculation up to endDate
    const partnerInvestments = transactions.filter(t => isInvestmentTx(t) && (!t.date || t.date <= endDate));
    let totalPartnerCapital = 0;
    const partnerCapitalByName: Record<string, { total: number; count: number; lastDate: string }> = {};

    partnerInvestments.forEach(t => {
      const pName = t.partnerName?.trim() || 'Unspecified Partner';
      const amt = safeNum(t.amount);
      totalPartnerCapital += amt;
      if (!partnerCapitalByName[pName]) {
        partnerCapitalByName[pName] = { total: 0, count: 0, lastDate: t.date };
      }
      partnerCapitalByName[pName].total += amt;
      partnerCapitalByName[pName].count += 1;
      if (t.date > partnerCapitalByName[pName].lastDate) {
        partnerCapitalByName[pName].lastDate = t.date;
      }
    });

    const asOfDepDate = new Date(endDate > format(now, 'yyyy-MM-dd') && bsPeriod !== 'ytd' ? format(now, 'yyyy-MM-dd') : endDate);
    const depBreakdown = calculateAssetDepreciationBreakdown(assetTransactions, isNaN(asOfDepDate.getTime()) ? new Date() : asOfDepDate);
    const totalAccumulatedDepreciation = depBreakdown.totalAccumulatedDepreciation;
    const currentFYDepreciationYTD = depBreakdown.currentFYDepreciationYTD;
    const netFixedAssets = Math.max(0, totalFixedAssets - totalAccumulatedDepreciation);

    // Total Assets = Current Assets + Net Fixed Assets (Cost less Accumulated Depreciation)
    const totalAssets = currentAssets + netFixedAssets;
    
    // Current Liabilities from pending Accruals (2010) and Accrued Staff Salaries (2030) up to endDate
    const accountsPayable = accrualsList
      .filter(a => {
        const aDate = a.transactionDate || (a.createdAt ? a.createdAt.split('T')[0] : '');
        if (aDate && aDate > endDate) return false;
        return a.status !== 'Settled';
      })
      .reduce((sum, a) => sum + (a.balanceDue || 0), 0);

    const accruedSalaries = salariesList
      .filter(s => {
        const sDate = s.paymentDate || (s.createdAt ? s.createdAt.split('T')[0] : '');
        if (sDate && sDate > endDate) return false;
        return s.status !== 'Paid' && s.status !== 'Advance';
      })
      .reduce((sum, s) => sum + (s.balanceDue || 0), 0);

    const liabilities = accountsPayable + accruedSalaries; // Current liabilities
    const equity = totalAssets - liabilities; // Assets = Liabilities + Equity
    const operatingSurplus = (currentAssets + totalFixedAssets) - liabilities - totalPartnerCapital;
    // Net profit is part of Equity instead of operating profit (after deducting accumulated depreciation)
    const netProfit = equity - totalPartnerCapital;
    const retainedEarnings = netProfit;

    return { 
      periodLabel,
      startDate,
      endDate,
      asOfDate,
      bankBalance,
      cashBalance,
      cashAndBank,
      cashAtBank: bankBalance, 
      accountsReceivable, 
      totalSecurityDeposits,
      depositsByCategory,
      depositTransactions,
      currentAssets, 
      totalFixedAssets, 
      totalAccumulatedDepreciation,
      currentFYDepreciationYTD,
      netFixedAssets,
      assetsByCategory, 
      assetTransactions,
      totalAssets, 
      liabilities, 
      accountsPayable,
      accruedSalaries,
      equity,
      totalPartnerCapital,
      partnerCapitalByName,
      partnerInvestments,
      operatingSurplus,
      netProfit,
      retainedEarnings
    };
  };

  // 8. Profit & Loss Statement (Accrual / GAAP Accounting with Depreciation Schedule)
  const processProfitAndLoss = () => {
    const now = new Date();
    let startDate: string;
    let endDate: string;
    let periodLabel: string;
    let priorStartDate: string;
    let priorEndDate: string;
    let monthsInPeriod = 1;

    if (pnlPeriod === 'this_month') {
      startDate = format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = format(endOfMonth(now), 'yyyy-MM-dd');
      periodLabel = format(now, 'MMMM yyyy');
      const prior = subMonths(now, 1);
      priorStartDate = format(startOfMonth(prior), 'yyyy-MM-dd');
      priorEndDate = format(endOfMonth(prior), 'yyyy-MM-dd');
      monthsInPeriod = 1;
    } else if (pnlPeriod === 'last_month') {
      const last = subMonths(now, 1);
      startDate = format(startOfMonth(last), 'yyyy-MM-dd');
      endDate = format(endOfMonth(last), 'yyyy-MM-dd');
      periodLabel = format(last, 'MMMM yyyy');
      const twoMonthsAgo = subMonths(now, 2);
      priorStartDate = format(startOfMonth(twoMonthsAgo), 'yyyy-MM-dd');
      priorEndDate = format(endOfMonth(twoMonthsAgo), 'yyyy-MM-dd');
      monthsInPeriod = 1;
    } else if (pnlPeriod === 'this_quarter') {
      const fyInfo = getIndianFYInfo(now);
      startDate = fyInfo.quarterStartDate;
      endDate = fyInfo.quarterEndDate > format(now, 'yyyy-MM-dd') ? format(now, 'yyyy-MM-dd') : fyInfo.quarterEndDate;
      periodLabel = `${fyInfo.quarterLabel} (Indian FY)`;
      const prevQEnd = new Date(new Date(fyInfo.quarterStartDate).getTime() - 86400000);
      const prevQInfo = getIndianFYInfo(prevQEnd);
      priorStartDate = prevQInfo.quarterStartDate;
      priorEndDate = prevQInfo.quarterEndDate;
      monthsInPeriod = 3;
    } else if (pnlPeriod === 'ytd') {
      const fyInfo = getIndianFYInfo(now);
      startDate = fyInfo.fyStartDate;
      endDate = fyInfo.fyEndDate;
      periodLabel = `${fyInfo.fyLabel} (Cumulative: Apr ${fyInfo.fyStartYear} - Mar ${fyInfo.fyEndYear})`;
      const priorFyStart = `${fyInfo.fyStartYear - 1}-04-01`;
      const priorFyEnd = `${fyInfo.fyStartYear}-03-31`;
      priorStartDate = priorFyStart;
      priorEndDate = priorFyEnd;
      monthsInPeriod = 12;
    } else if (pnlPeriod === 'custom') {
      startDate = pnlCustomStart || format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = pnlCustomEnd || format(now, 'yyyy-MM-dd');
      periodLabel = `${formatDate(startDate)} to ${formatDate(endDate)}`;
      const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const priorEnd = new Date(new Date(startDate).getTime() - 86400000);
      const priorStart = new Date(priorEnd.getTime() - diffMs);
      priorStartDate = format(priorStart, 'yyyy-MM-dd');
      priorEndDate = format(priorEnd, 'yyyy-MM-dd');
      monthsInPeriod = Math.max(1, Math.round(diffMs / (30 * 86400000)));
    } else {
      startDate = '2000-01-01';
      endDate = '2099-12-31';
      periodLabel = 'All Time Historical';
      priorStartDate = '1990-01-01';
      priorEndDate = '1999-12-31';
      monthsInPeriod = 12;
    }

    const inRange = (d?: string, start = startDate, end = endDate) => {
      if (!d) return false;
      return d >= start && d <= end;
    };

    // Revenue in period
    let tuitionRevenue = 0;
    const feesByType: Record<string, number> = {};
    fees.forEach(f => {
      if (inRange(f.dueDate) && f.amountPaid) {
        const amt = safeNum(f.amountPaid);
        tuitionRevenue += amt;
        const type = f.type || 'Monthly Tuition';
        feesByType[type] = (feesByType[type] || 0) + amt;
      }
    });

    let otherIncomeTotal = 0;
    const otherIncomesByCategory: Record<string, number> = {};
    transactions.forEach(t => {
      if (isIncomeTx(t) && inRange(t.date)) {
        const amt = safeNum(t.amount);
        otherIncomeTotal += amt;
        otherIncomesByCategory[t.category] = (otherIncomesByCategory[t.category] || 0) + amt;
      }
    });

    const totalRevenue = tuitionRevenue + otherIncomeTotal;

    // Operating Expenses in period
    let totalOperatingExpenses = 0;
    const expensesByCategory: Record<string, { total: number; count: number }> = {};
    transactions.forEach(t => {
      if (isExpenseTx(t) && inRange(t.date)) {
        const amt = safeNum(t.amount);
        totalOperatingExpenses += amt;
        if (!expensesByCategory[t.category]) {
          expensesByCategory[t.category] = { total: 0, count: 0 };
        }
        expensesByCategory[t.category].total += amt;
        expensesByCategory[t.category].count += 1;
      }
    });

    // Operating Profit
    const operatingProfit = totalRevenue - totalOperatingExpenses;
    const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;

    // Capital Asset Depreciation in period (Aligned with Indian Financial Year and Asset Active Months)
    let totalDepreciation = 0;
    const depreciationByAssetCategory: Record<string, { totalCost: number; depreciation: number; count: number }> = {};
    const fyInfo = getIndianFYInfo(now);
    
    transactions.filter(isAssetTx).forEach(t => {
      if (t.date && t.date <= endDate) {
        const cost = safeNum(t.amount);
        const usefulLife = safeNum(t.assetDetails?.usefulLifeYears) || 5;
        const totalUsefulMonths = usefulLife * 12;
        const monthlyDep = totalUsefulMonths > 0 ? cost / totalUsefulMonths : 0;
        const purchaseDate = t.date;
        const pDate = new Date(purchaseDate);

        let periodDep = 0;
        if (pnlPeriod === 'all_time') {
          // All-time cumulative depreciation up to current date (capped at useful life)
          const elapsedMonths = Math.max(1, (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth()) + 1);
          const activeMonths = Math.min(totalUsefulMonths, elapsedMonths);
          periodDep = Math.min(cost, Math.round(monthlyDep * activeMonths));
        } else if (pnlPeriod === 'ytd') {
          // Indian FY YTD depreciation: from max(purchaseDate, fyStartDate) up to endDate
          const serviceStart = purchaseDate > fyInfo.fyStartDate ? purchaseDate : fyInfo.fyStartDate;
          if (serviceStart <= endDate) {
            const sDate = new Date(serviceStart);
            const eDate = new Date(endDate);
            const elapsed = Math.max(1, (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth()) + 1);
            const priorMonths = purchaseDate < fyInfo.fyStartDate
              ? Math.max(0, (fyInfo.fyStartYear - pDate.getFullYear()) * 12 + (3 - pDate.getMonth()))
              : 0;
            const remainingMonths = Math.max(0, totalUsefulMonths - priorMonths);
            const activeMonths = Math.min(remainingMonths, elapsed);
            const priorDep = Math.round(priorMonths * monthlyDep);
            periodDep = Math.min(Math.max(0, cost - priorDep), Math.round(monthlyDep * activeMonths));
          }
        } else if (pnlPeriod === 'this_quarter') {
          // Indian FY Quarter: from max(purchaseDate, quarterStartDate) up to endDate
          const serviceStart = purchaseDate > fyInfo.quarterStartDate ? purchaseDate : fyInfo.quarterStartDate;
          if (serviceStart <= endDate) {
            const sDate = new Date(serviceStart);
            const eDate = new Date(endDate);
            const elapsed = Math.max(1, (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth()) + 1);
            const priorMonths = purchaseDate < fyInfo.quarterStartDate
              ? Math.max(0, (sDate.getFullYear() - pDate.getFullYear()) * 12 + (sDate.getMonth() - pDate.getMonth()))
              : 0;
            const remainingMonths = Math.max(0, totalUsefulMonths - priorMonths);
            const activeMonths = Math.min(remainingMonths, elapsed);
            periodDep = Math.min(cost, Math.round(monthlyDep * activeMonths));
          }
        } else if (pnlPeriod === 'this_month' || pnlPeriod === 'last_month') {
          // Single month depreciation
          const serviceStart = purchaseDate > startDate ? purchaseDate : startDate;
          if (serviceStart <= endDate) {
            const sDate = new Date(startDate);
            const priorMonths = purchaseDate < startDate
              ? Math.max(0, (sDate.getFullYear() - pDate.getFullYear()) * 12 + (sDate.getMonth() - pDate.getMonth()))
              : 0;
            if (priorMonths < totalUsefulMonths) {
              periodDep = Math.min(cost, Math.round(monthlyDep));
            }
          }
        } else {
          // Custom date range
          const serviceStart = purchaseDate > startDate ? purchaseDate : startDate;
          if (serviceStart <= endDate) {
            const sDate = new Date(serviceStart);
            const eDate = new Date(endDate);
            const elapsed = Math.max(1, (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth()) + 1);
            const priorMonths = purchaseDate < startDate
              ? Math.max(0, (sDate.getFullYear() - pDate.getFullYear()) * 12 + (sDate.getMonth() - pDate.getMonth()))
              : 0;
            const remainingMonths = Math.max(0, totalUsefulMonths - priorMonths);
            const activeMonths = Math.min(remainingMonths, elapsed);
            periodDep = Math.min(cost, Math.round(monthlyDep * activeMonths));
          }
        }

        totalDepreciation += periodDep;

        const cat = t.assetDetails?.category || t.category || 'Play & Learning Equipment';
        if (!depreciationByAssetCategory[cat]) {
          depreciationByAssetCategory[cat] = { totalCost: 0, depreciation: 0, count: 0 };
        }
        depreciationByAssetCategory[cat].totalCost += cost;
        depreciationByAssetCategory[cat].depreciation += periodDep;
        depreciationByAssetCategory[cat].count += 1;
      }
    });

    // Net Profit
    const netProfit = operatingProfit - totalDepreciation;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Prior Period calculations for comparison
    let priorRevenue = 0;
    fees.forEach(f => {
      if (inRange(f.dueDate, priorStartDate, priorEndDate) && f.amountPaid) {
        priorRevenue += safeNum(f.amountPaid);
      }
    });
    transactions.forEach(t => {
      if (isIncomeTx(t) && inRange(t.date, priorStartDate, priorEndDate)) {
        priorRevenue += safeNum(t.amount);
      }
    });

    let priorExpenses = 0;
    transactions.forEach(t => {
      if (isExpenseTx(t) && inRange(t.date, priorStartDate, priorEndDate)) {
        priorExpenses += safeNum(t.amount);
      }
    });
    const priorNetProfit = priorRevenue - priorExpenses;

    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const revenueGrowth = calcGrowth(totalRevenue, priorRevenue);
    const expenseGrowth = calcGrowth(totalOperatingExpenses, priorExpenses);
    const netProfitGrowth = calcGrowth(netProfit, priorNetProfit);
    const expenseRatio = totalRevenue > 0 ? (totalOperatingExpenses / totalRevenue) * 100 : 0;

    return {
      periodLabel,
      startDate,
      endDate,
      monthsInPeriod,
      tuitionRevenue,
      feesByType,
      otherIncomeTotal,
      otherIncomesByCategory,
      totalRevenue,
      totalOperatingExpenses,
      expensesByCategory,
      operatingProfit,
      operatingMargin,
      totalDepreciation,
      depreciationByAssetCategory,
      netProfit,
      netProfitMargin,
      priorRevenue,
      priorExpenses,
      priorNetProfit,
      revenueGrowth,
      expenseGrowth,
      netProfitGrowth,
      expenseRatio
    };
  };

  const financialTrends = processFinancialTrends();
  const attendanceTrends = processAttendanceTrends();
  const expenseBreakdown = processExpenseBreakdown();
  const therapyBreakdown = processTherapyBreakdown();

  const rp = processReceiptsAndPayments();
  const cf = processCashFlow();
  const bs = processBalanceSheet();
  const pnl = processProfitAndLoss();

  const currentMonthIncome = financialTrends[financialTrends.length - 1]?.income || 0;
  const currentMonthExpense = financialTrends[financialTrends.length - 1]?.expense || 0;
  const currentMonthAssets = financialTrends[financialTrends.length - 1]?.assets || 0;
  const profit = currentMonthIncome - currentMonthExpense;

  // Filtered Assets for the Balance Sheet Asset Details Register
  const filteredAssets = bs.assetTransactions.filter(item => {
    const name = item.assetDetails?.assetName || item.description || item.category;
    const loc = item.assetDetails?.locationOrRoom || '';
    const cat = item.assetDetails?.category || item.category;
    const serial = item.assetDetails?.serialNumber || '';
    
    const matchesSearch = assetSearchQuery === '' || 
      name.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
      loc.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
      serial.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
      cat.toLowerCase().includes(assetSearchQuery.toLowerCase());

    const matchesCat = selectedAssetCategoryFilter === 'ALL' || cat === selectedAssetCategoryFilter;

    return matchesSearch && matchesCat;
  });

  // Known Partner Names from all investments for quick-select
  const knownPartnerNames = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach(t => {
      if (t.partnerName?.trim()) {
        names.add(t.partnerName.trim());
      }
    });
    return Array.from(names).sort();
  }, [transactions]);

  // Filtered Partner Investments in Partners tab
  const filteredInvestments = useMemo(() => {
    return transactions.filter(isInvestmentTx).filter(t => {
      const pName = t.partnerName || '';
      const notes = t.description || '';
      const cat = t.category || '';
      const mode = t.paymentMode || '';

      const matchesSearch = !partnerSearchQuery ||
        pName.toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
        notes.toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
        cat.toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
        mode.toLowerCase().includes(partnerSearchQuery.toLowerCase());

      const matchesPartner = partnerFilter === 'ALL' || pName === partnerFilter;

      return matchesSearch && matchesPartner;
    });
  }, [transactions, partnerSearchQuery, partnerFilter]);

  // Filtered Deposits for the Balance Sheet Security Deposits Register
  const filteredDeposits = bs.depositTransactions.filter(item => {
    const payee = item.depositDetails?.payeeName || '';
    const premises = item.depositDetails?.premisesOrAccount || '';
    const cat = item.depositDetails?.depositCategory || item.category;
    const ref = item.depositDetails?.referenceNumber || '';
    const desc = item.description || '';
    
    const matchesSearch = depositSearchQuery === '' || 
      payee.toLowerCase().includes(depositSearchQuery.toLowerCase()) ||
      premises.toLowerCase().includes(depositSearchQuery.toLowerCase()) ||
      ref.toLowerCase().includes(depositSearchQuery.toLowerCase()) ||
      cat.toLowerCase().includes(depositSearchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(depositSearchQuery.toLowerCase());

    const matchesCat = selectedDepositCategoryFilter === 'ALL' || cat === selectedDepositCategoryFilter;

    return matchesSearch && matchesCat;
  });

  // Filtered Transactions list in Dashboard
  const filteredTransactions = transactions.filter(t => {
    if (txFilter === 'TRANSFER') return isTransferTx(t);
    if (txFilter === 'EXPENSE') return isExpenseTx(t);
    if (txFilter === 'ASSET') return isAssetTx(t);
    if (txFilter === 'DEPOSIT') return isDepositTx(t);
    if (txFilter === 'INCOME') return isIncomeTx(t);
    if (txFilter === 'INVESTMENT') return isInvestmentTx(t);
    return true;
  });

  // Executive Multi-Tab Professional Financial Workbook Export
  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Little Buds Child Care Centre';
    wb.lastModifiedBy = 'Finance & Accounts Administration';
    wb.created = new Date();
    wb.modified = new Date();

    // ----------------------------------------------------
    // SHEET 1: EXECUTIVE FINANCIAL SUMMARY & KPI DASHBOARD
    // ----------------------------------------------------
    const wsSummary = wb.addWorksheet('Executive Summary', {
      properties: { tabColor: { argb: 'FFD97706' } }
    });
    addExecutiveReportHeader(wsSummary, {
      title: 'Executive Financial Summary',
      subtitle: 'FINANCIAL PERFORMANCE & POSITION DASHBOARD',
      colSpan: 4,
      periodLabel: `P&L: ${pnl.periodLabel} | Balance Sheet: ${bs.periodLabel}`,
      asOfDate: new Date()
    });

    const hSummary = wsSummary.addRow(['Financial Metric', 'Reporting Category / Scope', 'Figure / Balance (₹)', 'Performance / Audit Notes']);
    styleHeaderRow(hSummary, 4, EXCEL_COLORS.navyHeader);
    hSummary.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const summaryMetrics = [
      { name: 'Total Operating Revenue', cat: 'Income Statement (P&L)', val: pnl.totalRevenue, note: `Fee Collections: ₹${pnl.tuitionRevenue.toLocaleString('en-IN')} | Other: ₹${pnl.otherIncomeTotal.toLocaleString('en-IN')}`, isCurrency: true },
      { name: 'Total Operating Expenses', cat: 'Income Statement (P&L)', val: pnl.totalOperatingExpenses, note: `${Object.keys(pnl.expensesByCategory).length} Active Expense Categories`, isCurrency: true },
      { name: 'Operating Profit / EBITDA', cat: 'Operational Surplus', val: pnl.operatingProfit, note: `Operating Margin: ${pnl.operatingMargin.toFixed(1)}%`, isCurrency: true, isHighlight: true },
      { name: 'Capital Asset Depreciation', cat: 'Non-Cash Amortization', val: Math.round(pnl.totalDepreciation), note: 'Straight-line pro-rata depreciation', isCurrency: true },
      { name: 'Net Profit / Net Surplus', cat: 'Net Result (Surplus / Deficit)', val: Math.round(pnl.netProfit), note: `Net Margin: ${pnl.netProfitMargin.toFixed(1)}%`, isCurrency: true, isHighlight: true },
      { name: 'Closing Bank Balance', cat: 'Liquid Assets (Account 1010)', val: bs.bankBalance, note: 'Bank Accounts, UPI & Online Collections', isCurrency: true },
      { name: 'Closing Cash in Hand Balance', cat: 'Liquid Assets (Account 1020)', val: bs.cashBalance, note: 'Physical Cash Drawer on Premises', isCurrency: true },
      { name: 'Total Liquid Funds Available', cat: 'Total Cash & Bank', val: bs.cashAndBank, note: 'Immediate operational liquidity', isCurrency: true, isHighlight: true },
      { name: 'Accounts Receivable (Fee Dues)', cat: 'Current Assets (Account 1200)', val: bs.accountsReceivable, note: 'Pending parent tuition balances', isCurrency: true },
      { name: 'Refundable Security Deposits Paid', cat: 'Current Assets (Account 1300)', val: bs.totalSecurityDeposits, note: `${bs.depositTransactions.length} Facility, landlord & utility deposits`, isCurrency: true },
      { name: 'Total Current Assets', cat: 'Current Assets Group', val: bs.currentAssets, note: 'Liquid + Fee Receivables + Security Deposits', isCurrency: true, isHighlight: true },
      { name: 'Gross Fixed Capital Assets', cat: 'Fixed Assets (Gross Book Value)', val: bs.totalFixedAssets, note: `${bs.assetTransactions.length} Capital Equipment & Facilities`, isCurrency: true },
      { name: 'Less: Accumulated Depreciation', cat: 'Contra-Asset (Account 1600)', val: -bs.totalAccumulatedDepreciation, note: 'All-time cumulative amortized value', isCurrency: true },
      { name: 'Net Fixed Capital Assets', cat: 'Fixed Assets (Net Book Value)', val: bs.netFixedAssets, note: 'Depreciated carrying value on balance sheet', isCurrency: true, isHighlight: true },
      { name: 'TOTAL BALANCE SHEET ASSETS', cat: 'Total Centre Assets', val: bs.totalAssets, note: 'Current Assets + Net Fixed Assets', isCurrency: true, isTotal: true },
      { name: 'Current Liabilities (Payables & Accruals)', cat: 'Current Liabilities (Account 2000)', val: bs.liabilities, note: 'Unsettled vendor accruals & unpaid staff salaries', isCurrency: true },
      { name: 'Total Partner Capital Invested', cat: 'Equity (Account 3010)', val: bs.totalPartnerCapital, note: `${Object.keys(bs.partnerCapitalByName).length} Active Partners`, isCurrency: true },
      { name: 'Net Profit & Retained Surplus', cat: 'Equity (Account 3020)', val: bs.netProfit, note: 'Cumulative Net Profit after deducting YTD accumulated depreciation', isCurrency: true, isHighlight: true },
      { name: 'TOTAL LIABILITIES & EQUITY', cat: 'Double-Entry Balanced Total', val: bs.liabilities + bs.equity, note: 'Verified balanced: Assets = Liabilities + Capital + Net Profit', isCurrency: true, isTotal: true }
    ];

    summaryMetrics.forEach((m, idx) => {
      const r = wsSummary.addRow([m.name, m.cat, m.val, m.note]);
      if (m.isTotal) {
        styleTotalRow(r, 4);
      } else {
        styleDataRow(r, 4, idx % 2 === 0);
        if (m.isHighlight) {
          r.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E1B4B' } };
        }
      }
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    setupSheetViews(wsSummary, 5);
    autoFitWorksheetColumns(wsSummary, { 1: 32, 2: 30, 3: 24, 4: 42 });

    // ----------------------------------------------------
    // SHEET 2: STATEMENT OF PROFIT & LOSS (ACCRUAL BASIS)
    // ----------------------------------------------------
    const wsPnl = wb.addWorksheet('Profit & Loss', {
      properties: { tabColor: { argb: 'FF4F46E5' } }
    });
    addExecutiveReportHeader(wsPnl, {
      title: 'Statement of Profit and Loss',
      subtitle: 'INCOME STATEMENT — ACCRUAL ACCOUNTING STANDARD',
      colSpan: 3,
      periodLabel: pnl.periodLabel,
      asOfDate: pnl.endDate
    });

    const hPnl = wsPnl.addRow(['Accounting Section / Category', 'Particulars / Account Head', 'Amount (₹)']);
    styleHeaderRow(hPnl, 3, EXCEL_COLORS.navyHeader);
    hPnl.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    let pnlRowIdx = 0;
    // Section A: Revenue
    const rRevH = wsPnl.addRow(['I. REVENUE', 'OPERATING REVENUES & COLLECTIONS', '']);
    styleSectionHeaderRow(rRevH, 3, 'I. OPERATING REVENUES & FEE INCOMES', 'FFECFDF5', 'FF065F46');

    Object.entries(pnl.feesByType).forEach(([feeType, amt]) => {
      const r = wsPnl.addRow(['Tuition Collections', `Tuition & Program Fees — ${feeType}`, amt]);
      styleDataRow(r, 3, pnlRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });
    Object.entries(pnl.otherIncomesByCategory).forEach(([cat, amt]) => {
      const r = wsPnl.addRow(['Other Incomes', cat, amt]);
      styleDataRow(r, 3, pnlRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotRev = wsPnl.addRow(['TOTAL REVENUE', 'TOTAL OPERATING REVENUE (A)', pnl.totalRevenue]);
    styleTotalRow(rTotRev, 3, { fillColor: 'FFD1FAE5', textColor: 'FF065F46' });
    rTotRev.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotRev.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsPnl.addRow([]); // Blank

    // Section B: Expenses
    const rExpH = wsPnl.addRow(['II. OPERATING EXPENSES', 'OPERATIONAL EXPENSES & OVERHEADS', '']);
    styleSectionHeaderRow(rExpH, 3, 'II. OPERATIONAL OVERHEADS & EXPENSES', 'FFFEF2F2', 'FF9F1239');

    Object.entries(pnl.expensesByCategory).forEach(([cat, data]) => {
      const r = wsPnl.addRow(['Operating Expense', `${cat} (${data.count} transactions)`, data.total]);
      styleDataRow(r, 3, pnlRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotExp = wsPnl.addRow(['TOTAL EXPENSES', 'TOTAL OPERATING EXPENSES (B)', pnl.totalOperatingExpenses]);
    styleTotalRow(rTotExp, 3, { fillColor: 'FFFEE2E2', textColor: 'FF991B1B' });
    rTotExp.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotExp.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsPnl.addRow([]);

    // Operating Profit
    const rOpProfit = wsPnl.addRow(['OPERATING PROFIT', 'OPERATING PROFIT / EBITDA (A - B)', pnl.operatingProfit]);
    styleTotalRow(rOpProfit, 3, { fillColor: 'FFE0E7FF', textColor: 'FF312E81' });
    rOpProfit.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rOpProfit.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rOpMargin = wsPnl.addRow(['OPERATING MARGIN', 'Operating Profit Margin %', (pnl.operatingMargin / 100)]);
    styleDataRow(rOpMargin, 3, false);
    rOpMargin.getCell(3).numFmt = NUMBER_FORMATS.percentage;
    rOpMargin.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsPnl.addRow([]);

    // Section C: Depreciation
    const rDepH = wsPnl.addRow(['III. ASSET DEPRECIATION', 'NON-CASH CAPITAL AMORTIZATION', '']);
    styleSectionHeaderRow(rDepH, 3, 'III. CAPITAL ASSET DEPRECIATION (INDIAN FY SCHEDULE)', 'FFF1F5F9', 'FF334155');

    Object.entries(pnl.depreciationByAssetCategory).forEach(([cat, data]) => {
      const r = wsPnl.addRow(['Depreciation Schedule', `${cat} (${data.count} assets)`, Math.round(data.depreciation)]);
      styleDataRow(r, 3, pnlRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotDep = wsPnl.addRow(['TOTAL DEPRECIATION', 'TOTAL ASSET DEPRECIATION CHARGE (C)', Math.round(pnl.totalDepreciation)]);
    styleTotalRow(rTotDep, 3, { fillColor: 'FFE2E8F0', textColor: 'FF1E293B' });
    rTotDep.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotDep.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsPnl.addRow([]);

    // Net Result
    const isSurplus = pnl.netProfit >= 0;
    const rNet = wsPnl.addRow(['NET SURPLUS / (DEFICIT)', 'NET PROFIT / SURPLUS FOR PERIOD (A - B - C)', Math.round(pnl.netProfit)]);
    styleTotalRow(rNet, 3, {
      fillColor: isSurplus ? 'FFD1FAE5' : 'FFFEE2E2',
      textColor: isSurplus ? 'FF065F46' : 'FF991B1B'
    });
    rNet.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rNet.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rNetMargin = wsPnl.addRow(['NET PROFIT MARGIN', 'Net Profit Margin %', (pnl.netProfitMargin / 100)]);
    styleDataRow(rNetMargin, 3, false);
    rNetMargin.getCell(3).numFmt = NUMBER_FORMATS.percentage;
    rNetMargin.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsPnl, 5);
    autoFitWorksheetColumns(wsPnl, { 1: 30, 2: 44, 3: 24 });

    // ----------------------------------------------------
    // SHEET 3: BALANCE SHEET (FINANCIAL POSITION)
    // ----------------------------------------------------
    const wsBs = wb.addWorksheet('Balance Sheet', {
      properties: { tabColor: { argb: 'FF2563EB' } }
    });
    addExecutiveReportHeader(wsBs, {
      title: 'Statement of Financial Position (Balance Sheet)',
      subtitle: 'ASSETS, LIABILITIES & PARTNER CAPITAL EQUITY',
      colSpan: 3,
      periodLabel: bs.periodLabel,
      asOfDate: bs.asOfDate
    });

    const hBs = wsBs.addRow(['Classification & Standard Code', 'Account Head / Category Description', 'Amount (₹)']);
    styleHeaderRow(hBs, 3, EXCEL_COLORS.navyHeader);
    hBs.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    let bsRowIdx = 0;
    // 1. Current Assets
    const rCaH = wsBs.addRow(['1. CURRENT ASSETS', 'LIQUID FUNDS, RECEIVABLES & DEPOSITS', '']);
    styleSectionHeaderRow(rCaH, 3, '1. CURRENT ASSETS (LIQUID FUNDS & SHORT-TERM RECEIVABLES)', 'FFEFF6FF', 'FF1E40AF');

    const caItems = [
      { code: 'Asset #1010', name: 'Bank Balance (Primary Accounts, UPI & Online Collections)', amt: bs.bankBalance },
      { code: 'Asset #1020', name: 'Cash Balance (Physical Cash in Hand Drawer)', amt: bs.cashBalance },
      { code: 'Subtotal Liquid', name: '↳ Subtotal Liquid Cash & Bank Funds', amt: bs.cashAndBank, isSub: true },
      { code: 'Asset #1200', name: 'Accounts Receivable (Outstanding Student Tuition Fee Dues)', amt: bs.accountsReceivable },
      { code: 'Asset #1300', name: 'Security Deposits Paid (Premises Lease, Utility & Caution Deposits)', amt: bs.totalSecurityDeposits }
    ];
    caItems.forEach(i => {
      const r = wsBs.addRow([i.code, i.name, i.amt]);
      styleDataRow(r, 3, bsRowIdx++ % 2 === 0);
      if (i.isSub) {
        r.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF1E40AF' } };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      }
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotCa = wsBs.addRow(['TOTAL CURRENT ASSETS', 'TOTAL CURRENT ASSETS (A)', bs.currentAssets]);
    styleTotalRow(rTotCa, 3, { fillColor: 'FFDBEAFE', textColor: 'FF1E3A8A' });
    rTotCa.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotCa.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsBs.addRow([]);

    // 2. Fixed Capital Assets
    const rFaH = wsBs.addRow(['2. FIXED ASSETS', 'CAPITAL ASSETS & DEPRECIATION SCHEDULE', '']);
    styleSectionHeaderRow(rFaH, 3, '2. CAPITAL FIXED ASSETS & AMORTIZATION', 'FFF0FDF4', 'FF166534');

    Object.entries(bs.assetsByCategory).forEach(([cat, data]) => {
      const r = wsBs.addRow(['Fixed Asset Gross', `${cat} (${data.count} items)`, data.total]);
      styleDataRow(r, 3, bsRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rGrossFa = wsBs.addRow(['Fixed Assets Gross', 'Total Fixed Assets (Gross Historical Cost)', bs.totalFixedAssets]);
    styleDataRow(rGrossFa, 3, false);
    rGrossFa.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
    rGrossFa.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rGrossFa.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rAccDep = wsBs.addRow(['Contra Asset #1600', 'Less: Accumulated Depreciation to Date', -bs.totalAccumulatedDepreciation]);
    styleDataRow(rAccDep, 3, true);
    rAccDep.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFDC2626' } };
    rAccDep.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rAccDep.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rNetFa = wsBs.addRow(['TOTAL NET FIXED ASSETS', 'NET FIXED CAPITAL ASSETS (Carrying Book Value) (B)', bs.netFixedAssets]);
    styleTotalRow(rNetFa, 3, { fillColor: 'FFDCFCE7', textColor: 'FF166534' });
    rNetFa.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rNetFa.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsBs.addRow([]);

    // Total Assets (Current Assets + Net Fixed Assets)
    const rTotAss = wsBs.addRow(['TOTAL ASSETS', 'TOTAL CENTRE ASSETS (Current Assets + Net Fixed Assets)', bs.totalAssets]);
    styleTotalRow(rTotAss, 3, { fillColor: 'FF312E81', textColor: 'FFFFFFFF' });
    rTotAss.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotAss.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsBs.addRow([]);

    // 3. Liabilities
    const rLiabH = wsBs.addRow(['3. CURRENT LIABILITIES', 'ACCOUNTS PAYABLE & ACCRUED SALARIES', '']);
    styleSectionHeaderRow(rLiabH, 3, '3. CURRENT LIABILITIES & ACCRUED OBLIGATIONS', 'FFFDF4FF', 'FF86198F');

    const liabItems = [
      { code: 'Liability #2010', name: 'Accounts Payable (Unsettled Accrued Expenses & Overheads)', amt: bs.accountsPayable },
      { code: 'Liability #2030', name: 'Accrued Staff Salaries (Unpaid Payroll Obligations)', amt: bs.accruedSalaries }
    ];
    liabItems.forEach(i => {
      const r = wsBs.addRow([i.code, i.name, i.amt]);
      styleDataRow(r, 3, bsRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotLiab = wsBs.addRow(['TOTAL LIABILITIES', 'TOTAL CURRENT LIABILITIES (C)', bs.liabilities]);
    styleTotalRow(rTotLiab, 3, { fillColor: 'FFF5D0FE', textColor: 'FF701A75' });
    rTotLiab.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotLiab.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsBs.addRow([]);

    // 4. Partner Capital & Equity
    const rEqH = wsBs.addRow(['4. EQUITY & CAPITAL', 'PARTNER INVESTMENTS & NET PROFIT SURPLUS', '']);
    styleSectionHeaderRow(rEqH, 3, '4. PARTNER CAPITAL & ACCUMULATED EQUITY', 'FFFAF5FF', 'FF6B21A8');

    Object.entries(bs.partnerCapitalByName).forEach(([pName, pData]) => {
      const r = wsBs.addRow(['Equity #3010', `Partner Capital Contribution — ${pName} (${pData.count} entries)`, pData.total]);
      styleDataRow(r, 3, bsRowIdx++ % 2 === 0);
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotCap = wsBs.addRow(['Partner Equity', 'Total Paid-In Partner Capital', bs.totalPartnerCapital]);
    styleDataRow(rTotCap, 3, false);
    rTotCap.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF581C87' } };
    rTotCap.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotCap.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rOpSurplus = wsBs.addRow(['Operating Surplus', 'Operating Surplus (Revenue less Operating Expenses)', bs.operatingSurplus]);
    styleDataRow(rOpSurplus, 3, true);
    rOpSurplus.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
    rOpSurplus.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rOpSurplus.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rLessDep = wsBs.addRow(['YTD Depreciation', 'Less: Cumulative YTD Depreciation on Fixed Assets', -bs.totalAccumulatedDepreciation]);
    styleDataRow(rLessDep, 3, true);
    rLessDep.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FFDC2626' } };
    rLessDep.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rLessDep.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rRetEarn = wsBs.addRow(['Equity #3020', 'Net Profit & Retained Surplus (After YTD Depreciation)', bs.netProfit]);
    styleDataRow(rRetEarn, 3, false);
    rRetEarn.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF166534' } };
    rRetEarn.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rRetEarn.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const rTotEq = wsBs.addRow(['TOTAL EQUITY', 'TOTAL PARTNER CAPITAL & ACCUMULATED NET PROFIT (D)', bs.equity]);
    styleTotalRow(rTotEq, 3, { fillColor: 'FFE9D5FF', textColor: 'FF581C87' });
    rTotEq.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotEq.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    wsBs.addRow([]);

    // Total Liabilities & Equity
    const rTotLiabEq = wsBs.addRow(['TOTAL LIABILITIES & EQUITY', 'TOTAL LIABILITIES & PARTNER EQUITY (C + D)', bs.liabilities + bs.equity]);
    styleTotalRow(rTotLiabEq, 3, { fillColor: 'FF10B981', textColor: 'FFFFFFFF' });
    rTotLiabEq.getCell(3).numFmt = NUMBER_FORMATS.currency;
    rTotLiabEq.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsBs, 5);
    autoFitWorksheetColumns(wsBs, { 1: 30, 2: 48, 3: 24 });

    // ----------------------------------------------------
    // SHEET 4: FIXED ASSETS REGISTER DETAIL
    // ----------------------------------------------------
    const wsAssets = wb.addWorksheet('Fixed Assets Register', {
      properties: { tabColor: { argb: 'FF0891B2' } }
    });
    addExecutiveReportHeader(wsAssets, {
      title: 'Fixed Assets Register',
      subtitle: 'CAPITAL ASSETS INVENTORY & AMORTIZATION REGISTER',
      colSpan: 11,
      periodLabel: bs.periodLabel,
      asOfDate: bs.asOfDate
    });

    const hAssets = wsAssets.addRow([
      'Asset Name',
      'Asset Category',
      'Acquisition Date',
      'Cost Value (₹)',
      'Useful Life (Yrs)',
      'Monthly Dep (₹)',
      'Accumulated Dep (₹)',
      'Net Book Value (₹)',
      'Location / Room',
      'Condition',
      'Serial / Tag No.'
    ]);
    styleHeaderRow(hAssets, 11, EXCEL_COLORS.navyHeader);
    hAssets.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    hAssets.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    hAssets.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    hAssets.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    let totalAssetCost = 0;
    let totalAssetAccumDep = 0;
    let totalAssetNetBook = 0;

    const depBreakdown = calculateAssetDepreciationBreakdown(bs.assetTransactions, new Date(bs.asOfDate || new Date()));
    const depMap = new Map(depBreakdown.perAsset.map(p => [p.transaction.id, p]));

    bs.assetTransactions.forEach((t, idx) => {
      const cost = safeNum(t.amount);
      const usefulYears = safeNum(t.assetDetails?.usefulLifeYears) || 5;
      const depInfo = depMap.get(t.id);
      const accumDep = depInfo?.assetAccumulatedDep || 0;
      const monthlyDep = depInfo?.monthlyDep || (usefulYears > 0 ? cost / (usefulYears * 12) : 0);
      const bookVal = Math.max(0, cost - accumDep);

      totalAssetCost += cost;
      totalAssetAccumDep += accumDep;
      totalAssetNetBook += bookVal;

      const r = wsAssets.addRow([
        t.assetDetails?.assetName || t.description || t.category,
        t.assetDetails?.category || t.category,
        formatDate(t.date),
        cost,
        usefulYears,
        Math.round(monthlyDep),
        accumDep,
        bookVal,
        t.assetDetails?.locationOrRoom || 'Centre',
        t.assetDetails?.condition || 'Good',
        t.assetDetails?.serialNumber || '—'
      ]);
      styleDataRow(r, 11, idx % 2 === 0);
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(4).numFmt = NUMBER_FORMATS.currency;
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).numFmt = NUMBER_FORMATS.currency;
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(7).numFmt = NUMBER_FORMATS.currency;
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(8).numFmt = NUMBER_FORMATS.currency;
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotAsset = wsAssets.addRow([
      'TOTAL CAPITAL ASSETS',
      `${bs.assetTransactions.length} Asset Items Recorded`,
      '',
      totalAssetCost,
      '',
      '',
      totalAssetAccumDep,
      totalAssetNetBook,
      '',
      '',
      ''
    ]);
    styleTotalRow(rTotAsset, 11);
    rTotAsset.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rTotAsset.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotAsset.getCell(7).numFmt = NUMBER_FORMATS.currency;
    rTotAsset.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotAsset.getCell(8).numFmt = NUMBER_FORMATS.currency;
    rTotAsset.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsAssets, 5);
    autoFitWorksheetColumns(wsAssets, { 1: 30, 2: 26, 3: 16, 4: 18, 5: 16, 6: 18, 7: 20, 8: 20, 9: 20, 10: 14, 11: 18 });

    // ----------------------------------------------------
    // SHEET 5: SECURITY DEPOSITS REGISTER
    // ----------------------------------------------------
    const wsDeposits = wb.addWorksheet('Security Deposits', {
      properties: { tabColor: { argb: 'FF0D9488' } }
    });
    addExecutiveReportHeader(wsDeposits, {
      title: 'Security Deposits Register',
      subtitle: 'REFUNDABLE CURRENT ASSETS (ACCOUNT #1300)',
      colSpan: 8,
      periodLabel: bs.periodLabel,
      asOfDate: bs.asOfDate
    });

    const hDep = wsDeposits.addRow([
      'Deposit Category',
      'Payee / Landlord / Authority',
      'Premises / Account / Meter',
      'Date Placed',
      'Payment Mode',
      'Agreement / Ref #',
      'Accounting Classification',
      'Deposit Amount (₹)'
    ]);
    styleHeaderRow(hDep, 8, EXCEL_COLORS.navyHeader);
    hDep.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    let totalDepositSum = 0;
    bs.depositTransactions.forEach((t, idx) => {
      const amt = safeNum(t.amount);
      totalDepositSum += amt;
      const r = wsDeposits.addRow([
        t.depositDetails?.depositCategory || t.category,
        t.depositDetails?.payeeName || '—',
        t.depositDetails?.premisesOrAccount || 'Main Facility',
        formatDate(t.date),
        t.paymentMode || 'Bank Transfer',
        t.depositDetails?.referenceNumber || '—',
        'Current Asset (Account #1300)',
        amt
      ]);
      styleDataRow(r, 8, idx % 2 === 0);
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(8).numFmt = NUMBER_FORMATS.currency;
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotDepSum = wsDeposits.addRow([
      'TOTAL SECURITY DEPOSITS',
      `${bs.depositTransactions.length} Active Deposits Held`,
      '',
      '',
      '',
      '',
      '',
      totalDepositSum
    ]);
    styleTotalRow(rTotDepSum, 8, { fillColor: 'FFCCFBF1', textColor: 'FF115E59' });
    rTotDepSum.getCell(8).numFmt = NUMBER_FORMATS.currency;
    rTotDepSum.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsDeposits, 5);
    autoFitWorksheetColumns(wsDeposits, { 1: 30, 2: 26, 3: 24, 4: 16, 5: 18, 6: 20, 7: 28, 8: 20 });

    // ----------------------------------------------------
    // SHEET 6: RECEIPTS & PAYMENTS ACCOUNT
    // ----------------------------------------------------
    const wsRp = wb.addWorksheet('Receipts & Payments', {
      properties: { tabColor: { argb: 'FF059669' } }
    });
    addExecutiveReportHeader(wsRp, {
      title: 'Receipts and Payments Account',
      subtitle: 'SUMMARY OF CASH & BANK LIQUIDITY MOVEMENTS',
      colSpan: 4,
      periodLabel: 'Comprehensive All-Time Liquid Transactions',
      asOfDate: new Date()
    });

    const hRp = wsRp.addRow(['Flow Classification', 'Particulars / Account Head', 'Channel Breakdown', 'Amount (₹)']);
    styleHeaderRow(hRp, 4, EXCEL_COLORS.navyHeader);
    hRp.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    let rpIdx = 0;
    // Receipts
    const rRpH = wsRp.addRow(['RECEIPTS', 'ALL CASH & BANK REVENUE INFLOWS', '', '']);
    styleSectionHeaderRow(rRpH, 4, 'I. RECEIPTS (FEE COLLECTIONS, OTHER INCOMES & CAPITAL)', 'FFECFDF5', 'FF065F46');

    Object.entries(rp.receiptsByCategory).forEach(([cat, amount]) => {
      const r = wsRp.addRow(['Receipt Inflow', cat, 'Operating / Financing Receipt', amount]);
      styleDataRow(r, 4, rpIdx++ % 2 === 0);
      r.getCell(4).numFmt = NUMBER_FORMATS.currency;
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotRec = wsRp.addRow(['TOTAL RECEIPTS', 'TOTAL INFLOWS RECEIVED (A)', '', rp.totalReceipts]);
    styleTotalRow(rTotRec, 4, { fillColor: 'FFD1FAE5', textColor: 'FF065F46' });
    rTotRec.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rTotRec.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    wsRp.addRow([]);

    // Operating Payments
    const rOpPayH = wsRp.addRow(['PAYMENTS', 'OPERATING EXPENSE OUTFLOWS', '', '']);
    styleSectionHeaderRow(rOpPayH, 4, 'II. PAYMENTS — OPERATING OVERHEADS & EXPENSES', 'FFFEF2F2', 'FF9F1239');

    Object.entries(rp.operatingPaymentsByCategory).forEach(([cat, amount]) => {
      const r = wsRp.addRow(['Operating Outflow', cat, 'Operational Overhead', amount]);
      styleDataRow(r, 4, rpIdx++ % 2 === 0);
      r.getCell(4).numFmt = NUMBER_FORMATS.currency;
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotOpPay = wsRp.addRow(['Subtotal Operating', 'Total Operating Payments', '', rp.totalOperatingPayments]);
    styleDataRow(rTotOpPay, 4, false);
    rTotOpPay.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF991B1B' } };
    rTotOpPay.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rTotOpPay.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    wsRp.addRow([]);

    // Capital Payments
    const rCapPayH = wsRp.addRow(['PAYMENTS', 'CAPITAL ASSET & DEPOSIT OUTFLOWS', '', '']);
    styleSectionHeaderRow(rCapPayH, 4, 'III. PAYMENTS — CAPITAL ASSET PURCHASES & DEPOSITS', 'FFF0FDF4', 'FF166534');

    Object.entries(rp.capitalPaymentsByCategory).forEach(([cat, amount]) => {
      const r = wsRp.addRow(['Capital Outflow', `Asset: ${cat}`, 'Investing Outflow', amount]);
      styleDataRow(r, 4, rpIdx++ % 2 === 0);
      r.getCell(4).numFmt = NUMBER_FORMATS.currency;
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    });
    Object.entries(rp.depositPaymentsByCategory).forEach(([cat, amount]) => {
      const r = wsRp.addRow(['Deposit Outflow', `Deposit: ${cat}`, 'Current Asset Outflow', amount]);
      styleDataRow(r, 4, rpIdx++ % 2 === 0);
      r.getCell(4).numFmt = NUMBER_FORMATS.currency;
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotPay = wsRp.addRow(['TOTAL PAYMENTS', 'TOTAL CASH & BANK PAYMENTS (B)', '', rp.totalPayments]);
    styleTotalRow(rTotPay, 4, { fillColor: 'FFFEE2E2', textColor: 'FF991B1B' });
    rTotPay.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rTotPay.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    wsRp.addRow([]);

    // Closing Balances
    const rCloseH = wsRp.addRow(['CLOSING BALANCES', 'CLOSING LIQUID FUNDS', '', '']);
    styleSectionHeaderRow(rCloseH, 4, 'IV. CLOSING LIQUID BALANCES (A - B + CONTRA TRANSFERS)', 'FFEFF6FF', 'FF1E40AF');

    const rCloseBank = wsRp.addRow(['Closing Liquid', 'Closing Bank Account Balance', 'Accounts, Digital & UPI', rp.bankBalance]);
    styleDataRow(rCloseBank, 4, false);
    rCloseBank.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1D4ED8' } };
    rCloseBank.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rCloseBank.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    const rCloseCash = wsRp.addRow(['Closing Liquid', 'Closing Physical Cash in Hand Balance', 'Physical Cash Drawer', rp.cashBalance]);
    styleDataRow(rCloseCash, 4, true);
    rCloseCash.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF047857' } };
    rCloseCash.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rCloseCash.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    const rTotClose = wsRp.addRow(['TOTAL CLOSING LIQUIDITY', 'TOTAL CLOSING CASH & BANK FUNDS', 'Total Verified Liquidity', rp.closingBalance]);
    styleTotalRow(rTotClose, 4, { fillColor: 'FFD1FAE5', textColor: 'FF065F46' });
    rTotClose.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rTotClose.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsRp, 5);
    autoFitWorksheetColumns(wsRp, { 1: 28, 2: 44, 3: 28, 4: 24 });

    // ----------------------------------------------------
    // SHEET 7: CASH FLOW STATEMENT
    // ----------------------------------------------------
    const wsCf = wb.addWorksheet('Cash Flow', {
      properties: { tabColor: { argb: 'FF16A34A' } }
    });
    addExecutiveReportHeader(wsCf, {
      title: 'Cash Flow Statement',
      subtitle: 'STATEMENT OF CASH FLOWS — DIRECT METHOD',
      colSpan: 3,
      periodLabel: 'Current Month Activity',
      asOfDate: new Date()
    });

    const hCf = wsCf.addRow(['Activity Section', 'Cash Flow Particulars', 'Amount (₹)']);
    styleHeaderRow(hCf, 3, EXCEL_COLORS.navyHeader);
    hCf.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    const cfLines = [
      { sec: 'Opening Balance', item: 'Opening Bank Account Balance', amt: cf.openingBankBalance },
      { sec: 'Opening Balance', item: 'Opening Cash in Hand Balance', amt: cf.openingCashBalance },
      { sec: 'Opening Balance', item: 'TOTAL OPENING CASH & BANK FUNDS', amt: cf.openingBalance, isSub: true },
      { sec: 'Operating Activities', item: 'Operating Inflows via Bank (Tuition & Fees)', amt: cf.bankInflows },
      { sec: 'Operating Activities', item: 'Operating Inflows via Cash (Cash Collections)', amt: cf.cashInflows },
      { sec: 'Operating Activities', item: 'Total Operating Cash Inflows', amt: cf.inflows, isSub: true },
      { sec: 'Operating Activities', item: 'Operating Cash Outflows (Overheads & Expenses)', amt: -cf.operatingOutflows },
      { sec: 'Investing Activities', item: 'Investing Outflows (Capital Asset Purchases)', amt: -cf.capitalOutflows },
      { sec: 'Financing Activities', item: 'Financing Inflows (Partner Capital Inflows)', amt: cf.financingInflows },
      { sec: 'Contra Transfers', item: 'Internal Cash Deposited to Bank (Contra)', amt: cf.monthCashDepositedToBank },
      { sec: 'Contra Transfers', item: 'Internal Cash Withdrawn from Bank (Contra)', amt: -cf.monthCashWithdrawnFromBank },
      { sec: 'Net Flow Summary', item: 'Net Bank Movement for Period', amt: cf.netBankFlow },
      { sec: 'Net Flow Summary', item: 'Net Physical Cash Movement for Period', amt: cf.netCashFlow },
      { sec: 'Net Flow Summary', item: 'NET CASH & BANK MOVEMENT FOR PERIOD', amt: cf.netCashFlowTotal, isSub: true },
      { sec: 'Closing Liquidity', item: 'Closing Bank Balance', amt: cf.closingBankBalance },
      { sec: 'Closing Liquidity', item: 'Closing Cash in Hand Balance', amt: cf.closingCashBalance },
      { sec: 'Closing Liquidity', item: 'TOTAL CLOSING CASH & BANK FUNDS', amt: cf.closingBalance, isTotal: true }
    ];

    cfLines.forEach((l, idx) => {
      const r = wsCf.addRow([l.sec, l.item, l.amt]);
      if (l.isTotal) {
        styleTotalRow(r, 3, { fillColor: 'FFD1FAE5', textColor: 'FF065F46' });
      } else if (l.isSub) {
        styleDataRow(r, 3, idx % 2 === 0);
        r.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E1B4B' } };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      } else {
        styleDataRow(r, 3, idx % 2 === 0);
      }
      r.getCell(3).numFmt = NUMBER_FORMATS.currency;
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    setupSheetViews(wsCf, 5);
    autoFitWorksheetColumns(wsCf, { 1: 26, 2: 44, 3: 24 });

    // ----------------------------------------------------
    // SHEET 8: STAFF SALARIES & PAYROLL
    // ----------------------------------------------------
    const wsSal = wb.addWorksheet('Staff Salaries', {
      properties: { tabColor: { argb: 'FF7C3AED' } }
    });
    addExecutiveReportHeader(wsSal, {
      title: 'Staff Salaries Register',
      subtitle: 'PAYROLL DISBURSEMENT & OUTSTANDING BALANCES',
      colSpan: 9,
      periodLabel: 'Complete Staff Payroll Register',
      asOfDate: new Date()
    });

    const hSal = wsSal.addRow([
      'Staff Name',
      'Salary Month',
      'Disbursement Date',
      'Monthly Salary (₹)',
      'Amount Paid (₹)',
      'Advance Paid (₹)',
      'Balance Due (₹)',
      'Payment Mode',
      'Payment Status'
    ]);
    styleHeaderRow(hSal, 9, EXCEL_COLORS.navyHeader);
    hSal.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    hSal.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    hSal.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    hSal.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

    let totSalAmount = 0;
    let totSalPaid = 0;
    let totSalAdvance = 0;
    let totSalDue = 0;

    salariesList.forEach((s, idx) => {
      const salaryAmt = safeNum(s.salaryAmount);
      const paidAmt = safeNum(s.amountPaid);
      const advAmt = safeNum(s.advanceAmount);
      const dueAmt = safeNum(s.balanceDue);

      totSalAmount += salaryAmt;
      totSalPaid += paidAmt;
      totSalAdvance += advAmt;
      totSalDue += dueAmt;

      const r = wsSal.addRow([
        s.staffName,
        s.salaryMonth,
        formatDate(s.paymentDate),
        salaryAmt,
        paidAmt,
        advAmt,
        dueAmt,
        s.paymentMode || 'Bank Transfer',
        s.status
      ]);
      styleDataRow(r, 9, idx % 2 === 0);
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(4).numFmt = NUMBER_FORMATS.currency;
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(5).numFmt = NUMBER_FORMATS.currency;
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(6).numFmt = NUMBER_FORMATS.currency;
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(7).numFmt = NUMBER_FORMATS.currency;
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const rTotSal = wsSal.addRow([
      'TOTAL STAFF PAYROLL',
      `${salariesList.length} Salary Records`,
      '',
      totSalAmount,
      totSalPaid,
      totSalAdvance,
      totSalDue,
      '',
      ''
    ]);
    styleTotalRow(rTotSal, 9, { fillColor: 'FFE9D5FF', textColor: 'FF581C87' });
    rTotSal.getCell(4).numFmt = NUMBER_FORMATS.currency;
    rTotSal.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotSal.getCell(5).numFmt = NUMBER_FORMATS.currency;
    rTotSal.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotSal.getCell(6).numFmt = NUMBER_FORMATS.currency;
    rTotSal.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotSal.getCell(7).numFmt = NUMBER_FORMATS.currency;
    rTotSal.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsSal, 5);
    autoFitWorksheetColumns(wsSal, { 1: 26, 2: 16, 3: 18, 4: 18, 5: 18, 6: 18, 7: 18, 8: 20, 9: 16 });

    // ----------------------------------------------------
    // SHEET 9: ACCRUALS & OUTSTANDING PAYABLES
    // ----------------------------------------------------
    const wsAcc = wb.addWorksheet('Accruals & Payables', {
      properties: { tabColor: { argb: 'FFD97706' } }
    });
    addExecutiveReportHeader(wsAcc, {
      title: 'Accrued Expenses Register',
      subtitle: 'UNSETTLED LIABILITIES & ACCRUAL ACCOUNTING LOG',
      colSpan: 9,
      periodLabel: 'Complete Accruals Register',
      asOfDate: new Date()
    });

    const hAcc = wsAcc.addRow([
      'Expense Category',
      'Vendor / Recipient',
      'Transaction Date',
      'Due Date',
      'Accrued Amount (₹)',
      'Amount Settled (₹)',
      'Balance Due (₹)',
      'Settlement Status',
      'Ledger Account'
    ]);
    styleHeaderRow(hAcc, 9, EXCEL_COLORS.navyHeader);
    hAcc.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    hAcc.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    hAcc.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

    let totAccAmount = 0;
    let totAccSettled = 0;
    let totAccDue = 0;

    accrualsList.forEach((a, idx) => {
      const amt = safeNum(a.amount);
      const paid = safeNum(a.paidAmount);
      const due = safeNum(a.balanceDue);

      totAccAmount += amt;
      totAccSettled += paid;
      totAccDue += due;

      const r = wsAcc.addRow([
        a.category,
        a.vendorOrRecipient || '—',
        formatDate(a.transactionDate),
        formatDate(a.dueDate),
        amt,
        paid,
        due,
        a.status,
        a.ledgerAccountCode ? `${a.ledgerAccountCode} - ${a.ledgerAccountName || ''}` : '2010 - Accounts Payable'
      ]);
      styleDataRow(r, 9, idx % 2 === 0);
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(5).numFmt = NUMBER_FORMATS.currency;
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(6).numFmt = NUMBER_FORMATS.currency;
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(7).numFmt = NUMBER_FORMATS.currency;
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const rTotAcc = wsAcc.addRow([
      'TOTAL ACCRUED LIABILITIES',
      `${accrualsList.length} Accrual Entries`,
      '',
      '',
      totAccAmount,
      totAccSettled,
      totAccDue,
      '',
      ''
    ]);
    styleTotalRow(rTotAcc, 9, { fillColor: 'FFFEF3C7', textColor: 'FF92400E' });
    rTotAcc.getCell(5).numFmt = NUMBER_FORMATS.currency;
    rTotAcc.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotAcc.getCell(6).numFmt = NUMBER_FORMATS.currency;
    rTotAcc.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    rTotAcc.getCell(7).numFmt = NUMBER_FORMATS.currency;
    rTotAcc.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsAcc, 5);
    autoFitWorksheetColumns(wsAcc, { 1: 26, 2: 26, 3: 16, 4: 16, 5: 18, 6: 18, 7: 18, 8: 18, 9: 30 });

    // ----------------------------------------------------
    // SHEET 10: PARTNER CAPITAL CONTRIBUTIONS
    // ----------------------------------------------------
    const wsPartners = wb.addWorksheet('Partner Capital', {
      properties: { tabColor: { argb: 'FF8B5CF6' } }
    });
    addExecutiveReportHeader(wsPartners, {
      title: 'Partner Capital Register',
      subtitle: 'EQUITY CONTRIBUTIONS & OWNERSHIP REGISTER',
      colSpan: 6,
      periodLabel: bs.periodLabel,
      asOfDate: bs.asOfDate
    });

    const hPart = wsPartners.addRow([
      'Contributing Partner',
      'Contribution Date',
      'Investment Category',
      'Payment Mode',
      'Transaction Reference / Notes',
      'Capital Amount (₹)'
    ]);
    styleHeaderRow(hPart, 6, EXCEL_COLORS.navyHeader);
    hPart.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    let totalPartnerSum = 0;
    bs.partnerInvestments.forEach((t, idx) => {
      const amt = safeNum(t.amount);
      totalPartnerSum += amt;
      const r = wsPartners.addRow([
        t.partnerName || 'Partner',
        formatDate(t.date),
        t.category,
        t.paymentMode || 'Bank Transfer',
        t.description || '—',
        amt
      ]);
      styleDataRow(r, 6, idx % 2 === 0);
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).numFmt = NUMBER_FORMATS.currency;
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotPart = wsPartners.addRow([
      'TOTAL PARTNER CAPITAL INVESTED',
      `${bs.partnerInvestments.length} Contributions`,
      `${Object.keys(bs.partnerCapitalByName).length} Partners`,
      '',
      '',
      totalPartnerSum
    ]);
    styleTotalRow(rTotPart, 6, { fillColor: 'FFE9D5FF', textColor: 'FF581C87' });
    rTotPart.getCell(6).numFmt = NUMBER_FORMATS.currency;
    rTotPart.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsPartners, 5);
    autoFitWorksheetColumns(wsPartners, { 1: 28, 2: 18, 3: 28, 4: 20, 5: 36, 6: 22 });

    // ----------------------------------------------------
    // SHEET 11: ALL TRANSACTIONS JOURNAL
    // ----------------------------------------------------
    const wsTx = wb.addWorksheet('All Transactions', {
      properties: { tabColor: { argb: 'FF475569' } }
    });
    addExecutiveReportHeader(wsTx, {
      title: 'Financial Transactions Master Journal',
      subtitle: 'COMPLETE DOUBLE-ENTRY TRANSACTION REPOSITORY',
      colSpan: 8,
      periodLabel: 'All Historical Transactions',
      asOfDate: new Date()
    });

    const hTx = wsTx.addRow([
      'Transaction Date',
      'Voucher / Ref #',
      'Type',
      'Classification',
      'Category',
      'Payment Mode',
      'Description / Particulars',
      'Amount (₹)'
    ]);
    styleHeaderRow(hTx, 8, EXCEL_COLORS.navyHeader);
    hTx.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    let totalTxSum = 0;
    transactions.forEach((t, idx) => {
      const amt = safeNum(t.amount);
      totalTxSum += amt;
      const classification = isTransferTx(t)
        ? (isBankToCashTx(t) ? 'Bank to Cash Withdrawal' : 'Cash to Bank Deposit')
        : (isInvestmentTx(t) 
          ? `Partner Capital (${t.partnerName || 'Partner'})` 
          : (isAssetTx(t) ? 'Capital Asset' : (isDepositTx(t) ? 'Security Deposit' : (isExpenseTx(t) ? 'Operating Expense' : 'Operating Income'))));

      const desc = isTransferTx(t)
        ? `Contra Transfer: ${t.description || t.category}`
        : (isInvestmentTx(t)
          ? `Partner: ${t.partnerName || 'Partner'} - ${t.description || t.category}`
          : t.assetDetails?.assetName 
          ? `${t.assetDetails.assetName} [Loc: ${t.assetDetails.locationOrRoom || 'N/A'}]` 
          : t.description);

      const r = wsTx.addRow([
        formatDate(t.date),
        t.id ? `TX-${t.id.slice(-6).toUpperCase()}` : '—',
        t.type,
        classification,
        t.category,
        t.paymentMode || '—',
        desc,
        amt
      ]);
      styleDataRow(r, 8, idx % 2 === 0);
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(8).numFmt = NUMBER_FORMATS.currency;
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const rTotTx = wsTx.addRow([
      'TOTAL TRANSACTIONS LOGGED',
      `${transactions.length} Records`,
      '',
      '',
      '',
      '',
      '',
      totalTxSum
    ]);
    styleTotalRow(rTotTx, 8, { fillColor: 'FFE2E8F0', textColor: 'FF0F172A' });
    rTotTx.getCell(8).numFmt = NUMBER_FORMATS.currency;
    rTotTx.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    setupSheetViews(wsTx, 5);
    autoFitWorksheetColumns(wsTx, { 1: 16, 2: 18, 3: 16, 4: 26, 5: 28, 6: 18, 7: 45, 8: 20 });

    // ----------------------------------------------------
    // SHEET 12: CHART OF ACCOUNTS (GENERAL LEDGER MASTER)
    // ----------------------------------------------------
    const wsCoa = wb.addWorksheet('Chart of Accounts', {
      properties: { tabColor: { argb: 'FF312E81' } }
    });
    addExecutiveReportHeader(wsCoa, {
      title: 'General Ledger Chart of Accounts',
      subtitle: 'STANDARD ACCOUNTING CODE STRUCTURE & CLASSIFICATION',
      colSpan: 7,
      periodLabel: 'Active Standard Chart of Accounts',
      asOfDate: new Date()
    });

    const hCoa = wsCoa.addRow([
      'Account Code',
      'Account Title / Name',
      'Classification',
      'Account Subtype',
      'Normal Balance',
      'Status',
      'Description / Purpose'
    ]);
    styleHeaderRow(hCoa, 7, EXCEL_COLORS.navyHeader);

    accountsList.forEach((a, idx) => {
      const r = wsCoa.addRow([
        a.code,
        a.name,
        a.type,
        a.subtype,
        a.normalBalance,
        a.isActive ? 'Active' : 'Inactive',
        a.description || ''
      ]);
      styleDataRow(r, 7, idx % 2 === 0);
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    setupSheetViews(wsCoa, 5);
    autoFitWorksheetColumns(wsCoa, { 1: 16, 2: 36, 3: 20, 4: 26, 5: 16, 6: 14, 7: 45 });

    // Write buffer and trigger browser download
    const buffer = await wb.xlsx.writeBuffer();
    const cleanPeriod = bs.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
    const dateTag = formatDate(new Date()).replace(/\//g, '-');
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `LittleBuds_Financial_Statements_${cleanPeriod}_${dateTag}.xlsx`);
    addToast('success', `Financial statements exported to Excel successfully (${bs.periodLabel})!`);
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        <p className="text-sm text-gray-500 font-medium">Loading financial accounts and asset records...</p>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            {useCustomPageHeading ? (
              <StyledWordText
                words={pageHeadingWords}
                fontSize={elementFontSizes.pageHeading}
                className="font-extrabold text-gray-900 tracking-tight"
                as="h1"
              />
            ) : (
              <h1
                className="font-extrabold text-gray-900 tracking-tight"
                style={{ fontSize: `${elementFontSizes.pageHeading}px` }}
              >
                Reports & Financial Statements
              </h1>
            )}
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors inline-flex items-center"
              title="Customize Heading & Letter Colours"
            >
              <Palette className="h-4 w-4" style={{ color: accentColor }} />
            </button>
          </div>
          <p
            className="mt-1 text-gray-500"
            style={{ fontSize: `${elementFontSizes.subheading}px` }}
          >
            Comprehensive financial management with categorized operating expenses and balance sheet assets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenCashWithdrawalModal}
            className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-lg shadow-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
            title="Withdraw Cash from Bank to Physical Cash Drawer (Contra Withdrawal)"
          >
            <ArrowRightLeft className="-ml-0.5 mr-1.5 h-4 w-4 text-blue-700" />
            Withdraw Cash
          </button>
          <button
            onClick={handleOpenCashDepositModal}
            className="inline-flex items-center px-3 py-2 border border-emerald-300 rounded-lg shadow-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
            title="Convert Cash in Hand to Bank (Contra Deposit)"
          >
            <ArrowRightLeft className="-ml-0.5 mr-1.5 h-4 w-4 text-emerald-700" />
            Deposit Cash
          </button>
          <button
            onClick={() => handleOpenAddForm('Deposit')}
            className="inline-flex items-center px-3 py-2 border border-teal-200 rounded-lg shadow-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
          >
            <ShieldCheck className="-ml-0.5 mr-1.5 h-4 w-4 text-teal-600" />
            + Security Deposit
          </button>
          <button
            onClick={() => handleOpenAddForm('Investment')}
            className="inline-flex items-center px-3 py-2 border border-purple-200 rounded-lg shadow-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
          >
            <Users className="-ml-0.5 mr-1.5 h-4 w-4 text-purple-600" />
            + Partner Investment
          </button>
          <button
            onClick={() => handleOpenAddForm('Asset')}
            className="inline-flex items-center px-3 py-2 border border-indigo-200 rounded-lg shadow-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
          >
            <Package className="-ml-0.5 mr-1.5 h-4 w-4 text-indigo-600" />
            + Record Asset
          </button>
          <button
            onClick={() => setActiveTab('salaries')}
            className="inline-flex items-center px-3 py-2 border border-indigo-200 rounded-lg shadow-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
          >
            <Users className="-ml-0.5 mr-1.5 h-4 w-4 text-indigo-600" />
            + Staff Salary
          </button>
          <button
            onClick={() => setActiveTab('accruals')}
            className="inline-flex items-center px-3 py-2 border border-amber-200 rounded-lg shadow-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
          >
            <Clock className="-ml-0.5 mr-1.5 h-4 w-4 text-amber-600" />
            + Accrual Entry
          </button>
          <button
            onClick={() => handleOpenAddForm('Expense')}
            className="inline-flex items-center px-3.5 py-2 border border-transparent rounded-lg shadow-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors shadow-2xs"
            style={{
              backgroundColor: accentColor,
              fontSize: `${elementFontSizes.buttonText}px`,
            }}
          >
            <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
            Add Transaction
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            style={{ fontSize: `${elementFontSizes.buttonText}px` }}
          >
            <Download className="-ml-0.5 mr-1.5 h-4 w-4 text-gray-500" />
            Export to Excel
          </button>
        </div>
      </div>
      
      {/* Live Liquidity Overview Banner: Bank vs Cash */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bank Balance Card */}
        <div className="bg-white rounded-xl border border-blue-200/90 shadow-xs p-4 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Balance</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Bank Accounts & UPI</span>
              </div>
              <div className="text-2xl font-extrabold text-blue-900 mt-0.5 font-mono tabular-nums">
                ₹{rp.bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Receipts: ₹{rp.bankReceipts.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Payments: ₹{rp.bankPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenCashWithdrawalModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition-colors shrink-0"
            title="Withdraw Cash from Bank to Physical Cash Drawer (Contra Entry)"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-700" />
            Withdraw Cash
          </button>
        </div>

        {/* Cash Balance Card */}
        <div className="bg-white rounded-xl border border-emerald-200/90 shadow-xs p-4 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cash Balance</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Physical Cash in Hand</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-900 mt-0.5 font-mono tabular-nums">
                ₹{rp.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Receipts: ₹{rp.cashReceipts.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Payments: ₹{rp.cashPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenCashDepositModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors shrink-0"
            title="Convert Cash in Hand to Bank Account (Contra Entry)"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-700" />
            Deposit to Bank
          </button>
        </div>

        {/* Total Combined Liquid Funds */}
        <div className="bg-white rounded-xl border border-indigo-200/90 shadow-xs p-4 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Liquid Funds</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Bank + Cash Combined</span>
              </div>
              <div className="text-2xl font-extrabold text-indigo-900 mt-0.5 font-mono tabular-nums">
                ₹{rp.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Total Inflows: ₹{rp.totalReceipts.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Total Outflows: ₹{rp.totalPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`${
              activeTab === 'dashboard'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <TrendingUp className="h-4 w-4" />
            Overview & Trends
          </button>
          <button
            onClick={() => setActiveTab('pnl')}
            className={`${
              activeTab === 'pnl'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Scale className="h-4 w-4" />
            Profit & Loss (P&L)
          </button>
          <button
            onClick={() => setActiveTab('balance')}
            className={`${
              activeTab === 'balance'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Building className="h-4 w-4" />
            Balance Sheet & Assets
            {bs.assetTransactions.length > 0 && (
              <span className="ml-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                {bs.assetTransactions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`${
              activeTab === 'ledger'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <BookOpen className="h-4 w-4 text-indigo-600" />
            Ledger Wise Report
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`${
              activeTab === 'accounts'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Layers className="h-4 w-4 text-indigo-600" />
            Chart of Accounts
            {accountsList.length > 0 && (
              <span className="ml-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                {accountsList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`${
              activeTab === 'partners'
                ? 'border-purple-600 text-purple-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Users className="h-4 w-4 text-purple-600" />
            Partner Capital
            {bs.partnerInvestments.length > 0 && (
              <span className="ml-1 bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-200">
                {bs.partnerInvestments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`${
              activeTab === 'receipts'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Layers className="h-4 w-4" />
            Receipts & Payments
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`${
              activeTab === 'cashflow'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <DollarSign className="h-4 w-4" />
            Cash Flow
          </button>
          <button
            onClick={() => setActiveTab('salaries')}
            className={`${
              activeTab === 'salaries'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Users className="h-4 w-4 text-indigo-600" />
            Staff Salaries
            {salariesList.filter(s => s.status !== 'Paid' && s.status !== 'Advance').length > 0 && (
              <span className="ml-1 bg-rose-50 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold border border-rose-200">
                {salariesList.filter(s => s.status !== 'Paid' && s.status !== 'Advance').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('accruals')}
            className={`${
              activeTab === 'accruals'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Clock className="h-4 w-4 text-amber-600" />
            Accruals & Payables
            {accrualsList.filter(a => a.status !== 'Settled').length > 0 && (
              <span className="ml-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold border border-amber-200">
                {accrualsList.filter(a => a.status !== 'Settled').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`${
              activeTab === 'financial'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <Landmark className="h-4 w-4 text-emerald-600" />
            Financial Details
          </button>
        </nav>
      </div>

      {/* ADD TRANSACTION / ASSET FORM MODAL */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowAddForm(false)}>
              <div className="absolute inset-0 bg-gray-600 opacity-60"></div>
            </div>
            
            <div className="relative z-10 w-full max-w-2xl transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all">
              <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <h3 className="text-lg font-bold">Record Transaction / Purchase</h3>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-white hover:text-indigo-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddTransactionSubmit} className="p-6 space-y-6">
                {/* 1. Purchase Classification Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Transaction & Purchase Classification
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormTransactionType('Expense');
                        setFormPurchaseType('Expense');
                        setFormData(p => ({ ...p, category: EXPENSE_CATEGORIES[0] }));
                      }}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formTransactionType === 'Expense' && formPurchaseType === 'Expense'
                          ? 'border-red-500 bg-red-50 ring-2 ring-red-400'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">Operating Expense</span>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="text-[11px] text-gray-500 mt-1">Consumables, rent, utility bills</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormTransactionType('Asset');
                        setFormPurchaseType('Asset');
                        setFormData(p => ({ ...p, category: ASSET_CATEGORIES[0], assetCategory: ASSET_CATEGORIES[0] }));
                      }}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formPurchaseType === 'Asset' || formTransactionType === 'Asset'
                          ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900">Capital Asset</span>
                        <Package className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="text-[11px] text-indigo-700 mt-1">Therapy equipment, furniture, IT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormTransactionType('Deposit');
                        setFormPurchaseType('Deposit');
                        setFormData(p => ({
                          ...p,
                          category: SECURITY_DEPOSIT_CATEGORIES[0],
                          depositCategory: SECURITY_DEPOSIT_CATEGORIES[0]
                        }));
                      }}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formTransactionType === 'Deposit' || formPurchaseType === 'Deposit'
                          ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-900">Security Deposit</span>
                        <ShieldCheck className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="text-[11px] text-teal-700 mt-1">Premises lease, meter, current asset</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormTransactionType('Investment');
                        setFormPurchaseType('Investment');
                        setFormData(p => ({
                          ...p,
                          category: PARTNER_INVESTMENT_CATEGORIES[0],
                          paymentMode: PAYMENT_MODES[0]
                        }));
                      }}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formTransactionType === 'Investment'
                          ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-900">Partner Capital</span>
                        <Users className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-[11px] text-purple-700 mt-1">Capital contribution & equity</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormTransactionType('Income');
                        setFormData(p => ({ ...p, category: INCOME_CATEGORIES[0] }));
                      }}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formTransactionType === 'Income'
                          ? 'border-green-500 bg-green-50 ring-2 ring-green-400'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">Other Income</span>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-[11px] text-gray-500 mt-1">Grants, sponsorships, inflows</span>
                    </button>
                  </div>
                </div>

                {/* Common Fields: Date and Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date of Transaction</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="e.g. 50000"
                      required
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                    />
                  </div>
                </div>

                {/* DYNAMIC SECTION: PARTNER INVESTMENT, CAPITAL ASSET, OR OPERATING EXPENSE/INCOME */}
                {formTransactionType === 'Investment' ? (
                  <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200 space-y-4">
                    <div className="flex items-center space-x-2 border-b border-purple-200/60 pb-2">
                      <Users className="h-5 w-5 text-purple-700" />
                      <h4 className="text-sm font-bold text-purple-900 uppercase tracking-wide">
                        Partner Investment Details
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Partner Name *</label>
                        <input
                          type="text"
                          required
                          list="partner-name-suggestions"
                          placeholder="e.g. Dr. Alby Mathew"
                          value={formData.partnerName}
                          onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                        />
                        <datalist id="partner-name-suggestions">
                          {knownPartnerNames.map(name => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                        {knownPartnerNames.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] text-gray-500">Known partners:</span>
                            {knownPartnerNames.map(name => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setFormData({ ...formData, partnerName: name })}
                                className="text-[11px] bg-purple-100 hover:bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-medium transition-colors"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Payment Mode / Channel *</label>
                        <select
                          value={formData.paymentMode}
                          onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                        >
                          {PAYMENT_MODES.map(mode => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">Investment Category / Head</label>
                        <select
                          value={formData.category}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                        >
                          {PARTNER_INVESTMENT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">Notes / Reference (Cheque No., Bank Reference, Purpose)</label>
                        <input
                          type="text"
                          placeholder="e.g. Chq #482910, capital for sensory gym upgrade"
                          value={formData.description}
                          onChange={e => setFormData({ ...formData, description: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                        />
                      </div>
                    </div>
                  </div>
                ) : (formPurchaseType === 'Deposit' || formTransactionType === 'Deposit') ? (
                  <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="h-5 w-5 text-teal-700" />
                        <h4 className="text-sm font-bold text-teal-900 uppercase tracking-wide">
                          Security Deposit Details (Current Asset)
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full border border-teal-200">
                        Refundable Current Asset • Account #1300
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Deposit Category / Head *</label>
                        <select
                          value={formData.depositCategory}
                          onChange={e => setFormData({ ...formData, depositCategory: e.target.value, category: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        >
                          {SECURITY_DEPOSIT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Payee / Landlord / Authority *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Building Landlord, Electricity Board, Water Authority"
                          value={formData.payeeName}
                          onChange={e => setFormData({ ...formData, payeeName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Premises / Facility / Consumer Ref</label>
                        <input
                          type="text"
                          placeholder="e.g. Main Child Care Centre Building, Meter #11420"
                          value={formData.premisesOrAccount}
                          onChange={e => setFormData({ ...formData, premisesOrAccount: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Payment Mode / Channel *</label>
                        <select
                          value={formData.paymentMode}
                          onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        >
                          {PAYMENT_MODES.map(mode => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Lease Deed / Agreement / Ref #</label>
                        <input
                          type="text"
                          placeholder="e.g. Lease Agreement Reg #248/2026 or Dep-2026-01"
                          value={formData.referenceNumber}
                          onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700">Tenure / Lease Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 3-Year Commercial Lease (Refundable on Vacating)"
                          value={formData.termsOrDuration}
                          onChange={e => setFormData({ ...formData, termsOrDuration: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">Description / Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. Refundable caution deposit paid via bank transfer to property owner"
                          value={formData.description}
                          onChange={e => setFormData({ ...formData, description: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border"
                        />
                      </div>

                      <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-teal-200/80 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="deposit-refundable"
                            checked={formData.refundable}
                            onChange={e => setFormData({ ...formData, refundable: e.target.checked })}
                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                          />
                          <label htmlFor="deposit-refundable" className="text-xs font-semibold text-gray-800 cursor-pointer">
                            Refundable Security Deposit (Reported under Current Assets on Balance Sheet)
                          </label>
                        </div>
                        <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          Chart of Accounts: #1300
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (formPurchaseType === 'Asset' || formTransactionType === 'Asset') ? (
                  <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 space-y-4">
                    <div className="flex items-center space-x-2 border-b border-indigo-200/60 pb-2">
                      <Package className="h-5 w-5 text-indigo-700" />
                      <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
                        Asset Details (Capitalized on Balance Sheet)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">Asset Name / Title *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sensory Vestibular Swing & Suspension Kit"
                          value={formData.assetName}
                          onChange={e => setFormData({ ...formData, assetName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700">Asset Category *</label>
                        <select
                          value={formData.assetCategory}
                          onChange={e => setFormData({ ...formData, assetCategory: e.target.value, category: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        >
                          {ASSET_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700">Centre Location / Room</label>
                        <input
                          type="text"
                          placeholder="e.g. Sensory Gym, OT Room 1, Speech Lab"
                          value={formData.locationOrRoom}
                          onChange={e => setFormData({ ...formData, locationOrRoom: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700">Expected Useful Life (Years)</label>
                        <select
                          value={formData.usefulLifeYears}
                          onChange={e => setFormData({ ...formData, usefulLifeYears: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        >
                          <option value="1">1 Year</option>
                          <option value="2">2 Years</option>
                          <option value="3">3 Years</option>
                          <option value="5">5 Years (Standard)</option>
                          <option value="7">7 Years</option>
                          <option value="10">10 Years</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700">Asset Condition</label>
                        <select
                          value={formData.condition}
                          onChange={e => setFormData({ ...formData, condition: e.target.value as any })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        >
                          <option value="Brand New">Brand New</option>
                          <option value="Good">Good / Like New</option>
                          <option value="Refurbished">Refurbished</option>
                          <option value="Fair">Fair</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700">Serial Number / Asset Tag (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. SN-883921 / OT-SW-01"
                          value={formData.serialNumber}
                          onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700">Supplier / Warranty / Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. 2-yr warranty from SensoryCare India"
                          value={formData.assetNotes}
                          onChange={e => setFormData({ ...formData, assetNotes: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* OPERATING EXPENSE OR INCOME DETAILS */
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                          {formTransactionType === 'Income' ? 'Income Category' : 'Expense Category'} *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomCategoryDefaultType(formTransactionType === 'Income' ? 'Income' : 'Expense');
                            setShowCustomCategoryModal(true);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                        >
                          <Plus className="w-3 h-3 inline" />
                          <span>New Category</span>
                        </button>
                      </div>
                      <select
                        required
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white"
                      >
                        {(formTransactionType === 'Income' 
                          ? Array.from(new Set([...INCOME_CATEGORIES, ...customCategoriesList.filter(c => c.type === 'Income').map(c => c.name)]))
                          : Array.from(new Set([...EXPENSE_CATEGORIES, ...customCategoriesList.filter(c => c.type === 'Expense').map(c => c.name)]))
                        ).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                          General Ledger Account (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomLedgerDefaultType(formTransactionType === 'Income' ? 'Revenue' : 'Expense');
                            setShowCustomLedgerModal(true);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                        >
                          <Plus className="w-3 h-3 inline" />
                          <span>New Ledger Head</span>
                        </button>
                      </div>
                      <select
                        value={formData.ledgerAccountCode}
                        onChange={e => setFormData({ ...formData, ledgerAccountCode: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                      >
                        <option value="">-- Auto-select from Category --</option>
                        {accountsList
                          .filter(a => formTransactionType === 'Income' ? a.type === 'Revenue' : a.type === 'Expense')
                          .map(a => (
                            <option key={a.code} value={a.code}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Payment Mode / Channel</label>
                        <select
                          value={formData.paymentMode}
                          onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        >
                          {PAYMENT_MODES.map(mode => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Ref / Bill / Cheque # (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Inv #9921, Cheque #48201"
                          value={formData.referenceNumber}
                          onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description / Payee (Paid To)</label>
                      <input
                        type="text"
                        placeholder="e.g. Electricity bill for main campus, therapy playdough batch"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Save {formPurchaseType === 'Deposit' || formTransactionType === 'Deposit' ? 'Security Deposit' : (formPurchaseType === 'Asset' || formTransactionType === 'Asset' ? 'Asset Purchase' : (formTransactionType === 'Investment' ? 'Partner Investment' : 'Transaction'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ASSET DETAILS MODAL */}
      {viewAssetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setViewAssetModal(null)}>
              <div className="absolute inset-0 bg-gray-600 opacity-60"></div>
            </div>
            
            <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all">
              <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <h3 className="text-lg font-bold">Capital Asset Details</h3>
                </div>
                <button onClick={() => setViewAssetModal(null)} className="text-white hover:text-indigo-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="border-b border-gray-200 pb-4">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 mb-1">
                    {viewAssetModal.assetDetails?.category || viewAssetModal.category}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewAssetModal.assetDetails?.assetName || viewAssetModal.description || viewAssetModal.category}
                  </h2>
                  <p className="text-2xl font-extrabold text-indigo-600 mt-2">
                    ₹{viewAssetModal.amount.toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs">Acquisition Date</span>
                    <span className="font-semibold text-gray-900">{formatDate(viewAssetModal.date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Centre Location</span>
                    <span className="font-semibold text-gray-900">{viewAssetModal.assetDetails?.locationOrRoom || 'Main Facility'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Useful Life</span>
                    <span className="font-semibold text-gray-900">{viewAssetModal.assetDetails?.usefulLifeYears || 5} Years</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Asset Condition</span>
                    <span className="font-semibold text-gray-900">{viewAssetModal.assetDetails?.condition || 'Good'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Serial Number / Tag</span>
                    <span className="font-semibold text-gray-900">{viewAssetModal.assetDetails?.serialNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Accounting Status</span>
                    <span className="inline-flex items-center text-green-700 font-semibold text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Capitalized on Balance Sheet
                    </span>
                  </div>
                </div>

                {(viewAssetModal.assetDetails?.notes || viewAssetModal.description) && (
                  <div className="bg-gray-50 p-3 rounded-md text-xs text-gray-600 mt-4 border border-gray-200">
                    <strong className="block text-gray-700 mb-1">Description / Notes:</strong>
                    {viewAssetModal.assetDetails?.notes || viewAssetModal.description}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setViewAssetModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tx = viewAssetModal;
                    setViewAssetModal(null);
                    setSelectedVoucherTx(tx);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  Print Payment Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW SECURITY DEPOSIT DETAILS MODAL */}
      {viewDepositModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setViewDepositModal(null)}>
              <div className="absolute inset-0 bg-gray-600 opacity-60"></div>
            </div>
            
            <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all">
              <div className="bg-teal-700 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-5 w-5 text-teal-200" />
                  <h3 className="text-lg font-bold">Security Deposit Details (Current Asset)</h3>
                </div>
                <button onClick={() => setViewDepositModal(null)} className="text-white hover:text-teal-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
                      {viewDepositModal.depositDetails?.depositCategory || viewDepositModal.category}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                      Account #1300
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewDepositModal.depositDetails?.payeeName || viewDepositModal.description || 'Landlord / Authority'}
                  </h2>
                  <p className="text-2xl font-extrabold text-teal-700 mt-2 font-mono">
                    ₹{viewDepositModal.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs">Date Paid</span>
                    <span className="font-semibold text-gray-900">{formatDate(viewDepositModal.date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Premises / Facility</span>
                    <span className="font-semibold text-gray-900">{viewDepositModal.depositDetails?.premisesOrAccount || 'Main Facility'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Payment Mode</span>
                    <span className="font-semibold text-gray-900">{viewDepositModal.paymentMode || 'Bank Transfer'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Reference / Agreement #</span>
                    <span className="font-semibold text-gray-900">{viewDepositModal.depositDetails?.referenceNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Tenure / Duration</span>
                    <span className="font-semibold text-gray-900">{viewDepositModal.depositDetails?.termsOrDuration || 'Refundable on Exit'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Accounting Classification</span>
                    <span className="inline-flex items-center text-teal-700 font-semibold text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Current Asset (Refundable)
                    </span>
                  </div>
                </div>

                {(viewDepositModal.depositDetails?.notes || viewDepositModal.description) && (
                  <div className="bg-gray-50 p-3 rounded-md text-xs text-gray-600 mt-4 border border-gray-200">
                    <strong className="block text-gray-700 mb-1">Description / Conditions:</strong>
                    {viewDepositModal.depositDetails?.notes || viewDepositModal.description}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setViewDepositModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tx = viewDepositModal;
                    setViewDepositModal(null);
                    setSelectedVoucherTx(tx);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  Print Payment Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROFIT & LOSS (P&L) STATEMENT */}
      {activeTab === 'pnl' && (
        <div className="space-y-8">
          {/* Controls Bar: Period Filter + Print */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Scale className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Profit & Loss Statement (Income Statement)</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Period: <span className="font-semibold text-gray-800">{pnl.periodLabel}</span> • Accrual accounting reflecting Operating Revenues, Overheads, and Asset Depreciation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="inline-flex bg-gray-100 p-1 rounded-lg text-xs font-medium text-gray-600">
                <button
                  onClick={() => setPnlPeriod('this_month')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${pnlPeriod === 'this_month' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setPnlPeriod('last_month')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${pnlPeriod === 'last_month' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  Last Month
                </button>
                <button
                  onClick={() => setPnlPeriod('this_quarter')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${pnlPeriod === 'this_quarter' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  Quarter
                </button>
                <button
                  onClick={() => setPnlPeriod('ytd')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${pnlPeriod === 'ytd' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  YTD (Apr - Mar)
                </button>
                <button
                  onClick={() => setPnlPeriod('all_time')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${pnlPeriod === 'all_time' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setPnlPeriod('custom')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${pnlPeriod === 'custom' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  Custom
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                title="Print P&L Statement"
              >
                <Printer className="w-3.5 h-3.5 mr-1 text-gray-500" />
                Print
              </button>
            </div>
          </div>

          {/* Custom Date Range Picker when active */}
          {pnlPeriod === 'custom' && (
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-indigo-900 flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 text-indigo-600" />
                Select Custom Date Range:
              </span>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">From:</label>
                <input
                  type="date"
                  value={pnlCustomStart}
                  onChange={(e) => setPnlCustomStart(e.target.value)}
                  className="border border-gray-300 rounded-md px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">To:</label>
                <input
                  type="date"
                  value={pnlCustomEnd}
                  onChange={(e) => setPnlCustomEnd(e.target.value)}
                  className="border border-gray-300 rounded-md px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* P&L Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Operating Revenue */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Operating Revenue</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900">₹{pnl.totalRevenue.toLocaleString()}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-gray-500">Tuition: ₹{pnl.tuitionRevenue.toLocaleString()}</span>
                  {pnl.revenueGrowth !== 0 && (
                    <span className={`inline-flex items-center font-semibold ${pnl.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pnl.revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                      {Math.abs(pnl.revenueGrowth).toFixed(1)}% vs prior
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Operating Expenses */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operating Expenses</span>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900">₹{pnl.totalOperatingExpenses.toLocaleString()}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-gray-500">{pnl.expenseRatio.toFixed(1)}% expense ratio</span>
                  {pnl.expenseGrowth !== 0 && (
                    <span className={`inline-flex items-center font-semibold ${pnl.expenseGrowth <= 0 ? 'text-emerald-600' : 'text-orange-500'}`}>
                      {pnl.expenseGrowth > 0 ? '+' : ''}{pnl.expenseGrowth.toFixed(1)}% vs prior
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Operating Profit (EBITDA) */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operating Profit (EBITDA)</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-bold ${pnl.operatingProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  ₹{pnl.operatingProfit.toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-gray-500">Op. Margin: <strong className="text-gray-700">{pnl.operatingMargin.toFixed(1)}%</strong></span>
                  <span className="text-gray-400">Pre-depreciation</span>
                </div>
              </div>
            </div>

            {/* Card 4: Net Profit / Surplus */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Profit / Surplus</span>
                <div className={`p-2 rounded-lg ${pnl.netProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-bold ${pnl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{Math.round(pnl.netProfit).toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-gray-500">Net Margin: <strong className="text-gray-700">{pnl.netProfitMargin.toFixed(1)}%</strong></span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${pnl.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {pnl.netProfit >= 0 ? 'Surplus' : 'Deficit'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Charts: P&L Comparison & Cost Structure */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: P&L Structure Breakdown */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-base font-bold text-gray-900 mb-1">Financial Performance Summary</h3>
              <p className="text-xs text-gray-500 mb-4">Revenue vs Overheads vs Depreciation vs Net Result</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Revenue', amount: pnl.totalRevenue, fill: '#10b981' },
                      { name: 'Operating Exp', amount: pnl.totalOperatingExpenses, fill: '#ef4444' },
                      { name: 'Op. Profit', amount: pnl.operatingProfit, fill: '#6366f1' },
                      { name: 'Depreciation', amount: Math.round(pnl.totalDepreciation), fill: '#f59e0b' },
                      { name: 'Net Profit', amount: Math.round(pnl.netProfit), fill: pnl.netProfit >= 0 ? '#059669' : '#dc2626' }
                    ]}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {[
                        { fill: '#10b981' },
                        { fill: '#ef4444' },
                        { fill: '#6366f1' },
                        { fill: '#f59e0b' },
                        { fill: pnl.netProfit >= 0 ? '#059669' : '#dc2626' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Operating Expense Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-base font-bold text-gray-900 mb-1">Operating Overheads Breakdown</h3>
              <p className="text-xs text-gray-500 mb-4">Proportionate distribution of operational expenditure</p>
              {Object.keys(pnl.expensesByCategory).length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
                  <FileText className="w-8 h-8 mb-2 opacity-40" />
                  No operating expense records in this period.
                </div>
              ) : (
                <div className="h-64 flex flex-col md:flex-row items-center justify-center">
                  <div className="w-full md:w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(pnl.expensesByCategory).map(([name, data]) => ({ name, value: data.total }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          dataKey="value"
                        >
                          {Object.entries(pnl.expensesByCategory).map((_, index) => (
                            <Cell key={`pnl-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Expense']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 max-h-56 overflow-y-auto pl-2 space-y-1.5 text-xs">
                    {Object.entries(pnl.expensesByCategory).map(([cat, data], idx) => {
                      const pct = pnl.totalOperatingExpenses > 0 ? (data.total / pnl.totalOperatingExpenses) * 100 : 0;
                      return (
                        <div key={cat} className="flex items-center justify-between py-1 border-b border-gray-50">
                          <div className="flex items-center space-x-1.5 truncate mr-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-gray-700 truncate" title={cat}>{cat}</span>
                          </div>
                          <span className="font-semibold text-gray-900 whitespace-nowrap">
                            ₹{data.total.toLocaleString()} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Formal Accounting Profit & Loss Statement Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-900 to-indigo-950 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Statement of Profit and Loss</h3>
                <p className="text-xs text-indigo-200 mt-1">
                  For the Period: <span className="text-white font-semibold">{pnl.periodLabel}</span> ({pnl.startDate} to {pnl.endDate})
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-indigo-300 block">Net Financial Position</span>
                <span className={`text-xl font-extrabold ${pnl.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl.netProfit >= 0 ? '+' : '-'}₹{Math.abs(Math.round(pnl.netProfit)).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 text-left">Particulars / Account Head</th>
                    <th className="py-3 px-4 text-center">Schedule / Count</th>
                    <th className="py-3 px-4 text-right">% of Revenue</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {/* SCHEDULE 1: OPERATING REVENUES */}
                  <tr className="bg-gray-100/70">
                    <td colSpan={4} className="py-2.5 px-4 font-bold text-gray-900 text-xs uppercase tracking-wider">
                      Schedule 1: Operating Revenues & Incomes
                    </td>
                  </tr>

                  {/* Tuition Fee Breakdown */}
                  {Object.entries(pnl.feesByType).map(([feeType, amt]) => {
                    const pct = pnl.totalRevenue > 0 ? (amt / pnl.totalRevenue) * 100 : 0;
                    return (
                      <tr key={feeType} className="hover:bg-gray-50/80">
                        <td className="py-2.5 px-4 pl-8 text-gray-700 font-medium">
                          Tuition Fees: {feeType}
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs text-gray-500">Student Receipts</td>
                        <td className="py-2.5 px-4 text-right text-xs text-gray-500">{pct.toFixed(1)}%</td>
                        <td className="py-2.5 px-4 text-right font-medium text-emerald-700">₹{amt.toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  {/* Other Incomes */}
                  {Object.entries(pnl.otherIncomesByCategory).map(([cat, amt]) => {
                    const pct = pnl.totalRevenue > 0 ? (amt / pnl.totalRevenue) * 100 : 0;
                    return (
                      <tr key={cat} className="hover:bg-gray-50/80">
                        <td className="py-2.5 px-4 pl-8 text-gray-700 font-medium">
                          Other Income: {cat}
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs text-gray-500">Other Receipt</td>
                        <td className="py-2.5 px-4 text-right text-xs text-gray-500">{pct.toFixed(1)}%</td>
                        <td className="py-2.5 px-4 text-right font-medium text-emerald-700">₹{amt.toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  {pnl.totalRevenue === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 px-4 pl-8 text-xs text-gray-400 italic">No revenue recorded for this period.</td>
                    </tr>
                  )}

                  {/* Subtotal: Total Revenue */}
                  <tr className="bg-emerald-50/60 font-bold border-t border-b border-emerald-200">
                    <td className="py-3 px-4 text-emerald-950 font-bold">TOTAL OPERATING REVENUE (A)</td>
                    <td className="py-3 px-4 text-center text-xs text-emerald-800">Gross Inflow</td>
                    <td className="py-3 px-4 text-right text-xs text-emerald-800">100.0%</td>
                    <td className="py-3 px-4 text-right text-emerald-700 text-base font-extrabold">₹{pnl.totalRevenue.toLocaleString()}</td>
                  </tr>

                  {/* SCHEDULE 2: OPERATING EXPENSES */}
                  <tr className="bg-gray-100/70">
                    <td colSpan={4} className="py-2.5 px-4 font-bold text-gray-900 text-xs uppercase tracking-wider">
                      Schedule 2: Operating Overheads & Operational Costs
                    </td>
                  </tr>

                  {Object.entries(pnl.expensesByCategory).map(([cat, data]) => {
                    const pctOfRev = pnl.totalRevenue > 0 ? (data.total / pnl.totalRevenue) * 100 : 0;
                    return (
                      <tr key={cat} className="hover:bg-gray-50/80">
                        <td className="py-2.5 px-4 pl-8 text-gray-700 font-medium">
                          {cat}
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs text-gray-500">{data.count} items</td>
                        <td className="py-2.5 px-4 text-right text-xs text-gray-500">{pctOfRev.toFixed(1)}%</td>
                        <td className="py-2.5 px-4 text-right font-medium text-red-600">₹{data.total.toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  {Object.keys(pnl.expensesByCategory).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 px-4 pl-8 text-xs text-gray-400 italic">No operational expenses recorded for this period.</td>
                    </tr>
                  )}

                  {/* Subtotal: Total Operating Expenses */}
                  <tr className="bg-red-50/60 font-bold border-t border-b border-red-200">
                    <td className="py-3 px-4 text-red-950 font-bold">TOTAL OPERATING EXPENSES (B)</td>
                    <td className="py-3 px-4 text-center text-xs text-red-800">Overhead Outflows</td>
                    <td className="py-3 px-4 text-right text-xs text-red-800">{pnl.expenseRatio.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-red-600 text-base font-extrabold">₹{pnl.totalOperatingExpenses.toLocaleString()}</td>
                  </tr>

                  {/* OPERATING PROFIT / EBITDA */}
                  <tr className="bg-indigo-50/70 font-bold border-t-2 border-b-2 border-indigo-200">
                    <td className="py-3.5 px-4 text-indigo-950 font-bold text-sm">
                      OPERATING PROFIT / EBITDA (A - B)
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs text-indigo-800">Operating Core</td>
                    <td className="py-3.5 px-4 text-right text-xs text-indigo-800">{pnl.operatingMargin.toFixed(1)}% Margin</td>
                    <td className={`py-3.5 px-4 text-right text-base font-extrabold ${pnl.operatingProfit >= 0 ? 'text-indigo-800' : 'text-red-700'}`}>
                      ₹{pnl.operatingProfit.toLocaleString()}
                    </td>
                  </tr>

                  {/* SCHEDULE 3: DEPRECIATION OF FIXED CAPITAL ASSETS */}
                  <tr className="bg-gray-100/70">
                    <td colSpan={4} className="py-2.5 px-4 font-bold text-gray-900 text-xs uppercase tracking-wider">
                      Schedule 3: Depreciation of Fixed Capital Assets (Straight-Line)
                    </td>
                  </tr>

                  {Object.entries(pnl.depreciationByAssetCategory).map(([cat, data]) => {
                    const depRounded = Math.round(data.depreciation);
                    const pctOfRev = pnl.totalRevenue > 0 ? (depRounded / pnl.totalRevenue) * 100 : 0;
                    return (
                      <tr key={cat} className="hover:bg-gray-50/80">
                        <td className="py-2.5 px-4 pl-8 text-gray-700 font-medium">
                          {cat} <span className="text-gray-400 text-xs">(Cost: ₹{data.totalCost.toLocaleString()})</span>
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs text-gray-500">{data.count} assets</td>
                        <td className="py-2.5 px-4 text-right text-xs text-gray-500">{pctOfRev.toFixed(1)}%</td>
                        <td className="py-2.5 px-4 text-right font-medium text-amber-700">₹{depRounded.toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  {Object.keys(pnl.depreciationByAssetCategory).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 px-4 pl-8 text-xs text-gray-400 italic">No depreciable capital assets recorded.</td>
                    </tr>
                  )}

                  {/* Subtotal: Total Depreciation */}
                  <tr className="bg-amber-50/60 font-bold border-t border-b border-amber-200">
                    <td className="py-3 px-4 text-amber-950 font-bold">TOTAL CAPITAL ASSET DEPRECIATION (C)</td>
                    <td className="py-3 px-4 text-center text-xs text-amber-800">Non-Cash Expense</td>
                    <td className="py-3 px-4 text-right text-xs text-amber-800">
                      {pnl.totalRevenue > 0 ? ((pnl.totalDepreciation / pnl.totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="py-3 px-4 text-right text-amber-700 text-base font-extrabold">₹{Math.round(pnl.totalDepreciation).toLocaleString()}</td>
                  </tr>

                  {/* FINAL RESULT: NET PROFIT / NET SURPLUS (LOSS) */}
                  <tr className={`font-black text-base border-t-4 border-b-4 ${pnl.netProfit >= 0 ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950' : 'bg-red-100/90 border-red-400 text-red-950'}`}>
                    <td className="py-4 px-4 font-black">
                      NET PROFIT / SURPLUS (LOSS) FOR THE PERIOD [A - B - C]
                    </td>
                    <td className="py-4 px-4 text-center text-xs font-bold uppercase">
                      {pnl.netProfit >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
                    </td>
                    <td className="py-4 px-4 text-right text-xs font-bold">
                      {pnl.netProfitMargin.toFixed(1)}% Net Margin
                    </td>
                    <td className={`py-4 px-4 text-right text-xl font-black ${pnl.netProfit >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      ₹{Math.round(pnl.netProfit).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Health & Accounting Advisory Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Health 1: Break-even Analysis */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm mb-2">
                <Scale className="h-4 w-4" />
                <h4>Break-Even Safety Analysis</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Minimum revenue needed in this period to cover operational expenses and overheads.
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-600 font-medium">Target Revenue:</span>
                <span className="text-base font-bold text-gray-900">₹{pnl.totalOperatingExpenses.toLocaleString()}</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${pnl.totalRevenue >= pnl.totalOperatingExpenses ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, pnl.totalOperatingExpenses > 0 ? (pnl.totalRevenue / pnl.totalOperatingExpenses) * 100 : 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {pnl.totalRevenue >= pnl.totalOperatingExpenses
                  ? `Safety buffer: ₹${(pnl.totalRevenue - pnl.totalOperatingExpenses).toLocaleString()} surplus over breakeven.`
                  : `Deficit buffer: ₹${(pnl.totalOperatingExpenses - pnl.totalRevenue).toLocaleString()} below operational break-even.`}
              </p>
            </div>

            {/* Health 2: Operational Burn Rate */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 text-amber-700 font-bold text-sm mb-2">
                <TrendingDown className="h-4 w-4" />
                <h4>Expense Burn Rate</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Average monthly and daily operational overhead spend rate.
              </p>
              <div className="flex items-baseline justify-between text-xs py-1 border-b border-gray-100">
                <span className="text-gray-600">Monthly Run Rate:</span>
                <span className="font-bold text-gray-900">₹{Math.round(pnl.totalOperatingExpenses / pnl.monthsInPeriod).toLocaleString()}/mo</span>
              </div>
              <div className="flex items-baseline justify-between text-xs py-1 mt-1">
                <span className="text-gray-600">Daily Average Spend:</span>
                <span className="font-bold text-gray-900">₹{Math.round(pnl.totalOperatingExpenses / (pnl.monthsInPeriod * 30)).toLocaleString()}/day</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Covers centre rent, utilities, consumables, play/learning materials, and general supplies.
              </p>
            </div>

            {/* Health 3: Top Cost Center Driver */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 text-rose-700 font-bold text-sm mb-2">
                <PieChartIcon className="h-4 w-4" />
                <h4>Top Expense Driver</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Single largest expenditure category impacting profitability.
              </p>
              {(() => {
                const entries = Object.entries(pnl.expensesByCategory).sort((a, b) => b[1].total - a[1].total);
                if (entries.length === 0) {
                  return <p className="text-xs text-gray-400 italic">No operational overheads logged.</p>;
                }
                const top = entries[0];
                const topPct = pnl.totalOperatingExpenses > 0 ? (top[1].total / pnl.totalOperatingExpenses) * 100 : 0;
                return (
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-900">{top[0]}</span>
                      <span className="font-bold text-rose-600">₹{top[1].total.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-rose-500" style={{ width: `${topPct}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                      Accounts for <strong className="text-gray-700">{topPct.toFixed(1)}%</strong> of all overheads in this period.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5 sm:gap-4 mb-8">
            {/* Month's Income */}
            <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs hover:border-green-300 transition-colors flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className="font-bold text-gray-500 uppercase tracking-wider leading-tight whitespace-normal"
                  style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
                >
                  Month's Income
                </span>
                <div className="p-1.5 bg-green-50 text-green-600 rounded-lg shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div
                className="mt-2.5 font-extrabold text-gray-950 font-mono tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar"
                style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
                title={`₹${currentMonthIncome.toLocaleString('en-IN')}`}
              >
                ₹{currentMonthIncome.toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-gray-400 font-medium mt-1 whitespace-normal">Fees collected</span>
            </div>

            {/* Expenses */}
            <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs hover:border-red-300 transition-colors flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className="font-bold text-gray-500 uppercase tracking-wider leading-tight whitespace-normal"
                  style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
                >
                  Operating Expenses
                </span>
                <div className="p-1.5 bg-red-50 text-red-600 rounded-lg shrink-0">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </div>
              <div
                className="mt-2.5 font-extrabold text-red-700 font-mono tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar"
                style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
                title={`₹${currentMonthExpense.toLocaleString('en-IN')}`}
              >
                ₹{currentMonthExpense.toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-gray-400 font-medium mt-1 whitespace-normal">Operating costs</span>
            </div>

            {/* Operating Profit */}
            <div className={`bg-white rounded-xl p-4 border shadow-xs transition-colors flex flex-col justify-between min-w-0 ${
              profit >= 0 ? 'border-emerald-200/80 hover:border-emerald-300' : 'border-orange-200/80 hover:border-orange-300'
            }`}>
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className="font-bold text-gray-500 uppercase tracking-wider leading-tight whitespace-normal"
                  style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
                >
                  Operating Profit
                </span>
                <div className={`p-1.5 rounded-lg shrink-0 ${profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div
                className={`mt-2.5 font-extrabold font-mono tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar ${
                  profit >= 0 ? 'text-emerald-700' : 'text-orange-700'
                }`}
                style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
                title={profit >= 0 ? `₹${profit.toLocaleString('en-IN')}` : `-₹${Math.abs(profit).toLocaleString('en-IN')}`}
              >
                {profit >= 0 ? `₹${profit.toLocaleString('en-IN')}` : `-₹${Math.abs(profit).toLocaleString('en-IN')}`}
              </div>
              <span className={`text-[11px] font-medium mt-1 whitespace-normal ${profit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {profit >= 0 ? 'Operating surplus' : 'Operating deficit'}
              </span>
            </div>

            {/* Bank Balance */}
            <div className="bg-white rounded-xl p-4 border border-blue-200/80 shadow-xs hover:border-blue-300 transition-colors flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className="font-bold text-blue-800 uppercase tracking-wider leading-tight whitespace-normal"
                  style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
                >
                  Bank Balance
                </span>
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg shrink-0">
                  <Landmark className="h-4 w-4" />
                </div>
              </div>
              <div
                className="mt-2.5 font-extrabold text-blue-900 font-mono tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar"
                style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
                title={`₹${rp.bankBalance.toLocaleString('en-IN')}`}
              >
                ₹{rp.bankBalance.toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-blue-600 font-medium mt-1 whitespace-normal">Bank & UPI funds</span>
            </div>

            {/* Cash Balance */}
            <div className="bg-white rounded-xl p-4 border border-emerald-200/80 shadow-xs hover:border-emerald-300 transition-colors flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className="font-bold text-emerald-800 uppercase tracking-wider leading-tight whitespace-normal"
                    style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
                  >
                    Cash in Hand
                  </span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                    <Banknote className="h-4 w-4" />
                  </div>
                </div>
                <div
                  className="mt-2.5 font-extrabold text-emerald-900 font-mono tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar"
                  style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
                  title={`₹${rp.cashBalance.toLocaleString('en-IN')}`}
                >
                  ₹{rp.cashBalance.toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-emerald-600 font-medium mt-1 whitespace-normal block">Drawer petty cash</span>
              </div>
              <button
                type="button"
                onClick={handleOpenCashDepositModal}
                className="mt-3 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                title="Deposit Cash in Hand to Bank Account (Contra Entry)"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-700" />
                Deposit to Bank
              </button>
            </div>

            {/* Fixed Assets */}
            <div className="bg-white rounded-xl p-4 border border-indigo-200/80 shadow-xs hover:border-indigo-300 transition-colors flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className="font-bold text-indigo-900 uppercase tracking-wider leading-tight whitespace-normal"
                  style={{ fontSize: `${elementFontSizes.kpiLabel}px` }}
                >
                  Fixed Assets
                </span>
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <div
                className="mt-2.5 font-extrabold text-indigo-900 font-mono tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar"
                style={{ fontSize: `${elementFontSizes.kpiValue}px` }}
                title={`₹${bs.totalFixedAssets.toLocaleString('en-IN')}`}
              >
                ₹{bs.totalFixedAssets.toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-indigo-600 font-medium mt-1 whitespace-normal">
                {bs.assetTransactions.length} capitalized items
              </span>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white shadow-xs rounded-xl p-5 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4 gap-1">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Financial Trends (Last 6 Months)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Income vs Operating Expenses vs Asset Capex</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Operating Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="assets" name="Capital Asset Purchases" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white shadow-xs rounded-xl p-5 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4 gap-1">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Attendance Trends (Last 6 Months)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Student attendance tracking over time</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="present" name="Present" stroke="#4f46e5" strokeWidth={2} />
                    <Line type="monotone" dataKey="absent" name="Absent" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white shadow-xs rounded-xl p-5 border border-gray-200">
              <div className="mb-4">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Operating Expenses by Category</h2>
                <p className="text-xs text-gray-500 mt-0.5">Current month operational expenditure breakdown</p>
              </div>
              {expenseBreakdown.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-500 text-sm">
                  No operating expenses recorded this month.
                </div>
              )}
            </div>

            <div className="bg-white shadow-xs rounded-xl p-5 border border-gray-200">
              <div className="mb-4">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Activity & Care Sessions Breakdown</h2>
                <p className="text-xs text-gray-500 mt-0.5">Current month session count by developmental activity</p>
              </div>
              {therapyBreakdown.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={therapyBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                        label={({name, value}) => `${name}: ${value}`}
                      >
                        {therapyBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-500 text-sm">
                  No activity sessions recorded this month.
                </div>
              )}
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="text-lg leading-6 font-bold text-gray-900">Financial Transactions & Purchases</h3>
                <p className="text-xs text-gray-500 mt-0.5">Filter by operating expenses, capital assets, or incomes</p>
              </div>

              {/* Classification Filter Chips */}
              <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setTxFilter('ALL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({transactions.length})
                </button>
                <button
                  onClick={() => setTxFilter('EXPENSE')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'EXPENSE' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Operating Expenses
                </button>
                <button
                  onClick={() => setTxFilter('ASSET')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'ASSET' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Capital Assets ({bs.assetTransactions.length})
                </button>
                <button
                  onClick={() => setTxFilter('INCOME')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'INCOME' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Income
                </button>
                <button
                  onClick={() => setTxFilter('DEPOSIT')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'DEPOSIT' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Security Deposits ({bs.depositTransactions.length})
                </button>
                <button
                  onClick={() => setTxFilter('INVESTMENT')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'INVESTMENT' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Partner Capital ({bs.partnerInvestments.length})
                </button>
                <button
                  onClick={() => setTxFilter('TRANSFER')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    txFilter === 'TRANSFER' ? 'bg-cyan-100 text-cyan-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Cash & Bank Contra Transfers (Deposits & Withdrawals)"
                >
                  Contra Transfers ({transactions.filter(isTransferTx).length})
                </button>
              </div>
            </div>

            <ul className="divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <li className="px-6 py-12 text-center text-gray-500 text-sm">
                  No transactions found matching the selected filter.
                </li>
              ) : (
                filteredTransactions.map((transaction) => {
                  const isInvestment = isInvestmentTx(transaction);
                  const isAsset = isAssetTx(transaction);
                  const isDeposit = isDepositTx(transaction);
                  const isTransfer = isTransferTx(transaction);
                  const isExpense = isExpenseTx(transaction);
                  const isIncome = isIncomeTx(transaction);
                  const isBankToCash = isBankToCashTx(transaction);

                  return (
                    <li key={transaction.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 flex justify-between items-center transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          isTransfer ? (isBankToCash ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700') : (isInvestment ? 'bg-purple-100 text-purple-600' : (isIncome ? 'bg-green-100 text-green-600' : (isDeposit ? 'bg-teal-100 text-teal-700' : (isAsset ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'))))
                        }`}>
                          {isTransfer ? (
                            <ArrowRightLeft className="h-5 w-5" />
                          ) : isInvestment ? (
                            <Users className="h-5 w-5" />
                          ) : isIncome ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : isDeposit ? (
                            <ShieldCheck className="h-5 w-5" />
                          ) : isAsset ? (
                            <Package className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-bold text-gray-900">
                              {isTransfer
                                ? (isBankToCash
                                    ? (transaction.description || 'Cash Withdrawn from Bank')
                                    : (transaction.description || 'Cash Deposited to Bank'))
                                : isInvestment 
                                ? `Partner Capital: ${transaction.partnerName || 'Partner'}`
                                : isDeposit
                                ? `Security Deposit: ${transaction.depositDetails?.payeeName || transaction.category}`
                                : isAsset && transaction.assetDetails?.assetName 
                                ? transaction.assetDetails.assetName 
                                : transaction.category}
                            </p>
                            {isTransfer && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                isBankToCash
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isBankToCash
                                  ? 'Contra Entry • Bank to Cash'
                                  : 'Contra Entry • Cash to Bank'}
                              </span>
                            )}
                            {isInvestment && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                                Partner Investment
                              </span>
                            )}
                            {isDeposit && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800">
                                Current Asset • Account 1300
                              </span>
                            )}
                            {isAsset && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                                Capital Asset
                              </span>
                            )}
                            {isExpense && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                                Operating Expense
                              </span>
                            )}
                            {isIncome && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                                Income
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDate(transaction.date)} • {transaction.category}
                            {isTransfer && (
                              <span className={`ml-2 font-medium ${isBankToCash ? 'text-blue-800' : 'text-emerald-800'}`}>
                                {isBankToCash
                                  ? `${transaction.transferDetails?.bankName || 'Bank Account'} ➔ Cash Drawer (Petty Cash)`
                                  : `Cash in Hand ➔ ${transaction.transferDetails?.bankName || 'Bank Account'}`}
                                {transaction.transferDetails?.depositSlipNumber ? ` (Ref #${transaction.transferDetails.depositSlipNumber})` : ''}
                                {transaction.transferDetails?.depositedBy ? ` • By: ${transaction.transferDetails.depositedBy}` : ''}
                              </span>
                            )}
                            {isInvestment && transaction.paymentMode && (
                              <span className="ml-2 text-purple-700 font-medium">
                                Mode: {transaction.paymentMode}
                              </span>
                            )}
                            {isDeposit && transaction.depositDetails?.premisesOrAccount && (
                              <span className="ml-2 text-teal-700 font-medium">
                                🏢 {transaction.depositDetails.premisesOrAccount}
                              </span>
                            )}
                            {!isTransfer && transaction.description && ` • ${transaction.description}`}
                            {isAsset && transaction.assetDetails?.locationOrRoom && (
                              <span className="ml-2 text-indigo-600 font-medium">
                                📍 {transaction.assetDetails.locationOrRoom}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className={`text-base font-bold font-mono tabular-nums ${
                            isTransfer ? 'text-cyan-800' : (isInvestment ? 'text-purple-700' : (isIncome ? 'text-green-600' : (isDeposit ? 'text-teal-700' : (isAsset ? 'text-indigo-600' : 'text-red-600'))))
                          }`}>
                            {isTransfer ? '⇄ ' : (isIncome || isInvestment ? '+' : '-')}₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {isTransfer && (
                            <span className="text-[10px] text-cyan-700 font-semibold block">Cash ➔ Bank Transfer</span>
                          )}
                          {isInvestment && (
                            <span className="text-[10px] text-purple-600 font-medium block">Equity Contribution</span>
                          )}
                          {isDeposit && (
                            <span className="text-[10px] text-teal-600 font-medium block">Refundable Deposit</span>
                          )}
                          {isAsset && (
                            <span className="text-[10px] text-gray-400 block">Balance Sheet Asset</span>
                          )}
                        </div>

                        {isTransfer && (
                          <button
                            onClick={() => handleOpenEditTransaction(transaction)}
                            className="p-1.5 text-gray-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-md transition-colors"
                            title="Edit Cash to Bank Transfer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {isInvestment && (
                          <>
                            <button
                              onClick={() => setViewReceiptModal(transaction)}
                              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-colors"
                              title="Print Capital Receipt Voucher"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditTransaction(transaction)}
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="Edit Partner Investment"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isDeposit && (
                          <>
                            <button
                              onClick={() => setSelectedVoucherTx(transaction)}
                              className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-md transition-colors"
                              title="Print Payment Voucher"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setViewDepositModal(transaction)}
                              className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-md transition-colors"
                              title="View Security Deposit Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditTransaction(transaction)}
                              className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                              title="Edit Security Deposit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isAsset && (
                          <>
                            <button
                              onClick={() => setSelectedVoucherTx(transaction)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Print Payment Voucher"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setViewAssetModal(transaction)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                              title="View Asset Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditTransaction(transaction)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Edit Capital Asset"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isExpense && (
                          <>
                            <button
                              onClick={() => setSelectedVoucherTx(transaction)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Print Payment Voucher"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditTransaction(transaction)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Edit Operating Expense"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {isIncome && (
                          <button
                            onClick={() => handleOpenEditTransaction(transaction)}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Edit Income Record"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        <button 
                          onClick={() => setTransactionToDelete(transaction)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}

      {/* TAB 2: BALANCE SHEET & ASSET REGISTER */}
      {activeTab === 'balance' && (
        <div className="w-full space-y-8">
          {/* Header & Period Filter Toolbar (Same as in P&L) */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <div className="flex items-center space-x-2">
                <Landmark className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Balance Sheet (Financial Position)</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Period: <span className="font-semibold text-gray-800">{bs.periodLabel}</span> • Cumulative position of liquid assets, receivables, fixed assets, liabilities & partner equity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="inline-flex bg-gray-100 p-1 rounded-lg text-xs font-medium text-gray-600">
                <button
                  type="button"
                  onClick={() => setBsPeriod('this_month')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${bsPeriod === 'this_month' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setBsPeriod('last_month')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${bsPeriod === 'last_month' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => setBsPeriod('this_quarter')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${bsPeriod === 'this_quarter' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  Quarter
                </button>
                <button
                  type="button"
                  onClick={() => setBsPeriod('ytd')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${bsPeriod === 'ytd' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  YTD (Apr - Mar)
                </button>
                <button
                  type="button"
                  onClick={() => setBsPeriod('all_time')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${bsPeriod === 'all_time' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setBsPeriod('custom')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${bsPeriod === 'custom' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-gray-900'}`}
                >
                  Custom
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 shadow-sm transition-colors"
                title="Export Financial Statements to Excel"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                Export to Excel
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                title="Print Balance Sheet"
              >
                <Printer className="w-3.5 h-3.5 mr-1 text-gray-500" />
                Print
              </button>
            </div>
          </div>

          {/* Custom Date Range Picker when active */}
          {bsPeriod === 'custom' && (
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-indigo-900 flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 text-indigo-600" />
                Select Custom Date Range:
              </span>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">From:</label>
                <input
                  type="date"
                  value={bsCustomStart}
                  onChange={(e) => setBsCustomStart(e.target.value)}
                  className="border border-gray-300 rounded-md px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">To:</label>
                <input
                  type="date"
                  value={bsCustomEnd}
                  onChange={(e) => setBsCustomEnd(e.target.value)}
                  className="border border-gray-300 rounded-md px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Top KPI Cards - 4 Columns for Complete Liquidity & Asset Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Bank Balance */}
            <div className="bg-white rounded-xl p-5 border border-blue-200 shadow-xs hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Bank Balance</span>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Landmark className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-blue-900 mt-2 font-mono tabular-nums">
                ₹{bs.bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-700/80 mt-1 font-medium">Bank Accounts, UPI & Online Payments</p>
            </div>

            {/* Card 2: Cash in Hand Balance */}
            <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-xs hover:border-emerald-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Cash in Hand</span>
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-emerald-900 mt-2 font-mono tabular-nums">
                  ₹{bs.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-emerald-700/80 mt-1 font-medium">Physical Cash Drawer on Premises</p>
              </div>
              <button
                type="button"
                onClick={handleOpenCashDepositModal}
                className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition-colors"
                title="Deposit Cash in Hand to Bank (Contra Entry)"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-700" />
                Deposit to Bank
              </button>
            </div>

            {/* Card 3: Current Assets (Liquid + Dues) */}
            <div className="bg-white rounded-xl p-5 border border-indigo-200 shadow-xs hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Total Current Assets</span>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Wallet className="h-4 w-4 text-indigo-600" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-indigo-950 mt-2 font-mono tabular-nums">
                ₹{bs.currentAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-indigo-600 mt-1 font-medium">
                Liquid (₹{bs.cashAndBank.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + Dues (₹{bs.accountsReceivable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + Deposits (₹{bs.totalSecurityDeposits.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
              </p>
            </div>

            {/* Card 4: Total Centre Assets & Equity */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Assets & Equity</span>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-gray-900 mt-2 font-mono tabular-nums">
                ₹{bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Fixed Assets + Current Assets</p>
            </div>
          </div>

          {/* Formal Balance Sheet Table with Aligned Symmetrical Columns */}
          <div className="bg-white shadow rounded-xl overflow-hidden p-6 sm:p-8 border border-gray-200">
            <div className="text-center border-b border-gray-200 pb-6 mb-8">
              <div className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 rounded-full text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                Audited General Ledger Balance Sheet
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">STATEMENT OF FINANCIAL POSITION</h2>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">
                Little Buds Child Care Centre • {bs.periodLabel}
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* ASSETS COLUMN */}
              <div className="flex flex-col justify-between h-full bg-slate-50/40 rounded-xl border border-gray-200 p-5 shadow-xs">
                <div>
                  <div className="bg-indigo-600 text-white px-4 py-3 rounded-lg mb-5 flex justify-between items-center shadow-xs">
                    <div className="flex items-center space-x-2">
                      <Landmark className="w-4 h-4 text-indigo-200" />
                      <h3 className="text-sm font-bold tracking-wide uppercase">ASSETS</h3>
                    </div>
                    <span className="text-sm font-extrabold font-mono">
                      ₹{bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="space-y-6">
                    {/* Current Assets */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200/80 shadow-xs">
                      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                          1. Current Assets
                        </h4>
                        <span className="text-xs font-bold text-gray-900 font-mono">
                          ₹{bs.currentAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {/* 1.1 Bank Balance */}
                          <tr className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-2.5 px-2 text-gray-800">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-blue-100 rounded text-blue-700 shrink-0">
                                  <Landmark className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-900 text-xs sm:text-sm">Bank Balance</span>
                                  <p className="text-[11px] text-gray-500">Bank accounts, digital transfers & UPI</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-blue-900 tabular-nums">
                              ₹{bs.bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* 1.2 Cash Balance */}
                          <tr className="hover:bg-emerald-50/30 transition-colors">
                            <td className="py-2.5 px-2 text-gray-800">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-emerald-100 rounded text-emerald-700 shrink-0">
                                  <Banknote className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">Cash in Hand Balance</span>
                                    <button
                                      type="button"
                                      onClick={handleOpenCashDepositModal}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded transition-colors"
                                      title="Deposit Cash in Hand to Bank (Contra Entry)"
                                    >
                                      <ArrowRightLeft className="w-3 h-3 text-emerald-700" />
                                      Deposit to Bank
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-gray-500">Physical petty cash drawer on premises</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-900 tabular-nums">
                              ₹{bs.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* Subtotal Liquid Cash & Bank Funds */}
                          <tr className="bg-indigo-50/40 text-xs font-semibold text-indigo-950">
                            <td className="py-2 px-2 pl-9">
                              ↳ Subtotal Liquid Cash & Bank Funds
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-indigo-900 tabular-nums">
                              ₹{bs.cashAndBank.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* Accounts Receivable */}
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-2 text-gray-700">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-amber-100 rounded text-amber-700 shrink-0">
                                  <HandCoins className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <span className="font-medium text-gray-800 text-xs sm:text-sm">Accounts Receivable (Fee Dues)</span>
                                  <p className="text-[11px] text-gray-400">Unpaid pending tuition fees from enrolled students</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">
                              ₹{bs.accountsReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* 1.4 Security Deposits Paid (Refundable Current Asset - Account 1300) */}
                          <tr className="hover:bg-teal-50/30 transition-colors">
                            <td className="py-2.5 px-2 text-gray-800">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-teal-100 rounded text-teal-700 shrink-0">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">Security Deposits Paid</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded">
                                      Account #1300
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500">
                                    Refundable lease, rental & utility deposits ({bs.depositTransactions.length} active)
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-teal-900 tabular-nums">
                              ₹{bs.totalSecurityDeposits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* Total Current Assets Subtotal Bar */}
                          <tr className="bg-gray-100/90 font-bold text-xs text-gray-900">
                            <td className="py-2 px-2">Subtotal Current Assets</td>
                            <td className="py-2 px-2 text-right font-mono text-gray-900 tabular-nums">
                              ₹{bs.currentAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Fixed / Capital Assets */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200/80 shadow-xs">
                      <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-indigo-600" />
                          2. Fixed Assets (Capital Equipment)
                        </h4>
                        <span className="text-xs font-bold text-indigo-700 font-mono">
                          ₹{bs.totalFixedAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {Object.keys(bs.assetsByCategory).length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-4 text-center text-xs text-gray-500 italic bg-gray-50 rounded">
                                No capital assets recorded yet. Use "+ Record Asset Purchase" to add learning equipment or classroom furniture.
                              </td>
                            </tr>
                          ) : (
                            Object.entries(bs.assetsByCategory).map(([category, data]) => (
                              <tr key={category} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="py-2 px-2 text-gray-700 flex items-center space-x-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                  <span className="font-medium text-xs sm:text-sm text-gray-800">{category}</span>
                                  <span className="text-[11px] text-gray-400 font-normal">({data.count} items)</span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">
                                  ₹{data.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          )}
                          <tr className="bg-indigo-50/70 font-bold text-xs text-indigo-950">
                            <td className="py-2 px-2">Gross Fixed Capital Assets (At Cost)</td>
                            <td className="py-2 px-2 text-right text-indigo-700 font-mono tabular-nums">
                              ₹{bs.totalFixedAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {bs.totalAccumulatedDepreciation > 0 && (
                            <tr className="text-xs text-rose-800 bg-rose-50/40">
                              <td className="py-1.5 px-2 pl-4">
                                <span className="font-semibold">Less: Accumulated Depreciation (Contra Asset #1600)</span>
                                <span className="block text-[10px] text-gray-500">Cumulative amortization across Indian Financial Years to date</span>
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono font-medium text-rose-700 tabular-nums">
                                -₹{bs.totalAccumulatedDepreciation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                          <tr className="bg-indigo-100/70 font-bold text-xs text-indigo-950 border-t border-indigo-200">
                            <td className="py-2 px-2">Net Fixed Assets (Book Value)</td>
                            <td className="py-2 px-2 text-right text-indigo-900 font-mono tabular-nums">
                              ₹{bs.netFixedAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Total Assets Row Banner */}
                <div className="mt-6 bg-indigo-900 text-white rounded-xl p-4 flex justify-between items-center shadow-md">
                  <div>
                    <span className="font-extrabold text-sm tracking-wider uppercase block">TOTAL ASSETS</span>
                    <span className="text-[11px] text-indigo-200 font-normal">Current Assets + Net Fixed Capital Assets (After YTD Depreciation)</span>
                  </div>
                  <span className="font-extrabold text-xl font-mono tabular-nums">
                    ₹{bs.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY COLUMN */}
              <div className="flex flex-col justify-between h-full bg-slate-50/40 rounded-xl border border-gray-200 p-5 shadow-xs">
                <div>
                  <div className="bg-amber-600 text-white px-4 py-3 rounded-lg mb-5 flex justify-between items-center shadow-xs">
                    <div className="flex items-center space-x-2">
                      <Scale className="w-4 h-4 text-amber-200" />
                      <h3 className="text-sm font-bold tracking-wide uppercase">LIABILITIES & EQUITY</h3>
                    </div>
                    <span className="text-sm font-extrabold font-mono">
                      ₹{(bs.liabilities + bs.equity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="space-y-6">
                    {/* Liabilities */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200/80 shadow-xs">
                      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-amber-600" />
                          1. Liabilities
                        </h4>
                        <span className="text-xs font-bold text-gray-900 font-mono">
                          ₹{bs.liabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-2 text-gray-700">
                              <span className="font-medium text-xs sm:text-sm text-gray-800">Accounts Payable (Unsettled Accruals #2010)</span>
                              <p className="text-[11px] text-gray-400">Vendor accruals & unsettled operating obligations</p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">
                              ₹{bs.accountsPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-2 text-gray-700">
                              <span className="font-medium text-xs sm:text-sm text-gray-800">Accrued Staff Salaries (#2030)</span>
                              <p className="text-[11px] text-gray-400">Unpaid payroll & staff salary balances</p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">
                              ₹{bs.accruedSalaries.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="bg-gray-100/90 font-bold text-xs text-gray-900">
                            <td className="py-2 px-2">Total Liabilities</td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums">
                              ₹{bs.liabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Equity & Reserves */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200/80 shadow-xs">
                      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                        <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          2. Capital Fund & Partner Equity
                        </h4>
                        <span className="text-xs font-bold text-purple-700 font-mono">
                          ₹{bs.equity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {bs.totalPartnerCapital > 0 ? (
                            <>
                              <tr className="bg-purple-50/50">
                                <td className="py-2.5 px-2 text-purple-950 font-semibold">
                                  <div className="text-xs sm:text-sm font-bold">Total Partner Capital Contributions (#3010)</div>
                                  <span className="text-[11px] text-purple-700 font-normal">
                                    {Object.keys(bs.partnerCapitalByName).length} active contributing partner(s)
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-purple-900 tabular-nums">
                                  ₹{bs.totalPartnerCapital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                              {Object.entries(bs.partnerCapitalByName).map(([pName, data]) => (
                                <tr key={pName} className="text-xs text-gray-600 hover:bg-gray-50">
                                  <td className="py-1.5 px-2 pl-6 flex items-center space-x-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0"></span>
                                    <span className="font-medium text-gray-800">{pName}</span>
                                    <span className="text-[10px] text-purple-600">({((data.total / Math.max(1, bs.totalPartnerCapital)) * 100).toFixed(1)}% share)</span>
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono text-gray-800 font-medium tabular-nums">
                                    ₹{data.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                              <tr className="hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 px-2 text-gray-700">
                                  <div className="text-xs sm:text-sm font-bold text-gray-900">Net Profit & Accumulated Surplus (Account #3020)</div>
                                  <span className="text-[11px] text-gray-500 block">
                                    Cumulative net earnings after deducting YTD accumulated depreciation
                                  </span>
                                  <span className="text-[10px] text-indigo-700 font-mono font-semibold">
                                    (Operating Surplus ₹{bs.operatingSurplus.toLocaleString('en-IN', { maximumFractionDigits: 0 })} − YTD Dep. ₹{bs.totalAccumulatedDepreciation.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                                  </span>
                                </td>
                                <td className={`py-2.5 px-2 text-right font-mono font-bold tabular-nums ${bs.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  ₹{bs.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-2 text-gray-700">
                                <div className="text-xs sm:text-sm font-bold text-gray-900">Net Profit & Accumulated Surplus (Account #3020)</div>
                                <span className="text-[11px] text-gray-500 block">
                                  Retained net earnings after deducting YTD accumulated depreciation
                                </span>
                                <span className="text-[10px] text-indigo-700 font-mono font-semibold">
                                  (Operating Surplus ₹{bs.operatingSurplus.toLocaleString('en-IN', { maximumFractionDigits: 0 })} − YTD Dep. ₹{bs.totalAccumulatedDepreciation.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                                </span>
                              </td>
                              <td className={`py-2.5 px-2 text-right font-mono font-bold tabular-nums ${bs.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                ₹{bs.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                          <tr className="bg-gray-100/90 font-bold text-xs text-gray-900">
                            <td className="py-2 px-2">Total Equity & Capital Fund</td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums">
                              ₹{bs.equity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Total Liabilities & Equity Row Banner + Equilibrium Badge */}
                <div className="mt-6 space-y-2">
                  <div className="bg-gray-900 text-white rounded-xl p-4 flex justify-between items-center shadow-md">
                    <div>
                      <span className="font-extrabold text-sm tracking-wider uppercase block">TOTAL LIABILITIES & EQUITY</span>
                      <span className="text-[11px] text-gray-300 font-normal">Total Liabilities + Partner Capital Fund</span>
                    </div>
                    <span className="font-extrabold text-xl font-mono tabular-nums">
                      ₹{(bs.liabilities + bs.equity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">Equilibrium verified: Total Assets match Total Liabilities & Capital Equity.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ASSET REGISTER WITH DETAILED ASSET BREAKDOWN */}
          <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4 bg-gray-50/50">
              <div>
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-900">Fixed Assets Register (Asset Details)</h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Individual itemized details of all capitalized learning equipment, classroom furniture, and IT infrastructure.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAddForm('Asset')}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add New Asset
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets by name, room, serial..."
                  value={assetSearchQuery}
                  onChange={e => setAssetSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs w-full rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <select
                  value={selectedAssetCategoryFilter}
                  onChange={e => setSelectedAssetCategoryFilter(e.target.value)}
                  className="py-1.5 px-3 text-xs w-full rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Categories ({bs.assetTransactions.length})</option>
                  {ASSET_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-gray-500 flex items-center justify-end font-medium">
                Showing {filteredAssets.length} of {bs.assetTransactions.length} assets • Total Value: ₹{filteredAssets.reduce((sum, a) => sum + safeNum(a.amount), 0).toFixed(2)}
              </div>
            </div>

            {/* Assets Table */}
            <div className="overflow-x-auto">
              {filteredAssets.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900">No assets found</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    {bs.assetTransactions.length === 0 
                      ? "You haven't recorded any capital asset purchases yet. Click '+ Record Asset Purchase' above to add learning equipment or centre assets."
                      : "No assets match your search criteria. Try clearing the filter."}
                  </p>
                  {bs.assetTransactions.length === 0 && (
                    <button
                      onClick={() => handleOpenAddForm('Asset')}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Record First Capital Asset
                    </button>
                  )}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Asset Name & Info</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acquired</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location / Room</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Condition & Life</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Cost Value</th>
                      <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredAssets.map((asset) => {
                      const details = asset.assetDetails;
                      const assetTitle = details?.assetName || asset.description || asset.category;
                      const category = details?.category || asset.category;

                      return (
                        <tr key={asset.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">{assetTitle}</div>
                            {details?.serialNumber && (
                              <div className="text-[11px] text-gray-400 font-mono">SN: {details.serialNumber}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs">
                            {formatDate(asset.date)}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-xs font-medium">
                            {details?.locationOrRoom || 'Main Centre'}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="text-gray-700 font-medium">{details?.condition || 'Good'}</span>
                            <span className="text-gray-400 block text-[11px]">{details?.usefulLifeYears || 5} yrs useful life</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-indigo-700">
                            ₹{asset.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => setSelectedVoucherTx(asset)}
                                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                                title="Print Payment Voucher"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setViewAssetModal(asset)}
                                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                                title="Inspect Asset Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditTransaction(asset)}
                                className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Edit Capital Asset"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setTransactionToDelete(asset)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete Asset"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SECURITY DEPOSITS REGISTER (CURRENT ASSETS - ACCOUNT 1300) */}
          <div className="bg-white shadow rounded-xl overflow-hidden border border-teal-200">
            <div className="px-6 py-5 border-b border-teal-100 flex flex-wrap justify-between items-center gap-4 bg-teal-50/50">
              <div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-5 w-5 text-teal-700" />
                  <h3 className="text-lg font-bold text-teal-950">Security Deposits Register (Current Assets)</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full border border-teal-200">
                    Chart of Accounts: #1300
                  </span>
                </div>
                <p className="text-xs text-teal-800/80 mt-1">
                  Itemized register of all refundable security deposits paid for building leases, electricity meters, water connections, and premises.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAddForm('Deposit')}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md shadow-xs text-white bg-teal-700 hover:bg-teal-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> + Record Security Deposit
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by landlord, premises, ref #..."
                  value={depositSearchQuery}
                  onChange={e => setDepositSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs w-full rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <select
                  value={selectedDepositCategoryFilter}
                  onChange={e => setSelectedDepositCategoryFilter(e.target.value)}
                  className="py-1.5 px-3 text-xs w-full rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="ALL">All Deposit Heads ({bs.depositTransactions.length})</option>
                  {SECURITY_DEPOSIT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-teal-900 flex items-center justify-end font-semibold">
                Showing {filteredDeposits.length} of {bs.depositTransactions.length} deposits • Total Asset: ₹{filteredDeposits.reduce((sum, d) => sum + safeNum(d.amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Deposits Table */}
            <div className="overflow-x-auto">
              {filteredDeposits.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <ShieldCheck className="h-10 w-10 text-teal-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900">No security deposits recorded yet</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    {bs.depositTransactions.length === 0 
                      ? "Keep track of security deposits paid for building rental, utility meters, and telephone lines as Current Assets."
                      : "No deposits match your search criteria. Try clearing the filter."}
                  </p>
                  {bs.depositTransactions.length === 0 && (
                    <button
                      onClick={() => handleOpenAddForm('Deposit')}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-md text-white bg-teal-700 hover:bg-teal-800"
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Record First Security Deposit
                    </button>
                  )}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-teal-50/40">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-teal-900 uppercase tracking-wider">Payee & Premises</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-teal-900 uppercase tracking-wider">Deposit Head</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-teal-900 uppercase tracking-wider">Date Paid</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-teal-900 uppercase tracking-wider">Payment Mode</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-teal-900 uppercase tracking-wider">Agreement / Ref #</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-teal-900 uppercase tracking-wider">Accounting Class</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-teal-900 uppercase tracking-wider">Deposit Amount</th>
                      <th className="py-3 px-4 text-center text-xs font-semibold text-teal-900 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredDeposits.map((deposit) => {
                      const details = deposit.depositDetails;
                      const payee = details?.payeeName || deposit.description || 'Landlord / Authority';
                      const category = details?.depositCategory || deposit.category;

                      return (
                        <tr key={deposit.id} className="hover:bg-teal-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">{payee}</div>
                            {details?.premisesOrAccount && (
                              <div className="text-[11px] text-teal-700 font-medium flex items-center gap-1 mt-0.5">
                                <span>🏢</span> {details.premisesOrAccount}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold bg-teal-100 text-teal-800">
                              {category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                            {formatDate(deposit.date)}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-xs font-medium">
                            {deposit.paymentMode || 'Bank Transfer'}
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs font-mono">
                            {details?.referenceNumber || <span className="text-gray-400">N/A</span>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-teal-600" />
                              Current Asset #1300
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-teal-950 tabular-nums">
                            ₹{deposit.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => setSelectedVoucherTx(deposit)}
                                className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded"
                                title="Print Payment Voucher"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setViewDepositModal(deposit)}
                                className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded"
                                title="Inspect Security Deposit Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditTransaction(deposit)}
                                className="p-1 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded"
                                title="Edit Security Deposit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setTransactionToDelete(deposit)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete Deposit"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARTNER CAPITAL & INVESTMENTS */}
      {activeTab === 'partners' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-purple-700/60 rounded-lg">
                  <Users className="h-6 w-6 text-purple-200" />
                </span>
                <h2 className="text-xl font-bold text-white">Partner Capital & Equity Register</h2>
              </div>
              <p className="text-purple-200 text-xs sm:text-sm mt-1 max-w-2xl">
                Comprehensive record of capital contributions, partner equity shares, and funding transactions for the centre.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleOpenAddForm('Investment')}
                className="inline-flex items-center px-4 py-2 bg-white text-purple-900 hover:bg-purple-50 rounded-lg text-sm font-bold shadow transition-colors"
              >
                <Plus className="h-4 w-4 mr-1.5 text-purple-700" />
                Record Capital Investment
              </button>
            </div>
          </div>

          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Partner Capital</span>
                <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Landmark className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-purple-900">
                ₹{bs.totalPartnerCapital.toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Cumulative capital contributed by partners
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Partners</span>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-indigo-950">
                {Object.keys(bs.partnerCapitalByName).length}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Founding & investing equity partners
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Investment Tranches</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <HandCoins className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-emerald-900">
                {bs.partnerInvestments.length}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Individual capital funding transactions logged
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Equity Contribution</span>
                <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Percent className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-amber-900">
                {bs.equity > 0 ? ((bs.totalPartnerCapital / bs.equity) * 100).toFixed(1) : (bs.totalPartnerCapital > 0 ? '100.0' : '0.0')}%
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Share of total centre equity fund
              </p>
            </div>
          </div>

          {/* Partner Shareholding Cards & Equity Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Partners Breakdown Cards (2 columns on lg) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-purple-600" />
                  Partner Capital Breakdown
                </h3>
                <span className="text-xs text-gray-500">
                  {Object.keys(bs.partnerCapitalByName).length} partner(s) registered
                </span>
              </div>

              {Object.keys(bs.partnerCapitalByName).length === 0 ? (
                <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                  <div className="inline-flex p-3 rounded-full bg-purple-50 text-purple-600 mb-3">
                    <Users className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">No partner investments recorded yet</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Record capital contributions from partners to track ownership stakes, financial contributions, and equity allocation.
                  </p>
                  <button
                    onClick={() => handleOpenAddForm('Investment')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Record First Partner Investment
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(bs.partnerCapitalByName).map(([partnerName, data], index) => {
                    const sharePct = bs.totalPartnerCapital > 0
                      ? (data.total / bs.totalPartnerCapital) * 100
                      : 0;
                    const color = PARTNER_COLORS[index % PARTNER_COLORS.length];
                    const initials = partnerName
                      .split(' ')
                      .filter(Boolean)
                      .map(w => w[0].toUpperCase())
                      .slice(0, 2)
                      .join('');

                    return (
                      <div
                        key={partnerName}
                        className={`bg-white rounded-xl border transition-all p-5 hover:shadow-md ${
                          partnerFilter === partnerName ? 'border-purple-500 ring-2 ring-purple-300' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              {initials || 'P'}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">{partnerName}</h4>
                              <p className="text-xs text-gray-500">
                                {data.count} contribution{data.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <span 
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${color}15`, color }}
                          >
                            {sharePct.toFixed(1)}%
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-xs text-gray-500 font-medium">Total Invested:</span>
                            <span className="text-base font-extrabold text-gray-900">
                              ₹{data.total.toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${Math.max(4, sharePct)}%`, backgroundColor: color }}
                            />
                          </div>

                          <div className="mt-2.5 flex justify-between items-center text-[11px] text-gray-400">
                            <span>Last: {data.lastDate ? formatDate(data.lastDate) : 'N/A'}</span>
                            <button
                              onClick={() => {
                                setPartnerFilter(partnerFilter === partnerName ? 'ALL' : partnerName);
                              }}
                              className="text-purple-600 hover:text-purple-800 font-semibold"
                            >
                              {partnerFilter === partnerName ? 'Show All' : 'Filter Ledger'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setFormTransactionType('Investment');
                              setFormPurchaseType('Investment');
                              setFormData({
                                date: format(new Date(), 'yyyy-MM-dd'),
                                category: PARTNER_INVESTMENT_CATEGORIES[0],
                                amount: '',
                                description: '',
                                partnerName: partnerName,
                                paymentMode: PAYMENT_MODES[0],
                                assetName: '',
                                assetCategory: ASSET_CATEGORIES[0],
                                usefulLifeYears: '5',
                                locationOrRoom: 'Sensory Gym',
                                serialNumber: '',
                                condition: 'Brand New',
                                assetNotes: ''
                              });
                              setShowAddForm(true);
                            }}
                            className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Capital for {partnerName.split(' ')[0]}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Equity Share Pie Chart (1 column on lg) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
                  <PieChartIcon className="h-5 w-5 text-purple-600" />
                  Equity Share Distribution
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Visual proportion of total capital contributed
                </p>

                {Object.keys(bs.partnerCapitalByName).length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-xs text-center">
                    <PieChartIcon className="h-10 w-10 text-gray-300 mb-2" />
                    <span>No partner investments recorded yet</span>
                  </div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(bs.partnerCapitalByName).map(([name, d]) => ({
                            name,
                            value: d.total
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {Object.entries(bs.partnerCapitalByName).map(([entry], index) => (
                            <Cell key={`cell-${entry}`} fill={PARTNER_COLORS[index % PARTNER_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Capital']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {Object.keys(bs.partnerCapitalByName).length > 0 && (
                <div className="pt-3 border-t border-gray-100 space-y-1.5 max-h-40 overflow-y-auto">
                  {Object.entries(bs.partnerCapitalByName).map(([name, d], idx) => (
                    <div key={name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2">
                        <span 
                          className="h-2.5 w-2.5 rounded-full" 
                          style={{ backgroundColor: PARTNER_COLORS[idx % PARTNER_COLORS.length] }}
                        />
                        <span className="text-gray-700 font-medium truncate max-w-[120px]">{name}</span>
                      </div>
                      <span className="font-semibold text-gray-900">₹{d.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Investment Ledger Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table Header & Search Controls */}
            <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Partner Capital Investment Ledger
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detailed history of all capital contributions with payment modes and receipt generation
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative min-w-[200px]">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search partner, purpose, mode..."
                    value={partnerSearchQuery}
                    onChange={e => setPartnerSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                  />
                  {partnerSearchQuery && (
                    <button
                      onClick={() => setPartnerSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter by Partner Dropdown */}
                <div className="flex items-center space-x-1.5 text-xs">
                  <Filter className="h-3.5 w-3.5 text-gray-500" />
                  <select
                    value={partnerFilter}
                    onChange={e => setPartnerFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 py-1.5 px-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">All Partners ({bs.partnerInvestments.length})</option>
                    {knownPartnerNames.map(name => (
                      <option key={name} value={name}>
                        {name} ({bs.partnerCapitalByName[name]?.count || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {partnerFilter !== 'ALL' && (
                  <button
                    onClick={() => setPartnerFilter('ALL')}
                    className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">Date</th>
                    <th className="py-3 px-4 text-left">Partner Name</th>
                    <th className="py-3 px-4 text-left">Investment Category</th>
                    <th className="py-3 px-4 text-left">Payment Mode</th>
                    <th className="py-3 px-4 text-left">Reference / Notes</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm bg-white">
                  {filteredInvestments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                        No capital investments match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInvestments.map(inv => (
                      <tr key={inv.id} className="hover:bg-purple-50/40 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-700 font-medium">
                          {formatDate(inv.date)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="h-7 w-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                              {(inv.partnerName || 'P')[0].toUpperCase()}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">
                              {inv.partnerName || 'Partner'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {inv.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                          {inv.paymentMode || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-500 max-w-xs truncate">
                          {inv.description || '—'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-extrabold text-purple-700 text-base">
                          ₹{inv.amount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setViewReceiptModal(inv)}
                              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                              title="Print Capital Receipt Voucher"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditInvestment(inv)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded transition-colors"
                              title="Edit Investment Record"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setTransactionToDelete(inv)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredInvestments.length > 0 && (
                  <tfoot className="bg-purple-50/60 font-bold text-xs text-purple-900 border-t-2 border-purple-200">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider">
                        Subtotal (Filtered Records):
                      </td>
                      <td className="py-3 px-4 text-right text-base text-purple-900">
                        ₹{filteredInvestments.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECEIPTS AND PAYMENTS ACCOUNT */}
      {activeTab === 'receipts' && (
        <div className="bg-white shadow rounded-lg overflow-hidden p-6 max-w-5xl mx-auto border border-gray-200">
          <div className="border-b pb-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900">Receipts and Payments Account (All Time)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive cash book summarizing all incoming receipts, operational payments, and capital asset acquisitions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Receipts */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3 bg-green-50 text-green-800 p-2.5 rounded flex items-center justify-between">
                <span>RECEIPTS (CASH INFLOWS)</span>
                <span>₹{rp.totalReceipts.toFixed(2)}</span>
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(rp.receiptsByCategory).map(([category, amount]) => (
                    <tr key={category} className="border-b border-gray-100">
                      <td className="py-2.5 text-gray-700">{category}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">₹{amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t">
                    <td className="py-2.5 px-2 text-gray-900">Total Receipts</td>
                    <td className="py-2.5 px-2 text-right text-green-600">₹{rp.totalReceipts.toFixed(2)}</td>
                  </tr>
                  <tr className="text-xs text-blue-800 bg-blue-50/50">
                    <td className="py-1.5 px-2 pl-4">↳ Received via Bank / UPI / Online</td>
                    <td className="py-1.5 px-2 text-right font-semibold">₹{rp.bankReceipts.toFixed(2)}</td>
                  </tr>
                  <tr className="text-xs text-emerald-800 bg-emerald-50/50">
                    <td className="py-1.5 px-2 pl-4">↳ Received in Physical Cash</td>
                    <td className="py-1.5 px-2 text-right font-semibold">₹{rp.cashReceipts.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payments */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3 bg-red-50 text-red-800 p-2.5 rounded flex items-center justify-between">
                <span>PAYMENTS (CASH OUTFLOWS)</span>
                <span>₹{rp.totalPayments.toFixed(2)}</span>
              </h3>
              
              <div className="space-y-4">
                {/* 1. Operating Payments */}
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">A. Operating Expenses</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(rp.operatingPaymentsByCategory).map(([category, amount]) => (
                        <tr key={category} className="border-b border-gray-100">
                          <td className="py-1.5 text-gray-600">{category}</td>
                          <td className="py-1.5 text-right font-medium text-gray-900">₹{amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold text-xs text-gray-700 bg-gray-50">
                        <td className="py-1.5 px-2">Subtotal Operating Payments</td>
                        <td className="py-1.5 px-2 text-right text-red-600">₹{rp.totalOperatingPayments.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. Capital Asset Payments */}
                <div>
                  <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">B. Capital Asset Purchases</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.keys(rp.capitalPaymentsByCategory).length === 0 ? (
                        <tr><td colSpan={2} className="py-2 text-xs text-gray-400 italic">No asset purchases recorded.</td></tr>
                      ) : (
                        Object.entries(rp.capitalPaymentsByCategory).map(([category, amount]) => (
                          <tr key={category} className="border-b border-gray-100">
                            <td className="py-1.5 text-gray-600">{category}</td>
                            <td className="py-1.5 text-right font-medium text-gray-900">₹{amount.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="font-semibold text-xs text-indigo-950 bg-indigo-50/50">
                        <td className="py-1.5 px-2">Subtotal Capital Asset Purchases</td>
                        <td className="py-1.5 px-2 text-right text-indigo-700">₹{rp.totalCapitalPayments.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Security Deposits Paid (if any) */}
                {rp.totalDepositPayments > 0 && (
                  <div>
                    <div className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-1">C. Refundable Security Deposits</div>
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(rp.depositPaymentsByCategory).map(([category, amount]) => (
                          <tr key={category} className="border-b border-gray-100">
                            <td className="py-1.5 text-gray-600">{category}</td>
                            <td className="py-1.5 text-right font-medium text-gray-900">₹{amount.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold text-xs text-teal-950 bg-teal-50/50">
                          <td className="py-1.5 px-2">Subtotal Security Deposits</td>
                          <td className="py-1.5 px-2 text-right text-teal-700">₹{rp.totalDepositPayments.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totals & Closing Balance */}
                <table className="w-full text-sm mt-4">
                  <tbody>
                    <tr className="bg-gray-100 font-bold border-t">
                      <td className="py-2 px-2 text-gray-900">Total External Payments (Outflows)</td>
                      <td className="py-2 px-2 text-right text-red-600">₹{rp.totalPayments.toFixed(2)}</td>
                    </tr>
                    <tr className="text-xs text-gray-600 bg-gray-50">
                      <td className="py-1 px-2 pl-4">↳ Paid via Bank / Digital</td>
                      <td className="py-1 px-2 text-right">₹{rp.bankPayments.toFixed(2)}</td>
                    </tr>
                    <tr className="text-xs text-gray-600 bg-gray-50 border-b">
                      <td className="py-1 px-2 pl-4">↳ Paid in Physical Cash</td>
                      <td className="py-1 px-2 text-right">₹{rp.cashPayments.toFixed(2)}</td>
                    </tr>
                    {(rp.totalCashDepositedToBank > 0 || rp.totalCashWithdrawnFromBank > 0) && (
                      <tr className="text-xs text-indigo-900 bg-indigo-50/70 border-b border-indigo-200">
                        <td className="py-1.5 px-2 pl-4">
                          <span className="font-semibold block text-indigo-950">Internal Contra Transfers (Zero P&L Impact):</span>
                          {rp.totalCashDepositedToBank > 0 && <span className="block text-[11px] text-emerald-700">↳ Cash Deposited to Bank (Cash ➔ Bank): ₹{rp.totalCashDepositedToBank.toFixed(2)}</span>}
                          {rp.totalCashWithdrawnFromBank > 0 && <span className="block text-[11px] text-blue-700">↳ Cash Withdrawn from Bank (Bank ➔ Cash): ₹{rp.totalCashWithdrawnFromBank.toFixed(2)}</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right font-bold text-gray-500">±₹0.00</td>
                      </tr>
                    )}
                    <tr className="bg-blue-50/60 font-semibold border-t border-blue-200">
                      <td className="py-2 px-2 text-blue-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Landmark className="h-4 w-4 text-blue-600 inline" /> Closing Bank Balance
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenCashWithdrawalModal}
                          className="text-[11px] font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded border border-blue-300 transition-colors"
                          title="Withdraw cash from bank into physical cash drawer"
                        >
                          Withdraw to Cash
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right text-blue-700 font-bold">₹{rp.bankBalance.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-emerald-50/60 font-semibold border-t border-emerald-200">
                      <td className="py-2 px-2 text-emerald-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Banknote className="h-4 w-4 text-emerald-600 inline" /> Closing Cash in Hand Balance
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenCashDepositModal}
                          className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 transition-colors"
                          title="Deposit cash in hand into bank account"
                        >
                          Deposit to Bank
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-700 font-bold">₹{rp.cashBalance.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-indigo-50 font-bold text-base border-t-2 border-indigo-300">
                      <td className="py-3 px-2 text-indigo-900 flex items-center gap-1.5">
                        <Wallet className="h-4 w-4 text-indigo-600 inline" /> Total Closing Liquid Funds
                      </td>
                      <td className="py-3 px-2 text-right text-indigo-700 font-extrabold">₹{rp.closingBalance.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CASH FLOW STATEMENT */}
      {activeTab === 'cashflow' && (
        <div className="bg-white shadow rounded-lg overflow-hidden p-6 max-w-3xl mx-auto border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Cash Flow Statement</h2>
          <p className="text-gray-500 text-xs mb-6 border-b pb-4">For the month of {format(new Date(), 'MMMM yyyy')}</p>
          
          <table className="w-full text-sm">
            <tbody>
              {/* Opening Balances */}
              <tr className="border-b bg-gray-50 font-bold">
                <td className="py-2.5 px-2 text-gray-800">Opening Liquid Balance (Start of Month)</td>
                <td className="py-2.5 px-2 text-right font-semibold text-gray-900">₹{cf.openingBalance.toFixed(2)}</td>
              </tr>
              <tr className="text-xs text-blue-800 bg-blue-50/40">
                <td className="py-1 px-2 pl-4">↳ Opening Bank Balance</td>
                <td className="py-1 px-2 text-right font-semibold">₹{cf.openingBankBalance.toFixed(2)}</td>
              </tr>
              <tr className="text-xs text-emerald-800 bg-emerald-50/40 border-b">
                <td className="py-1 px-2 pl-4">↳ Opening Cash in Hand Balance</td>
                <td className="py-1 px-2 text-right font-semibold">₹{cf.openingCashBalance.toFixed(2)}</td>
              </tr>
              
              {/* Inflows */}
              <tr>
                <td className="py-3 font-bold text-gray-800 uppercase text-xs" colSpan={2}>1. Inflows for the Month</td>
              </tr>
              <tr className="text-xs text-blue-800">
                <td className="py-1.5 pl-4">Inflows via Bank (UPI, Bank Transfer, Online)</td>
                <td className="py-1.5 text-right font-medium text-blue-700">₹{cf.bankInflows.toFixed(2)}</td>
              </tr>
              <tr className="text-xs text-emerald-800">
                <td className="py-1.5 pl-4">Inflows via Physical Cash</td>
                <td className="py-1.5 text-right font-medium text-emerald-700">₹{cf.cashInflows.toFixed(2)}</td>
              </tr>
              <tr className="border-b bg-gray-50 font-semibold text-xs">
                <td className="py-2 px-2 text-gray-700">Total Operating Inflows</td>
                <td className="py-2 px-2 text-right text-green-600 font-bold">₹{cf.inflows.toFixed(2)}</td>
              </tr>
              
              {/* Outflows */}
              <tr>
                <td className="py-3 font-bold text-gray-800 uppercase text-xs" colSpan={2}>2. Outflows for the Month</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 pl-4 text-gray-600">
                  Operating Expenses Outflows
                  <span className="block text-[11px] text-gray-400">Bank: ₹{cf.bankOperatingOutflows.toFixed(2)} • Cash: ₹{cf.cashOperatingOutflows.toFixed(2)}</span>
                </td>
                <td className="py-1.5 text-right text-red-600 font-medium">(₹{cf.operatingOutflows.toFixed(2)})</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 pl-4 text-indigo-700 font-medium">
                  Investing / Capital Asset Outflows
                  <span className="block text-[11px] text-indigo-400">Bank: ₹{cf.bankCapitalOutflows.toFixed(2)} • Cash: ₹{cf.cashCapitalOutflows.toFixed(2)}</span>
                </td>
                <td className="py-1.5 text-right text-indigo-700 font-medium">(₹{cf.capitalOutflows.toFixed(2)})</td>
              </tr>
              <tr className="border-b bg-gray-50 font-semibold text-xs">
                <td className="py-2 px-2 text-gray-700">Total Outflows (Bank & Cash)</td>
                <td className="py-2 px-2 text-right text-red-600 font-semibold">(₹{cf.totalOutflows.toFixed(2)})</td>
              </tr>

              {/* 3. Internal Contra Transfers (if any occurred this month) */}
              {(cf.monthCashDepositedToBank > 0 || cf.monthCashWithdrawnFromBank > 0) && (
                <>
                  <tr>
                    <td className="py-3 font-bold text-gray-800 uppercase text-xs" colSpan={2}>3. Internal Contra Transfers (Zero Net P&L Impact)</td>
                  </tr>
                  {cf.monthCashDepositedToBank > 0 && (
                    <tr className="border-b text-xs text-emerald-800 bg-emerald-50/20">
                      <td className="py-1.5 pl-4">
                        Cash Deposited to Bank (Cash ➔ Bank)
                        <span className="block text-[11px] text-gray-400">Transferred from Physical Cash into Operating Bank</span>
                      </td>
                      <td className="py-1.5 text-right font-medium text-emerald-700">₹{cf.monthCashDepositedToBank.toFixed(2)}</td>
                    </tr>
                  )}
                  {cf.monthCashWithdrawnFromBank > 0 && (
                    <tr className="border-b text-xs text-blue-800 bg-blue-50/20">
                      <td className="py-1.5 pl-4">
                        Cash Withdrawn from Bank (Bank ➔ Cash)
                        <span className="block text-[11px] text-gray-400">Transferred from Operating Bank into Physical Cash</span>
                      </td>
                      <td className="py-1.5 text-right font-medium text-blue-700">₹{cf.monthCashWithdrawnFromBank.toFixed(2)}</td>
                    </tr>
                  )}
                </>
              )}

              {/* Net Flow Movement */}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="py-2.5 px-2 text-gray-900">Net Movement for Month</td>
                <td className={`py-2.5 px-2 text-right font-bold ${cf.netCashFlowTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cf.netCashFlowTotal >= 0 ? '+' : ''}₹{cf.netCashFlowTotal.toFixed(2)}
                </td>
              </tr>
              <tr className="text-xs text-blue-800 bg-blue-50/30">
                <td className="py-1 px-2 pl-4">↳ Net Bank Flow</td>
                <td className="py-1 px-2 text-right font-semibold">
                  {cf.netBankFlow >= 0 ? '+' : ''}₹{cf.netBankFlow.toFixed(2)}
                </td>
              </tr>
              <tr className="text-xs text-emerald-800 bg-emerald-50/30 border-b">
                <td className="py-1 px-2 pl-4">↳ Net Cash in Hand Flow</td>
                <td className="py-1 px-2 text-right font-semibold">
                  {cf.netCashFlow >= 0 ? '+' : ''}₹{cf.netCashFlow.toFixed(2)}
                </td>
              </tr>
              
              {/* Closing Balances */}
              <tr className="bg-blue-50/70 font-semibold border-t border-blue-200">
                <td className="py-2 px-2 text-blue-900 flex items-center gap-1.5">
                  <Landmark className="h-4 w-4 text-blue-600 inline" /> Closing Bank Balance
                </td>
                <td className="py-2 px-2 text-right text-blue-800 font-bold">₹{cf.closingBankBalance.toFixed(2)}</td>
              </tr>
              <tr className="bg-emerald-50/70 font-semibold border-t border-emerald-200">
                <td className="py-2 px-2 text-emerald-900 flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-emerald-600 inline" /> Closing Cash in Hand Balance
                </td>
                <td className="py-2 px-2 text-right text-emerald-800 font-bold">₹{cf.closingCashBalance.toFixed(2)}</td>
              </tr>
              <tr className="bg-indigo-50 font-bold mt-2 border-t-2 border-indigo-300">
                <td className="py-3 px-2 text-indigo-900 text-base flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-indigo-600 inline" /> Total Closing Liquid Funds
                </td>
                <td className="py-3 px-2 text-right text-indigo-700 text-base font-extrabold">₹{cf.closingBalance.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: LEDGER WISE REPORT */}
      {activeTab === 'ledger' && (
        <LedgerWiseReportView
          accounts={accountsList}
          transactions={transactions}
          fees={fees}
          initialAccountCode={selectedLedgerAccountCode}
        />
      )}

      {/* TAB: CHART OF ACCOUNTS GENERAL LEDGER */}
      {activeTab === 'accounts' && (
        <ChartOfAccountsView
          accounts={accountsList}
          transactions={transactions}
          fees={fees}
          liquidStats={{
            bankBalance: rp.bankBalance,
            cashBalance: rp.cashBalance,
            totalReceipts: rp.totalReceipts,
            totalPayments: rp.totalPayments,
            depreciationTotal: bs.totalFixedAssets > 0 ? (pnl.totalDepreciation || 0) : 0,
            accumulatedDepreciationTotal: bs.totalAccumulatedDepreciation,
            depreciationExpenseYTD: bs.currentFYDepreciationYTD
          }}
          onAccountsUpdated={loadAccounts}
          onViewLedger={(acc) => {
            setSelectedLedgerAccountCode(acc.code);
            setActiveTab('ledger');
          }}
          onRecordTransactionForAccount={(acc) => {
            if (acc.type === 'Asset' && acc.subtype === 'Fixed Asset') {
              handleOpenAddForm('Asset');
            } else if (acc.type === 'Equity' && acc.subtype === 'Partner Capital') {
              handleOpenAddForm('Investment');
            } else {
              handleOpenAddForm('Expense');
            }
          }}
        />
      )}

      {/* TAB: STAFF SALARIES MANAGEMENT */}
      {activeTab === 'salaries' && (
        <StaffSalaryManager
          salaries={salariesList}
          accounts={accountsList}
          onRefresh={loadData}
          onToast={addToast}
          onOpenNewLedgerModal={() => {
            setCustomLedgerDefaultType('Expense');
            setShowCustomLedgerModal(true);
          }}
        />
      )}

      {/* TAB: ACCRUALS & OUTSTANDING PAYABLES */}
      {activeTab === 'accruals' && (
        <AccrualManager
          accruals={accrualsList}
          accounts={accountsList}
          customCategories={customCategoriesList}
          onRefresh={loadData}
          onToast={addToast}
          onOpenNewCategoryModal={() => {
            setCustomCategoryDefaultType('Expense');
            setShowCustomCategoryModal(true);
          }}
          onOpenNewLedgerModal={() => {
            setCustomLedgerDefaultType('Expense');
            setShowCustomLedgerModal(true);
          }}
        />
      )}

      {/* TAB: FINANCIAL & BANKING SETTINGS */}
      {activeTab === 'financial' && (
        <FinancialDetailsSettingsTab
          onSavedNotification={(msg) => addToast('success', msg)}
        />
      )}

      {/* COMPREHENSIVE EDIT TRANSACTION MODAL (EXPENSE, INCOME, ASSET, DEPOSIT, INVESTMENT) */}
      {transactionToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => !isUpdating && setTransactionToEdit(null)}>
              <div className="absolute inset-0 bg-gray-900 opacity-60"></div>
            </div>

            <div className="relative z-10 w-full max-w-xl transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all border border-gray-100">
              {/* Dynamic Header */}
              <div className={`px-6 py-4 flex items-center justify-between text-white ${
                editTxData.type === 'Income'
                  ? 'bg-gradient-to-r from-emerald-700 via-teal-700 to-green-800'
                  : editTxData.type === 'Transfer'
                  ? 'bg-gradient-to-r from-cyan-700 via-teal-700 to-cyan-900'
                  : editTxData.type === 'Asset'
                  ? 'bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-900'
                  : editTxData.type === 'Deposit'
                  ? 'bg-gradient-to-r from-teal-700 via-cyan-800 to-teal-900'
                  : editTxData.type === 'Investment'
                  ? 'bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-950'
                  : 'bg-gradient-to-r from-rose-700 via-red-700 to-rose-900'
              }`}>
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-white/15 rounded-lg backdrop-blur-xs">
                    {editTxData.type === 'Transfer' ? (
                      <ArrowRightLeft className="h-5 w-5 text-white" />
                    ) : editTxData.type === 'Income' ? (
                      <TrendingUp className="h-5 w-5 text-white" />
                    ) : editTxData.type === 'Asset' ? (
                      <Package className="h-5 w-5 text-white" />
                    ) : editTxData.type === 'Deposit' ? (
                      <ShieldCheck className="h-5 w-5 text-white" />
                    ) : editTxData.type === 'Investment' ? (
                      <Users className="h-5 w-5 text-white" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">
                      {editTxData.type === 'Income'
                        ? 'Edit Income Record'
                        : editTxData.type === 'Transfer'
                        ? 'Edit Cash to Bank Transfer'
                        : editTxData.type === 'Asset'
                        ? 'Edit Capital Asset'
                        : editTxData.type === 'Deposit'
                        ? 'Edit Security Deposit'
                        : editTxData.type === 'Investment'
                        ? 'Edit Partner Investment'
                        : 'Edit Operating Expense'}
                    </h3>
                    <p className="text-xs text-white/80">
                      Update details, amount, category, or payment instrument
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isUpdating && setTransactionToEdit(null)}
                  className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEditTransactionSubmit} className="p-6 space-y-4">
                {/* Type Reclassification Selector (allows quick re-sorting between Expense & Income) */}
                {(editTxData.type === 'Expense' || editTxData.type === 'Income') && (
                  <div className="bg-gray-50 p-2 rounded-lg flex items-center justify-between border border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 px-2">Classification:</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTxData(prev => ({
                            ...prev,
                            type: 'Expense',
                            category: EXPENSE_CATEGORIES.includes(prev.category) ? prev.category : EXPENSE_CATEGORIES[0]
                          }));
                        }}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                          editTxData.type === 'Expense'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                        }`}
                      >
                        Operating Expense
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditTxData(prev => ({
                            ...prev,
                            type: 'Income',
                            category: INCOME_CATEGORIES.includes(prev.category) ? prev.category : INCOME_CATEGORIES[0]
                          }));
                        }}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                          editTxData.type === 'Income'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                        }`}
                      >
                        Income Record
                      </button>
                    </div>
                  </div>
                )}

                {/* Cash & Bank Contra Transfer Specific Fields */}
                {editTxData.type === 'Transfer' && (
                  <div className="space-y-3 p-3.5 bg-cyan-50/70 rounded-xl border border-cyan-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-900">
                      <ArrowRightLeft className="h-4 w-4 text-cyan-700" />
                      <span>
                        {isBankToCashTx(transactionToEdit) || editTxData.category === 'Cash Withdrawal from Bank'
                          ? 'Contra Transfer: Bank Account (Account 1010) ➔ Cash Drawer (Account 1020)'
                          : 'Contra Transfer: Cash Drawer (Account 1020) ➔ Bank Account (Account 1010)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-cyan-950">
                          {isBankToCashTx(transactionToEdit) || editTxData.category === 'Cash Withdrawal from Bank'
                            ? 'Source Bank Account *'
                            : 'Destination Bank Account *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={editTxData.bankName}
                          onChange={e => setEditTxData({ ...editTxData, bankName: e.target.value })}
                          placeholder="e.g. Primary Bank Account (Account #1010)"
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-cyan-950">
                          {isBankToCashTx(transactionToEdit) || editTxData.category === 'Cash Withdrawal from Bank'
                            ? 'Cheque # / ATM Slip / Ref #'
                            : 'Deposit Slip / Reference #'}
                        </label>
                        <input
                          type="text"
                          value={editTxData.depositSlipNumber}
                          onChange={e => setEditTxData({ ...editTxData, depositSlipNumber: e.target.value })}
                          placeholder="e.g. SLIP-2026-091 or Cheque Ref"
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm border bg-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-cyan-950">
                        {isBankToCashTx(transactionToEdit) || editTxData.category === 'Cash Withdrawal from Bank'
                          ? 'Withdrawn By (Staff / Manager Name)'
                          : 'Deposited By (Staff / Manager Name)'}
                      </label>
                      <input
                        type="text"
                        value={editTxData.depositedBy}
                        onChange={e => setEditTxData({ ...editTxData, depositedBy: e.target.value })}
                        placeholder="e.g. Centre Admin / Accounts Officer"
                        className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm border bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Investment Partner Name */}
                {editTxData.type === 'Investment' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Contributing Partner *</label>
                    <input
                      type="text"
                      required
                      list="edit-partner-name-suggestions"
                      value={editTxData.partnerName}
                      onChange={e => setEditTxData({ ...editTxData, partnerName: e.target.value })}
                      placeholder="e.g. John Doe, Sarah Jenkins"
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                    />
                    <datalist id="edit-partner-name-suggestions">
                      {knownPartnerNames.map(name => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                )}

                {/* Capital Asset Specific Fields */}
                {editTxData.type === 'Asset' && (
                  <div className="space-y-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <div>
                      <label className="block text-xs font-semibold text-indigo-950">Asset / Equipment Name *</label>
                      <input
                        type="text"
                        required
                        value={editTxData.assetName}
                        onChange={e => setEditTxData({ ...editTxData, assetName: e.target.value })}
                        placeholder="e.g. Montessori Sensory Wall, Classroom Ergonomic Desk Set"
                        className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-indigo-950">Location / Room</label>
                        <input
                          type="text"
                          value={editTxData.locationOrRoom}
                          onChange={e => setEditTxData({ ...editTxData, locationOrRoom: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-indigo-950">Useful Life (Years)</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={editTxData.usefulLifeYears}
                          onChange={e => setEditTxData({ ...editTxData, usefulLifeYears: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-indigo-950">Condition</label>
                        <select
                          value={editTxData.condition}
                          onChange={e => setEditTxData({ ...editTxData, condition: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white"
                        >
                          <option value="Brand New">Brand New</option>
                          <option value="Good">Good</option>
                          <option value="Refurbished">Refurbished</option>
                          <option value="Fair">Fair</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-indigo-950">Serial / Asset Tag #</label>
                      <input
                        type="text"
                        value={editTxData.serialNumber}
                        onChange={e => setEditTxData({ ...editTxData, serialNumber: e.target.value })}
                        placeholder="e.g. SN-2026-LBD-094"
                        className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Security Deposit Specific Fields */}
                {editTxData.type === 'Deposit' && (
                  <div className="space-y-3 p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-teal-950">Landlord / Payee Authority *</label>
                        <input
                          type="text"
                          required
                          value={editTxData.payeeName}
                          onChange={e => setEditTxData({ ...editTxData, payeeName: e.target.value })}
                          placeholder="e.g. Landlord Name, KSEB, Water Authority"
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-teal-950">Premises / Meter / Consumer Account</label>
                        <input
                          type="text"
                          value={editTxData.premisesOrAccount}
                          onChange={e => setEditTxData({ ...editTxData, premisesOrAccount: e.target.value })}
                          placeholder="e.g. Main Centre Facility, Meter #1142"
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="block text-xs font-semibold text-teal-950">Lease Reference / Agreement #</label>
                        <input
                          type="text"
                          value={editTxData.referenceNumber}
                          onChange={e => setEditTxData({ ...editTxData, referenceNumber: e.target.value })}
                          placeholder="e.g. AGR-2026-004"
                          className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm border bg-white font-mono"
                        />
                      </div>
                      <div className="pt-4 flex items-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editTxData.refundable}
                            onChange={e => setEditTxData({ ...editTxData, refundable: e.target.checked })}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                          />
                          <span className="ml-2 text-xs font-medium text-gray-700">100% Refundable on vacating</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Core Row: Date & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700">Transaction Date *</label>
                      {editTxData.date && (
                        <span className="text-[11px] font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {formatDate(editTxData.date)}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      required
                      value={editTxData.date}
                      onChange={e => setEditTxData({ ...editTxData, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Amount (₹) *
                    </label>
                    <div className="relative mt-1 rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-gray-500 sm:text-sm">₹</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={editTxData.amount}
                        onChange={e => setEditTxData({ ...editTxData, amount: e.target.value })}
                        placeholder="0.00"
                        className="block w-full rounded-md border-gray-300 pl-7 pr-3 py-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                      />
                    </div>
                  </div>
                </div>

                {/* Category & Payment Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {editTxData.type === 'Asset'
                          ? 'Asset Category'
                          : editTxData.type === 'Deposit'
                          ? 'Deposit Category'
                          : editTxData.type === 'Investment'
                          ? 'Investment Purpose'
                          : editTxData.type === 'Income'
                          ? 'Income Category'
                          : 'Expense Category'} *
                      </label>
                      {(editTxData.type === 'Expense' || editTxData.type === 'Income') && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomCategoryDefaultType(editTxData.type === 'Income' ? 'Income' : 'Expense');
                            setShowCustomCategoryModal(true);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          + New Category
                        </button>
                      )}
                    </div>
                    <select
                      required
                      value={editTxData.category}
                      onChange={e => setEditTxData({ ...editTxData, category: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border bg-white"
                    >
                      {(editTxData.type === 'Income'
                        ? Array.from(new Set([...INCOME_CATEGORIES, ...customCategoriesList.filter(c => c.type === 'Income').map(c => c.name)]))
                        : editTxData.type === 'Asset'
                        ? ASSET_CATEGORIES
                        : editTxData.type === 'Deposit'
                        ? SECURITY_DEPOSIT_CATEGORIES
                        : editTxData.type === 'Investment'
                        ? PARTNER_INVESTMENT_CATEGORIES
                        : editTxData.type === 'Transfer'
                        ? ['Cash Deposit to Bank', 'Cash Withdrawal from Bank']
                        : Array.from(new Set([...EXPENSE_CATEGORIES, ...customCategoriesList.filter(c => c.type === 'Expense').map(c => c.name)]))
                      ).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Payment Mode *</label>
                    <select
                      value={editTxData.paymentMode}
                      onChange={e => setEditTxData({ ...editTxData, paymentMode: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                    >
                      {PAYMENT_MODES.map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description / Reference / Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Description / Notes / Reference
                  </label>
                  <textarea
                    rows={2}
                    value={editTxData.description}
                    onChange={e => setEditTxData({ ...editTxData, description: e.target.value })}
                    placeholder="e.g. Monthly classroom supplies from vendor, Cheque #104928, Bank Ref..."
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                  />
                </div>

                {/* Modal Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      const target = transactionToEdit;
                      setTransactionToEdit(null);
                      if (target) setTransactionToDelete(target);
                    }}
                    className="inline-flex items-center text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete this record
                  </button>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => setTransactionToEdit(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className={`px-5 py-2 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors ${
                        editTxData.type === 'Income'
                          ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                          : editTxData.type === 'Asset'
                          ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                          : editTxData.type === 'Deposit'
                          ? 'bg-teal-700 hover:bg-teal-800 focus:ring-teal-600'
                          : editTxData.type === 'Investment'
                          ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                          : 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
                      }`}
                    >
                      {isUpdating ? 'Saving Changes...' : `Update ${editTxData.type}`}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PARTNER CAPITAL RECEIPT VOUCHER MODAL */}
      {viewReceiptModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setViewReceiptModal(null)}>
              <div className="absolute inset-0 bg-gray-600 opacity-60"></div>
            </div>

            <div className="relative z-10 w-full max-w-xl transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all border border-gray-200">
              {/* Receipt Action Bar (Not printed) */}
              <div className="bg-gray-900 px-6 py-3 flex items-center justify-between text-white">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Partner Capital Contribution Voucher
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const printContent = document.getElementById('partner-receipt-print-area');
                      if (printContent) {
                        const iframe = document.createElement('iframe');
                        iframe.style.position = 'fixed';
                        iframe.style.right = '0';
                        iframe.style.bottom = '0';
                        iframe.style.width = '0';
                        iframe.style.height = '0';
                        iframe.style.border = '0';
                        document.body.appendChild(iframe);
                        const doc = iframe.contentWindow?.document;
                        if (doc) {
                          doc.open();
                          doc.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <title>Partner Investment Receipt - ${viewReceiptModal.partnerName || 'Partner'}</title>
                              <style>
                                body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111827; }
                                .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px; }
                                .title { font-size: 20px; font-weight: bold; color: #4c1d95; text-transform: uppercase; }
                                .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
                                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 13px; }
                                .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #faf5ff; }
                                .amount-box { text-align: center; border: 2px solid #7c3aed; border-radius: 8px; padding: 16px; margin: 24px 0; background: #faf5ff; }
                                .amount { font-size: 28px; font-weight: bold; color: #6d28d9; }
                                .signatures { display: grid; grid-template-columns: 1fr 1fr; margin-top: 60px; text-align: center; font-size: 12px; }
                                .sign-line { border-top: 1px solid #9ca3af; width: 80%; margin: 40px auto 4px auto; }
                              </style>
                            </head>
                            <body>
                              ${printContent.innerHTML}
                            </body>
                            </html>
                          `);
                          doc.close();
                          iframe.contentWindow?.focus();
                          setTimeout(() => {
                            iframe.contentWindow?.print();
                            setTimeout(() => {
                              if (document.body.contains(iframe)) {
                                document.body.removeChild(iframe);
                              }
                            }, 1000);
                          }, 300);
                        }
                      }
                    }}
                    className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Print Receipt
                  </button>
                  <button onClick={() => setViewReceiptModal(null)} className="text-gray-400 hover:text-white p-1">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Printable Voucher Paper */}
              <div id="partner-receipt-print-area" className="p-8 bg-white">
                <div className="text-center border-b-2 border-purple-600 pb-4 mb-6">
                  <h3 className="text-lg font-extrabold text-purple-950 uppercase tracking-wider">
                    Little Buds Child Care Centre
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Child Care & Early Childhood Development Centre</p>
                  <div className="inline-block mt-3 px-4 py-1 bg-purple-100 text-purple-900 rounded-full text-xs font-bold uppercase tracking-wide">
                    Official Partner Capital Contribution Voucher
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                  <div>
                    <span className="text-gray-400 block uppercase">Voucher Reference</span>
                    <span className="font-bold text-gray-900 font-mono">
                      VCH-CAP-{viewReceiptModal.id?.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block uppercase">Date Received</span>
                    <span className="font-bold text-gray-900">
                      {formatDate(viewReceiptModal.date)}
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-5 mb-6 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">Contributing Partner:</span>
                    <span className="font-extrabold text-gray-900 text-sm">{viewReceiptModal.partnerName || 'Partner'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-purple-100/80 pt-2">
                    <span className="text-gray-600">Capital Head / Purpose:</span>
                    <span className="font-semibold text-purple-900">{viewReceiptModal.category}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-purple-100/80 pt-2">
                    <span className="text-gray-600">Payment Mode / Instrument:</span>
                    <span className="font-semibold text-gray-800">{viewReceiptModal.paymentMode || 'N/A'}</span>
                  </div>
                  {viewReceiptModal.description && (
                    <div className="flex justify-between items-center text-xs border-t border-purple-100/80 pt-2">
                      <span className="text-gray-600">Reference / Notes:</span>
                      <span className="text-gray-700 italic">{viewReceiptModal.description}</span>
                    </div>
                  )}
                </div>

                {/* Amount Box */}
                <div className="border-2 border-purple-600 rounded-xl p-4 text-center bg-purple-50 mb-8">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                    Capital Amount Contributed
                  </span>
                  <div className="text-3xl font-extrabold text-purple-950 mt-1">
                    ₹{viewReceiptModal.amount.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-purple-800 mt-1">
                    Credited into the Centre's Capital Equity Fund Account
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 mt-4 text-center text-xs">
                  <div>
                    <div className="border-t border-gray-400 w-3/4 mx-auto pt-2 font-medium text-gray-700">
                      Contributing Partner Signature
                    </div>
                    <span className="text-[10px] text-gray-400">({viewReceiptModal.partnerName || 'Partner'})</span>
                  </div>
                  <div>
                    <div className="border-t border-gray-400 w-3/4 mx-auto pt-2 font-medium text-gray-700">
                      Authorised Managing Signatory
                    </div>
                    <span className="text-[10px] text-gray-400">For Little Buds Child Care Centre</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASH DEPOSIT TO BANK MODAL (CONTRA ENTRY) */}
      {showCashDepositModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div 
              className="fixed inset-0 transition-opacity" 
              aria-hidden="true" 
              onClick={() => !isDepositingCash && setShowCashDepositModal(false)}
            >
              <div className="absolute inset-0 bg-gray-900 opacity-60"></div>
            </div>

            <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all border border-emerald-100">
              <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-white/15 rounded-lg backdrop-blur-xs">
                    <ArrowRightLeft className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Deposit Cash in Hand to Bank</h3>
                    <p className="text-xs text-emerald-100">
                      Contra Entry: Transfers physical cash to bank without impacting P&L
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isDepositingCash && setShowCashDepositModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCashDepositSubmit} className="p-6 space-y-4">
                {/* Liquidity summary banner */}
                <div className="bg-emerald-50/80 rounded-xl p-3.5 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                        Available Cash in Hand
                      </span>
                      <span className="text-xl font-extrabold text-emerald-900 font-mono tabular-nums">
                        ₹{rp.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                        Current Bank Balance
                      </span>
                      <span className="text-xl font-extrabold text-blue-900 font-mono tabular-nums">
                        ₹{rp.bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {rp.cashBalance > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-emerald-200/70">
                      <span className="text-[11px] text-emerald-800 font-semibold mr-1">Quick Select:</span>
                      <button
                        type="button"
                        onClick={() => setCashDepositFormData(prev => ({ ...prev, amount: rp.cashBalance.toString() }))}
                        className="px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 rounded border border-emerald-300 transition-colors"
                      >
                        All Cash (₹{rp.cashBalance.toLocaleString('en-IN')})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashDepositFormData(prev => ({ ...prev, amount: (Math.round(rp.cashBalance / 2)).toString() }))}
                        className="px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 rounded border border-emerald-300 transition-colors"
                      >
                        50% (₹{(Math.round(rp.cashBalance / 2)).toLocaleString('en-IN')})
                      </button>
                    </div>
                  )}
                </div>

                {/* Transfer Date */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">Deposit Date *</label>
                    {cashDepositFormData.date && (
                      <span className="text-[11px] font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {formatDate(cashDepositFormData.date)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    value={cashDepositFormData.date}
                    onChange={e => setCashDepositFormData({ ...cashDepositFormData, date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border"
                  />
                </div>

                {/* Amount to Deposit */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Deposit Amount (₹) *
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-500 sm:text-sm">₹</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={cashDepositFormData.amount}
                      onChange={e => setCashDepositFormData({ ...cashDepositFormData, amount: e.target.value })}
                      className="block w-full rounded-md border-gray-300 pl-7 pr-3 py-2 focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border font-mono font-bold text-gray-900"
                    />
                  </div>
                  {parseFloat(cashDepositFormData.amount) > rp.cashBalance && rp.cashBalance > 0 && (
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      ⚠️ Note: Depositing amount exceeds current physical cash in hand (₹{rp.cashBalance.toLocaleString('en-IN')}).
                    </p>
                  )}
                </div>

                {/* Destination Bank Account */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Destination Bank Account *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary Bank Account (Account #1020), State Bank of India"
                    value={cashDepositFormData.bankName}
                    onChange={e => setCashDepositFormData({ ...cashDepositFormData, bankName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border"
                  />
                </div>

                {/* Slip Number and Deposited By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Bank Deposit Slip / Challan #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SLIP-2026-001 or CDM #4491"
                      value={cashDepositFormData.depositSlipNumber}
                      onChange={e => setCashDepositFormData({ ...cashDepositFormData, depositSlipNumber: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Deposited By (Staff Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Centre Admin / Manager"
                      value={cashDepositFormData.depositedBy}
                      onChange={e => setCashDepositFormData({ ...cashDepositFormData, depositedBy: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border"
                    />
                  </div>
                </div>

                {/* Description / Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Narration / Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Cash in hand from fee collections deposited directly into centre primary bank account"
                    value={cashDepositFormData.description}
                    onChange={e => setCashDepositFormData({ ...cashDepositFormData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border text-xs"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={isDepositingCash}
                    onClick={() => setShowCashDepositModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDepositingCash}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isDepositingCash ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                        Recording Transfer...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Confirm Deposit to Bank
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CASH WITHDRAWAL FROM BANK (CONTRA ENTRY) MODAL */}
      {showCashWithdrawalModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div 
              className="fixed inset-0 transition-opacity" 
              aria-hidden="true" 
              onClick={() => !isWithdrawingCash && setShowCashWithdrawalModal(false)}
            >
              <div className="absolute inset-0 bg-gray-900 opacity-60"></div>
            </div>

            <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all border border-blue-100">
              <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-white/15 rounded-lg backdrop-blur-xs">
                    <ArrowRightLeft className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Withdraw Cash from Bank</h3>
                    <p className="text-xs text-blue-100">
                      Contra Entry: Transfers funds from Bank (1010) to Cash Drawer (1020) without impacting P&L
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isWithdrawingCash && setShowCashWithdrawalModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCashWithdrawalSubmit} className="p-6 space-y-4">
                {/* Liquidity summary banner */}
                <div className="bg-blue-50/80 rounded-xl p-3.5 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                        Source Bank Balance
                      </span>
                      <span className="text-xl font-extrabold text-blue-900 font-mono tabular-nums">
                        ₹{rp.bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                        Current Cash in Hand
                      </span>
                      <span className="text-xl font-extrabold text-emerald-900 font-mono tabular-nums">
                        ₹{rp.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-blue-200/70">
                    <span className="text-[11px] text-blue-800 font-semibold mr-1">Quick Select:</span>
                    <button
                      type="button"
                      onClick={() => setCashWithdrawalFormData(prev => ({ ...prev, amount: '5000' }))}
                      className="px-2 py-0.5 text-[11px] font-bold text-blue-800 bg-white hover:bg-blue-100 rounded border border-blue-300 transition-colors"
                    >
                      ₹5,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashWithdrawalFormData(prev => ({ ...prev, amount: '10000' }))}
                      className="px-2 py-0.5 text-[11px] font-bold text-blue-800 bg-white hover:bg-blue-100 rounded border border-blue-300 transition-colors"
                    >
                      ₹10,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashWithdrawalFormData(prev => ({ ...prev, amount: '25000' }))}
                      className="px-2 py-0.5 text-[11px] font-bold text-blue-800 bg-white hover:bg-blue-100 rounded border border-blue-300 transition-colors"
                    >
                      ₹25,000
                    </button>
                    {rp.bankBalance > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCashWithdrawalFormData(prev => ({ ...prev, amount: (Math.round(rp.bankBalance / 2)).toString() }))}
                          className="px-2 py-0.5 text-[11px] font-bold text-blue-800 bg-white hover:bg-blue-100 rounded border border-blue-300 transition-colors"
                        >
                          50% Bank
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashWithdrawalFormData(prev => ({ ...prev, amount: rp.bankBalance.toString() }))}
                          className="px-2 py-0.5 text-[11px] font-bold text-blue-800 bg-white hover:bg-blue-100 rounded border border-blue-300 transition-colors"
                        >
                          All Bank Funds
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Transfer Date */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">Withdrawal Date *</label>
                    {cashWithdrawalFormData.date && (
                      <span className="text-[11px] font-mono text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {formatDate(cashWithdrawalFormData.date)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    value={cashWithdrawalFormData.date}
                    onChange={e => setCashWithdrawalFormData({ ...cashWithdrawalFormData, date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border"
                  />
                </div>

                {/* Amount to Withdraw */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Withdrawal Amount (₹) *
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-500 sm:text-sm">₹</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={cashWithdrawalFormData.amount}
                      onChange={e => setCashWithdrawalFormData({ ...cashWithdrawalFormData, amount: e.target.value })}
                      className="block w-full rounded-md border-gray-300 pl-7 pr-3 py-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm border font-mono font-bold text-gray-900"
                    />
                  </div>
                  {parseFloat(cashWithdrawalFormData.amount) > rp.bankBalance && rp.bankBalance > 0 && (
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      ⚠️ Note: Withdrawal amount exceeds current bank balance (₹{rp.bankBalance.toLocaleString('en-IN')}).
                    </p>
                  )}
                </div>

                {/* Source Bank Account */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Source Bank Account *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary Business Bank Account (Account #1010), State Bank of India"
                    value={cashWithdrawalFormData.bankName}
                    onChange={e => setCashWithdrawalFormData({ ...cashWithdrawalFormData, bankName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border"
                  />
                </div>

                {/* Cheque / ATM Ref and Withdrawn By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Cheque # / ATM Slip / Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CHQ-88201 or ATM-0921"
                      value={cashWithdrawalFormData.referenceNumber}
                      onChange={e => setCashWithdrawalFormData({ ...cashWithdrawalFormData, referenceNumber: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">
                      Withdrawn By (Staff Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Centre Admin / Custodian"
                      value={cashWithdrawalFormData.withdrawnBy}
                      onChange={e => setCashWithdrawalFormData({ ...cashWithdrawalFormData, withdrawnBy: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border"
                    />
                  </div>
                </div>

                {/* Description / Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Narration / Purpose
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Cash withdrawn from bank to replenish physical cash drawer for centre operations"
                    value={cashWithdrawalFormData.description}
                    onChange={e => setCashWithdrawalFormData({ ...cashWithdrawalFormData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-1.5 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border text-xs"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={isWithdrawingCash}
                    onClick={() => setShowCashWithdrawalModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isWithdrawingCash}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isWithdrawingCash ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                        Recording Withdrawal...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Confirm Cash Withdrawal
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* STANDARDIZED DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={!!transactionToDelete}
        title={transactionToDelete && isAssetTx(transactionToDelete) ? "Delete Capital Asset" : "Delete Transaction Record"}
        itemName={
          transactionToDelete 
            ? `${transactionToDelete.category} - ₹${transactionToDelete.amount.toFixed(2)}${transactionToDelete.description ? ` (${transactionToDelete.description})` : ''}`
            : undefined
        }
        message={
          transactionToDelete && isAssetTx(transactionToDelete)
            ? "Are you sure you want to delete this capital asset? It will be permanently removed from the Asset Register and Balance Sheet."
            : "Are you sure you want to delete this financial transaction? All accounting reports, cash flows, and statements will be updated immediately."
        }
        confirmText="Delete Record"
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setTransactionToDelete(null)}
      />

      {/* PAYMENT VOUCHER MODAL */}
      <PaymentVoucherModal
        isOpen={!!selectedVoucherTx}
        transaction={selectedVoucherTx}
        onClose={() => setSelectedVoucherTx(null)}
        onTransactionUpdated={(updatedTx) => {
          setSelectedVoucherTx(updatedTx);
          loadData();
          addToast('success', 'Voucher details updated and saved to ledger');
        }}
      />

      {/* CUSTOM ACCOUNTING CATEGORY MODAL */}
      <CustomCategoryModal
        isOpen={showCustomCategoryModal}
        onClose={() => setShowCustomCategoryModal(false)}
        defaultType={customCategoryDefaultType}
        accounts={accountsList}
        onCategoryAdded={(newCat) => {
          setCustomCategoriesList(prev => [...prev.filter(c => c.name.toLowerCase() !== newCat.name.toLowerCase()), newCat]);
          addToast('success', `Custom category "${newCat.name}" added successfully.`);
        }}
      />

      {/* CUSTOM GENERAL LEDGER HEAD MODAL */}
      <CustomLedgerModal
        isOpen={showCustomLedgerModal}
        onClose={() => setShowCustomLedgerModal(false)}
        existingAccounts={accountsList}
        defaultType={customLedgerDefaultType}
        onAccountAdded={(newAcc) => {
          setAccountsList(prev => [...prev, newAcc].sort((a, b) => a.code.localeCompare(b.code)));
          addToast('success', `General ledger account ${newAcc.code} - ${newAcc.name} created.`);
          loadAccounts();
        }}
      />

      {/* TOAST NOTIFICATIONS */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default ReportsFinances;
