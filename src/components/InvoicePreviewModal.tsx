import React, { useRef, useMemo, useState } from 'react';
import { Fee, Student } from '../types';
import { InvoiceSettings, defaultInvoiceSettings, numberToWords, generateInvoicePdf, generatePrintableHtml, printInvoiceDocument } from '../utils/invoicePdf';
import { format } from 'date-fns';
import { X, Printer, Download, MessageSquare, CheckCircle, Clock, AlertCircle, Building, User, Calendar, CreditCard, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import { LittleBudsLogo } from './Logo';

interface Props {
  fee: Fee;
  student?: Student;
  settings?: InvoiceSettings;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid?: (feeId: string, amount: number) => void;
  initialAction?: 'preview' | 'print';
}

const InvoicePreviewModal: React.FC<Props> = ({
  fee,
  student,
  settings = defaultInvoiceSettings,
  isOpen,
  onClose,
  onMarkPaid,
  initialAction = 'preview'
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const invoiceNumber = `INV-${fee.id ? fee.id.slice(0, 8).toUpperCase() : 'REC' + format(new Date(), 'yyyyMMdd')}`;
  const balance = Math.max(0, fee.amount - (fee.amountPaid || 0));
  const formattedDueDate = fee.dueDate ? format(new Date(fee.dueDate), 'dd MMMM yyyy') : 'On Receipt';
  const issueDate = format(new Date(), 'dd MMMM yyyy');

  // Generate self-contained printable standalone HTML blob URL
  const printBlobUrl = useMemo(() => {
    if (!isOpen) return '';
    try {
      const html = generatePrintableHtml(fee, settings, student);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to generate printable HTML blob', e);
      return '';
    }
  }, [fee, settings, student, isOpen]);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const doc = await generateInvoicePdf(fee, settings, student);
      const fileName = `Invoice_${fee.studentName.replace(/\s+/g, '_')}_${invoiceNumber}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * 100% reliable print execution:
   * 1. Uses isolated hidden iframe with printInvoiceDocument
   * 2. Fallback to in-page print via CSS @media print
   * 3. Fallback to vector PDF download if environment blocks both
   */
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const success = await printInvoiceDocument(fee, settings, student);
      if (!success) {
        // Fallback: In-page print
        document.body.classList.add('printing-invoice');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-invoice');
        }, 1500);
      }
    } catch (err) {
      console.warn('Iframe print error, attempting in-page print and PDF download:', err);
      try {
        document.body.classList.add('printing-invoice');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-invoice');
        }, 1500);
      } catch (e) {
        handleDownloadPdf();
      }
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = () => {
    switch (fee.status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
            PAID IN FULL
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            PAYMENT PENDING
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
            OVERDUE
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CreditCard className="w-3.5 h-3.5 mr-1 text-blue-600" />
            PARTIALLY PAID
          </span>
        );
      default:
        return null;
    }
  };

  const whatsappPhone = (student?.guardianContact || '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
    `Hello ${student?.guardianName || 'Parent'}, regarding invoice ${invoiceNumber} for ${fee.studentName}. Total fee: ₹${fee.amount.toFixed(2)}, Paid: ₹${(fee.amountPaid || 0).toFixed(2)}, Balance due: ₹${balance.toFixed(2)}. Due date: ${formattedDueDate}. Please contact ${settings.centreName} if you have any questions.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Control Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-100">
                Official Invoice Preview & Receipt
              </h2>
              <p className="text-xs text-slate-400">{invoiceNumber} • {fee.studentName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {fee.status !== 'Paid' && onMarkPaid && (
              <button
                type="button"
                onClick={() => onMarkPaid(fee.id!, fee.amount)}
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                title="Mark this fee as fully paid"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Mark as Paid
              </button>
            )}

            {whatsappPhone && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                title="Share invoice summary on WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                WhatsApp
              </a>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              title="Print Invoice"
            >
              {isPrinting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-slate-200" /> : <Printer className="w-3.5 h-3.5 mr-1 text-slate-200" />}
              {isPrinting ? 'Preparing...' : 'Print'}
            </button>

            {printBlobUrl && (
              <a
                href={printBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                title="Open standalone print document in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Open Print Tab
              </a>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              title="Download formal PDF"
            >
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
              {isDownloading ? 'Generating...' : 'PDF Download'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Canvas */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100/70 flex justify-center">
          <div 
            ref={printContentRef}
            id="printable-invoice"
            className="w-full max-w-[780px] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-slate-800 p-6 sm:p-10 font-sans"
          >
            {/* Header Banner */}
            <div 
              className="rounded-xl p-6 text-white mb-6 relative overflow-hidden"
              style={{ backgroundColor: settings.accentColor || '#4f46e5' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="max-w-md">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-white rounded-xl shrink-0 shadow-sm">
                      <LittleBudsLogo className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                      {settings.centreName}
                    </h1>
                  </div>
                  {settings.subName && (
                    <p className="text-sm text-indigo-100 font-medium mt-0.5">{settings.subName}</p>
                  )}
                  <p className="text-xs text-indigo-100/80 mt-2 leading-relaxed">
                    {settings.address}
                  </p>
                  <p className="text-xs text-indigo-100/80 mt-0.5 font-mono">
                    {settings.contactInfo}
                  </p>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/20">
                  <div className="inline-block px-3 py-1 rounded bg-white/20 backdrop-blur-sm text-xs font-bold tracking-wider uppercase mb-1">
                    Tax Invoice / Receipt
                  </div>
                  <div className="text-lg font-extrabold font-mono tracking-wide">{invoiceNumber}</div>
                  {settings.regNumber && (
                    <div className="text-xs text-indigo-100/80 mt-1">{settings.regNumber}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Bill To & Invoice Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Bill To Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  <User className="w-3.5 h-3.5" />
                  <span>Billed To (Child & Guardian)</span>
                </div>
                <div className="text-base font-bold text-slate-900">{fee.studentName}</div>
                <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                  <p><span className="text-slate-400">Guardian:</span> {student?.guardianName || 'Parent / Guardian'}</p>
                  <p><span className="text-slate-400">Contact:</span> {student?.guardianContact || 'N/A'}</p>
                  {(student?.developmentalFocus || student?.primaryDiagnosis) && (
                    <p><span className="text-slate-400">Focus:</span> {student.developmentalFocus || student.primaryDiagnosis}</p>
                  )}
                  {student?.admissionDate && (
                    <p><span className="text-slate-400">Enrolled:</span> {student.admissionDate}</p>
                  )}
                </div>
              </div>

              {/* Invoice Meta Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Invoice & Payment Meta</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">Date of Issue</span>
                    <span className="font-semibold text-slate-800">{issueDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Payment Due Date</span>
                    <span className="font-semibold text-slate-800">{formattedDueDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Payment Status</span>
                    <div className="mt-1">{getStatusBadge()}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Billing Category</span>
                    <span className="font-semibold text-slate-800">{fee.type}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left w-12">#</th>
                    <th className="py-3 px-4 text-left">Service Description</th>
                    <th className="py-3 px-4 text-left">Due Date</th>
                    <th className="py-3 px-4 text-right">Fee Rate (₹)</th>
                    <th className="py-3 px-4 text-right">Paid (₹)</th>
                    <th className="py-3 px-4 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 text-slate-400 font-mono text-xs">01</td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{fee.type}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Child Care & Early Development Session
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 text-xs">{formattedDueDate}</td>
                    <td className="py-4 px-4 text-right font-medium text-slate-900">
                      ₹{fee.amount.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-emerald-600">
                      ₹{(fee.amountPaid || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-slate-900">
                      ₹{balance.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Amount in Words */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 mb-8">
              {/* Words and Bank Info */}
              <div className="sm:col-span-7 bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Amount in Words
                  </div>
                  <div className="text-sm font-bold text-indigo-900 italic">
                    "{numberToWords(fee.amount)}"
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs">
                  <span className="font-semibold text-slate-700 block mb-1">Payment Instructions & UPI</span>
                  {settings.upiId && (
                    <p className="text-slate-600">
                      <span className="text-slate-400">UPI VPA:</span> <span className="font-mono font-medium text-slate-900">{settings.upiId}</span>
                    </p>
                  )}
                  {settings.bankDetails && (
                    <p className="text-slate-600 mt-0.5">
                      <span className="text-slate-400">Bank:</span> {settings.bankDetails}
                    </p>
                  )}
                </div>
              </div>

              {/* Totals Calculation Card */}
              <div className="sm:col-span-5 bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Gross Total Amount:</span>
                  <span className="font-semibold text-slate-900 font-mono">₹{fee.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Amount Paid / Received:</span>
                  <span className="font-semibold text-emerald-600 font-mono">₹{(fee.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-800">Balance Due:</span>
                  <span className={`text-lg font-black font-mono ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₹{balance.toFixed(2)}
                  </span>
                </div>
                {balance === 0 && (
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-1.5 text-center">
                    ✓ Full payment received with thanks
                  </div>
                )}
              </div>
            </div>

            {/* Terms & Conditions and Signature */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-8 text-[11px] text-slate-500 leading-relaxed">
                <span className="font-bold text-slate-700 block mb-0.5">Terms & Conditions</span>
                <p className="whitespace-pre-line">{settings.terms || defaultInvoiceSettings.terms}</p>
              </div>

              <div className="sm:col-span-4 text-center sm:text-right">
                <div className="h-12 flex items-end justify-center sm:justify-end">
                  <div className="w-40 border-b border-slate-400"></div>
                </div>
                <div className="text-xs font-bold text-slate-800 mt-1">Authorized Signatory</div>
                <div className="text-[10px] text-slate-500">{settings.centreName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <p>Tip: Click "Print" to use the browser print dialog, or "PDF Download" to export a high-resolution vector PDF.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white text-xs"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
