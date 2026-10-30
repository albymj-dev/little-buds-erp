import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Fee, Student } from '../types';
import { 
  InvoiceSettings, 
  defaultInvoiceSettings, 
  getStoredInvoiceSettings,
  numberToWords, 
  generateInvoicePdf, 
  generatePrintableHtml, 
  printInvoiceDocument, 
  openInvoicePrintWindow,
  getInvoiceLineItems,
  normalizeWhatsAppNumber,
  formatWhatsAppInvoiceMessage
} from '../utils/invoicePdf';
import { formatDate } from '../utils/dateUtils';
import { updateFee } from '../services/api';
import { 
  X, Printer, Download, MessageSquare, CheckCircle, Clock, 
  AlertCircle, Edit3, Share2, Check, FileCheck, ExternalLink, Loader2, Phone
} from 'lucide-react';
import { LittleBudsLogo } from './Logo';
import { InvoiceEditModal } from './InvoiceEditModal';

interface Props {
  fee: Fee;
  student?: Student;
  settings?: InvoiceSettings;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid?: (feeId: string, amount: number) => void;
  onFeeUpdated?: (updatedFee: Fee) => void;
  initialAction?: 'preview' | 'print';
}

export const InvoicePreviewModal: React.FC<Props> = ({
  fee: initialFee,
  student,
  settings = defaultInvoiceSettings,
  isOpen,
  onClose,
  onMarkPaid,
  onFeeUpdated,
  initialAction = 'preview'
}) => {
  const [currentFee, setCurrentFee] = useState<Fee>(initialFee);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [whatsAppBannerMessage, setWhatsAppBannerMessage] = useState<string | null>(null);

  // WhatsApp Workflow State
  const [whatsAppPromptOpen, setWhatsAppPromptOpen] = useState(false);
  const [manualPhoneInput, setManualPhoneInput] = useState('');
  const [targetPhoneNumber, setTargetPhoneNumber] = useState('');
  const [lastDownloadedPdfName, setLastDownloadedPdfName] = useState('');

  useEffect(() => {
    setCurrentFee(initialFee);
  }, [initialFee]);

  // Self-contained standalone printable HTML blob URL for direct new-tab printing
  const printBlobUrl = useMemo(() => {
    if (!isOpen || !currentFee) return '';
    try {
      const html = generatePrintableHtml(currentFee, settings, student);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to generate printable HTML blob', e);
      return '';
    }
  }, [currentFee, settings, student, isOpen]);

  // Handle initialAction='print' when modal opens
  useEffect(() => {
    if (isOpen && initialAction === 'print') {
      const timer = setTimeout(() => {
        handlePrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialAction]);

  if (!isOpen) return null;

  const invoiceNum = currentFee.invoiceNumber || (currentFee.id ? `INV-${currentFee.id.slice(0, 8).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const issueDateFormatted = formatDate(currentFee.issueDate || currentFee.createdAt || new Date());
  const dueDateFormatted = formatDate(currentFee.dueDate || new Date());
  const status = (currentFee.status || 'Pending').toUpperCase();

  const customerName = currentFee.guardianName || student?.guardianName || 'Parent / Guardian';
  const customerAddress = currentFee.address || student?.address || '';
  const customerPhone = currentFee.guardianContact || student?.guardianContact || student?.emergencyContact || '';

  const childName = currentFee.studentName || student?.name || '';
  const childClassAge = currentFee.classOrAge || (student?.age ? `${student.age} Years` : '') || student?.developmentalFocus || 'Child Care';
  const parentName = currentFee.parentName || currentFee.guardianName || student?.guardianName || '';
  const parentPhone = currentFee.guardianContact || student?.guardianContact || '';

  const subTotal = currentFee.subtotal !== undefined ? currentFee.subtotal : currentFee.amount;
  const discount = currentFee.discount || 0;
  const amountPaid = currentFee.amountPaid || 0;
  const balanceDue = Math.max(0, (subTotal - discount) - amountPaid);

  // Centre Address from Invoice Settings
  const storedSettings = getStoredInvoiceSettings();
  const centreAddress = settings.address || storedSettings.address || '';
  const centreContact = settings.contactInfo || settings.phone || storedSettings.contactInfo || '';

  const lineItems = getInvoiceLineItems(currentFee);
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

  const handleDownloadPdf = async (): Promise<Blob | null> => {
    setIsDownloading(true);
    try {
      const doc = await generateInvoicePdf(currentFee, settings, student);
      const fileName = `Invoice_${childName.replace(/\s+/g, '_')}_${invoiceNum}.pdf`;
      doc.save(fileName);
      setLastDownloadedPdfName(fileName);
      return doc.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
      return null;
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Opens standalone print window/tab and auto-triggers native print dialogue
   */
  const handlePrint = () => {
    setIsPrinting(true);
    try {
      openInvoicePrintWindow(currentFee, settings, student);
    } catch (err) {
      console.warn('openInvoicePrintWindow failed, attempting iframe print:', err);
      printInvoiceDocument(currentFee, settings, student);
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
      }, 600);
    }
  };

  /**
   * WhatsApp Sharing Workflow:
   * Automatically targets the exact phone number in the invoice to whom the invoice is billed.
   * Executes synchronously on click to guarantee browser does not block the window.
   */
  const initiateWhatsAppFlow = (overridePhone?: string) => {
    const rawPhone = overridePhone || customerPhone || parentPhone || '';
    const cleanPhone = normalizeWhatsAppNumber(rawPhone);

    if (!cleanPhone) {
      // If no valid phone number is present in the invoice, prompt user for it
      setManualPhoneInput('');
      setWhatsAppPromptOpen(true);
      return;
    }

    setTargetPhoneNumber(cleanPhone);
    setIsSharingWhatsApp(true);

    const message = formatWhatsAppInvoiceMessage(currentFee, student);
    const fileName = `Invoice_${childName.replace(/\s+/g, '_')}_${invoiceNum}.pdf`;
    setLastDownloadedPdfName(fileName);

    // 1. Build universal wa.me link
    const encodedMsg = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

    // 2. Open WhatsApp IMMEDIATELY within the synchronous user click gesture!
    // This prevents ANY browser popup blocking.
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
      // Direct navigation fallback if popup blocker prevented new tab
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

    setWhatsAppBannerMessage(`WhatsApp opened for +${cleanPhone} (${customerName})! Generating and downloading PDF invoice...`);
    setTimeout(() => setWhatsAppBannerMessage(null), 8000);

    // 3. Generate latest PDF in parallel and download
    generateInvoicePdf(currentFee, settings, student)
      .then(doc => {
        doc.save(fileName);
      })
      .catch(err => {
        console.error('WhatsApp invoice PDF download failed:', err);
      })
      .finally(() => {
        setIsSharingWhatsApp(false);
      });
  };

  const handleManualPhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhoneInput.trim()) return;

    const normalized = normalizeWhatsAppNumber(manualPhoneInput);
    if (!normalized || normalized.length < 10) {
      alert('Please enter a valid 10-digit mobile or WhatsApp number.');
      return;
    }

    // Persist this phone number onto the fee record so future invoices have it
    if (currentFee.id) {
      updateFee(currentFee.id, { guardianContact: manualPhoneInput.trim() }).catch(console.warn);
      const updated = { ...currentFee, guardianContact: manualPhoneInput.trim() };
      setCurrentFee(updated);
      if (onFeeUpdated) onFeeUpdated(updated);
    }

    setWhatsAppPromptOpen(false);
    initiateWhatsAppFlow(manualPhoneInput.trim());
  };

  const handleSavedFromEdit = (updatedFee: Fee) => {
    setCurrentFee(updatedFee);
    if (onFeeUpdated) {
      onFeeUpdated(updatedFee);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col border border-stone-200 overflow-hidden my-auto">
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-stone-900 text-sm sm:text-base">Invoice Preview</span>
            <span className="text-xs font-mono bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
              {invoiceNum}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Edit Invoice Button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Data
            </button>

            {/* Print Button (Opens dedicated print tab and auto-triggers print dialogue) */}
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-800 hover:bg-stone-900 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              title="Open Print Tab & Dialogue"
            >
              <Printer className="w-3.5 h-3.5" />
              {isPrinting ? 'Opening...' : 'Print'}
            </button>

            {/* Standalone Print Tab Link */}
            {printBlobUrl && (
              <a
                href={printBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-800 border border-stone-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                title="Open standalone invoice in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
                Print Tab
              </a>
            )}

            {/* Download PDF Button */}
            <button
              onClick={() => handleDownloadPdf()}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </button>

            {/* Send via WhatsApp Button */}
            <button
              onClick={() => initiateWhatsAppFlow()}
              disabled={isSharingWhatsApp}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              title={`Send to billed phone: ${customerPhone || 'Billed Parent'}`}
            >
              {isSharingWhatsApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
              {isSharingWhatsApp ? 'Sending...' : 'Send WhatsApp'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic WhatsApp Notification Banner */}
        {whatsAppBannerMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-6 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{whatsAppBannerMessage}</span>
            </div>
            <button
              onClick={() => setWhatsAppBannerMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Pastel Invoice Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-100/70">
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

                {/* Address below logo entered in invoice setting */}
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
                    {currentFee.notes ? (
                      <p>{currentFee.notes}</p>
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
      </div>

      {/* Edit Invoice Modal */}
      {showEditModal && (
        <InvoiceEditModal
          fee={currentFee}
          student={student}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={handleSavedFromEdit}
        />
      )}

      {/* Missing WhatsApp Phone Number Prompt Modal */}
      {whatsAppPromptOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">Recipient WhatsApp Number</h3>
                  <p className="text-xs text-stone-500">Billed to: {customerName}</p>
                </div>
              </div>
              <button 
                onClick={() => setWhatsAppPromptOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualPhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Enter WhatsApp Number (10 digits)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-stone-500 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    autoFocus
                    placeholder="9876543210"
                    value={manualPhoneInput}
                    onChange={(e) => setManualPhoneInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    className="w-full pl-12 pr-3 py-2 border border-stone-300 rounded-xl text-sm font-mono font-medium focus:ring-2 focus:ring-green-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  This phone number will be attached to the invoice record for {childName}.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWhatsAppPromptOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualPhoneInput.length < 10}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  Attach PDF & Open WhatsApp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicePreviewModal;
