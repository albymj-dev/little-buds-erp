import React, { useState, useEffect } from 'react';
import { Fee, Student, InvoiceItem } from '../types';
import { getInvoiceLineItems } from '../utils/invoicePdf';
import { formatDate, toInputDate, getTodayIso } from '../utils/dateUtils';
import { updateFee } from '../services/api';
import { X, Plus, Trash2, Save, AlertCircle, Calculator, FileText, User, Calendar } from 'lucide-react';

interface Props {
  fee: Fee;
  student?: Student;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedFee: Fee) => void;
}

export const InvoiceEditModal: React.FC<Props> = ({
  fee,
  student,
  isOpen,
  onClose,
  onSaved
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<Fee['status']>('Pending');

  // Customer / Bill To
  const [guardianName, setGuardianName] = useState('');
  const [address, setAddress] = useState('');
  const [guardianContact, setGuardianContact] = useState('');

  // Child details
  const [studentName, setStudentName] = useState('');
  const [classOrAge, setClassOrAge] = useState('');
  const [parentName, setParentName] = useState('');
  const [childPhone, setChildPhone] = useState('');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && fee) {
      const invNum = fee.invoiceNumber || (fee.id ? `INV-${fee.id.slice(0, 8).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceNumber(invNum);
      setIssueDate(toInputDate(fee.issueDate || fee.createdAt) || getTodayIso());
      setDueDate(toInputDate(fee.dueDate) || getTodayIso());
      setStatus(fee.status || 'Pending');

      setGuardianName(fee.guardianName || student?.guardianName || 'Parent / Guardian');
      setAddress(fee.address || student?.address || '');
      setGuardianContact(fee.guardianContact || student?.guardianContact || student?.emergencyContact || '');

      setStudentName(fee.studentName || student?.name || '');
      setClassOrAge(fee.classOrAge || (student?.age ? `${student.age} Years` : '') || student?.developmentalFocus || 'Child Care');
      setParentName(fee.parentName || fee.guardianName || student?.guardianName || '');
      setChildPhone(fee.guardianContact || student?.guardianContact || '');

      const initialItems = getInvoiceLineItems(fee);
      setItems(initialItems.length > 0 ? initialItems : [{ description: 'Child Care Fee', quantity: 1, rate: fee.amount, amount: fee.amount }]);
      setDiscount(fee.discount || 0);
      setAmountPaid(fee.amountPaid || 0);
      setNotes(fee.notes || '');
      setErrorMsg('');
    }
  }, [isOpen, fee, student]);

  if (!isOpen) return null;

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      if (field === 'quantity' || field === 'rate') {
        const q = field === 'quantity' ? Number(value) || 0 : item.quantity || 0;
        const r = field === 'rate' ? Number(value) || 0 : item.rate || 0;
        item.amount = Math.round(q * r * 100) / 100;
      }
      next[index] = item;
      return next;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { description: 'Activity / Service Fee', quantity: 1, rate: 1000, amount: 1000 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMsg('At least one line item is required on the invoice.');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Computations
  const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalAmount = Math.max(0, subTotal - (Number(discount) || 0));
  const balanceDue = Math.max(0, totalAmount - (Number(amountPaid) || 0));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fee.id) return;

    if (items.length === 0) {
      setErrorMsg('Please specify at least one line item.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      // Determine overall payment status
      let updatedStatus = status;
      if (balanceDue === 0 && totalAmount > 0) {
        updatedStatus = 'Paid';
      } else if (amountPaid > 0 && balanceDue > 0) {
        updatedStatus = 'Partially Paid';
      }

      const updatedData: Partial<Fee> = {
        invoiceNumber: invoiceNumber.trim(),
        issueDate: issueDate,
        dueDate: dueDate,
        status: updatedStatus,
        guardianName: guardianName.trim(),
        address: address.trim(),
        guardianContact: guardianContact.trim(),
        studentName: studentName.trim(),
        classOrAge: classOrAge.trim(),
        parentName: parentName.trim(),
        items: items,
        subtotal: subTotal,
        discount: Number(discount) || 0,
        amount: totalAmount,
        amountPaid: Number(amountPaid) || 0,
        notes: notes.trim(),
        updatedAt: new Date().toISOString()
      };

      await updateFee(fee.id, updatedData);

      const mergedFee: Fee = {
        ...fee,
        ...updatedData
      };

      onSaved(mergedFee);
      onClose();
    } catch (err: any) {
      console.error('Failed to update invoice data:', err);
      setErrorMsg(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-stone-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Edit Invoice & Billing Details</h2>
              <p className="text-xs text-stone-500">
                Updating will immediately sync with the live preview, PDF exports, WhatsApp messages, and financial records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-6 flex-1 text-sm">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Invoice Meta */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Invoice & Date Information (DD/MM/YYYY)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block">Display: {formatDate(issueDate)}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block">Display: {formatDate(dueDate)}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Payment Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Bill To & Child's Details Side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BILL TO Card */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/20">
              <div className="bg-emerald-100/70 px-4 py-2 text-xs font-bold text-emerald-800 tracking-wider">
                BILL TO (CUSTOMER DETAILS)
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Customer / Guardian Name</label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={e => setGuardianName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Customer Address</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Street address, Apartment, City, PIN"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Customer Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={guardianContact}
                    onChange={e => setGuardianContact(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* CHILD'S DETAILS Card */}
            <div className="border border-sky-200 rounded-xl overflow-hidden bg-sky-50/20">
              <div className="bg-sky-100/70 px-4 py-2 text-xs font-bold text-sky-800 tracking-wider">
                CHILD'S DETAILS
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Child's Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Class / Age</label>
                  <input
                    type="text"
                    value={classOrAge}
                    onChange={e => setClassOrAge(e.target.value)}
                    placeholder="e.g. Toddler Care / 3.5 Years"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Parent's Name</label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    placeholder="e.g. Anjali Sharma"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Parent Phone</label>
                  <input
                    type="tel"
                    value={childPhone}
                    onChange={e => setChildPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Line Items */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <div className="bg-stone-100 px-4 py-3 flex items-center justify-between border-b border-stone-200">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                Line Items (Description, Quantity, Rate, Amount)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-semibold">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 w-24 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-32 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-sm">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50">
                      <td className="py-2 px-3 text-center font-semibold text-stone-500">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Service description"
                          className="w-full px-2.5 py-1.5 border border-stone-300 rounded-md text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded-md text-sm text-center focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={e => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded-md text-sm text-right focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={e => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-stone-300 rounded-md text-sm text-right font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          required
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove item"
                          className="text-stone-400 hover:text-red-600 transition p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Totals & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notes */}
            <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/20">
              <div className="bg-rose-100/70 px-4 py-2 text-xs font-bold text-rose-800 tracking-wider">
                INVOICE NOTES & SPECIAL TERMS
              </div>
              <div className="p-4">
                <textarea
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add any specific parent instructions, billing remarks, or payment conditions..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Totals Summary */}
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/50 p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-600 font-medium">Sub Total:</span>
                <span className="font-semibold text-stone-900">₹ {subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-600 font-medium">Discount (₹):</span>
                <div className="w-32">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1 border border-stone-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-stone-200 pt-2">
                <span className="text-stone-800 font-bold">Total Invoiced:</span>
                <span className="font-bold text-stone-900">₹ {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-600 font-medium">Amount Received (₹):</span>
                <div className="w-32">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1 border border-stone-300 rounded-lg text-sm text-right font-medium text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-sm bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-rose-800 font-bold">
                <span>Balance Due:</span>
                <span>₹ {balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-stone-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 border border-stone-300 text-stone-700 font-semibold rounded-xl hover:bg-stone-100 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving Changes...' : 'Save & Update Everywhere'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
