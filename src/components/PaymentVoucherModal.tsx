import React, { useState, useEffect, useMemo } from 'react';
import { FinanceTransaction } from '../types';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Building2,
  FileCheck2,
  CreditCard,
  Banknote,
  Landmark,
  ShieldCheck,
  Package,
  Calendar,
  Hash,
  AlertCircle,
  Edit3,
  Eye,
  Save,
  RotateCcw,
  Sparkles,
  User,
  FileText,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  defaultVoucherSettings,
  printVoucherDocument,
  downloadVoucherPdf,
  generatePrintableVoucherHtml,
  getVoucherNumber,
  getAccountHeadInfo,
  getPayeeName,
  getStoredVoucherSettings,
  saveStoredVoucherSettings,
  VoucherSettings,
  EditableVoucherDetails
} from '../utils/voucherPdf';
import { numberToWords } from '../utils/invoicePdf';
import { useTypography } from '../contexts/TypographyContext';
import { updateTransaction } from '../services/api';

interface PaymentVoucherModalProps {
  transaction: FinanceTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onTransactionUpdated?: (updatedTransaction: FinanceTransaction) => void;
}

const COMMON_ACCOUNT_HEADS = [
  { code: '#5000', name: 'Premises Rent & Facility Lease' },
  { code: '#5100', name: 'Utilities, Electricity & Power' },
  { code: '#5200', name: 'Staff Salaries, Wages & Professional Fees' },
  { code: '#5300', name: 'Teaching, Sensory & Play Materials' },
  { code: '#5400', name: 'Facility Repairs & Equipment Maintenance' },
  { code: '#5500', name: 'Student Nutrition, Food & Pantry' },
  { code: '#5600', name: 'Marketing, Printing & Outreach' },
  { code: '#5700', name: 'Administrative & Office Overheads' },
  { code: '#1300', name: 'Security Deposits (Current Asset)' },
  { code: '#1500', name: 'Capital Assets & Equipment (Fixed Asset)' },
  { code: '#5900', name: 'General Operating Expense' }
];

const PAYMENT_MODES = [
  'Bank Transfer',
  'Cash',
  'UPI',
  'Cheque',
  'Credit Card',
  'Debit Card',
  'Demand Draft'
];

export const PaymentVoucherModal: React.FC<PaymentVoucherModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onTransactionUpdated
}) => {
  const { accentColor } = useTypography();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Editable Form States
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [accountHead, setAccountHead] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [amountInWords, setAmountInWords] = useState('');
  const [narration, setNarration] = useState('');
  const [disbursedFrom, setDisbursedFrom] = useState('');
  const [preparedBy, setPreparedBy] = useState('Accounts Assistant');
  const [preparedByTitle, setPreparedByTitle] = useState('Prepared By');
  const [checkedBy, setCheckedBy] = useState('Internal Auditor');
  const [checkedByTitle, setCheckedByTitle] = useState('Checked & Verified');
  const [authorizedBy, setAuthorizedBy] = useState('Managing Director');
  const [authorizedByTitle, setAuthorizedByTitle] = useState('Authorized Signatory');
  const [receivedBy, setReceivedBy] = useState('');
  const [receivedByTitle, setReceivedByTitle] = useState("Receiver's Signature");
  const [notesOrRemarks, setNotesOrRemarks] = useState(
    'This payment has been verified against bills, supporting invoices, or contractual agreements, and debited to the respective account head in Little Buds Child Care Centre accounts.'
  );

  // Editable Company / Centre Header States
  const [centreName, setCentreName] = useState(defaultVoucherSettings.centreName);
  const [subName, setSubName] = useState(defaultVoucherSettings.subName);
  const [address, setAddress] = useState(defaultVoucherSettings.address);
  const [contactInfo, setContactInfo] = useState(defaultVoucherSettings.contactInfo);
  const [regNumber, setRegNumber] = useState(defaultVoucherSettings.regNumber || '');
  const [panNumber, setPanNumber] = useState(defaultVoucherSettings.panNumber || '');
  const [savedSettingsMsg, setSavedSettingsMsg] = useState('');

  // Initialize or reset form values whenever the selected transaction changes
  const initForm = (tx: FinanceTransaction) => {
    const acc = getAccountHeadInfo(tx);
    const payee = getPayeeName(tx);
    const ref =
      tx.depositDetails?.referenceNumber ||
      tx.assetDetails?.serialNumber ||
      (tx.description?.match(/(?:ref|cheque|utr|chq|txn|inv)[\s#:]*([A-Za-z0-9-]+)/i)?.[1]) ||
      '';

    setVoucherNumber(getVoucherNumber(tx));
    setVoucherDate(tx.date || format(new Date(), 'yyyy-MM-dd'));
    setPayeeName(payee);
    setPaymentMode(tx.paymentMode || 'Bank Transfer');
    setReferenceNumber(ref || 'N/A');
    setAccountCode(acc.code);
    setAccountHead(acc.name);
    setAmount(tx.amount || 0);
    setAmountInWords(numberToWords(tx.amount || 0));
    setNarration(tx.description || tx.category || 'Disbursement for centre requirements');
    setDisbursedFrom(
      (tx.paymentMode || '').toLowerCase().includes('cash')
        ? 'Petty Cash Drawer'
        : 'Primary Bank Account'
    );
    setPreparedBy('Accounts Assistant');
    setPreparedByTitle('Prepared By');
    setCheckedBy('Internal Auditor');
    setCheckedByTitle('Checked & Verified');
    setAuthorizedBy('Managing Director');
    setAuthorizedByTitle('Authorized Signatory');
    setReceivedBy(payee || 'Payee / Beneficiary');
    setReceivedByTitle("Receiver's Signature");
    setNotesOrRemarks(
      'This payment has been verified against bills, supporting invoices, or contractual agreements, and debited to the respective account head in Little Buds Child Care Centre accounts.'
    );

    // Load custom stored company settings if available
    const stored = getStoredVoucherSettings();
    setCentreName(stored.centreName);
    setSubName(stored.subName);
    setAddress(stored.address);
    setContactInfo(stored.contactInfo);
    setRegNumber(stored.regNumber || '');
    setPanNumber(stored.panNumber || '');

    setIsEditing(false);
    setSaveSuccessMsg('');
    setSavedSettingsMsg('');
  };

  const handleSaveCompanyDefaults = () => {
    saveStoredVoucherSettings({
      centreName,
      subName,
      address,
      contactInfo,
      regNumber,
      panNumber
    });
    setSavedSettingsMsg('Company details saved as default for all vouchers!');
    setTimeout(() => setSavedSettingsMsg(''), 4000);
  };

  useEffect(() => {
    if (transaction && isOpen) {
      initForm(transaction);
    }
  }, [transaction?.id, isOpen]);

  const voucherSettings: VoucherSettings = {
    ...defaultVoucherSettings,
    centreName,
    subName,
    address,
    contactInfo,
    regNumber,
    panNumber,
    accentColor: accentColor || defaultVoucherSettings.accentColor
  };

  const customDetails: EditableVoucherDetails = {
    centreName,
    subName,
    address,
    contactInfo,
    regNumber,
    panNumber,
    voucherNumber,
    voucherDate,
    payeeName,
    paymentMode,
    referenceNumber,
    accountCode,
    accountHead,
    amount,
    amountInWords,
    narration,
    disbursedFrom,
    preparedBy,
    preparedByTitle,
    checkedBy,
    checkedByTitle,
    authorizedBy,
    authorizedByTitle,
    receivedBy,
    receivedByTitle,
    notesOrRemarks
  };

  // Formatted date for display in preview
  let formattedVoucherDate = voucherDate;
  try {
    if (voucherDate && voucherDate.includes('-') && voucherDate.length === 10) {
      formattedVoucherDate = format(parseISO(voucherDate), 'dd MMMM yyyy');
    }
  } catch {
    formattedVoucherDate = voucherDate;
  }

  const isDeposit = transaction?.purchaseType === 'Deposit' || transaction?.type === 'Deposit';
  const isAsset = transaction?.purchaseType === 'Asset' || transaction?.type === 'Asset';

  const handleAmountChange = (newAmtVal: number) => {
    setAmount(newAmtVal);
    if (!isNaN(newAmtVal) && newAmtVal >= 0) {
      setAmountInWords(numberToWords(newAmtVal));
    }
  };

  const handleAccountHeadSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = COMMON_ACCOUNT_HEADS.find(h => h.code === e.target.value);
    if (selected) {
      setAccountCode(selected.code);
      setAccountHead(selected.name);
    }
  };

  // Self-contained standalone printable HTML blob URL for direct new-tab printing
  const printBlobUrl = useMemo(() => {
    if (!isOpen || !transaction) return '';
    try {
      const html = generatePrintableVoucherHtml(transaction, voucherSettings, customDetails);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to generate printable voucher HTML blob', e);
      return '';
    }
  }, [transaction, voucherSettings, customDetails, isOpen]);

  const handlePrint = async () => {
    if (!transaction) return;
    setIsPrinting(true);
    try {
      // Step 1: In-page print isolation class
      document.body.classList.add('printing-voucher');

      // Attempt iframe print first
      const printed = await printVoucherDocument(transaction, voucherSettings, customDetails);
      if (!printed) {
        // Fallback: in-page print dialog
        window.print();
      }
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print():', err);
      window.print();
    } finally {
      setTimeout(() => {
        document.body.classList.remove('printing-voucher');
      }, 1500);
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!transaction) return;
    setIsDownloading(true);
    try {
      await downloadVoucherPdf(transaction, voucherSettings, customDetails);
    } catch (err) {
      console.error('Failed to download PDF voucher', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyDetails = () => {
    const summary = `PAYMENT VOUCHER: ${voucherNumber}
Date: ${formattedVoucherDate}
Paid To: ${payeeName}
Amount: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Words: ${amountInWords}
Debit Head: ${accountCode} - ${accountHead}
Mode: ${paymentMode}
Ref: ${referenceNumber}
Narration: ${narration}
Centre: ${voucherSettings.centreName}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveToDatabase = async () => {
    if (!transaction?.id) return;
    setIsSavingDb(true);
    setSaveSuccessMsg('');
    try {
      const updates: Partial<FinanceTransaction> = {
        amount: Number(amount),
        paymentMode,
        date: voucherDate,
        description: narration,
        category: accountHead || transaction.category
      };

      if (isDeposit && transaction.depositDetails) {
        updates.depositDetails = {
          ...transaction.depositDetails,
          payeeName,
          referenceNumber
        };
      }

      await updateTransaction(transaction.id, updates);

      const updatedTx: FinanceTransaction = {
        ...transaction,
        ...updates
      };

      if (onTransactionUpdated) {
        onTransactionUpdated(updatedTx);
      }

      setSaveSuccessMsg('Transaction & voucher details saved to database successfully!');
      setTimeout(() => {
        setSaveSuccessMsg('');
      }, 4000);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update transaction', err);
      alert('Could not update transaction in database. Please check your network connection.');
    } finally {
      setIsSavingDb(false);
    }
  };

  const getModeIcon = () => {
    const m = paymentMode.toLowerCase();
    if (m.includes('cash')) return <Banknote className="h-4 w-4 text-emerald-600" />;
    if (m.includes('bank')) return <Landmark className="h-4 w-4 text-blue-600" />;
    if (m.includes('upi')) return <CreditCard className="h-4 w-4 text-purple-600" />;
    return <CreditCard className="h-4 w-4 text-indigo-600" />;
  };

  // Safe exit if modal is closed or transaction is not selected, only AFTER all hooks have executed
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden relative">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-linear-to-r from-stone-900 via-stone-800 to-stone-900 text-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <FileCheck2 className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Payment Voucher
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-white/15 text-indigo-200">
                  {voucherNumber}
                </span>
                {isEditing && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Edit Mode
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-stone-300">
                {isEditing
                  ? 'Customize voucher metadata, payee, ledger head, and signatory blocks'
                  : 'Authorized disbursement record with account ledger debit & signatures'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Edit / Preview Mode Toggle */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isEditing
                  ? 'bg-amber-500 hover:bg-amber-600 text-stone-900'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={isEditing ? 'View Printable Voucher Preview' : 'Edit Voucher Details'}
            >
              {isEditing ? (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview Voucher</span>
                </>
              ) : (
                <>
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Details</span>
                </>
              )}
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Print Payment Voucher"
            >
              {isPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              <span>{isPrinting ? 'Printing...' : 'Print Voucher'}</span>
            </button>

            {/* Open Print Tab (Clean fallback) */}
            {printBlobUrl && (
              <a
                href={printBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg text-xs font-bold transition-all"
                title="Open standalone print document in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5 text-stone-200" />
                <span>Print Tab</span>
              </a>
            )}

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Download PDF Voucher"
            >
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>{isDownloading ? 'Saving...' : 'PDF'}</span>
            </button>

            {/* Copy Details */}
            <button
              onClick={handleCopyDetails}
              className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Copy Voucher Summary"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
            <span className="flex items-center gap-2 font-medium">
              <Check className="h-4 w-4 text-emerald-600" />
              {saveSuccessMsg}
            </span>
            <button
              onClick={() => setSaveSuccessMsg('')}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body: Switch between Edit Form & Voucher Preview */}
        {isEditing ? (
          /* ========================================================================= */
          /*                         EDIT VOUCHER DETAILS VIEW                         */
          /* ========================================================================= */
          <div className="overflow-y-auto p-5 sm:p-6 bg-stone-50 flex-1 space-y-6">
            {/* COMPANY / CENTRE HEADER DETAILS (EDITABLE) */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-stone-200 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Company / Child Care Centre Details (Voucher Header)
                    </h4>
                    <p className="text-xs text-stone-500">
                      Edit the organisation name, subtitle, address, and legal details printed on the voucher.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCompanyDefaults}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0"
                  title="Save these company details as the default for all future vouchers"
                >
                  <Save className="h-3.5 w-3.5" />
                  Set as Default for All Vouchers
                </button>
              </div>

              {savedSettingsMsg && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-800">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {savedSettingsMsg}
                  </span>
                  <button onClick={() => setSavedSettingsMsg('')} className="text-emerald-700 font-bold">✕</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-stone-700 font-bold mb-1">Company / Centre Name</label>
                  <input
                    type="text"
                    value={centreName}
                    onChange={e => setCentreName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-bold text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Little Buds Child Care Centre"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1">Subtitle / Tagline</label>
                  <input
                    type="text"
                    value={subName}
                    onChange={e => setSubName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Early Childhood Learning & Care Services"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-stone-700 font-bold mb-1">Company Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. 104 Blossom Lane, Green Garden Layout, Bengaluru - 560034"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1">Contact Information (Phone / Email)</label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={e => setContactInfo(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Ph: +91 98765 43210 | Email: accounts@littlebuds.in"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-stone-700 font-bold mb-1">Registration #</label>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={e => setRegNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. Reg: LBDC/2023/8842"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 font-bold mb-1">PAN / Tax ID</label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={e => setPanNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. PAN: AAACL8842K"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-stone-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Payment Voucher Specifics
                    </h4>
                    <p className="text-xs text-stone-500">
                      Adjust transaction details for printing or permanently update the financial record in the ledger.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => initForm(transaction)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Original
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Voucher Number */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Voucher Number
                  </label>
                  <div className="relative">
                    <Hash className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={voucherNumber}
                      onChange={e => setVoucherNumber(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg font-mono font-bold text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. PV-202609-00042"
                    />
                  </div>
                </div>

                {/* 2. Date */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Payment Date
                  </label>
                  <div className="relative">
                    <Calendar className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      value={voucherDate}
                      onChange={e => setVoucherDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 3. Payee / Beneficiary */}
                <div className="md:col-span-2">
                  <label className="block text-stone-700 font-bold mb-1">
                    Paid To / In Favour Of (Beneficiary / Vendor)
                  </label>
                  <div className="relative">
                    <User className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={payeeName}
                      onChange={e => setPayeeName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. Landlord Name / Vendor / Staff Member"
                    />
                  </div>
                </div>

                {/* 4. Payment Mode */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => {
                      const m = e.target.value;
                      setPaymentMode(m);
                      if (m.toLowerCase().includes('cash')) {
                        setDisbursedFrom('Petty Cash Drawer');
                      } else {
                        setDisbursedFrom('Primary Bank Account');
                      }
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {PAYMENT_MODES.map(mode => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Reference / Cheque / UTR */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Ref / Cheque / UTR / Transaction No.
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. UTR12345678, CHQ#00123"
                  />
                </div>

                {/* 6. Account Head Selection */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Debit Account Head (Quick Select)
                  </label>
                  <select
                    value={accountCode}
                    onChange={handleAccountHeadSelect}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Choose Account Head --</option>
                    {COMMON_ACCOUNT_HEADS.map(h => (
                      <option key={h.code} value={h.code}>
                        {h.code} - {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Custom Account Head Name */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Account Head Title / Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountCode}
                      onChange={e => setAccountCode(e.target.value)}
                      className="w-20 px-2.5 py-2 border border-stone-300 rounded-lg font-mono text-xs font-bold text-indigo-700"
                      placeholder="#5000"
                    />
                    <input
                      type="text"
                      value={accountHead}
                      onChange={e => setAccountHead(e.target.value)}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-semibold"
                      placeholder="e.g. Premises Rent"
                    />
                  </div>
                </div>

                {/* 8. Amount */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Disbursement Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="text-stone-500 font-bold absolute left-3 top-2">₹</span>
                    <input
                      type="number"
                      step="any"
                      value={amount}
                      onChange={e => handleAmountChange(parseFloat(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 border border-stone-300 rounded-lg font-mono font-bold text-base text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* 9. Disbursed From */}
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Disbursement Source Account
                  </label>
                  <input
                    type="text"
                    value={disbursedFrom}
                    onChange={e => setDisbursedFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Primary Centre Bank Account / Petty Cash"
                  />
                </div>

                {/* 10. Amount in Words */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-stone-700 font-bold">
                      Amount in Words
                    </label>
                    <button
                      type="button"
                      onClick={() => setAmountInWords(numberToWords(amount))}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-Generate Words
                    </button>
                  </div>
                  <input
                    type="text"
                    value={amountInWords}
                    onChange={e => setAmountInWords(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 italic font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Rupee Five Thousand Only"
                  />
                </div>

                {/* 11. Narration / Particulars */}
                <div className="md:col-span-2">
                  <label className="block text-stone-700 font-bold mb-1">
                    Particulars / Narration of Payment
                  </label>
                  <textarea
                    rows={2}
                    value={narration}
                    onChange={e => setNarration(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe transaction particulars, invoice reference, purpose, or period..."
                  />
                </div>
              </div>
            </div>

            {/* Signatures & Certification Configuration */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
              <h4 className="text-sm font-bold text-stone-900 mb-3 border-b border-stone-200 pb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                Signatures & Certification Blocks
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 1. Prepared By */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <label className="block font-bold text-stone-700 mb-1">Prepared By Block</label>
                  <input
                    type="text"
                    value={preparedByTitle}
                    onChange={e => setPreparedByTitle(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded mb-1.5 font-bold uppercase text-[11px]"
                    placeholder="PREPARED BY"
                  />
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={e => setPreparedBy(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded text-stone-800 text-[11px]"
                    placeholder="Officer / Staff Name"
                  />
                </div>

                {/* 2. Checked By */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <label className="block font-bold text-stone-700 mb-1">Checked & Verified</label>
                  <input
                    type="text"
                    value={checkedByTitle}
                    onChange={e => setCheckedByTitle(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded mb-1.5 font-bold uppercase text-[11px]"
                    placeholder="CHECKED BY"
                  />
                  <input
                    type="text"
                    value={checkedBy}
                    onChange={e => setCheckedBy(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded text-stone-800 text-[11px]"
                    placeholder="Internal Auditor"
                  />
                </div>

                {/* 3. Authorized By */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <label className="block font-bold text-stone-700 mb-1">Authorized Signatory</label>
                  <input
                    type="text"
                    value={authorizedByTitle}
                    onChange={e => setAuthorizedByTitle(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded mb-1.5 font-bold uppercase text-[11px]"
                    placeholder="AUTHORIZED SIGNATORY"
                  />
                  <input
                    type="text"
                    value={authorizedBy}
                    onChange={e => setAuthorizedBy(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded text-stone-800 text-[11px]"
                    placeholder="Managing Director"
                  />
                </div>

                {/* 4. Receiver Signature */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <label className="block font-bold text-stone-700 mb-1">Receiver's Sign</label>
                  <input
                    type="text"
                    value={receivedByTitle}
                    onChange={e => setReceivedByTitle(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded mb-1.5 font-bold uppercase text-[11px]"
                    placeholder="RECEIVER'S SIGNATURE"
                  />
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={e => setReceivedBy(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 rounded text-stone-800 text-[11px]"
                    placeholder="Payee / Beneficiary"
                  />
                </div>
              </div>

              {/* Notes / Certification */}
              <div className="mt-3">
                <label className="block font-bold text-stone-700 mb-1 text-xs">
                  Accounting Certification Note
                </label>
                <textarea
                  rows={2}
                  value={notesOrRemarks}
                  onChange={e => setNotesOrRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Official accounting certification wording..."
                />
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /*                       PRINTABLE VOUCHER PREVIEW VIEW                      */
          /* ========================================================================= */
          <div className="overflow-y-auto p-4 sm:p-6 bg-stone-100/70 flex-1">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border-2 border-stone-300 p-6 sm:p-8">
              {/* Inner Voucher Container (Tagged for @media print) */}
              <div id="printable-voucher" className="border border-stone-400/80 rounded-lg p-5 sm:p-6 bg-linear-to-b from-stone-50/30 to-white">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-stone-900 pb-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-indigo-600 shrink-0" />
                      <h1 className="text-base sm:text-lg font-extrabold text-stone-900 uppercase tracking-tight">
                        {centreName}
                      </h1>
                    </div>
                    <p className="text-xs font-bold text-indigo-700">
                      {subName}
                    </p>
                    <p className="text-[11px] text-stone-500 leading-relaxed max-w-sm">
                      {address}<br />
                      {contactInfo} {regNumber ? `• ${regNumber}` : ''} {panNumber ? `• ${panNumber}` : ''}
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0 flex flex-col sm:items-end">
                    <div className="inline-block bg-stone-900 text-white text-xs font-extrabold tracking-wider uppercase px-3 py-1.5 rounded shadow-2xs">
                      PAYMENT VOUCHER
                    </div>
                    <div className="text-[10px] font-bold text-stone-500 uppercase mt-1">
                      {paymentMode.toLowerCase().includes('cash')
                        ? 'Cash Payment Voucher'
                        : isDeposit
                        ? 'Security Deposit Debit'
                        : isAsset
                        ? 'Capital Asset Debit'
                        : 'Bank Transfer Voucher'}
                    </div>
                    <div className="mt-2 border border-dashed border-stone-400 bg-stone-50 text-stone-600 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">
                      Official Disbursement • Verified
                    </div>
                  </div>
                </div>

                {/* Meta Details Grid */}
                <div className="my-4 p-3.5 bg-stone-50 rounded-lg border border-stone-200 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold flex items-center gap-1">
                          <Hash className="h-3 w-3 text-stone-400" /> Voucher No:
                        </span>
                        <span className="font-mono font-bold text-indigo-700">{voucherNumber}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-stone-400" /> Date:
                        </span>
                        <span className="font-bold text-stone-900">{formattedVoucherDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold">Payment Mode:</span>
                        <span className="font-bold text-stone-900 flex items-center gap-1">
                          {getModeIcon()}
                          {paymentMode}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:border-l sm:border-stone-200 sm:pl-4">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold">Disbursed From:</span>
                        <span className="font-semibold text-stone-700">
                          {disbursedFrom}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold">Accounting Type:</span>
                        <span className="font-semibold text-stone-700">
                          {isDeposit ? 'Current Asset (1300)' : isAsset ? 'Fixed Asset (1500)' : 'Operating Expense'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 font-semibold">Ref / Cheque / UTR:</span>
                        <span className="font-mono font-bold text-stone-800">{referenceNumber || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Full Width Debit Account Head Row */}
                  <div className="mt-2.5 pt-2.5 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-stone-500 font-semibold">Debit Account Head:</span>
                    <span className="font-bold text-stone-900">
                      <span className="text-indigo-600 font-mono">#{accountCode}</span> - {accountHead}
                    </span>
                  </div>
                </div>

                {/* Payee Box */}
                <div className="mb-4 p-3.5 rounded-lg border border-stone-200 bg-white border-l-4 border-l-indigo-600 shadow-2xs">
                  <div className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
                    Paid To / In Favour Of (Beneficiary)
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-stone-900 mt-0.5">
                    {payeeName}
                  </div>
                  {transaction.depositDetails?.premisesOrAccount && (
                    <div className="text-[11px] text-teal-700 font-medium mt-1">
                      <strong>Premises / Account / Meter:</strong> {transaction.depositDetails.premisesOrAccount}
                    </div>
                  )}
                  {transaction.assetDetails?.locationOrRoom && (
                    <div className="text-[11px] text-indigo-700 font-medium mt-1">
                      <strong>Facility Room:</strong> {transaction.assetDetails.locationOrRoom}
                    </div>
                  )}
                </div>

                {/* Particulars & Amount Table */}
                <div className="border border-stone-300 rounded-md overflow-hidden mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-900 text-white font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">#</th>
                        <th className="py-2 px-3 text-left">Particulars / Narration</th>
                        <th className="py-2 px-3 text-left w-40">Head of Account</th>
                        <th className="py-2 px-3 text-right w-32">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      <tr className="bg-white">
                        <td className="py-3 px-3 text-center font-bold text-stone-500">1</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-stone-900">
                            {narration}
                          </div>
                          {isDeposit && (
                            <div className="text-[11px] text-teal-700 font-medium mt-0.5 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Refundable Security Deposit (Current Asset #1300)
                            </div>
                          )}
                          {isAsset && (
                            <div className="text-[11px] text-indigo-700 font-medium mt-0.5 flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              Capital Equipment (Fixed Asset #1500 capitalized on Balance Sheet)
                            </div>
                          )}
                          {transaction.depositDetails?.termsOrDuration && (
                            <div className="text-[10px] text-stone-500 mt-0.5">
                              Tenure: {transaction.depositDetails.termsOrDuration}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-stone-600 text-[11px]">
                          <span className="font-bold text-stone-900 block font-mono">{accountCode}</span>
                          {accountHead}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-stone-900 text-sm">
                          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Grand Total Row */}
                      <tr className="bg-stone-100 font-extrabold border-t-2 border-stone-900">
                        <td colSpan={3} className="py-2.5 px-3 text-right text-stone-900 uppercase tracking-wider text-[11px]">
                          Total Amount Paid:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-700 text-sm sm:text-base">
                          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="bg-stone-50 border border-dashed border-stone-300 rounded-md p-3 mb-4 text-xs">
                  <span className="font-bold text-stone-600 mr-2">Amount in Words:</span>
                  <span className="font-bold text-stone-900 italic">{amountInWords}</span>
                </div>

                {/* Accounting Certification */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-md p-2.5 mb-8 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Accounting Certification:</strong> {notesOrRemarks}
                  </span>
                </div>

                {/* 4 Signatures Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center pt-2">
                  <div>
                    <div className="border-b border-stone-900 h-10 mb-1.5 flex items-end justify-center pb-0.5">
                      <span className="text-[10px] text-stone-400 font-mono">Verified</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-stone-900 uppercase">{preparedByTitle}</div>
                    <div className="text-[9px] text-stone-500">{preparedBy}</div>
                  </div>

                  <div>
                    <div className="border-b border-stone-900 h-10 mb-1.5 flex items-end justify-center pb-0.5">
                      <span className="text-[10px] text-stone-400 font-mono">Audited</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-stone-900 uppercase">{checkedByTitle}</div>
                    <div className="text-[9px] text-stone-500">{checkedBy}</div>
                  </div>

                  <div>
                    <div className="border-b border-stone-900 h-10 mb-1.5 flex items-end justify-center pb-0.5">
                      <span className="text-[10px] text-stone-400 font-mono">Approved</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-stone-900 uppercase">{authorizedByTitle}</div>
                    <div className="text-[9px] text-stone-500">{authorizedBy}</div>
                  </div>

                  <div>
                    <div className="border-b border-stone-900 h-10 mb-1.5 flex items-end justify-center pb-0.5">
                      <span className="text-[10px] text-stone-400 font-mono">Date: {formattedVoucherDate}</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-stone-900 uppercase">{receivedByTitle}</div>
                    <div className="text-[9px] text-stone-500">{receivedBy}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-500 font-medium">
            {isEditing ? (
              <span className="text-amber-700 font-semibold">
                Editing voucher details. Click &quot;Save to Database&quot; to commit changes to ledger.
              </span>
            ) : (
              'Standard accounting payment voucher ready for printing on A4 sheet'
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 transition-colors"
                >
                  Cancel Edit
                </button>
                <button
                  type="button"
                  onClick={handleSaveToDatabase}
                  disabled={isSavingDb}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSavingDb ? 'Saving...' : 'Save to Database'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview & Print</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3.5 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5 text-stone-600" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{isPrinting ? 'Printing...' : 'Print Voucher'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
