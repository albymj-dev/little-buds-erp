import React, { useState, useEffect } from 'react';
import { getFees, getStudents, addFee, updateFeeStatus, deleteFee } from '../services/api';
import { Fee, Student } from '../types';
import { Receipt, AlertCircle, CheckCircle, Clock, Download, Printer, Trash2, Settings, Eye, Landmark, Banknote, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './Toast';
import InvoicePreviewModal from './InvoicePreviewModal';
import { InvoiceSettings, defaultInvoiceSettings, generateInvoicePdf, printInvoiceDocument } from '../utils/invoicePdf';

const FeeManagement = () => {
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState<Fee | null>(null);
  const [selectedFeeForPreview, setSelectedFeeForPreview] = useState<Fee | null>(null);
  const [previewInitialAction, setPreviewInitialAction] = useState<'preview' | 'print'>('preview');
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Payment Recording Modal State
  const [payingFee, setPayingFee] = useState<Fee | null>(null);
  const [payingMode, setPayingMode] = useState<string>('Bank Transfer');
  const [payingAmount, setPayingAmount] = useState<number>(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

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
  
  // New fee form state
  const [newFee, setNewFee] = useState<Partial<Fee>>({
    type: 'Monthly Tuition',
    amount: 0,
    amountPaid: 0,
    dueDate: new Date().toISOString().split('T')[0],
    status: 'Pending'
  });

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
    if (!newFee.studentId || !newFee.amount) {
      addToast('error', 'Please select a student and enter a fee amount.');
      return;
    }
    
    const student = students.find(s => s.id === newFee.studentId);
    if (!student) {
      addToast('error', 'Selected student could not be found.');
      return;
    }

    try {
      await addFee({
        ...newFee as Fee,
        studentName: student.name
      });
      addToast('success', `Fee invoice created for ${student.name}.`);
      setShowAddForm(false);
      setNewFee({
        type: 'Monthly Tuition',
        amount: 0,
        amountPaid: 0,
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Pending'
      });
      loadData();
    } catch (error) {
      console.error("Failed to create fee", error);
      addToast('error', 'Failed to create fee invoice.');
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

  const printInvoice = async (fee: Fee) => {
    try {
      const student = students.find(s => s.id === fee.studentId || s.name === fee.studentName);
      addToast('info', `Opening print preview for ${fee.studentName}...`);
      const success = await printInvoiceDocument(fee, invoiceSettings, student);
      if (!success) {
        setSelectedFeeForPreview(fee);
      }
    } catch (err) {
      console.error('Print invoice failed, opening preview modal:', err);
      setSelectedFeeForPreview(fee);
    }
  };

  const previewInvoice = (fee: Fee) => {
    setPreviewInitialAction('preview');
    setSelectedFeeForPreview(fee);
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
              <input type="text" placeholder="e.g. littlebuds@upi" value={invoiceSettings.upiId || ''} onChange={e => setInvoiceSettings({...invoiceSettings, upiId: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Account Details</label>
              <input type="text" placeholder="e.g. HDFC Bank | A/C: 502000... | IFSC: HDFC..." value={invoiceSettings.bankDetails || ''} onChange={e => setInvoiceSettings({...invoiceSettings, bankDetails: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border" />
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
        <div className="mt-6 bg-stone-50 p-4 rounded-2xl border border-stone-200">
          <h3 className="text-lg font-bold leading-6 text-stone-900 mb-4">Assign New Fee</h3>
          <form onSubmit={handleCreateFee} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Student</label>
              <select required className="mt-1 block w-full rounded-xl border-stone-300 py-2 pl-3 pr-10 text-sm focus:border-[#74B72E] focus:outline-none focus:ring-[#74B72E] border bg-white"
                onChange={e => setNewFee({...newFee, studentId: e.target.value})}>
                <option value="">Select Student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Type</label>
              <select required className="mt-1 block w-full rounded-xl border-stone-300 py-2 pl-3 pr-10 text-sm focus:border-[#74B72E] focus:outline-none focus:ring-[#74B72E] border bg-white"
                onChange={e => setNewFee({...newFee, type: e.target.value as any})} value={newFee.type}>
                <option value="Monthly Tuition">Monthly Tuition</option>
                <option value="Care / Activity Session">Care / Activity Session</option>
                <option value="Registration">Registration</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Amount (₹)</label>
              <input type="number" required min="0" value={Number.isNaN(newFee.amount) || newFee.amount === 0 ? '' : newFee.amount} onChange={e => setNewFee({...newFee, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="mt-1 block w-full rounded-xl border-stone-300 py-2 px-3 focus:border-[#74B72E] focus:ring-[#74B72E] text-sm border bg-white" />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Due Date</label>
              <input type="date" required value={newFee.dueDate} onChange={e => setNewFee({...newFee, dueDate: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-300 py-2 px-3 focus:border-[#74B72E] focus:ring-[#74B72E] text-sm border bg-white" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Payment Mode</label>
              <select className="mt-1 block w-full rounded-xl border-stone-300 py-2 pl-3 pr-10 text-sm focus:border-[#74B72E] focus:outline-none focus:ring-[#74B72E] border bg-white"
                value={newFee.paymentMode || 'Bank Transfer'}
                onChange={e => setNewFee({...newFee, paymentMode: e.target.value})}>
                <option value="Bank Transfer">🏦 Bank Transfer</option>
                <option value="UPI">🏦 UPI / QR Code</option>
                <option value="Cash">💵 Physical Cash</option>
                <option value="Cheque">🏦 Cheque</option>
                <option value="Direct Bank Deposit">🏦 Direct Bank Deposit</option>
                <option value="Demand Draft">🏦 Demand Draft</option>
              </select>
            </div>
            <div className="sm:col-span-6 flex justify-end">
              <button type="submit" className="inline-flex justify-center rounded-xl border border-transparent bg-[#558B2F] py-2 px-4 text-sm font-bold text-white shadow-sm hover:bg-[#436D25] transition-colors">
                Save Fee Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Student</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Due Date</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : fees.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-500">No fees recorded.</td></tr>
                  ) : (
                    fees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{fee.studentName}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{fee.type}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                          <div>₹{fee.amount}</div>
                          {fee.amountPaid > 0 && fee.amountPaid < fee.amount && <div className="text-xs text-amber-700 font-normal">Paid: ₹{fee.amountPaid}</div>}
                          {fee.paymentMode && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
                              fee.paymentMode === 'Cash' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}>
                              {fee.paymentMode === 'Cash' ? <Banknote className="w-3 h-3 text-emerald-600" /> : <Landmark className="w-3 h-3 text-blue-600" />}
                              {fee.paymentMode}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{fee.dueDate}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {getStatusBadge(fee.status)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-2">
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
                            <a 
                              href={`https://wa.me/${students.find(s => s.name === fee.studentName)?.guardianContact?.replace(/\D/g, '') || ''}?text=${encodeURIComponent(`Reminder: Fee of ₹${fee.amount} is ${fee.status.toLowerCase()} for ${fee.studentName}. Due date: ${fee.dueDate}.`)}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 transition-colors"
                            >
                              Remind
                            </a>
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
                    ))
                  )}
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
          onMarkPaid={(feeId, amount) => {
            handleUpdateStatus(feeId, 'Paid', amount);
            setSelectedFeeForPreview(prev => prev ? { ...prev, status: 'Paid', amountPaid: amount } : null);
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
