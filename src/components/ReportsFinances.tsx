import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFees, getAttendanceByMonth, getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../services/api';
import { Fee, Attendance, FinanceTransaction, AssetDetails, DepositDetails, TransactionType, PurchaseType, ChartOfAccountItem } from '../types';
import { getChartOfAccounts } from '../services/chartOfAccountsService';
import ChartOfAccountsView from './ChartOfAccountsView';
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
  Filter, Check, BookOpen, Palette, ShieldCheck
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import DeleteConfirmModal from './DeleteConfirmModal';
import { PaymentVoucherModal } from './PaymentVoucherModal';
import { ToastContainer, ToastMessage } from './Toast';
import { useTypography } from '../contexts/TypographyContext';
import { StyledWordText } from './StyledWordText';

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
  const validTabs = ['dashboard', 'pnl', 'balance', 'partners', 'receipts', 'cashflow', 'accounts'] as const;

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pnl' | 'balance' | 'partners' | 'receipts' | 'cashflow' | 'accounts'>(
    validTabs.includes(initialUrlTab as any) ? (initialUrlTab as any) : 'dashboard'
  );

  // Chart of Accounts general ledger state
  const [accountsList, setAccountsList] = useState<ChartOfAccountItem[]>([]);

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

  // Partner filter and search in Partners tab
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');
  const [partnerSearchQuery, setPartnerSearchQuery] = useState<string>('');
  const [investmentToEdit, setInvestmentToEdit] = useState<FinanceTransaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    partnerName: '',
    category: PARTNER_INVESTMENT_CATEGORIES[0],
    paymentMode: PAYMENT_MODES[0],
    description: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewReceiptModal, setViewReceiptModal] = useState<FinanceTransaction | null>(null);

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

  // Transaction list filter
  const [txFilter, setTxFilter] = useState<'ALL' | 'EXPENSE' | 'ASSET' | 'DEPOSIT' | 'INCOME' | 'INVESTMENT'>('ALL');

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
    termsOrDuration: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(today, 5));
      const endOfThisMonth = endOfMonth(today);
      
      const [feesData, attendanceData, transData, coaData] = await Promise.all([
        getFees(),
        getAttendanceByMonth(format(sixMonthsAgo, 'yyyy-MM-dd'), format(endOfThisMonth, 'yyyy-MM-dd')),
        getTransactions(),
        getChartOfAccounts()
      ]);
      
      setFees(feesData);
      setAttendance(attendanceData);
      setTransactions(transData);
      setAccountsList(coaData);
    } catch (error) {
      console.error("Failed to load reports data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Classification Helpers
  const isDepositTx = (t: FinanceTransaction): boolean => {
    return t.type === 'Deposit' || t.purchaseType === 'Deposit' || (t.category && t.category.toLowerCase().includes('deposit'));
  };

  const isInvestmentTx = (t: FinanceTransaction): boolean => {
    return (t.type === 'Investment' || t.purchaseType === 'Investment' || (t.category && t.category.toLowerCase().includes('partner capital'))) && !isDepositTx(t);
  };

  const isAssetTx = (t: FinanceTransaction): boolean => {
    return (t.type === 'Asset' || t.purchaseType === 'Asset') && !isInvestmentTx(t) && !isDepositTx(t);
  };

  const isExpenseTx = (t: FinanceTransaction): boolean => {
    return t.type === 'Expense' && t.purchaseType !== 'Asset' && t.purchaseType !== 'Deposit' && !isInvestmentTx(t) && !isDepositTx(t);
  };

  const isIncomeTx = (t: FinanceTransaction): boolean => {
    return t.type === 'Income' && !isInvestmentTx(t) && !isDepositTx(t);
  };

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
          type: 'Expense',
          purchaseType: 'Expense',
          category: formData.category,
          amount: parsedAmount,
          paymentMode: formData.paymentMode || PAYMENT_MODES[0],
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
        termsOrDuration: ''
      });
      loadData();
    } catch (error) {
      console.error("Error adding transaction", error);
      alert("Could not save transaction. Please check console.");
    }
  };

  const handleOpenEditInvestment = (tx: FinanceTransaction) => {
    setInvestmentToEdit(tx);
    setEditFormData({
      date: tx.date,
      amount: tx.amount.toString(),
      partnerName: tx.partnerName || '',
      category: tx.category || PARTNER_INVESTMENT_CATEGORIES[0],
      paymentMode: tx.paymentMode || PAYMENT_MODES[0],
      description: tx.description || ''
    });
  };

  const handleEditInvestmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investmentToEdit?.id) return;

    const parsedAmount = parseFloat(editFormData.amount);
    if (!editFormData.date || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid date and positive amount.");
      return;
    }
    if (!editFormData.partnerName.trim()) {
      alert("Please specify the partner name.");
      return;
    }

    setIsUpdating(true);
    try {
      const updatedData: Partial<FinanceTransaction> = {
        date: editFormData.date,
        amount: parsedAmount,
        partnerName: editFormData.partnerName.trim(),
        category: editFormData.category,
        paymentMode: editFormData.paymentMode,
        description: editFormData.description.trim() || `Capital investment by ${editFormData.partnerName.trim()}`,
        type: 'Investment',
        purchaseType: 'Investment'
      };

      await updateTransaction(investmentToEdit.id, updatedData);
      
      // Optimistically update local transactions
      setTransactions(prev => prev.map(t => t.id === investmentToEdit.id ? { ...t, ...updatedData } as FinanceTransaction : t));
      
      addToast('success', `Investment record for "${editFormData.partnerName.trim()}" updated successfully.`);
      setInvestmentToEdit(null);
      loadData();
    } catch (error) {
      console.error("Error updating investment:", error);
      addToast('error', 'Failed to update partner investment. Please try again.');
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
        } else {
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
        breakdown[t] = (breakdown[t] || 0) + 1;
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
  const processReceiptsAndPayments = () => {
    let totalReceipts = 0;
    let bankReceipts = 0;
    let cashReceipts = 0;

    let totalOperatingPayments = 0;
    let bankOperatingPayments = 0;
    let cashOperatingPayments = 0;

    let totalCapitalPayments = 0;
    let bankCapitalPayments = 0;
    let cashCapitalPayments = 0;

    let totalPartnerInvestments = 0;
    let bankPartnerInvestments = 0;
    let cashPartnerInvestments = 0;

    const receiptsByCategory: Record<string, number> = { 'Tuition Fees': 0 };
    const bankReceiptsByCategory: Record<string, number> = {};
    const cashReceiptsByCategory: Record<string, number> = {};
    const partnerInvestmentsByName: Record<string, number> = {};
    const operatingPaymentsByCategory: Record<string, number> = {};
    const capitalPaymentsByCategory: Record<string, number> = {};

    fees.forEach(f => {
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
      const amt = safeNum(t.amount);
      const isCash = isCashPaymentMode(t.paymentMode);

      if (isInvestmentTx(t)) {
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
      } else {
        operatingPaymentsByCategory[t.category] = (operatingPaymentsByCategory[t.category] || 0) + amt;
        totalOperatingPayments += amt;
        if (isCash) {
          cashOperatingPayments += amt;
        } else {
          bankOperatingPayments += amt;
        }
      }
    });

    const bankPayments = bankOperatingPayments + bankCapitalPayments;
    const cashPayments = cashOperatingPayments + cashCapitalPayments;
    const totalPayments = totalOperatingPayments + totalCapitalPayments;

    const bankBalance = bankReceipts - bankPayments;
    const cashBalance = cashReceipts - cashPayments;
    const closingBalance = totalReceipts - totalPayments;

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
        if (isIncomeTx(t) || isInvestmentTx(t)) {
          openingBalance += amt;
          if (isCash) openingCashBalance += amt;
          else openingBankBalance += amt;
        } else {
          openingBalance -= amt;
          if (isCash) openingCashBalance -= amt;
          else openingBankBalance -= amt;
        }
      } else if (t.date && t.date.startsWith(currentMonthPrefix)) {
        if (isInvestmentTx(t)) {
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
        } else {
          operatingOutflows += amt;
          if (isCash) cashOperatingOutflows += amt;
          else bankOperatingOutflows += amt;
        }
      }
    });

    const bankOutflows = bankOperatingOutflows + bankCapitalOutflows;
    const cashOutflows = cashOperatingOutflows + cashCapitalOutflows;
    const totalOutflows = operatingOutflows + capitalOutflows;

    const netBankFlow = bankInflows - bankOutflows;
    const netCashFlow = cashInflows - cashOutflows;
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
    const rp = processReceiptsAndPayments();
    
    // Accounts Receivable from pending fees
    let accountsReceivable = 0;
    fees.forEach(f => {
      if (safeNum(f.amount) > safeNum(f.amountPaid)) {
        accountsReceivable += (safeNum(f.amount) - safeNum(f.amountPaid));
      }
    });

    const bankBalance = rp.bankBalance;
    const cashBalance = rp.cashBalance;
    const cashAndBank = rp.closingBalance;

    // Security Deposits Paid (Refundable Current Assets)
    const depositTransactions = transactions.filter(isDepositTx);
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

    // Fixed Assets (Capital Assets)
    const assetTransactions = transactions.filter(isAssetTx);
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

    // Partner Capital contributions calculation
    const partnerInvestments = transactions.filter(isInvestmentTx);
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

    const totalAssets = currentAssets + totalFixedAssets;
    const liabilities = 0; // Current liabilities
    const equity = totalAssets - liabilities; // Balances perfectly
    const retainedEarnings = equity - totalPartnerCapital;

    return { 
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
      assetsByCategory, 
      assetTransactions,
      totalAssets, 
      liabilities, 
      equity,
      totalPartnerCapital,
      partnerCapitalByName,
      partnerInvestments,
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
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const qStart = new Date(now.getFullYear(), qStartMonth, 1);
      const qEnd = endOfMonth(new Date(now.getFullYear(), qStartMonth + 2, 1));
      startDate = format(qStart, 'yyyy-MM-dd');
      endDate = format(qEnd, 'yyyy-MM-dd');
      periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
      const prevQStart = new Date(now.getFullYear(), qStartMonth - 3, 1);
      const prevQEnd = endOfMonth(new Date(now.getFullYear(), qStartMonth - 1, 1));
      priorStartDate = format(prevQStart, 'yyyy-MM-dd');
      priorEndDate = format(prevQEnd, 'yyyy-MM-dd');
      monthsInPeriod = 3;
    } else if (pnlPeriod === 'ytd') {
      const fyStart = now.getMonth() >= 3 
        ? new Date(now.getFullYear(), 3, 1) 
        : new Date(now.getFullYear() - 1, 3, 1);
      startDate = format(fyStart, 'yyyy-MM-dd');
      endDate = format(now, 'yyyy-MM-dd');
      periodLabel = `FY ${fyStart.getFullYear()}-${fyStart.getFullYear() + 1} (YTD)`;
      const priorFyStart = new Date(fyStart.getFullYear() - 1, 3, 1);
      const priorFyEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      priorStartDate = format(priorFyStart, 'yyyy-MM-dd');
      priorEndDate = format(priorFyEnd, 'yyyy-MM-dd');
      monthsInPeriod = Math.max(1, (now.getFullYear() - fyStart.getFullYear()) * 12 + now.getMonth() - fyStart.getMonth() + 1);
    } else if (pnlPeriod === 'custom') {
      startDate = pnlCustomStart || format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = pnlCustomEnd || format(now, 'yyyy-MM-dd');
      periodLabel = `${startDate} to ${endDate}`;
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

    // Capital Asset Depreciation in period
    let totalDepreciation = 0;
    const depreciationByAssetCategory: Record<string, { totalCost: number; depreciation: number; count: number }> = {};
    
    transactions.filter(isAssetTx).forEach(t => {
      if (t.date && t.date <= endDate) {
        const cost = safeNum(t.amount);
        const usefulLife = safeNum(t.assetDetails?.usefulLifeYears) || 5;
        const monthlyDep = cost / (usefulLife * 12);
        const periodDep = monthlyDep * monthsInPeriod;
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
    return bs.partnerInvestments.filter(t => {
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
  }, [bs.partnerInvestments, partnerSearchQuery, partnerFilter]);

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
    if (txFilter === 'EXPENSE') return isExpenseTx(t);
    if (txFilter === 'ASSET') return isAssetTx(t);
    if (txFilter === 'DEPOSIT') return isDepositTx(t);
    if (txFilter === 'INCOME') return isIncomeTx(t);
    if (txFilter === 'INVESTMENT') return isInvestmentTx(t);
    return true;
  });

  // Excel Export with Fixed Assets Register
  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    
    const styleHeader = (ws: ExcelJS.Worksheet) => {
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      ws.getRow(1).alignment = { horizontal: 'center' };
    };

    const applyBorders = (ws: ExcelJS.Worksheet) => {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    };

    // 1. Profit & Loss Statement Sheet
    const wsPnl = wb.addWorksheet('Profit & Loss');
    wsPnl.columns = [
      { header: 'Section / Classification', key: 'section', width: 28 },
      { header: 'Particulars / Account Head', key: 'item', width: 42 },
      { header: `Amount (₹) [${pnl.periodLabel}]`, key: 'amount', width: 25 }
    ];

    wsPnl.addRow({ section: 'REVENUE', item: 'OPERATING REVENUES & INCOMES', amount: '' }).font = { bold: true };
    Object.entries(pnl.feesByType).forEach(([feeType, amt]) => {
      wsPnl.addRow({ section: 'Fee Collections', item: `Tuition Fees - ${feeType}`, amount: amt });
    });
    Object.entries(pnl.otherIncomesByCategory).forEach(([cat, amt]) => {
      wsPnl.addRow({ section: 'Other Income', item: cat, amount: amt });
    });
    wsPnl.addRow({ section: 'TOTAL REVENUE', item: 'TOTAL OPERATING REVENUE (A)', amount: pnl.totalRevenue }).font = { bold: true, color: { argb: 'FF10B981' } };
    wsPnl.addRow({});

    wsPnl.addRow({ section: 'EXPENSES', item: 'OPERATING EXPENSES & OVERHEADS', amount: '' }).font = { bold: true };
    Object.entries(pnl.expensesByCategory).forEach(([cat, data]) => {
      wsPnl.addRow({ section: 'Operating Overhead', item: `${cat} (${data.count} txns)`, amount: data.total });
    });
    wsPnl.addRow({ section: 'TOTAL EXPENSES', item: 'TOTAL OPERATING EXPENSES (B)', amount: pnl.totalOperatingExpenses }).font = { bold: true, color: { argb: 'FFEF4444' } };
    wsPnl.addRow({});

    wsPnl.addRow({ section: 'OPERATING PROFIT', item: 'OPERATING PROFIT / EBITDA (A - B)', amount: pnl.operatingProfit }).font = { bold: true, color: { argb: 'FF4F46E5' } };
    wsPnl.addRow({ section: 'OPERATING MARGIN', item: 'Operating Margin %', amount: `${pnl.operatingMargin.toFixed(1)}%` });
    wsPnl.addRow({});

    wsPnl.addRow({ section: 'DEPRECIATION', item: 'DEPRECIATION OF FIXED CAPITAL ASSETS', amount: '' }).font = { bold: true };
    Object.entries(pnl.depreciationByAssetCategory).forEach(([cat, data]) => {
      wsPnl.addRow({ section: 'Depreciation Schedule', item: `${cat} (${data.count} assets)`, amount: Math.round(data.depreciation) });
    });
    wsPnl.addRow({ section: 'TOTAL DEPRECIATION', item: 'TOTAL ASSET DEPRECIATION (C)', amount: Math.round(pnl.totalDepreciation) }).font = { bold: true };
    wsPnl.addRow({});

    wsPnl.addRow({ section: 'NET RESULT', item: 'NET PROFIT / SURPLUS (LOSS) [A - B - C]', amount: Math.round(pnl.netProfit) }).font = { bold: true, color: { argb: pnl.netProfit >= 0 ? 'FF10B981' : 'FFEF4444' } };
    wsPnl.addRow({ section: 'NET MARGIN', item: 'Net Profit Margin %', amount: `${pnl.netProfitMargin.toFixed(1)}%` });

    styleHeader(wsPnl);
    applyBorders(wsPnl);

    // 2. Balance Sheet Sheet
    const wsBs = wb.addWorksheet('Balance Sheet');
    wsBs.columns = [
      { header: 'Classification', key: 'class', width: 20 },
      { header: 'Category / Particulars', key: 'item', width: 40 },
      { header: 'Amount (Rs)', key: 'amount', width: 20 }
    ];
    
    wsBs.addRow({ class: 'Current Assets', item: 'Bank Balance (Bank Accounts, UPI & Online)', amount: bs.bankBalance });
    wsBs.addRow({ class: 'Current Assets', item: 'Cash Balance (Physical Cash in Hand)', amount: bs.cashBalance });
    wsBs.addRow({ class: 'Current Assets', item: 'Subtotal Cash & Bank Liquid Funds', amount: bs.cashAndBank }).font = { italic: true };
    wsBs.addRow({ class: 'Current Assets', item: 'Accounts Receivable (Fee Dues)', amount: bs.accountsReceivable });
    wsBs.addRow({ class: 'Current Assets', item: 'Security Deposits Paid (Premises Lease, Utility & Caution Deposits)', amount: bs.totalSecurityDeposits });
    wsBs.addRow({ class: 'Current Assets', item: 'TOTAL CURRENT ASSETS', amount: bs.currentAssets }).font = { bold: true };
    wsBs.addRow({});

    wsBs.addRow({ class: 'Fixed Assets', item: 'Fixed Capital Assets (Gross Book Value)', amount: '' }).font = { bold: true };
    Object.entries(bs.assetsByCategory).forEach(([category, data]) => {
      wsBs.addRow({ class: 'Fixed Assets', item: `${category} (${data.count} items)`, amount: data.total });
    });
    wsBs.addRow({ class: 'Fixed Assets', item: 'TOTAL FIXED ASSETS', amount: bs.totalFixedAssets }).font = { bold: true };
    wsBs.addRow({});

    wsBs.addRow({ class: 'Total Assets', item: 'TOTAL ASSETS', amount: bs.totalAssets }).font = { bold: true, color: { argb: 'FF4F46E5' } };
    wsBs.addRow({});

    wsBs.addRow({ class: 'Liabilities', item: 'Total Liabilities', amount: bs.liabilities });
    wsBs.addRow({ class: 'Equity', item: 'Capital & General Reserve Fund', amount: bs.equity });
    wsBs.addRow({ class: 'Liabilities & Equity', item: 'TOTAL LIABILITIES & EQUITY', amount: bs.liabilities + bs.equity }).font = { bold: true, color: { argb: 'FF10B981' } };

    styleHeader(wsBs);
    applyBorders(wsBs);

    // 2. Fixed Assets Register Detail Sheet
    const wsAssets = wb.addWorksheet('Fixed Assets Register');
    wsAssets.columns = [
      { header: 'Asset Name', key: 'name', width: 30 },
      { header: 'Asset Category', key: 'category', width: 28 },
      { header: 'Acquisition Date', key: 'date', width: 16 },
      { header: 'Cost Value (Rs)', key: 'cost', width: 18 },
      { header: 'Location / Room', key: 'location', width: 22 },
      { header: 'Useful Life (Yrs)', key: 'life', width: 16 },
      { header: 'Condition', key: 'condition', width: 15 },
      { header: 'Serial / Tag No.', key: 'serial', width: 20 },
      { header: 'Notes / Description', key: 'notes', width: 35 }
    ];

    bs.assetTransactions.forEach(t => {
      wsAssets.addRow({
        name: t.assetDetails?.assetName || t.description || t.category,
        category: t.assetDetails?.category || t.category,
        date: t.date,
        cost: t.amount,
        location: t.assetDetails?.locationOrRoom || 'Centre',
        life: t.assetDetails?.usefulLifeYears || 5,
        condition: t.assetDetails?.condition || 'Good',
        serial: t.assetDetails?.serialNumber || 'N/A',
        notes: t.assetDetails?.notes || t.description || ''
      });
    });

    wsAssets.addRow({});
    wsAssets.addRow({
      name: 'TOTAL FIXED ASSETS VALUE',
      category: `${bs.assetTransactions.length} Asset Items`,
      date: '',
      cost: bs.totalFixedAssets
    }).font = { bold: true, color: { argb: 'FF4F46E5' } };

    styleHeader(wsAssets);
    applyBorders(wsAssets);

    // 3. Security Deposits Register Detail Sheet (Current Assets)
    const wsDeposits = wb.addWorksheet('Security Deposits Register');
    wsDeposits.columns = [
      { header: 'Deposit Category', key: 'cat', width: 32 },
      { header: 'Payee / Landlord / Authority', key: 'payee', width: 28 },
      { header: 'Premises / Account / Meter', key: 'premises', width: 26 },
      { header: 'Date Paid', key: 'date', width: 14 },
      { header: 'Payment Mode', key: 'mode', width: 22 },
      { header: 'Agreement / Ref #', key: 'ref', width: 22 },
      { header: 'Accounting Classification', key: 'class', width: 26 },
      { header: 'Deposit Amount (Rs)', key: 'amount', width: 18 }
    ];

    bs.depositTransactions.forEach(t => {
      wsDeposits.addRow({
        cat: t.depositDetails?.depositCategory || t.category,
        payee: t.depositDetails?.payeeName || 'N/A',
        premises: t.depositDetails?.premisesOrAccount || 'Main Facility',
        date: t.date,
        mode: t.paymentMode || 'N/A',
        ref: t.depositDetails?.referenceNumber || 'N/A',
        class: 'Refundable Current Asset (Account 1300)',
        amount: t.amount
      });
    });

    wsDeposits.addRow({});
    wsDeposits.addRow({
      cat: 'TOTAL SECURITY DEPOSITS PLACED',
      payee: `${bs.depositTransactions.length} Active Deposits`,
      premises: '',
      date: '',
      mode: '',
      ref: '',
      class: 'Current Asset (Account 1300)',
      amount: bs.totalSecurityDeposits
    }).font = { bold: true, color: { argb: 'FF0D9488' } };

    styleHeader(wsDeposits);
    applyBorders(wsDeposits);

    // 4. Receipts & Payments
    const wsRp = wb.addWorksheet('Receipts & Payments');
    wsRp.columns = [
      { header: 'Account Type', key: 'cat', width: 20 },
      { header: 'Particulars', key: 'item', width: 40 },
      { header: 'Amount (Rs)', key: 'amount', width: 18 }
    ];
    
    wsRp.addRow({ cat: 'Receipts', item: 'Tuition Fees', amount: rp.receiptsByCategory['Tuition Fees'] || 0 });
    Object.entries(rp.receiptsByCategory).filter(([cat]) => cat !== 'Tuition Fees').forEach(([cat, amount]) => {
      wsRp.addRow({ cat: 'Receipts', item: cat, amount });
    });
    wsRp.addRow({ cat: 'Receipts', item: 'TOTAL RECEIPTS', amount: rp.totalReceipts }).font = { bold: true };
    wsRp.addRow({});

    wsRp.addRow({ cat: 'Payments (Operating)', item: '--- OPERATING EXPENSES ---', amount: '' }).font = { bold: true };
    Object.entries(rp.operatingPaymentsByCategory).forEach(([cat, amount]) => {
      wsRp.addRow({ cat: 'Operating Payment', item: cat, amount });
    });
    wsRp.addRow({ cat: 'Payments (Operating)', item: 'TOTAL OPERATING PAYMENTS', amount: rp.totalOperatingPayments }).font = { bold: true };
    wsRp.addRow({});

    wsRp.addRow({ cat: 'Payments (Capital)', item: '--- CAPITAL ASSET PURCHASES ---', amount: '' }).font = { bold: true };
    Object.entries(rp.capitalPaymentsByCategory).forEach(([cat, amount]) => {
      wsRp.addRow({ cat: 'Capital Payment', item: `Asset: ${cat}`, amount });
    });
    wsRp.addRow({ cat: 'Payments (Capital)', item: 'TOTAL CAPITAL ASSET PAYMENTS', amount: rp.totalCapitalPayments }).font = { bold: true };
    wsRp.addRow({});

    wsRp.addRow({ cat: 'Total Payments', item: 'TOTAL PAYMENTS (Operating + Capital)', amount: rp.totalPayments }).font = { bold: true };
    wsRp.addRow({ cat: 'Balance', item: 'Closing Bank Balance (Accounts & UPI)', amount: rp.bankBalance }).font = { bold: true, color: { argb: 'FF2563EB' } };
    wsRp.addRow({ cat: 'Balance', item: 'Closing Cash Balance (Cash in Hand)', amount: rp.cashBalance }).font = { bold: true, color: { argb: 'FF059669' } };
    wsRp.addRow({ cat: 'Balance', item: 'TOTAL CLOSING CASH & BANK BALANCE', amount: rp.closingBalance }).font = { bold: true, color: { argb: 'FF10B981' } };
    
    styleHeader(wsRp);
    applyBorders(wsRp);

    // 4. Cash Flow Statement
    const wsCf = wb.addWorksheet('Cash Flow');
    wsCf.columns = [
      { header: 'Particulars', key: 'item', width: 44 },
      { header: 'Amount (Rs)', key: 'amount', width: 20 }
    ];
    wsCf.addRows([
      { item: 'Opening Bank Balance', amount: cf.openingBankBalance },
      { item: 'Opening Cash in Hand Balance', amount: cf.openingCashBalance },
      { item: 'Total Opening Balance', amount: cf.openingBalance },
      { item: 'Operating Inflows via Bank (Fees & Incomes)', amount: cf.bankInflows },
      { item: 'Operating Inflows via Cash (Physical Cash)', amount: cf.cashInflows },
      { item: 'Total Operating Cash Inflows', amount: cf.inflows },
      { item: 'Operating Cash Outflows (Expenses)', amount: cf.operatingOutflows },
      { item: 'Investing / Capital Outflows (Asset Purchases)', amount: cf.capitalOutflows },
      { item: 'Total Outflows (Bank & Cash)', amount: cf.totalOutflows },
      { item: 'Net Bank Flow for Period', amount: cf.netBankFlow },
      { item: 'Net Cash Flow for Period', amount: cf.netCashFlow },
      { item: 'Net Total Cash & Bank Flow for Period', amount: cf.netCashFlowTotal },
      { item: 'Closing Bank Balance', amount: cf.closingBankBalance },
      { item: 'Closing Cash in Hand Balance', amount: cf.closingCashBalance },
      { item: 'TOTAL CLOSING CASH & BANK BALANCE', amount: cf.closingBalance }
    ]);
    wsCf.getRow(3).font = { bold: true };
    wsCf.getRow(6).font = { bold: true };
    wsCf.getRow(9).font = { bold: true };
    wsCf.getRow(12).font = { bold: true };
    wsCf.getRow(13).font = { bold: true, color: { argb: 'FF2563EB' } };
    wsCf.getRow(14).font = { bold: true, color: { argb: 'FF059669' } };
    wsCf.getRow(15).font = { bold: true, color: { argb: 'FF10B981' } };
    styleHeader(wsCf);
    applyBorders(wsCf);

    // 5. Partner Capital Worksheet
    const wsPartners = wb.addWorksheet('Partner Capital');
    wsPartners.columns = [
      { header: 'Partner Name', key: 'name', width: 26 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Investment Category', key: 'category', width: 30 },
      { header: 'Payment Mode', key: 'mode', width: 22 },
      { header: 'Notes / Reference', key: 'desc', width: 40 },
      { header: 'Amount (Rs)', key: 'amount', width: 18 }
    ];
    bs.partnerInvestments.forEach(t => {
      wsPartners.addRow({
        name: t.partnerName || 'Partner',
        date: t.date,
        category: t.category,
        mode: t.paymentMode || 'N/A',
        desc: t.description || '',
        amount: t.amount
      });
    });
    wsPartners.addRow({});
    wsPartners.addRow({
      name: 'TOTAL PARTNER CAPITAL',
      date: `${bs.partnerInvestments.length} Contributions`,
      category: `${Object.keys(bs.partnerCapitalByName).length} Partners`,
      mode: '',
      desc: '',
      amount: bs.totalPartnerCapital
    });
    wsPartners.getRow(wsPartners.rowCount).font = { bold: true, color: { argb: 'FF6B21A8' } };
    styleHeader(wsPartners);
    applyBorders(wsPartners);

    // 6. All Transactions Detail
    const wsTx = wb.addWorksheet('All Transactions');
    wsTx.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Classification', key: 'class', width: 25 },
      { header: 'Category', key: 'category', width: 28 },
      { header: 'Description / Payee / Partner', key: 'desc', width: 45 },
      { header: 'Amount (Rs)', key: 'amount', width: 16 }
    ];
    transactions.forEach(t => {
      const classification = isInvestmentTx(t) 
        ? `Partner Capital (${t.partnerName || 'Partner'})` 
        : (isAssetTx(t) ? 'Capital Asset' : (isExpenseTx(t) ? 'Operating Expense' : 'Income'));
      const desc = isInvestmentTx(t)
        ? `Partner: ${t.partnerName || 'Partner'}${t.paymentMode ? ` [Mode: ${t.paymentMode}]` : ''} - ${t.description || t.category}`
        : t.assetDetails?.assetName 
        ? `${t.assetDetails.assetName} [Loc: ${t.assetDetails.locationOrRoom || 'N/A'}]` 
        : t.description;
      wsTx.addRow({ 
        date: t.date, 
        type: t.type, 
        class: classification, 
        category: t.category, 
        desc, 
        amount: t.amount 
      });
    });
    styleHeader(wsTx);
    applyBorders(wsTx);

    // 7. Chart of Accounts Worksheet
    const wsCoa = wb.addWorksheet('Chart of Accounts');
    wsCoa.columns = [
      { header: 'Account Code', key: 'code', width: 14 },
      { header: 'Account Name', key: 'name', width: 34 },
      { header: 'Classification', key: 'type', width: 18 },
      { header: 'Subtype', key: 'subtype', width: 24 },
      { header: 'Normal Balance', key: 'normal', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Description / Purpose', key: 'desc', width: 45 }
    ];
    accountsList.forEach(a => {
      wsCoa.addRow({
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        normal: a.normalBalance,
        status: a.isActive ? 'Active' : 'Inactive',
        desc: a.description || ''
      });
    });
    styleHeader(wsCoa);
    applyBorders(wsCoa);

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Financial_Reports_${format(new Date(), 'MMM_yyyy')}.xlsx`);
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
            onClick={() => setActiveTab('accounts')}
            className={`${
              activeTab === 'accounts'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors focus:outline-none`}
          >
            <BookOpen className="h-4 w-4 text-indigo-600" />
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
                      <label className="block text-sm font-medium text-gray-700">
                        {formTransactionType === 'Income' ? 'Income Category' : 'Expense Category'}
                      </label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border"
                      >
                        {(formTransactionType === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
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
                    <span className="font-semibold text-gray-900">{format(parseISO(viewAssetModal.date), 'dd MMMM yyyy')}</span>
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
                    <span className="font-semibold text-gray-900">{format(parseISO(viewDepositModal.date), 'dd MMMM yyyy')}</span>
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
                  YTD
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
              <span className="text-[11px] text-emerald-600 font-medium mt-1 whitespace-normal">Drawer petty cash</span>
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
                  const isExpense = isExpenseTx(transaction);
                  const isIncome = isIncomeTx(transaction);

                  return (
                    <li key={transaction.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 flex justify-between items-center transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          isInvestment ? 'bg-purple-100 text-purple-600' : (isIncome ? 'bg-green-100 text-green-600' : (isDeposit ? 'bg-teal-100 text-teal-700' : (isAsset ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600')))
                        }`}>
                          {isInvestment ? (
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
                              {isInvestment 
                                ? `Partner Capital: ${transaction.partnerName || 'Partner'}`
                                : isDeposit
                                ? `Security Deposit: ${transaction.depositDetails?.payeeName || transaction.category}`
                                : isAsset && transaction.assetDetails?.assetName 
                                ? transaction.assetDetails.assetName 
                                : transaction.category}
                            </p>
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
                            {format(parseISO(transaction.date), 'dd MMM yyyy')} • {transaction.category}
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
                            {transaction.description && ` • ${transaction.description}`}
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
                            isInvestment ? 'text-purple-700' : (isIncome ? 'text-green-600' : (isDeposit ? 'text-teal-700' : (isAsset ? 'text-indigo-600' : 'text-red-600')))
                          }`}>
                            {isIncome || isInvestment ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
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
                              onClick={() => handleOpenEditInvestment(transaction)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors"
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
                          </>
                        )}

                        {isExpense && (
                          <button
                            onClick={() => setSelectedVoucherTx(transaction)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Print Payment Voucher"
                          >
                            <Printer className="h-4 w-4" />
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
            <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-xs hover:border-emerald-300 transition-colors">
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
                Little Buds Child Care Centre • As of {format(new Date(), 'dd MMMM yyyy')}
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
                                  <span className="font-semibold text-gray-900 text-xs sm:text-sm">Cash in Hand Balance</span>
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
                            <td className="py-2 px-2">Subtotal Fixed Capital Assets</td>
                            <td className="py-2 px-2 text-right text-indigo-700 font-mono tabular-nums">
                              ₹{bs.totalFixedAssets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    <span className="text-[11px] text-indigo-200 font-normal">Current Assets + Fixed Capital Equipment</span>
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
                              <span className="font-medium text-xs sm:text-sm text-gray-800">Current Liabilities & Trade Payables</span>
                              <p className="text-[11px] text-gray-400">Vendor payables & short-term obligations</p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">₹0.00</td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-2 text-gray-700">
                              <span className="font-medium text-xs sm:text-sm text-gray-800">Long-term Debt & Bank Loans</span>
                              <p className="text-[11px] text-gray-400">Term borrowings & equipment finance</p>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">₹0.00</td>
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
                                  <div className="text-xs sm:text-sm font-bold">Total Partner Capital Contributions</div>
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
                                  <div className="text-xs sm:text-sm font-medium text-gray-800">Retained Operational Reserves & Surplus</div>
                                  <span className="text-[11px] text-gray-400">Accumulated operating surplus from child care centre operations</span>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">
                                  ₹{bs.retainedEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-2 text-gray-700">
                                <div className="text-xs sm:text-sm font-medium text-gray-800">General Fund & Capital Reserves</div>
                                <span className="text-[11px] text-gray-400">Owner's equity and retained centre assets</span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-medium text-gray-900 tabular-nums">
                                ₹{bs.equity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            {format(parseISO(asset.date), 'dd MMM yyyy')}
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
                            {format(parseISO(deposit.date), 'dd MMM yyyy')}
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
                            <span>Last: {data.lastDate ? format(parseISO(data.lastDate), 'dd MMM yyyy') : 'N/A'}</span>
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
                          {format(parseISO(inv.date), 'dd MMM yyyy')}
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

                {/* Totals & Closing Balance */}
                <table className="w-full text-sm mt-4">
                  <tbody>
                    <tr className="bg-gray-100 font-bold border-t">
                      <td className="py-2 px-2 text-gray-900">Total Payments (A + B)</td>
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
                    <tr className="bg-blue-50/60 font-semibold border-t border-blue-200">
                      <td className="py-2 px-2 text-blue-900 flex items-center gap-1.5">
                        <Landmark className="h-4 w-4 text-blue-600 inline" /> Closing Bank Balance
                      </td>
                      <td className="py-2 px-2 text-right text-blue-700 font-bold">₹{rp.bankBalance.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-emerald-50/60 font-semibold border-t border-emerald-200">
                      <td className="py-2 px-2 text-emerald-900 flex items-center gap-1.5">
                        <Banknote className="h-4 w-4 text-emerald-600 inline" /> Closing Cash in Hand Balance
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
            depreciationTotal: bs.totalFixedAssets > 0 ? (pnl.totalDepreciation || 0) : 0
          }}
          onAccountsUpdated={loadAccounts}
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

      {/* EDIT PARTNER INVESTMENT MODAL */}
      {investmentToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setInvestmentToEdit(null)}>
              <div className="absolute inset-0 bg-gray-600 opacity-60"></div>
            </div>

            <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all">
              <div className="bg-gradient-to-r from-purple-800 to-indigo-800 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <Pencil className="h-5 w-5" />
                  <h3 className="text-lg font-bold">Edit Partner Investment</h3>
                </div>
                <button onClick={() => setInvestmentToEdit(null)} className="text-white hover:text-purple-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEditInvestmentSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Partner Name *</label>
                  <input
                    type="text"
                    required
                    list="edit-partner-name-suggestions"
                    value={editFormData.partnerName}
                    onChange={e => setEditFormData({ ...editFormData, partnerName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                  />
                  <datalist id="edit-partner-name-suggestions">
                    {knownPartnerNames.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Date *</label>
                    <input
                      type="date"
                      required
                      value={editFormData.date}
                      onChange={e => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Investment Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={editFormData.amount}
                      onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Payment Mode *</label>
                    <select
                      value={editFormData.paymentMode}
                      onChange={e => setEditFormData({ ...editFormData, paymentMode: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                    >
                      {PAYMENT_MODES.map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Investment Category</label>
                    <select
                      value={editFormData.category}
                      onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                    >
                      {PARTNER_INVESTMENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">Notes / Reference / Cheque No.</label>
                  <input
                    type="text"
                    value={editFormData.description}
                    onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setInvestmentToEdit(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Update Investment'}
                  </button>
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
                      {format(parseISO(viewReceiptModal.date), 'dd MMMM yyyy')}
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

      {/* TOAST NOTIFICATIONS */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default ReportsFinances;
