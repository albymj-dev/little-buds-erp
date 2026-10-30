import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Fee, Student } from '../types';
import { 
  InvoiceSettings, 
  defaultInvoiceSettings, 
  getStoredInvoiceSettings,
  generateInvoicePdf, 
  openInvoicePrintWindow,
  getInvoiceLineItems 
} from '../utils/invoicePdf';
import { formatDate } from '../utils/dateUtils';
import { LittleBudsLogo } from './Logo';
import { Printer, Download, CheckCircle, Clock, AlertCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';

export const PublicInvoiceView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fee, setFee] = useState<Fee | null>(null);
  const [student, setStudent] = useState<Student | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      if (!id) {
        setError('No invoice ID provided.');
        setLoading(false);
        return;
      }

      try {
        const feeDocRef = doc(db, 'fees', id);
        const feeSnap = await getDoc(feeDocRef);

        if (!feeSnap.exists()) {
          setError('Invoice not found. Please verify the link or contact Little Buds accounts desk.');
          setLoading(false);
          return;
        }

        const feeData = { id: feeSnap.id, ...feeSnap.data() } as Fee;
        setFee(feeData);

        if (feeData.studentId) {
          try {
            const studentDocRef = doc(db, 'students', feeData.studentId);
            const studentSnap = await getDoc(studentDocRef);
            if (studentSnap.exists()) {
              setStudent({ id: studentSnap.id, ...studentSnap.data() } as Student);
            }
          } catch (e) {
            console.warn('Student record could not be fetched:', e);
          }
        }
      } catch (err: any) {
        console.error('Error fetching invoice:', err);
        setError('Unable to load invoice at this time. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
        <p className="text-stone-700 font-medium text-sm">Loading Little Buds Invoice...</p>
      </div>
    );
  }

  if (error || !fee) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-stone-200">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Invoice Not Available</h2>
          <p className="text-stone-600 text-sm mb-6 leading-relaxed">{error || 'Invoice record could not be found.'}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const invoiceNum = fee.invoiceNumber || (fee.id ? `INV-${fee.id.slice(0, 8).toUpperCase()}` : 'INV-REC');
  const issueDateFormatted = formatDate(fee.issueDate || fee.createdAt || new Date());
  const dueDateFormatted = formatDate(fee.dueDate || new Date());
  const status = (fee.status || 'Pending').toUpperCase();

  const customerName = fee.guardianName || student?.guardianName || 'Parent / Guardian';
  const customerAddress = fee.address || student?.address || '';
  const customerPhone = fee.guardianContact || student?.guardianContact || student?.emergencyContact || '';

  const childName = fee.studentName || student?.name || '';
  const childClassAge = fee.classOrAge || (student?.age ? `${student.age} Years` : '') || student?.developmentalFocus || 'Child Care';
  const parentName = fee.parentName || fee.guardianName || student?.guardianName || '';
  const parentPhone = fee.guardianContact || student?.guardianContact || '';

  const subTotal = fee.subtotal !== undefined ? fee.subtotal : fee.amount;
  const discount = fee.discount || 0;
  const amountPaid = fee.amountPaid || 0;
  const balanceDue = Math.max(0, (subTotal - discount) - amountPaid);

  const storedSettings = getStoredInvoiceSettings();
  const centreAddress = storedSettings.address || '';
  const centreContact = storedSettings.contactInfo || storedSettings.phone || '';

  const lineItems = getInvoiceLineItems(fee);
  const minRows = 8;
  const rows: { sl: number; desc: string; qty: string; rate: string; amount: string }[] = [];

  for (let i = 0; i < Math.max(lineItems.length, minRows); i++) {
    const item = lineItems[i];
    if (item) {
      rows.push({
        sl: i + 1,
        desc: item.description,
        qty: item.quantity ? String(item.quantity) : '1',
        rate: item.rate !== undefined ? `₹${item.rate.toFixed(2)}` : '',
        amount: item.amount !== undefined ? `₹${item.amount.toFixed(2)}` : ''
      });
    } else {
      rows.push({
        sl: i + 1,
        desc: '',
        qty: '',
        rate: '',
        amount: ''
      });
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const doc = await generateInvoicePdf(fee, defaultInvoiceSettings, student);
      doc.save(`Invoice_${childName.replace(/\s+/g, '_')}_${invoiceNum}.pdf`);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Unable to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    openInvoicePrintWindow(fee, defaultInvoiceSettings, student);
  };

  return (
    <div className="min-h-screen bg-stone-100 py-6 px-3 sm:px-6">
      {/* Top Banner & Control Bar */}
      <div className="max-w-[760px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-stone-900 text-sm">Official Invoice</span>
          <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200">
            {invoiceNum}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Little Buds Pastel Invoice Canvas */}
      <div 
        id="printable-invoice" 
        className="max-w-[760px] mx-auto bg-white shadow-xl rounded-lg p-6 sm:p-10 border border-stone-200 text-stone-800"
      >
        {/* Header: Logo & Brand on Left | Sage Green Divider | INVOICE on Right */}
        <div className="flex flex-col sm:flex-row items-stretch gap-6 pb-6 mb-6">
          {/* Left Brand */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 shrink-0">
                <LittleBudsLogo className="w-full h-full" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight leading-none">
                  <span className="text-purple-600">L</span>
                  <span className="text-pink-500">i</span>
                  <span className="text-amber-500">t</span>
                  <span className="text-yellow-500">t</span>
                  <span className="text-sky-500">l</span>
                  <span className="text-purple-500">e</span>
                  <span className="text-lime-600 ml-1.5">Buds</span>
                </h1>
                <p className="text-[11px] font-bold text-lime-700 tracking-wider uppercase mt-1">
                  CHILD CARE CENTRE
                </p>
                <p className="font-serif italic text-xs text-stone-600 mt-0.5">
                  Where Every Child Can Bloom.
                </p>
              </div>
            </div>

            {/* Address below logo entered in invoice settings */}
            {centreAddress && (
              <div className="mt-3 pt-2 border-t border-stone-200/70 text-xs text-stone-600 leading-snug">
                <p className="font-medium text-stone-700">{centreAddress}</p>
                {centreContact && (
                  <p className="text-[11px] text-stone-500 mt-0.5">Ph: {centreContact}</p>
                )}
              </div>
            )}
          </div>

          {/* Vertical Sage Green Divider */}
          <div className="hidden sm:block w-[1.5px] bg-[#6E9A70] self-stretch opacity-60" />

          {/* Right INVOICE Metadata */}
          <div className="w-full sm:w-[46%] pl-0 sm:pl-2">
            <h2 className="text-3xl font-extrabold text-[#5F8B62] tracking-wide mb-3">
              INVOICE
            </h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center">
                <span className="w-28 font-bold text-[#556B55]">Invoice No.</span>
                <span className="mr-2 font-bold text-[#556B55]">:</span>
                <span className="flex-1 border-b border-[#D6E4D8] pb-0.5 font-mono text-stone-900 font-medium">
                  {invoiceNum}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-28 font-bold text-[#556B55]">Date</span>
                <span className="mr-2 font-bold text-[#556B55]">:</span>
                <span className="flex-1 border-b border-[#D6E4D8] pb-0.5 text-stone-900 font-medium">
                  {issueDateFormatted}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-28 font-bold text-[#556B55]">Due Date</span>
                <span className="mr-2 font-bold text-[#556B55]">:</span>
                <span className="flex-1 border-b border-[#D6E4D8] pb-0.5 text-stone-900 font-medium">
                  {dueDateFormatted}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-28 font-bold text-[#556B55]">Payment Status</span>
                <span className="mr-2 font-bold text-[#556B55]">:</span>
                <div className="flex-1">
                  <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider ${
                    status === 'PAID' 
                      ? 'bg-[#E4F0E3] text-[#2D6A35] border border-[#BDD9BF]'
                      : status === 'OVERDUE'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Two Cards: BILL TO (Pastel Green) & CHILD'S DETAILS (Pastel Blue) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* BILL TO */}
          <div className="border border-[#BDD9BF] rounded-xl overflow-hidden bg-[#FBFDFB]">
            <div className="bg-[#E4F0E3] text-[#3F6A44] font-bold text-xs px-3.5 py-1.5 tracking-wider">
              BILL TO
            </div>
            <div className="p-3.5 space-y-2 text-xs">
              <div className="flex items-center">
                <span className="w-16 font-bold text-stone-600">Name</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-900 font-medium">
                  {customerName}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="w-16 font-bold text-stone-600">Address</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-700 min-h-[18px]">
                  {customerAddress || '—'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-16 font-bold text-stone-600">Phone</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-900 font-medium font-mono">
                  {customerPhone || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* CHILD'S DETAILS */}
          <div className="border border-[#B4D5F0] rounded-xl overflow-hidden bg-[#FBFCFE]">
            <div className="bg-[#E1EFFB] text-[#2A69A4] font-bold text-xs px-3.5 py-1.5 tracking-wider">
              CHILD'S DETAILS
            </div>
            <div className="p-3.5 space-y-2 text-xs">
              <div className="flex items-center">
                <span className="w-24 font-bold text-stone-600">Child's Name</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-900 font-semibold">
                  {childName}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-24 font-bold text-stone-600">Class / Age</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-700">
                  {childClassAge}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-24 font-bold text-stone-600">Parent's Name</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-900">
                  {parentName || '—'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-24 font-bold text-stone-600">Phone</span>
                <span className="mr-2 text-stone-400">:</span>
                <span className="flex-1 border-b border-stone-200 pb-0.5 text-stone-900 font-mono">
                  {parentPhone || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section (Sage Green Header & Crisp Grid) */}
        <div className="border border-[#A2C9A6] rounded-lg overflow-hidden mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#6E9A70] text-white">
                <th className="py-2 px-3 text-center w-14 font-bold border-r border-[#5C885E]">SL. NO.</th>
                <th className="py-2 px-4 text-left font-bold border-r border-[#5C885E]">DESCRIPTION</th>
                <th className="py-2 px-3 text-center w-24 font-bold border-r border-[#5C885E]">QUANTITY</th>
                <th className="py-2 px-3 text-right w-28 font-bold border-r border-[#5C885E]">RATE</th>
                <th className="py-2 px-3 text-right w-28 font-bold">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A2C9A6]">
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-[#F9FCF9]' : 'bg-white'}>
                  <td className="py-2 px-3 text-center font-bold text-stone-600 border-r border-[#A2C9A6]">
                    {r.sl}
                  </td>
                  <td className="py-2 px-4 border-r border-[#A2C9A6] text-stone-900">
                    {r.desc || '\u00A0'}
                  </td>
                  <td className="py-2 px-3 text-center border-r border-[#A2C9A6] text-stone-700">
                    {r.qty || '\u00A0'}
                  </td>
                  <td className="py-2 px-3 text-right border-r border-[#A2C9A6] text-stone-700">
                    {r.rate || '\u00A0'}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-stone-900">
                    {r.amount || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Row: NOTES on Left, Totals on Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: NOTES Box & Authorised Signature */}
          <div>
            <div className="border border-[#FCA5A5] rounded-xl overflow-hidden bg-[#FFFDFD] mb-8">
              <div className="bg-[#FFE4E8] text-[#E14B68] font-bold text-xs px-3.5 py-1.5 tracking-wider">
                NOTES
              </div>
              <div className="p-3.5 text-xs text-stone-700 space-y-1 min-h-[56px]">
                {fee.notes ? (
                  <p>{fee.notes}</p>
                ) : (
                  <p className="text-stone-500">Thank you for your trust in Little Buds Child Care Centre.</p>
                )}
              </div>
            </div>

            <div className="pt-4">
              <div className="w-48 border-b border-[#6E9A70] mb-1.5" />
              <p className="text-xs font-bold text-[#556B55]">Authorised Signature</p>
            </div>
          </div>

          {/* Right: Totals Box */}
          <div className="border border-[#A2C9A6] rounded-xl overflow-hidden bg-white text-xs">
            <div className="flex border-b border-stone-200">
              <span className="flex-1 p-2.5 font-semibold text-stone-600 border-r border-stone-200">
                Sub Total
              </span>
              <span className="w-32 p-2.5 text-right font-semibold text-stone-900">
                ₹ {subTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex border-b border-stone-200">
              <span className="flex-1 p-2.5 font-semibold text-stone-600 border-r border-stone-200">
                Discount
              </span>
              <span className="w-32 p-2.5 text-right text-stone-700">
                ₹ {discount.toFixed(2)}
              </span>
            </div>
            <div className="flex border-b border-stone-200">
              <span className="flex-1 p-2.5 font-semibold text-stone-600 border-r border-stone-200">
                Amount Paid
              </span>
              <span className="w-32 p-2.5 text-right text-emerald-700 font-bold">
                ₹ {amountPaid.toFixed(2)}
              </span>
            </div>
            <div className="flex bg-[#FEE2E2] text-rose-800 font-bold">
              <span className="flex-1 p-2.5 border-r border-rose-200">
                Balance Due
              </span>
              <span className="w-32 p-2.5 text-right">
                ₹ {balanceDue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicInvoiceView;
