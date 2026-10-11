import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Fee, Student } from '../types';
import { format } from 'date-fns';

export interface InvoiceSettings {
  centreName: string;
  subName: string;
  address: string;
  contactInfo: string;
  accentColor: string;
  regNumber?: string;
  upiId?: string;
  bankDetails?: string;
  terms?: string;
}

export const defaultInvoiceSettings: InvoiceSettings = {
  centreName: 'Little Buds Child Care Centre',
  subName: 'Child Care & Early Development Centre',
  address: 'Plot No. 42, Green Avenue, Child Care Enclave, City - 560001',
  contactInfo: 'Phone: +91 98765 43210 | Email: accounts@littlebuds.in',
  accentColor: '#558B2F',
  regNumber: 'Reg. No: LBDC/2023/8842',
  upiId: 'littlebuds@upi',
  bankDetails: 'HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234',
  terms: '1. Fees once paid are non-refundable.\n2. Please clear any outstanding balance before the due date to ensure continuous child care and activity scheduling.\n3. For any fee inquiries, please contact our accounts desk.'
};

/**
 * Convert number to Indian Currency Words (e.g., "Five Thousand Two Hundred Rupees Only")
 */
export function numberToWords(amount: number): string {
  const num = Math.floor(Math.abs(amount));
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'FifFifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  // Correction for Fifteen
  a[15] = 'Fifteen';

  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    return b[Math.floor(n / 10)] + ' ' + (n % 10 !== 0 ? a[n % 10] + ' ' : '');
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  if (crore > 0) words += convertTwoDigits(crore) + 'Crore ';
  if (lakh > 0) words += convertTwoDigits(lakh) + 'Lakh ';
  if (thousand > 0) words += convertTwoDigits(thousand) + 'Thousand ';
  if (hundred > 0) words += a[hundred] + ' Hundred ';
  if (remainder > 0) words += (words !== '' ? 'and ' : '') + convertTwoDigits(remainder);

  return `${words.trim()} Rupees Only`;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [79, 70, 229];
}

/**
 * Generates a clean, professional, non-overlapping PDF invoice document
 */
export async function generateInvoicePdf(
  fee: Fee,
  settings: InvoiceSettings = defaultInvoiceSettings,
  student?: Student
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  const primaryRgb = hexToRgb(settings.accentColor || '#4f46e5');

  // Top header banner background
  const bannerHeight = 38;
  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, bannerHeight, 'F');

  // Subtle accent line under banner
  doc.setFillColor(primaryRgb[0] > 30 ? primaryRgb[0] - 25 : 0, primaryRgb[1] > 30 ? primaryRgb[1] - 25 : 0, primaryRgb[2] > 30 ? primaryRgb[2] - 25 : 0);
  doc.rect(0, bannerHeight, pageWidth, 1.5, 'F');

  // Centre Brand Info (Left-aligned in banner)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  // Prevent overflow if name is long
  const centreNameLines = doc.splitTextToSize(settings.centreName, 115);
  doc.text(centreNameLines, margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let currentY = 12 + centreNameLines.length * 5.2;

  if (settings.subName) {
    doc.text(settings.subName, margin, currentY);
    currentY += 4.2;
  }
  if (settings.address) {
    const addrLines = doc.splitTextToSize(settings.address, 115);
    doc.text(addrLines[0], margin, currentY);
    currentY += 4.2;
  }
  if (settings.contactInfo) {
    doc.text(settings.contactInfo, margin, currentY);
  }

  // Invoice Title & Number (Right-aligned in banner)
  const rightAlignX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TAX INVOICE', rightAlignX, 14, { align: 'right' });

  const invoiceNumber = `INV-${fee.id ? fee.id.slice(0, 8).toUpperCase() : 'REC' + format(new Date(), 'yyyyMMdd')}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Invoice #: ${invoiceNumber}`, rightAlignX, 22, { align: 'right' });

  if (settings.regNumber) {
    doc.setFontSize(8);
    doc.text(settings.regNumber, rightAlignX, 28, { align: 'right' });
  }

  // Section 2: Bill To & Metadata Card (Y = 46)
  let yPos = 46;
  doc.setTextColor(30, 41, 59); // slate-800

  // Left card: BILL TO
  const colWidth = (contentWidth - 6) / 2; // ~88mm
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, yPos, colWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('BILLED TO (STUDENT & GUARDIAN)', margin + 4, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(fee.studentName || 'Student Name', margin + 4, yPos + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const guardianName = student?.guardianName || 'Guardian';
  const guardianContact = student?.guardianContact || 'N/A';
  doc.text(`Guardian: ${guardianName}`, margin + 4, yPos + 19);
  doc.text(`Contact: ${guardianContact}`, margin + 4, yPos + 24);
  if (student?.developmentalFocus || student?.primaryDiagnosis) {
    doc.text(`Focus: ${student.developmentalFocus || student.primaryDiagnosis}`, margin + 4, yPos + 29);
  } else {
    doc.text(`Child ID: ${fee.studentId || 'N/A'}`, margin + 4, yPos + 29);
  }

  // Right card: INVOICE DETAILS
  const rightCardX = margin + colWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightCardX, yPos, colWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INVOICE & PAYMENT DETAILS', rightCardX + 4, yPos + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Issue Date:', rightCardX + 4, yPos + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(format(new Date(), 'dd MMMM yyyy'), rightCardX + 28, yPos + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Due Date:', rightCardX + 4, yPos + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const formattedDueDate = fee.dueDate ? format(new Date(fee.dueDate), 'dd MMMM yyyy') : 'On Receipt';
  doc.text(formattedDueDate, rightCardX + 28, yPos + 19);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Payment Status:', rightCardX + 4, yPos + 25);
  
  // Status pill
  let statusBg: [number, number, number] = [254, 243, 199]; // yellow
  let statusText: [number, number, number] = [146, 64, 14];
  if (fee.status === 'Paid') {
    statusBg = [220, 252, 231];
    statusText = [22, 101, 52];
  } else if (fee.status === 'Overdue') {
    statusBg = [254, 226, 226];
    statusText = [153, 27, 27];
  } else if (fee.status === 'Partially Paid') {
    statusBg = [224, 242, 254];
    statusText = [7, 89, 133];
  }

  doc.setFillColor(...statusBg);
  doc.roundedRect(rightCardX + 28, yPos + 21, 24, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...statusText);
  doc.text(fee.status.toUpperCase(), rightCardX + 40, yPos + 25.2, { align: 'center' });

  // Section 3: Line Items Table
  const tableStartY = yPos + 40;
  const balance = Math.max(0, fee.amount - (fee.amountPaid || 0));

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['#', 'Item / Service Description', 'Billing Cycle / Due', 'Total Fee', 'Amount Paid', 'Balance Due']],
    body: [
      [
        '1',
        `${fee.type} - Early Learning & Child Care Program`,
        formattedDueDate,
        `₹${fee.amount.toFixed(2)}`,
        `₹${(fee.amountPaid || 0).toFixed(2)}`,
        `₹${balance.toFixed(2)}`
      ]
    ],
    theme: 'plain',
    headStyles: {
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      cellPadding: 3.5
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8.5,
      cellPadding: 4,
      lineWidth: 0.1,
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 32 },
      3: { cellWidth: 23, halign: 'right' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Section 4: Amount in Words & Totals Box
  // Left: Amount in Words & Payment Instructions
  const wordsBoxWidth = 105;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, finalY, wordsBoxWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('AMOUNT IN WORDS', margin + 3, finalY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const words = numberToWords(fee.amount);
  const wordsLines = doc.splitTextToSize(words, wordsBoxWidth - 6);
  doc.text(wordsLines, margin + 3, finalY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT DETAILS / MODES', margin + 3, finalY + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  if (settings.upiId) {
    doc.text(`UPI ID: ${settings.upiId}`, margin + 3, finalY + 27);
  }
  if (settings.bankDetails) {
    doc.text(settings.bankDetails, margin + 3, finalY + 32);
  }

  // Right: Summary Box
  const summaryBoxX = margin + wordsBoxWidth + 4;
  const summaryBoxWidth = contentWidth - wordsBoxWidth - 4; // ~73mm

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Invoiced:', summaryBoxX + 4, finalY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`₹${fee.amount.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 4, finalY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Amount Received:', summaryBoxX + 4, finalY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // green
  doc.text(`₹${(fee.amountPaid || 0).toFixed(2)}`, summaryBoxX + summaryBoxWidth - 4, finalY + 14, { align: 'right' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX + 4, finalY + 19, summaryBoxX + summaryBoxWidth - 4, finalY + 19);

  // Balance Due row
  doc.setFillColor(...(balance > 0 ? [254, 242, 242] : [240, 253, 244]) as [number, number, number]);
  doc.roundedRect(summaryBoxX + 2, finalY + 22, summaryBoxWidth - 4, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(balance > 0 ? 185 : 22, balance > 0 ? 28 : 101, balance > 0 ? 28 : 52);
  doc.text('Balance Due:', summaryBoxX + 5, finalY + 30);
  doc.setFontSize(11);
  doc.text(`₹${balance.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 5, finalY + 30, { align: 'right' });

  // Section 5: Terms & Signatory (at bottom of page)
  const bottomY = pageHeight - 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TERMS & CONDITIONS', margin, bottomY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const termsText = settings.terms || defaultInvoiceSettings.terms!;
  const termsLines = doc.splitTextToSize(termsText, 115);
  doc.text(termsLines, margin, bottomY + 4.5);

  // Authorized Signatory Box on Right
  const signX = pageWidth - margin - 50;
  doc.setDrawColor(203, 213, 225);
  doc.line(signX, bottomY + 22, signX + 48, bottomY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Authorized Signatory', signX + 24, bottomY + 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(settings.centreName, signX + 24, bottomY + 31, { align: 'center' });

  // Footer bar
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageHeight - 7, pageWidth, 7, 'F');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a computer-generated invoice and receipt from Little Buds Child Care Centre System.', pageWidth / 2, pageHeight - 2.5, { align: 'center' });

  return doc;
}

/**
 * Generates standalone, zero-dependency, print-perfect HTML document.
 * Can be opened in a new tab or iframe to guarantee 100% reliable printing
 * across all browsers, mobile devices, and sandboxed iframes.
 */
export function generatePrintableHtml(
  fee: Fee,
  settings: InvoiceSettings = defaultInvoiceSettings,
  student?: Student
): string {
  const invoiceNumber = `INV-${fee.id ? fee.id.slice(0, 8).toUpperCase() : 'REC' + format(new Date(), 'yyyyMMdd')}`;
  const balance = Math.max(0, fee.amount - (fee.amountPaid || 0));
  const formattedDueDate = fee.dueDate ? format(new Date(fee.dueDate), 'dd MMMM yyyy') : 'On Receipt';
  const issueDate = format(new Date(), 'dd MMMM yyyy');
  const words = numberToWords(fee.amount);
  const accent = settings.accentColor || '#4f46e5';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${fee.studentName} (${invoiceNumber})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
      line-height: 1.4;
      font-size: 13px;
    }
    .invoice-wrapper {
      max-width: 800px;
      margin: 0 auto;
      padding: 10px;
      background: #ffffff;
    }
    .header-banner {
      background-color: ${accent} !important;
      color: #ffffff;
      padding: 22px 24px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 4px solid #F5A623;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-left-info h1 {
      margin: 0 0 4px 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .header-left-info .sub {
      font-size: 13px;
      opacity: 0.95;
      margin-bottom: 8px;
      font-weight: 500;
      color: #F7FEE7;
    }
    .header-left-info .meta {
      font-size: 11px;
      opacity: 0.85;
      line-height: 1.4;
    }
    .header-right {
      text-align: right;
    }
    .badge-type {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .inv-number {
      font-size: 16px;
      font-weight: 800;
      font-family: monospace;
    }
    .cards-row {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .student-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .meta-label {
      color: #64748b;
    }
    .meta-value {
      font-weight: 600;
      color: #1e293b;
    }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
    }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-partial { background: #e0f2fe; color: #075985; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background: ${accent} !important;
      color: #ffffff;
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-section {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .summary-left {
      flex: 1.3;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
    }
    .summary-right {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
    }
    .words-box {
      font-weight: 700;
      color: #1e1b4b;
      font-style: italic;
      font-size: 12px;
      margin-top: 4px;
      margin-bottom: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .balance-box {
      background: ${balance > 0 ? '#fef2f2' : '#f0fdf4'} !important;
      color: ${balance > 0 ? '#b91c1c' : '#15803d'};
      padding: 8px 10px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      font-weight: 800;
      font-size: 14px;
    }
    .footer-section {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .terms {
      font-size: 10.5px;
      color: #64748b;
      max-width: 60%;
      white-space: pre-line;
    }
    .signature {
      text-align: center;
      width: 180px;
    }
    .sig-line {
      border-bottom: 1px solid #94a3b8;
      height: 35px;
      margin-bottom: 4px;
    }
    .sig-label {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }
    .sig-centre {
      font-size: 10px;
      color: #64748b;
    }
    @media screen {
      .print-bar {
        position: sticky;
        top: 0;
        background: #0f172a;
        color: #ffffff;
        padding: 10px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        border-radius: 6px;
      }
      .print-btn {
        background: ${accent};
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      }
    }
    @media print {
      .print-bar { display: none !important; }
      body { padding: 0 !important; }
      .invoice-wrapper { padding: 0 !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="print-bar">
      <span>Official Invoice: ${invoiceNumber}</span>
      <button class="print-btn" onclick="window.print()">Click to Print / Save PDF</button>
    </div>

    <div class="header-banner">
      <div class="header-left">
        <svg viewBox="0 0 500 500" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; border-radius:12px; padding:4px; flex-shrink:0; box-shadow: 0 2px 6px rgba(0,0,0,0.12);">
          <path d="M 92 372 C 45 272 82 145 180 82 C 275 22 400 55 450 152 C 478 206 476 270 446 324 C 424 362 398 375 404 372 C 438 308 440 234 410 172 C 362 76 242 42 146 98 C 58 148 24 266 68 360 C 76 376 86 385 92 372 Z" fill="#F5A623" />
          <path d="M 65 455 C 135 422 230 405 315 410 C 375 414 415 432 435 455 C 385 432 320 420 250 420 C 180 420 115 432 65 455 Z" fill="#8D5B4C" />
          <g fill="#74B72E">
            <path d="M 120 380 C 105 390 102 412 118 425 C 135 432 170 428 190 420 C 210 415 235 418 240 408 C 242 400 232 392 215 390 C 200 388 185 395 168 396 C 182 385 192 370 192 350 C 190 330 172 320 155 328 C 145 333 138 345 136 358 C 128 362 122 370 120 380 Z" />
            <path d="M 165 335 C 180 328 198 312 215 296 C 220 292 225 285 235 288 C 240 292 238 298 230 305 C 220 315 205 332 192 342 C 185 348 175 352 168 350 Z" />
            <path d="M 152 250 C 130 250 112 268 112 290 C 112 295 106 292 102 288 C 98 284 94 288 96 294 C 98 300 106 304 112 302 C 114 314 124 326 138 332 C 146 335 155 334 162 330 C 172 328 182 322 185 312 C 187 305 182 300 178 298 C 184 296 188 290 186 284 C 183 278 178 276 172 277 C 174 265 168 252 152 250 Z" />
          </g>
          <path d="M 272 410 C 275 375 272 325 285 270 C 295 228 305 205 312 198 C 304 205 290 238 280 275 C 268 325 268 375 264 410 Z" fill="#558B2F" />
          <path d="M 284 256 C 270 230 240 185 185 172 C 190 205 208 245 252 260 C 265 265 278 262 284 256 Z" fill="#689F38" />
          <path d="M 292 298 C 315 285 375 258 418 220 C 395 262 355 305 304 310 C 296 310 290 305 292 298 Z" fill="#42A5F5" />
          <g>
            <path d="M 326 95 C 330 115 342 140 348 160 C 335 152 320 138 316 122 C 314 110 320 100 326 95 Z" fill="#E53935" />
            <path d="M 312 198 C 298 175 280 148 290 120 C 298 100 318 105 326 128 C 322 152 308 178 312 198 Z" fill="#EF4444" />
            <path d="M 312 198 C 322 178 348 152 352 125 C 354 110 340 106 332 120 C 328 145 318 175 312 198 Z" fill="#E53935" />
          </g>
        </svg>
        <div class="header-left-info">
          <h1>${settings.centreName}</h1>
          ${settings.subName ? `<div class="sub">${settings.subName}</div>` : ''}
          <div class="meta">
            ${settings.address}<br>
            ${settings.contactInfo}
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="badge-type">TAX INVOICE / RECEIPT</div>
        <div class="inv-number">${invoiceNumber}</div>
        ${settings.regNumber ? `<div style="font-size:11px; opacity:0.85; margin-top:4px;">${settings.regNumber}</div>` : ''}
      </div>
    </div>

    <div class="cards-row">
      <div class="card">
        <div class="card-title">Billed To (Child & Guardian)</div>
        <div class="student-name">${fee.studentName}</div>
        <div style="font-size:12px; color:#475569;">
          <div><strong>Guardian:</strong> ${student?.guardianName || 'Parent / Guardian'}</div>
          <div><strong>Contact:</strong> ${student?.guardianContact || 'N/A'}</div>
          ${student?.developmentalFocus || student?.primaryDiagnosis ? `<div><strong>Focus:</strong> ${student.developmentalFocus || student.primaryDiagnosis}</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Invoice & Payment Details</div>
        <div class="meta-row">
          <span class="meta-label">Date of Issue:</span>
          <span class="meta-value">${issueDate}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Due Date:</span>
          <span class="meta-value">${formattedDueDate}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Status:</span>
          <span>
            <span class="status-pill ${fee.status === 'Paid' ? 'status-paid' : fee.status === 'Overdue' ? 'status-overdue' : fee.status === 'Partially Paid' ? 'status-partial' : 'status-pending'}">
              ${fee.status.toUpperCase()}
            </span>
          </span>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th>Service Description</th>
          <th>Due Date</th>
          <th class="text-right">Total Rate</th>
          <th class="text-right">Amount Paid</th>
          <th class="text-right">Balance Due</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>01</td>
          <td>
            <strong>${fee.type}</strong><br>
            <span style="color:#64748b; font-size:11px;">Early Learning, Care & Activity Program</span>
          </td>
          <td>${formattedDueDate}</td>
          <td class="text-right">₹${fee.amount.toFixed(2)}</td>
          <td class="text-right" style="color:#166534; font-weight:600;">₹${(fee.amountPaid || 0).toFixed(2)}</td>
          <td class="text-right" style="font-weight:700;">₹${balance.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-left">
        <div class="card-title">Amount in Words</div>
        <div class="words-box">"${words}"</div>

        <div class="card-title" style="margin-top:10px;">Payment Modes & Bank Details</div>
        <div style="font-size:11.5px; color:#475569;">
          ${settings.upiId ? `<div><strong>UPI ID:</strong> <code>${settings.upiId}</code></div>` : ''}
          ${settings.bankDetails ? `<div><strong>Bank Details:</strong> ${settings.bankDetails}</div>` : ''}
        </div>
      </div>

      <div class="summary-right">
        <div class="total-row">
          <span class="meta-label">Gross Amount:</span>
          <span class="meta-value">₹${fee.amount.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="meta-label">Amount Paid:</span>
          <span class="meta-value" style="color:#166534;">₹${(fee.amountPaid || 0).toFixed(2)}</span>
        </div>
        <div class="balance-box">
          <span>Balance Payable:</span>
          <span>₹${balance.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="footer-section">
      <div class="terms">
        <strong style="color:#334155;">Terms & Conditions:</strong><br>
        ${settings.terms || defaultInvoiceSettings.terms}
      </div>
      <div class="signature">
        <div class="sig-line"></div>
        <div class="sig-label">Authorized Signatory</div>
        <div class="sig-centre">${settings.centreName}</div>
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog after styles render
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.log('Auto-print deferred to button click:', e);
        }
      }, 350);
    });
  </script>
</body>
</html>`;
}

/**
 * Robust, cross-browser, iframe-safe invoice printing utility.
 * Creates a dedicated, isolated hidden iframe, populates it with self-contained
 * styled HTML, and triggers the browser print dialog cleanly without popup blockers.
 */
export function printInvoiceDocument(
  fee: Fee,
  settings: InvoiceSettings = defaultInvoiceSettings,
  student?: Student
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = generatePrintableHtml(fee, settings, student);

      // Clean up any stale iframe
      const oldFrame = document.getElementById('invoice-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'invoice-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc || !iframe.contentWindow) {
        throw new Error('Unable to access print frame context');
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      // Give styles and fonts a moment to layout
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe printing caught error, trying fallback:', err);
          window.print();
          resolve(false);
        } finally {
          setTimeout(() => {
            try {
              iframe.remove();
            } catch (e) {
              // ignore
            }
          }, 3000);
        }
      }, 400);
    } catch (error) {
      console.error('printInvoiceDocument failed:', error);
      // Fallback to direct print
      window.print();
      resolve(false);
    }
  });
}

