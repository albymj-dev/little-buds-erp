import React, { useState, useEffect, useMemo } from 'react';
import { getFees, getStudents, addFee, updateFeeStatus, deleteFee } from '../services/api';
import { Fee, Student, FeeBillingBasis } from '../types';
import { 
  Receipt, AlertCircle, CheckCircle, Clock, Download, Printer, Trash2, 
  Settings, Eye, Landmark, Banknote, X, Check, Timer, Sparkles, 
  StickyNote, Search, Filter, MapPin, Calendar, HelpCircle, Layers,
  ChevronDown, ArrowRight, Pencil, MessageSquare, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDate } from '../utils/dateUtils';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './Toast';
import InvoicePreviewModal from './InvoicePreviewModal';
import { InvoiceEditModal } from './InvoiceEditModal';
import { 
  InvoiceSettings, 
  defaultInvoiceSettings, 
  generateInvoicePdf, 
  printInvoiceDocument,
  openInvoicePrintWindow,
  normalizeWhatsAppNumber,
  formatWhatsAppInvoiceMessage
} from '../utils/invoicePdf';

const FeeManagement = () => {
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState<Fee | null>(null);
  const [selectedFeeForPreview, setSelectedFeeForPreview] = useState<Fee | null>(null);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [previewInitialAction, setPreviewInitialAction] = useState<'preview' | 'print'>('preview');
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Payment Recording Modal State
  const [payingFee, setPayingFee] = useState<Fee | null>(null);
  const [payingMode, setPayingMode] = useState<string>('Bank Transfer');
  const [payingAmount, setPayingAmount] = useState<number>(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Fee Assigning Section State
  const [billingBasis, setBillingBasis] = useState<FeeBillingBasis>('fixed');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Fixed / Monthly options
  const [fixedType, setFixedType] = useState<string>('Monthly Tuition');
  const [fixedAmount, setFixedAmount] = useState<number>(3500);

  // Hourly base options
  const [hourlyService, setHourlyService] = useState<string>('Hourly Daycare & Care');
  const [hourlyRate, setHourlyRate] = useState<number>(200);
  const [hourlyHours, setHourlyHours] = useState<number>(10);

  // Per session base options
  const DEFAULT_SESSION_OPTIONS = [
    'Special Education',
    'Speech Therapy',
    'Speech Assessment'
  ];

  const [customSessionOptions, setCustomSessionOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('little_buds_custom_fee_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const attSaved = localStorage.getItem('custom_activity_sessions');
      if (attSaved) {
        const parsed = JSON.parse(attSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(s => !['Special Education', 'Speech Therapy', 'Speech Assessment'].includes(s));
        }
      }
    } catch (e) {
      console.error('Failed to load custom fee sessions', e);
    }
    return [];
  });
  const [sessionService, setSessionService] = useState<string>('Special Education');
  const [sessionRate, setSessionRate] = useState<number>(500);
  const [sessionCount, setSessionCount] = useState<number>(8);
  const [isAddingCustomSession, setIsAddingCustomSession] = useState(false);
  const [customSessionInput, setCustomSessionInput] = useState('');

  // Persist custom session options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('little_buds_custom_fee_sessions', JSON.stringify(customSessionOptions));
    } catch (e) {
      console.error('Failed to save custom fee sessions', e);
    }
  }, [customSessionOptions]);

  const handleSessionChange = (value: string) => {
    if (value === '__ADD_CUSTOM__') {
      setIsAddingCustomSession(true);
      setCustomSessionInput('');
      return;
    }
    setIsAddingCustomSession(false);
    setSessionService(value);
    // Suggest standard benchmark session rates
    if (value === 'Special Education') {
      setSessionRate(500);
    } else if (value === 'Speech Therapy') {
      setSessionRate(600);
    } else if (value === 'Speech Assessment') {
      setSessionRate(1200);
    }
    setManualAmountOverride(null);
  };

  const handleSaveCustomSession = () => {
    const trimmed = customSessionInput.trim();
    if (!trimmed) {
      addToast('error', 'Please enter a valid session name.');
      return;
    }
    if (
      !DEFAULT_SESSION_OPTIONS.includes(trimmed) &&
      !customSessionOptions.some(s => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      setCustomSessionOptions(prev => [...prev, trimmed]);
    }
    setSessionService(trimmed);
    setIsAddingCustomSession(false);
    setCustomSessionInput('');
    setManualAmountOverride(null);
    addToast('success', `Session "${trimmed}" added and selected.`);
  };

  const handleRemoveCustomSession = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomSessionOptions(prev => prev.filter(s => s !== nameToRemove));
    if (sessionService === nameToRemove) {
      setSessionService('Special Education');
      setSessionRate(500);
    }
    addToast('info', `Removed custom session "${nameToRemove}".`);
  };

  // Custom fee options
  const [customFeeName, setCustomFeeName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('Materials & Supplies');
  const [customAmount, setCustomAmount] = useState<number>(1500);

  // Shared fee fields
  const [feeDueDate, setFeeDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [feePaymentMode, setFeePaymentMode] = useState<string>('Bank Transfer');
  const [feeNotes, setFeeNotes] = useState<string>('');
  const [manualAmountOverride, setManualAmountOverride] = useState<number | null>(null);

  // Filter & Search state in fee list
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [basisFilter, setBasisFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => {
    const saved = localStorage.getItem('invoiceSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.centreName || parsed.centreName.includes('Developmental') || parsed.centreName === 'Little Buds') {
          parsed.centreName = 'Little Buds Child Care Centre';
          localStorage.setItem('invoiceSettings', JSON.stringify({ ...defaultInvoiceSettings, ...parsed }));
        }
        return { ...defaultInvoiceSettings, ...parsed };
      } catch {
        return defaultInvoiceSettings;
      }
    }
    return defaultInvoiceSettings;
  });

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('invoiceSettings', JSON.stringify(invoiceSettings));
    setShowSettings(false);
    addToast('success', 'Invoice settings and branding saved.');
  };

  const calculatedTotalAmount = useMemo(() => {
    if (manualAmountOverride !== null) return manualAmountOverride;
    if (billingBasis === 'hourly') {
      return (Number(hourlyRate) || 0) * (Number(hourlyHours) || 0);
    }
    if (billingBasis === 'per_session') {
      return (Number(sessionRate) || 0) * (Number(sessionCount) || 0);
    }
    if (billingBasis === 'custom') {
      return Number(customAmount) || 0;
    }
    return Number(fixedAmount) || 0;
  }, [billingBasis, hourlyRate, hourlyHours, sessionRate, sessionCount, customAmount, fixedAmount, manualAmountOverride]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [feesData, studentsData] = await Promise.all([
        getFees(),
        getStudents()
      ]);
      setFees(feesData);
      setStudents(studentsData);
    } catch (error) {
      console.error("Failed to load fee data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      addToast('error', 'Please select a student.');
      return;
    }

    const finalAmount = manualAmountOverride !== null ? manualAmountOverride : calculatedTotalAmount;
    if (finalAmount <= 0) {
      addToast('error', 'Please enter a valid fee amount greater than ₹0.');
      return;
    }

    if (billingBasis === 'custom' && !customFeeName.trim()) {
      addToast('error', 'Please enter a name or description for the custom fee.');
      return;
    }
    
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) {
      addToast('error', 'Selected student could not be found.');
      return;
    }

    let finalType = fixedType;
    let customTypeName: string | undefined = undefined;
    let rate: number | undefined = undefined;
    let units: number | undefined = undefined;

    if (billingBasis === 'hourly') {
      finalType = hourlyService.trim() || 'Hourly Daycare';
      rate = Number(hourlyRate) || 0;
      units = Number(hourlyHours) || 0;
    } else if (billingBasis === 'per_session') {
      finalType = sessionService.trim() || 'Special Education';
      customTypeName = sessionService.trim() || 'Special Education';
      rate = Number(sessionRate) || 0;
      units = Number(sessionCount) || 0;
    } else if (billingBasis === 'custom') {
      finalType = customFeeName.trim();
      customTypeName = customFeeName.trim();
    }

    const feePayload: Omit<Fee, 'id'> = {
      studentId: student.id!,
      studentName: student.name,
      guardianName: student.guardianName,
      guardianContact: student.guardianContact || student.emergencyContact,
      address: student.address,
      classOrAge: student.age ? `${student.age} Years` : student.developmentalFocus,
      parentName: student.guardianName,
      type: finalType,
      customTypeName,
      billingBasis,
      rate,
      units,
      amount: finalAmount,
      amountPaid: 0,
      dueDate: feeDueDate,
      status: 'Pending',
      paymentMode: feePaymentMode,
      notes: feeNotes.trim() || undefined
    };

    try {
      await addFee(feePayload);
      addToast('success', `Fee assigned to ${student.name} for ₹${finalAmount}.`);
      setShowAddForm(false);
      
      // Reset form defaults
      setSelectedStudentId('');
      setManualAmountOverride(null);
      setCustomFeeName('');
      setFeeNotes('');
      loadData();
    } catch (error) {
      console.error("Failed to create fee", error);
      addToast('error', 'Failed to create fee assignment.');
    }
  };

  const handleUpdateStatus = async (feeId: string, newStatus: Fee['status'], amountPaid: number, paymentMode?: string) => {
    try {
      await updateFeeStatus(feeId, newStatus, amountPaid, paymentMode);
      loadData();
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingFee?.id) return;
    setIsSubmittingPayment(true);
    try {
      const isFull = payingAmount >= payingFee.amount;
      const newStatus = isFull ? 'Paid' : 'Partially Paid';
      await updateFeeStatus(payingFee.id, newStatus, payingAmount, payingMode);
      addToast('success', `Recorded payment of ₹${payingAmount} via ${payingMode} for ${payingFee.studentName}.`);
      setPayingFee(null);
      loadData();
    } catch (error) {
      console.error("Failed to record payment", error);
      addToast('error', 'Failed to update payment. Please try again.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!feeToDelete?.id) return;
    setIsDeleting(true);
    const targetFee = feeToDelete;
    try {
      // Optimistic delete
      setFees(prev => prev.filter(f => f.id !== targetFee.id));
      await deleteFee(targetFee.id);
      setFeeToDelete(null);
      addToast('success', `Fee record of ₹${targetFee.amount} for ${targetFee.studentName} was deleted.`);
    } catch (error) {
      console.error("Failed to delete fee", error);
      addToast('error', 'Failed to delete fee record. Please try again.');
      loadData();
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Paid': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Paid</span>;
      case 'Pending': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/> Pending</span>;
      case 'Overdue': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1"/> Overdue</span>;
      case 'Partially Paid': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Partial</span>;
      default: return null;
    }
  };

  const exportInvoice = async (fee: Fee) => {
    try {
      const student = students.find(s => s.id === fee.studentId || s.name === fee.studentName);
      const doc = await generateInvoicePdf(fee, invoiceSettings, student);
      const invNumber = fee.id ? fee.id.slice(0, 8).toUpperCase() : 'REC';
      doc.save(`Invoice_${fee.studentName.replace(/\s+/g, '_')}_${invNumber}.pdf`);
      addToast('success', `Exported PDF invoice for ${fee.studentName}.`);
    } catch (error) {
      console.error("Failed to export invoice PDF", error);
      addToast('error', 'Failed to generate PDF invoice.');
    }
  };

  const printInvoice = (fee: Fee) => {
    try {
      const student = students.find(s => s.id === fee.studentId || s.name === fee.studentName);
      addToast('info', `Opening print tab and dialogue for ${fee.studentName}...`);
      openInvoicePrintWindow(fee, invoiceSettings, student);
    } catch (err) {
      console.error('Print invoice failed, opening preview modal:', err);
      setSelectedFeeForPreview(fee);
    }
  };

  const previewInvoice = (fee: Fee) => {
    setPreviewInitialAction('preview');
    setSelectedFeeForPreview(fee);
  };

  const sendWhatsAppInvoice = (fee: Fee) => {
    const student = students.find(s => s.id === fee.studentId || s.name === fee.studentName);
    const rawPhone = fee.guardianContact || student?.guardianContact || student?.emergencyContact || '';
    const cleanPhone = normalizeWhatsAppNumber(rawPhone);

    if (!cleanPhone) {
      setSelectedFeeForPreview(fee);
      addToast('info', 'Please enter or confirm the parent WhatsApp number to send.');
      return;
    }

    const message = formatWhatsAppInvoiceMessage(fee, student);
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    // 1. Open WhatsApp IMMEDIATELY within synchronous click gesture (prevents popup blocking)
    let opened = false;
    try {
      const waWin = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (waWin && !waWin.closed) {
        waWin.focus();
        opened = true;
      }
    } catch (e) {
      console.warn('Direct window.open caught:', e);
    }

    if (!opened) {
      try {
        const link = document.createElement('a');
        link.href = waUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        opened = true;
      } catch (err) {
        console.warn('Link click fallback:', err);
      }
    }

    addToast('success', `WhatsApp opened for ${fee.studentName} (+${cleanPhone})! Generating PDF invoice...`);

    // 2. Generate and download PDF invoice in parallel
    const invNum = fee.invoiceNumber || (fee.id ? `INV-${fee.id.slice(0, 8).toUpperCase()}` : 'REC');
    const fileName = `Invoice_${fee.studentName.replace(/\s+/g, '_')}_${invNum}.pdf`;

    generateInvoicePdf(fee, invoiceSettings, student)
      .then(doc => {
        doc.save(fileName);
      })
      .catch(err => {
        console.warn('PDF download error:', err);
      });
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management & Dues Tracker</h1>
          <p className="mt-2 text-sm text-gray-700">Manage monthly tuition, activity & care sessions, and track payments.</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex-none flex space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-xs hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:ring-offset-2 sm:w-auto"
          >
            <Settings className="h-4 w-4 mr-2 text-stone-500" />
            Invoice Settings
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center justify-center rounded-xl border border-transparent bg-[#558B2F] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#436D25] focus:outline-none focus:ring-2 focus:ring-[#558B2F] focus:ring-offset-2 sm:w-auto transition-colors"
          >
            <Receipt className="h-4 w-4 mr-2" />
            Assign Fee
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Invoice Settings & Centre Branding</h3>
          <form onSubmit={saveSettings} className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Centre Name</label>
              <input type="text" required value={invoiceSettings.centreName} onChange={e => setInvoiceSettings({...invoiceSettings, centreName: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subtitle / Centre Tagline</label>
              <input type="text" required value={invoiceSettings.subName} onChange={e => setInvoiceSettings({...invoiceSettings, subName: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input type="text" required value={invoiceSettings.address} onChange={e => setInvoiceSettings({...invoiceSettings, address: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Phone & Email</label>
              <input type="text" required value={invoiceSettings.contactInfo} onChange={e => setInvoiceSettings({...invoiceSettings, contactInfo: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Registration / GST / Tax No.</label>
              <input type="text" placeholder="e.g. Reg. No: LBDC/2023/8842" value={invoiceSettings.regNumber || ''} onChange={e => setInvoiceSettings({...invoiceSettings, regNumber: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">UPI ID for Payments</label>
              <input type="text" placeholder="e.g. centre@upi (Optional)" value={invoiceSettings.upiId || ''} onChange={e => setInvoiceSettings({...invoiceSettings, upiId: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Account Details</label>
              <input type="text" placeholder="e.g. Bank Name | A/C No. | IFSC (Leave blank if none)" value={invoiceSettings.bankDetails || ''} onChange={e => setInvoiceSettings({...invoiceSettings, bankDetails: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Accent Color</label>
              <div className="mt-1 flex items-center space-x-2">
                <input type="color" value={invoiceSettings.accentColor} onChange={e => setInvoiceSettings({...invoiceSettings, accentColor: e.target.value})} className="h-9 w-12 rounded-md border border-gray-300 cursor-pointer p-0.5" />
                <span className="text-sm text-gray-500 font-mono">{invoiceSettings.accentColor}</span>
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setShowSettings(false)} className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                Cancel
              </button>
              <button type="submit" className="inline-flex justify-center rounded-xl border border-transparent bg-[#558B2F] py-2 px-4 text-sm font-bold text-white shadow-sm hover:bg-[#436D25] focus:outline-none focus:ring-2 focus:ring-[#558B2F] focus:ring-offset-2 transition-colors">
                Save Invoice Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddForm && (
        <div className="mt-6 bg-stone-50 p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-stone-200 gap-3">
            <div>
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#558B2F]" />
                Assign Student Fee & Generate Invoice
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Configure standard tuition, hourly daycare care, activity sessions, or custom fee items with notes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="self-end sm:self-auto p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateFee} className="mt-5 space-y-6">
            {/* Step 1: Student Selection */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Select Student *
              </label>
              <select
                required
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="block w-full rounded-xl border-stone-300 py-2.5 pl-3 pr-10 text-sm focus:border-[#74B72E] focus:outline-none focus:ring-[#74B72E] border bg-white font-medium text-stone-800"
              >
                <option value="">Choose a child / student...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.guardianName ? `(Guardian: ${s.guardianName})` : ''}
                  </option>
                ))}
              </select>

              {/* Student Profile Quick View */}
              {selectedStudentId && (() => {
                const s = students.find(item => item.id === selectedStudentId);
                if (!s) return null;
                return (
                  <div className="mt-2.5 p-3 bg-white rounded-xl border border-stone-200 text-xs flex flex-wrap gap-y-1 gap-x-4 items-center text-stone-600">
                    <span className="font-bold text-stone-900">{s.name}</span>
                    <span><strong>Guardian:</strong> {s.guardianName} ({s.guardianContact})</span>
                    {s.address && (
                      <span className="flex items-center text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                        <span>{s.address}</span>
                      </span>
                    )}
                    {(s.developmentalFocus || s.primaryDiagnosis) && (
                      <span className="text-stone-500"><strong>Focus:</strong> {s.developmentalFocus || s.primaryDiagnosis}</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Step 2: Billing Basis Selection */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                Billing Basis & Structure *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Fixed / Flat */}
                <button
                  type="button"
                  onClick={() => {
                    setBillingBasis('fixed');
                    setManualAmountOverride(null);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all ${
                    billingBasis === 'fixed'
                      ? 'border-[#558B2F] bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-[#74B72E]/40 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Fixed / Monthly</span>
                  </div>
                  <span className="text-[11px] text-stone-500 mt-1">Standard tuition, term or registration</span>
                </button>

                {/* Hourly Base */}
                <button
                  type="button"
                  onClick={() => {
                    setBillingBasis('hourly');
                    setManualAmountOverride(null);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all ${
                    billingBasis === 'hourly'
                      ? 'border-sky-600 bg-sky-50/80 text-sky-950 font-bold ring-2 ring-sky-500/40 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                    <Timer className="w-4 h-4 text-sky-600" />
                    <span>Hourly Base</span>
                  </div>
                  <span className="text-[11px] text-stone-500 mt-1">Daycare rate × hours care</span>
                </button>

                {/* Per Session Base */}
                <button
                  type="button"
                  onClick={() => {
                    setBillingBasis('per_session');
                    setManualAmountOverride(null);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all ${
                    billingBasis === 'per_session'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-500/40 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Per Session Base</span>
                  </div>
                  <span className="text-[11px] text-stone-500 mt-1">Rate per activity / care session</span>
                </button>

                {/* Custom Fee Item */}
                <button
                  type="button"
                  onClick={() => {
                    setBillingBasis('custom');
                    setManualAmountOverride(null);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all ${
                    billingBasis === 'custom'
                      ? 'border-purple-600 bg-purple-50/80 text-purple-950 font-bold ring-2 ring-purple-500/40 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Custom Fee</span>
                  </div>
                  <span className="text-[11px] text-stone-500 mt-1">Materials, trips, kits, uniforms</span>
                </button>
              </div>
            </div>

            {/* Step 3: Dynamic Basis Config Fields */}
            {billingBasis === 'fixed' && (
              <div className="bg-white p-4 rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Standard Fee Type
                  </label>
                  <select
                    value={fixedType}
                    onChange={e => setFixedType(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm focus:border-[#74B72E] focus:ring-[#74B72E]"
                  >
                    <option value="Monthly Tuition">Monthly Tuition</option>
                    <option value="Care / Activity Session">Care / Activity Session</option>
                    <option value="Registration">Registration & Admission Fee</option>
                    <option value="Quarterly Tuition">Quarterly Tuition</option>
                    <option value="Daycare Full-Day Monthly">Daycare Full-Day Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Standard Fee Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={fixedAmount === 0 ? '' : fixedAmount}
                    onChange={e => {
                      setFixedAmount(e.target.value === '' ? 0 : Number(e.target.value));
                      setManualAmountOverride(null);
                    }}
                    placeholder="e.g. 3500"
                    className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-semibold text-stone-900 focus:border-[#74B72E] focus:ring-[#74B72E]"
                  />
                </div>
              </div>
            )}

            {billingBasis === 'hourly' && (
              <div className="bg-white p-4 rounded-xl border border-sky-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                  <span className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-sky-600" />
                    Hourly Daycare / Extended Care Billing
                  </span>
                  <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-mono font-bold">
                    Rate × Hours = Calculated Fee
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Hourly Service Title
                    </label>
                    <input
                      type="text"
                      value={hourlyService}
                      onChange={e => setHourlyService(e.target.value)}
                      placeholder="e.g. Hourly Daycare Supervision"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm focus:border-sky-500 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Hourly Rate (₹ / Hour) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={hourlyRate === 0 ? '' : hourlyRate}
                      onChange={e => {
                        setHourlyRate(e.target.value === '' ? 0 : Number(e.target.value));
                        setManualAmountOverride(null);
                      }}
                      placeholder="e.g. 200"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-semibold text-stone-900 focus:border-sky-500 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Total Hours *
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      required
                      value={hourlyHours === 0 ? '' : hourlyHours}
                      onChange={e => {
                        setHourlyHours(e.target.value === '' ? 0 : Number(e.target.value));
                        setManualAmountOverride(null);
                      }}
                      placeholder="e.g. 15"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-semibold text-stone-900 focus:border-sky-500 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="bg-sky-50/80 rounded-xl p-3 flex flex-col sm:flex-row justify-between sm:items-center text-xs text-sky-900 border border-sky-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-600">Calculated Hourly Total:</span>
                    <span className="font-mono font-bold text-sky-950 text-sm">
                      {hourlyHours || 0} hrs × ₹{hourlyRate || 0}/hr = ₹{(hourlyHours || 0) * (hourlyRate || 0)}
                    </span>
                  </div>
                  <div className="text-[11px] text-sky-700">
                    💡 Will appear on invoice as {hourlyHours} hours @ ₹{hourlyRate}/hr
                  </div>
                </div>
              </div>
            )}

            {billingBasis === 'per_session' && (
              <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Per Session Care / Activity Billing
                  </span>
                  <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono font-bold">
                    Rate × Sessions = Calculated Fee
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Type of Session *
                      </label>
                      {!isAddingCustomSession && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCustomSession(true);
                            setCustomSessionInput('');
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Custom
                        </button>
                      )}
                    </div>

                    <select
                      value={isAddingCustomSession ? '__ADD_CUSTOM__' : sessionService}
                      onChange={e => handleSessionChange(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-semibold text-stone-900 bg-white focus:border-indigo-500 focus:ring-indigo-500 shadow-2xs"
                    >
                      <optgroup label="Standard Development & Therapy Sessions">
                        <option value="Special Education">Special Education</option>
                        <option value="Speech Therapy">Speech Therapy</option>
                        <option value="Speech Assessment">Speech Assessment</option>
                      </optgroup>
                      {customSessionOptions.length > 0 && (
                        <optgroup label="Custom Configured Sessions">
                          {customSessionOptions.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__ADD_CUSTOM__" className="text-indigo-600 font-bold">
                        + Add Custom Session Name...
                      </option>
                    </select>

                    {/* Inline custom session input */}
                    {isAddingCustomSession && (
                      <div className="mt-2.5 p-2.5 bg-indigo-50/90 rounded-xl border border-indigo-200 space-y-2">
                        <div className="text-[11px] font-bold text-indigo-900">Enter Custom Session Name:</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customSessionInput}
                            onChange={e => setCustomSessionInput(e.target.value)}
                            placeholder="e.g. Occupational Therapy, Sensory Play..."
                            className="flex-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs text-stone-900 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCustomSession();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleSaveCustomSession}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shrink-0"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingCustomSession(false);
                              if (!sessionService) setSessionService('Special Education');
                            }}
                            className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700 font-medium shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Custom session chips if any */}
                    {customSessionOptions.length > 0 && !isAddingCustomSession && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-stone-400 font-medium">Custom:</span>
                        {customSessionOptions.map(name => (
                          <span
                            key={name}
                            onClick={() => handleSessionChange(name)}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md cursor-pointer transition-colors border ${
                              sessionService === name
                                ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold'
                                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-indigo-50'
                            }`}
                            title="Click to select this session"
                          >
                            <span>{name}</span>
                            <button
                              type="button"
                              onClick={e => handleRemoveCustomSession(name, e)}
                              className="text-stone-400 hover:text-rose-600 ml-0.5"
                              title={`Delete "${name}"`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Rate per Session (₹) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={sessionRate === 0 ? '' : sessionRate}
                      onChange={e => {
                        setSessionRate(e.target.value === '' ? 0 : Number(e.target.value));
                        setManualAmountOverride(null);
                      }}
                      placeholder="e.g. 450"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-semibold text-stone-900 focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Number of Sessions *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={sessionCount === 0 ? '' : sessionCount}
                      onChange={e => {
                        setSessionCount(e.target.value === '' ? 0 : Number(e.target.value));
                        setManualAmountOverride(null);
                      }}
                      placeholder="e.g. 8"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-semibold text-stone-900 focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/80 rounded-xl p-3 flex flex-col sm:flex-row justify-between sm:items-center text-xs text-indigo-900 border border-indigo-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-600">Calculated Session Total:</span>
                    <span className="font-mono font-bold text-indigo-950 text-sm">
                      {sessionCount || 0} sessions × ₹{sessionRate || 0}/session = ₹{(sessionCount || 0) * (sessionRate || 0)}
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-700">
                    💡 Will appear on invoice as {sessionCount} sessions @ ₹{sessionRate}/session
                  </div>
                </div>
              </div>
            )}

            {billingBasis === 'custom' && (
              <div className="bg-white p-4 rounded-xl border border-purple-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                  <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Custom Fee Item (Materials, Trips, Kits, Uniforms, Meals)
                  </span>
                  <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold">
                    Flexible Ad-hoc Billing
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Custom Item / Service Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customFeeName}
                      onChange={e => setCustomFeeName(e.target.value)}
                      placeholder="e.g. Montessori Kit, Annual Field Trip, Uniform Set, Meal Plan"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-medium focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Custom Amount (₹) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={customAmount === 0 ? '' : customAmount}
                      onChange={e => {
                        setCustomAmount(e.target.value === '' ? 0 : Number(e.target.value));
                        setManualAmountOverride(null);
                      }}
                      placeholder="e.g. 1500"
                      className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm font-bold text-stone-900 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1.5 items-center pt-1">
                  <span className="text-[11px] font-semibold text-stone-500">Quick presets:</span>
                  {[
                    'Montessori Learning Kit',
                    'Annual Excursion & Nature Trip',
                    'Uniform & Activity Apron',
                    'Organic Lunch & Snacks Plan',
                    'School Van Transport Fee'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomFeeName(preset)}
                      className="text-[11px] bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200/60 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Fee Assignation Note (Requested Feature) */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <StickyNote className="w-4 h-4 text-amber-600" />
                Fee Assignation Note / Remarks
              </label>
              <textarea
                rows={2}
                value={feeNotes}
                onChange={e => setFeeNotes(e.target.value)}
                placeholder="e.g. 10% sibling discount applied, batch covers Oct 1 to Nov 15, includes Friday extended care, special dietary requirement note..."
                className="w-full rounded-xl border border-amber-300/80 bg-white py-2 px-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:ring-amber-500 shadow-2xs"
              />
              <p className="text-[11px] text-amber-700 mt-1">
                📝 <strong>Note:</strong> This remark will be printed on the official invoice, receipts, and WhatsApp payment reminders.
              </p>
            </div>

            {/* Step 5: Due Date, Payment Channel & Final Amount Review */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Payment Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={feeDueDate}
                  onChange={e => setFeeDueDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm focus:border-[#74B72E] focus:ring-[#74B72E] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Preferred Payment Channel
                </label>
                <select
                  value={feePaymentMode}
                  onChange={e => setFeePaymentMode(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 py-2 px-3 text-sm focus:border-[#74B72E] focus:ring-[#74B72E] bg-white"
                >
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="UPI">🏦 UPI / QR Code</option>
                  <option value="Cash">💵 Physical Cash</option>
                  <option value="Cheque">🏦 Cheque</option>
                  <option value="Direct Bank Deposit">🏦 Direct Bank Deposit</option>
                  <option value="Demand Draft">🏦 Demand Draft</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1 flex justify-between">
                  <span>Total Amount (₹) *</span>
                  {manualAmountOverride !== null && (
                    <button
                      type="button"
                      onClick={() => setManualAmountOverride(null)}
                      className="text-[10px] text-blue-600 hover:underline font-normal"
                    >
                      Reset auto-calc
                    </button>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualAmountOverride !== null ? manualAmountOverride : calculatedTotalAmount || ''}
                    onChange={e => setManualAmountOverride(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-300 py-2 pl-7 pr-3 text-sm font-black text-stone-900 bg-white focus:border-[#74B72E] focus:ring-[#74B72E]"
                  />
                </div>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-stone-200 flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-stone-500">
                Total to bill: <span className="font-extrabold text-stone-900 text-sm">₹{manualAmountOverride !== null ? manualAmountOverride : calculatedTotalAmount}</span>
              </div>
              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl border border-transparent bg-[#558B2F] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#436D25] focus:outline-none focus:ring-2 focus:ring-[#558B2F] transition-colors"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  Save Fee Assignment
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Fees Filter & Search Bar */}
      <div className="mt-8 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="relative rounded-xl shadow-2xs max-w-sm w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-stone-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border-stone-300 pl-9 py-2 text-xs text-stone-900 focus:border-[#74B72E] focus:ring-[#74B72E] border bg-stone-50/50"
            placeholder="Search by student, fee type, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Basis filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-500 font-semibold">Basis:</span>
            <select
              value={basisFilter}
              onChange={e => setBasisFilter(e.target.value)}
              className="text-xs rounded-xl border-stone-300 py-1.5 pl-2.5 pr-8 border bg-white text-stone-700 focus:border-[#74B72E] focus:ring-[#74B72E]"
            >
              <option value="all">All Bases</option>
              <option value="fixed">Fixed / Monthly</option>
              <option value="hourly">Hourly Daycare</option>
              <option value="per_session">Per Session</option>
              <option value="custom">Custom Items</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-500 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs rounded-xl border-stone-300 py-1.5 pl-2.5 pr-8 border bg-white text-stone-700 focus:border-[#74B72E] focus:ring-[#74B72E]"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Partially Paid">Partially Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fees Data Table */}
      <div className="mt-4 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 bg-white">
                <thead className="bg-stone-50/80">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-bold text-stone-700 uppercase tracking-wider sm:pl-6">
                      Student
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Fee Item & Rate Basis
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-stone-500 text-sm">
                        Loading fees...
                      </td>
                    </tr>
                  ) : (() => {
                    const filtered = fees.filter(fee => {
                      const matchesSearch = 
                        fee.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        fee.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (fee.customTypeName && fee.customTypeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (fee.notes && fee.notes.toLowerCase().includes(searchTerm.toLowerCase()));
                      
                      const matchesBasis = 
                        basisFilter === 'all' ||
                        (basisFilter === 'hourly' && (fee.billingBasis === 'hourly' || fee.type.toLowerCase().includes('hour'))) ||
                        (basisFilter === 'per_session' && (fee.billingBasis === 'per_session' || fee.type.toLowerCase().includes('session'))) ||
                        (basisFilter === 'custom' && (fee.billingBasis === 'custom' || !!fee.customTypeName)) ||
                        (basisFilter === 'fixed' && (fee.billingBasis === 'fixed' || (!fee.billingBasis && !fee.customTypeName)));

                      const matchesStatus = 
                        statusFilter === 'all' || fee.status === statusFilter;

                      return matchesSearch && matchesBasis && matchesStatus;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-stone-500 text-sm">
                            No fees recorded matching the filters.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((fee) => {
                      const studentObj = students.find(s => s.id === fee.studentId || s.name === fee.studentName);

                      return (
                        <tr key={fee.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-stone-900 sm:pl-6">
                            <div className="font-bold text-stone-900">{fee.studentName}</div>
                            {studentObj?.guardianContact && (
                              <div className="text-xs text-stone-500 font-normal">{studentObj.guardianContact}</div>
                            )}
                            {studentObj?.address && (
                              <div className="text-[11px] text-stone-500 font-normal flex items-center mt-0.5 max-w-[200px] truncate" title={studentObj.address}>
                                <MapPin className="w-3 h-3 mr-1 text-stone-400 shrink-0" />
                                <span className="truncate">{studentObj.address}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-3 text-sm text-stone-700">
                            <div className="font-semibold text-stone-900">
                              {fee.customTypeName || fee.type}
                            </div>

                            {/* Billing Basis Breakdown Badges */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {fee.billingBasis === 'hourly' ? (
                                <span className="inline-flex items-center text-[10px] font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded-md border border-sky-200">
                                  <Timer className="w-3 h-3 mr-1 text-sky-600" />
                                  Hourly: {fee.units || 1} hrs @ ₹{fee.rate || fee.amount}/hr
                                </span>
                              ) : fee.billingBasis === 'per_session' ? (
                                <span className="inline-flex items-center text-[10px] font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                                  <Layers className="w-3 h-3 mr-1 text-indigo-600" />
                                  Session: {fee.units || 1} sessions @ ₹{fee.rate || fee.amount}/session
                                </span>
                              ) : fee.billingBasis === 'custom' || fee.customTypeName ? (
                                <span className="inline-flex items-center text-[10px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200">
                                  <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                                  Custom Item
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                                  Fixed Fee
                                </span>
                              )}
                            </div>

                            {/* Note for each fee assignation */}
                            {fee.notes && (
                              <div
                                className="text-xs text-amber-950 bg-amber-50/90 border border-amber-200/70 rounded-lg px-2.5 py-1 mt-1.5 flex items-start gap-1.5 max-w-[320px]"
                                title={fee.notes}
                              >
                                <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span className="italic leading-tight">{fee.notes}</span>
                              </div>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-3 py-4 text-sm text-stone-900 font-medium">
                            <div className="font-bold text-stone-900">₹{fee.amount}</div>
                            {fee.amountPaid > 0 && fee.amountPaid < fee.amount && (
                              <div className="text-xs text-amber-700 font-normal">Paid: ₹{fee.amountPaid}</div>
                            )}
                            {fee.paymentMode && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
                                fee.paymentMode === 'Cash'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}>
                                {fee.paymentMode === 'Cash' ? (
                                  <Banknote className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Landmark className="w-3 h-3 text-blue-600" />
                                )}
                                {fee.paymentMode}
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-3 py-4 text-sm text-stone-500">
                            {formatDate(fee.dueDate)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-4 text-sm text-stone-500">
                            {getStatusBadge(fee.status)}
                          </td>

                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => setEditingFee(fee)}
                                className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                                title="Edit Invoice Data & Items"
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1 text-amber-600" />
                                Edit
                              </button>
                              <button
                                onClick={() => previewInvoice(fee)}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                title="Preview Official Invoice & Print"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Preview
                              </button>
                              <button 
                                onClick={() => printInvoice(fee)} 
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" 
                                title="Print Invoice"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => exportInvoice(fee)} 
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors" 
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {fee.status !== 'Paid' && (
                                <button 
                                  onClick={() => {
                                    setPayingFee(fee);
                                    setPayingAmount(fee.amount - (fee.amountPaid || 0));
                                    setPayingMode(fee.paymentMode || 'Bank Transfer');
                                  }} 
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors"
                                  title="Record payment with Bank vs Cash option"
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button 
                                onClick={() => sendWhatsAppInvoice(fee)} 
                                className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                                title="Send Invoice PDF via WhatsApp to Billed Number"
                              >
                                <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                                WhatsApp
                              </button>
                              <button 
                                onClick={() => setFeeToDelete(fee)} 
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors" 
                                title="Delete Fee"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Preview & Print Modal */}
      {selectedFeeForPreview && (
        <InvoicePreviewModal
          fee={selectedFeeForPreview}
          student={students.find(s => s.id === selectedFeeForPreview.studentId || s.name === selectedFeeForPreview.studentName)}
          settings={invoiceSettings}
          isOpen={!!selectedFeeForPreview}
          initialAction={previewInitialAction}
          onClose={() => setSelectedFeeForPreview(null)}
          onFeeUpdated={(updatedFee) => {
            setFees(prev => prev.map(f => f.id === updatedFee.id ? updatedFee : f));
            setSelectedFeeForPreview(updatedFee);
          }}
          onMarkPaid={(feeId, amount) => {
            handleUpdateStatus(feeId, 'Paid', amount);
            setSelectedFeeForPreview(prev => prev ? { ...prev, status: 'Paid', amountPaid: amount } : null);
          }}
        />
      )}

      {/* Invoice Edit Modal */}
      {editingFee && (
        <InvoiceEditModal
          fee={editingFee}
          student={students.find(s => s.id === editingFee.studentId || s.name === editingFee.studentName)}
          isOpen={!!editingFee}
          onClose={() => setEditingFee(null)}
          onSaved={(updatedFee) => {
            setFees(prev => prev.map(f => f.id === updatedFee.id ? updatedFee : f));
            setEditingFee(null);
            addToast('success', `Invoice for ${updatedFee.studentName} updated successfully.`);
          }}
        />
      )}

      {/* Record Payment Modal */}
      {payingFee && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Record Fee Payment</h3>
                <p className="text-xs text-stone-500">{payingFee.studentName} • {payingFee.type}</p>
              </div>
              <button 
                onClick={() => setPayingFee(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div className="bg-stone-50 rounded-xl p-3 text-xs flex justify-between items-center border border-stone-200">
                <span className="text-stone-600 font-medium">Total Bill: ₹{payingFee.amount}</span>
                <span className="font-bold text-stone-900">
                  Remaining Due: ₹{Math.max(0, payingFee.amount - (payingFee.amountPaid || 0))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Amount Received (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={payingFee.amount}
                  value={payingAmount}
                  onChange={(e) => setPayingAmount(Number(e.target.value))}
                  className="w-full text-lg font-bold text-stone-900 px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#74B72E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Deposit Channel (Bank vs Cash)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayingMode('Bank Transfer')}
                    className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all ${
                      payingMode !== 'Cash' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold ring-2 ring-blue-500/30' 
                        : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                      <Landmark className="w-4 h-4 text-blue-600" />
                      <span>Bank / Online</span>
                    </div>
                    <span className="text-[11px] text-stone-500 mt-1">Direct to Bank Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayingMode('Cash')}
                    className={`p-3 rounded-xl border text-left flex flex-col items-start transition-all ${
                      payingMode === 'Cash' 
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-emerald-500/30' 
                        : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Physical Cash</span>
                    </div>
                    <span className="text-[11px] text-stone-500 mt-1">Cash in hand drawer</span>
                  </button>
                </div>

                {/* Specific payment mode sub-selector if Bank is selected */}
                {payingMode !== 'Cash' && (
                  <div className="mt-2.5">
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Specific Method</label>
                    <select
                      value={payingMode}
                      onChange={(e) => setPayingMode(e.target.value)}
                      className="w-full text-xs rounded-lg border border-stone-300 py-1.5 px-2.5 bg-white text-stone-800"
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/IMPS/RTGS)</option>
                      <option value="UPI">UPI / GPay / PhonePe / Paytm</option>
                      <option value="Cheque">Bank Cheque</option>
                      <option value="Direct Bank Deposit">Direct Cash Deposit at Bank Branch</option>
                      <option value="Demand Draft">Demand Draft (DD)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setPayingFee(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || payingAmount <= 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#558B2F] hover:bg-[#436D25] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSubmittingPayment ? 'Recording...' : `Confirm & Record ₹${payingAmount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!feeToDelete}
        title="Delete Fee Record"
        itemName={feeToDelete ? `${feeToDelete.studentName} — ₹${feeToDelete.amount} (${feeToDelete.type})` : undefined}
        message="Are you sure you want to delete this fee record? This invoice and payment record will be permanently deleted."
        confirmText="Delete Fee"
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setFeeToDelete(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default FeeManagement;
