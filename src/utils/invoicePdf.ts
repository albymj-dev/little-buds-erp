import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Fee, Student, InvoiceItem } from '../types';
import { formatDate, getTodayIso } from './dateUtils';
import { getBusinessSettings, hasConfiguredBankDetails } from '../services/financialSettingsService';

export interface InvoiceSettings {
  centreName: string;
  tagline?: string;
  subName?: string;
  address?: string;
  contactInfo?: string;
  phone?: string;
  email?: string;
  accentColor?: string;
  regNumber?: string;
  upiId?: string;
  bankDetails?: string;
  terms?: string;
}

export const defaultInvoiceSettings: InvoiceSettings = {
  centreName: 'Little Buds Child Care Centre',
  tagline: 'Where Every Child Can Bloom.',
  subName: 'Child Care & Early Development Centre',
  address: '',
  contactInfo: '',
  phone: '',
  email: '',
  accentColor: '#5F8B62',
  regNumber: '',
  upiId: '',
  bankDetails: '',
  terms: '1. Fees once paid are non-refundable.\n2. Please clear any balance on or before the due date.\n3. For any billing queries, please contact our centre accounts desk.'
};

/**
 * Returns stored invoice settings with fallbacks to business settings and defaults.
 */
export function getStoredInvoiceSettings(): InvoiceSettings {
  let result: InvoiceSettings = { ...defaultInvoiceSettings };
  if (typeof window === 'undefined') return result;

  try {
    const raw = localStorage.getItem('invoiceSettings');
    if (raw) {
      const parsed = JSON.parse(raw);
      result = { ...result, ...parsed };
    }
  } catch (e) {}

  try {
    const bizRaw = localStorage.getItem('little_buds_business_financial_settings_v2');
    if (bizRaw) {
      const biz = JSON.parse(bizRaw);
      if (!result.address && biz.address) result.address = biz.address;
      if (!result.contactInfo && (biz.phone || biz.email)) result.contactInfo = [biz.phone, biz.email].filter(Boolean).join(' | ');
      if (!result.phone && biz.phone) result.phone = biz.phone;
    }
  } catch (e) {}

  return result;
}

/**
 * Convert number to Indian Currency Words (e.g., "Five Thousand Two Hundred Rupees Only")
 */
export function numberToWords(amount: number): string {
  const num = Math.floor(Math.abs(amount));
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

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

/**
 * Builds standard line items from Fee data.
 */
export function getInvoiceLineItems(fee: Fee): InvoiceItem[] {
  if (fee.items && fee.items.length > 0) {
    return fee.items;
  }

  // Construct from base fee fields
  let desc = fee.customTypeName || fee.type || 'Tuition & Child Care Fee';
  let qty = fee.units || 1;
  let rate = fee.rate || fee.amount;
  let amount = fee.amount;

  if (fee.billingBasis === 'hourly') {
    desc = fee.customTypeName ? `${fee.customTypeName} (Hourly Daycare)` : 'Hourly Daycare & Care';
    qty = fee.units || 1;
    rate = fee.rate || (amount / (qty || 1));
  } else if (fee.billingBasis === 'per_session') {
    const sessionName = fee.type || fee.customTypeName || 'Special Education';
    desc = sessionName.toLowerCase().includes('session') ? sessionName : `${sessionName} (Session Fee)`;
    qty = fee.units || 1;
    rate = fee.rate || (amount / (qty || 1));
  } else if (fee.billingBasis === 'custom') {
    desc = fee.customTypeName || 'Custom Service & Materials';
  }

  return [{
    description: desc,
    quantity: qty,
    rate: rate,
    amount: amount
  }];
}

/**
 * Formats currency in Indian Rupee format.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount).replace('₹', '₹ ');
}

/**
 * Generates an SVG string of the Little Buds Logo for embedding in HTML or canvas.
 */
export function getLogoSvgString(size = 80): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="${size}" height="${size}" fill="none">
    <path d="M 92 372 C 45 272 82 145 180 82 C 275 22 400 55 450 152 C 478 206 476 270 446 324 C 424 362 398 375 404 372 C 438 308 440 234 410 172 C 362 76 242 42 146 98 C 58 148 24 266 68 360 C 76 376 86 385 92 372 Z" fill="#F5A623"/>
    <path d="M 65 455 C 135 422 230 405 315 410 C 375 414 415 432 435 455 C 385 432 320 420 250 420 C 180 420 115 432 65 455 Z" fill="#8D5B4C"/>
    <g fill="#74B72E">
      <path d="M 120 380 C 105 390 102 412 118 425 C 135 432 170 428 190 420 C 210 415 235 418 240 408 C 242 400 232 392 215 390 C 200 388 185 395 168 396 C 182 385 192 370 192 350 C 190 330 172 320 155 328 C 145 333 138 345 136 358 C 128 362 122 370 120 380 Z"/>
      <path d="M 165 335 C 180 328 198 312 215 296 C 220 292 225 285 235 288 C 240 292 238 298 230 305 C 220 315 205 332 192 342 C 185 348 175 352 168 350 Z"/>
      <path d="M 233 287 C 238 280 244 278 246 282 C 248 286 242 292 236 295 Z"/>
      <path d="M 230 290 C 238 286 243 286 244 290 C 245 294 238 298 231 300 Z"/>
      <path d="M 226 295 C 234 294 240 297 238 301 C 236 305 229 306 224 302 Z"/>
      <circle cx="152" cy="275" r="28"/>
      <path d="M 152 250 C 156 242 164 238 168 242 C 172 246 165 254 158 256 Z"/>
    </g>
    <path d="M 272 410 C 275 375 272 325 285 270 C 295 228 305 205 312 198 C 304 205 290 238 280 275 C 268 325 268 375 264 410 Z" fill="#558B2F"/>
    <g>
      <path d="M 284 256 C 270 230 240 185 185 172 C 190 205 208 245 252 260 C 265 265 278 262 284 256 Z" fill="#689F38"/>
      <path d="M 276 254 C 255 240 230 215 200 184" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g>
      <path d="M 292 298 C 315 285 375 258 418 220 C 395 262 355 305 304 310 C 296 310 290 305 292 298 Z" fill="#42A5F5"/>
      <path d="M 302 304 C 335 292 375 268 406 232" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g>
      <path d="M 326 122 C 322 135 320 152 322 165 C 318 162 312 155 310 148 C 312 136 318 126 326 122 Z" fill="#E53935"/>
      <path d="M 305 130 C 305 145 310 162 322 175 C 312 188 295 192 282 182 C 268 170 270 148 280 135 C 290 122 302 124 305 130 Z" fill="#E53935"/>
      <path d="M 324 175 C 336 162 342 145 342 130 C 345 124 358 122 368 135 C 378 148 380 170 366 182 C 352 192 336 188 324 175 Z" fill="#E53935"/>
      <path d="M 324 175 C 324 185 320 200 312 210 C 318 206 324 200 326 195 C 328 188 326 180 324 175 Z" fill="#558B2F"/>
    </g>
  </svg>`;
}

/**
 * Generates the Little Buds Pastel Invoice PDF (recreates the uploaded template design).
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

  // Fetch business settings if available
  let bizSettings = await getBusinessSettings();

  const invoiceNum = fee.invoiceNumber || (fee.id ? `INV-${fee.id.slice(0, 8).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const issueDateFormatted = formatDate(fee.issueDate || fee.createdAt || new Date());
  const dueDateFormatted = formatDate(fee.dueDate || new Date());
  const status = (fee.status || 'Pending').toUpperCase();

  // Resolved Customer and Child details
  const customerName = fee.guardianName || student?.guardianName || 'Parent / Guardian';
  const customerAddress = fee.address || student?.address || (bizSettings.address ? '' : '');
  const customerPhone = fee.guardianContact || student?.guardianContact || student?.emergencyContact || '';

  const childName = fee.studentName || student?.name || '';
  const childClassAge = fee.classOrAge || (student?.age ? `${student.age} Years` : '') || student?.developmentalFocus || 'Child Care';
  const parentName = fee.parentName || fee.guardianName || student?.guardianName || '';
  const parentPhone = fee.guardianContact || student?.guardianContact || '';

  // 1. TOP BRAND SECTION (Left Side)
  // Draw Decorative Sun Arch & toddler motif outline in vector
  const logoX = margin + 18;
  const logoY = 24;
  
  // Sun circle arc
  doc.setDrawColor(245, 166, 35); // Sun Gold
  doc.setLineWidth(1.2);
  doc.circle(logoX, logoY, 13, 'S');

  // Ground mound
  doc.setFillColor(141, 91, 76); // Earth Brown
  doc.ellipse(logoX, logoY + 12, 10, 2, 'F');

  // Baby toddler silhouette
  doc.setFillColor(116, 183, 46); // Fresh Green
  doc.circle(logoX - 4, logoY + 3, 3, 'F'); // head
  doc.rect(logoX - 7, logoY + 5, 6, 6, 'F'); // body

  // Stem & Leaves
  doc.setDrawColor(85, 139, 47);
  doc.setLineWidth(0.9);
  doc.line(logoX + 2, logoY + 11, logoX + 3, logoY - 3);

  // Left leaf (green)
  doc.setFillColor(104, 159, 56);
  doc.ellipse(logoX - 1, logoY, 3, 1.8, 'F');

  // Right leaf (sky blue)
  doc.setFillColor(66, 165, 245);
  doc.ellipse(logoX + 6, logoY + 1, 3.2, 1.8, 'F');

  // Tulip flower bud (top red)
  doc.setFillColor(229, 57, 53);
  doc.circle(logoX + 3.5, logoY - 4.5, 2.5, 'F');

  // "Little Buds" Title Text with Pastel Lettering
  const brandTextX = margin + 3;
  const brandTextY = logoY + 23;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);

  // "Little" letters with colorful palette
  doc.setTextColor(139, 92, 246); // L (Purple)
  doc.text('L', brandTextX, brandTextY);
  doc.setTextColor(236, 72, 153); // i (Pink)
  doc.text('i', brandTextX + 5, brandTextY);
  doc.setTextColor(245, 158, 11); // t (Amber)
  doc.text('t', brandTextX + 8.5, brandTextY);
  doc.setTextColor(234, 179, 8);  // t (Yellow)
  doc.text('t', brandTextX + 13, brandTextY);
  doc.setTextColor(56, 189, 248);  // l (Sky Blue)
  doc.text('l', brandTextX + 17.5, brandTextY);
  doc.setTextColor(168, 85, 247); // e (Violet)
  doc.text('e', brandTextX + 21, brandTextY);

  // "Buds" in Friendly Green
  doc.setTextColor(101, 163, 13); // Leaf Green
  doc.text(' Buds', brandTextX + 28, brandTextY);

  // "CHILD CARE CENTRE"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(85, 139, 47); // Green #558B2F
  doc.text('CHILD CARE CENTRE', brandTextX + 2, brandTextY + 6);

  // "Where Every Child Can Bloom."
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(141, 91, 76); // Earth Brown
  doc.text('Where Every Child Can Bloom.', brandTextX + 2, brandTextY + 12);

  // Centre Address below logo (entered in invoice settings)
  const storedSettings = getStoredInvoiceSettings();
  const effectiveAddress = settings.address || storedSettings.address || bizSettings.address || '';
  const effectiveContact = settings.contactInfo || settings.phone || storedSettings.contactInfo || bizSettings.phone || '';

  let headerBottomY = brandTextY + 13;
  if (effectiveAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 75, 70);
    const splitAddr = doc.splitTextToSize(effectiveAddress, 68);
    doc.text(splitAddr, margin + 2, brandTextY + 17);
    headerBottomY = brandTextY + 17 + (splitAddr.length * 3.3);

    if (effectiveContact) {
      doc.setFontSize(7);
      doc.setTextColor(95, 100, 95);
      doc.text(`Ph: ${effectiveContact}`, margin + 2, headerBottomY);
      headerBottomY += 3.5;
    }
  }

  // VERTICAL DIVIDER LINE (Center header)
  const dividerX = margin + 74;
  doc.setDrawColor(110, 154, 112); // Sage green divider
  doc.setLineWidth(0.6);
  doc.line(dividerX, margin + 4, dividerX, Math.max(margin + 52, headerBottomY + 2));

  // TOP RIGHT: "INVOICE" Title and Metadata
  const invMetaX = dividerX + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(95, 139, 98); // Sage Green #5F8B62
  doc.text('INVOICE', invMetaX, margin + 11);

  // Metadata labels and underlines
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 105, 90);

  const labelColX = invMetaX;
  const valColX = invMetaX + 34;
  const lineEndX = pageWidth - margin;

  // Invoice No.
  let rowY = margin + 20;
  doc.text('Invoice No.', labelColX, rowY);
  doc.text(':', labelColX + 28, rowY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 50, 40);
  doc.text(invoiceNum, valColX, rowY);
  doc.setDrawColor(220, 230, 222);
  doc.setLineWidth(0.4);
  doc.line(valColX - 2, rowY + 1.5, lineEndX, rowY + 1.5);

  // Date
  rowY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(90, 105, 90);
  doc.text('Date', labelColX, rowY);
  doc.text(':', labelColX + 28, rowY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 50, 40);
  doc.text(issueDateFormatted, valColX, rowY);
  doc.setDrawColor(220, 230, 222);
  doc.line(valColX - 2, rowY + 1.5, lineEndX, rowY + 1.5);

  // Due Date
  rowY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(90, 105, 90);
  doc.text('Due Date', labelColX, rowY);
  doc.text(':', labelColX + 28, rowY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 50, 40);
  doc.text(dueDateFormatted, valColX, rowY);
  doc.setDrawColor(220, 230, 222);
  doc.line(valColX - 2, rowY + 1.5, lineEndX, rowY + 1.5);

  // Payment Status
  rowY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(90, 105, 90);
  doc.text('Payment Status', labelColX, rowY);
  doc.text(':', labelColX + 28, rowY);

  // Status pill
  let pillBg: [number, number, number] = [235, 245, 235]; // Light pastel green
  let pillText: [number, number, number] = [40, 110, 50];
  if (status === 'PENDING') {
    pillBg = [254, 243, 199];
    pillText = [146, 64, 14];
  } else if (status === 'OVERDUE') {
    pillBg = [254, 226, 226];
    pillText = [185, 28, 28];
  } else if (status === 'PARTIALLY PAID') {
    pillBg = [224, 242, 254];
    pillText = [3, 105, 161];
  }

  doc.setFillColor(...pillBg);
  doc.roundedRect(valColX, rowY - 4.5, 38, 6.5, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...pillText);
  doc.text(status, valColX + 19, rowY, { align: 'center' });

  // 2. MIDDLE TWO CARDS (BILL TO & CHILD'S DETAILS)
  const cardsStartY = margin + 57;
  const cardW = (contentWidth - 6) / 2; // ~88mm
  const cardH = 42;

  // LEFT CARD: BILL TO (Pastel Green)
  doc.setFillColor(248, 252, 248); // Very light pastel green bg
  doc.setDrawColor(189, 217, 191); // Pastel green border #BDD9BF
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, cardsStartY, cardW, cardH, 3, 3, 'FD');

  // Header band for BILL TO
  doc.setFillColor(228, 240, 227); // #E4F0E3
  doc.roundedRect(margin, cardsStartY, cardW, 8.5, 3, 3, 'F');
  doc.rect(margin, cardsStartY + 5, cardW, 3.5, 'F'); // square off bottom corners of header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(63, 106, 68); // Dark sage green
  doc.text('BILL TO', margin + 4, cardsStartY + 6);

  // BILL TO Fields
  let bY = cardsStartY + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 100, 80);
  doc.text('Name', margin + 4, bY);
  doc.text(':', margin + 17, bY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 30);
  doc.text(customerName, margin + 21, bY);
  doc.setDrawColor(225, 235, 225);
  doc.line(margin + 20, bY + 1.2, margin + cardW - 4, bY + 1.2);

  bY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 100, 80);
  doc.text('Address', margin + 4, bY);
  doc.text(':', margin + 17, bY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 30);
  const addr1 = customerAddress ? customerAddress.slice(0, 38) : '';
  const addr2 = customerAddress && customerAddress.length > 38 ? customerAddress.slice(38, 76) : '';
  doc.text(addr1, margin + 21, bY);
  doc.setDrawColor(225, 235, 225);
  doc.line(margin + 20, bY + 1.2, margin + cardW - 4, bY + 1.2);

  bY += 7;
  doc.text(addr2, margin + 21, bY);
  doc.line(margin + 20, bY + 1.2, margin + cardW - 4, bY + 1.2);

  bY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 100, 80);
  doc.text('Phone', margin + 4, bY);
  doc.text(':', margin + 17, bY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 30);
  doc.text(customerPhone, margin + 21, bY);
  doc.line(margin + 20, bY + 1.2, margin + cardW - 4, bY + 1.2);

  // RIGHT CARD: CHILD'S DETAILS (Pastel Sky Blue)
  const rightCardX = margin + cardW + 6;
  doc.setFillColor(248, 251, 255); // Very soft sky-blue
  doc.setDrawColor(180, 213, 240); // Pastel sky border #B4D5F0
  doc.setLineWidth(0.5);
  doc.roundedRect(rightCardX, cardsStartY, cardW, cardH, 3, 3, 'FD');

  // Header band for CHILD'S DETAILS
  doc.setFillColor(225, 239, 251); // #E1EFFB
  doc.roundedRect(rightCardX, cardsStartY, cardW, 8.5, 3, 3, 'F');
  doc.rect(rightCardX, cardsStartY + 5, cardW, 3.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(42, 105, 164); // Dark sky blue
  doc.text("CHILD'S DETAILS", rightCardX + 4, cardsStartY + 6);

  // CHILD'S DETAILS Fields
  let cY = cardsStartY + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(70, 95, 120);
  doc.text("Child's Name", rightCardX + 4, cY);
  doc.text(':', rightCardX + 24, cY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 50);
  doc.text(childName, rightCardX + 28, cY);
  doc.setDrawColor(220, 235, 248);
  doc.line(rightCardX + 27, cY + 1.2, rightCardX + cardW - 4, cY + 1.2);

  cY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 95, 120);
  doc.text('Class / Age', rightCardX + 4, cY);
  doc.text(':', rightCardX + 24, cY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 50);
  doc.text(childClassAge, rightCardX + 28, cY);
  doc.line(rightCardX + 27, cY + 1.2, rightCardX + cardW - 4, cY + 1.2);

  cY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 95, 120);
  doc.text("Parent's Name", rightCardX + 4, cY);
  doc.text(':', rightCardX + 24, cY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 50);
  doc.text(parentName, rightCardX + 28, cY);
  doc.line(rightCardX + 27, cY + 1.2, rightCardX + cardW - 4, cY + 1.2);

  cY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 95, 120);
  doc.text('Phone', rightCardX + 4, cY);
  doc.text(':', rightCardX + 24, cY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 40, 50);
  doc.text(parentPhone, rightCardX + 28, cY);
  doc.line(rightCardX + 27, cY + 1.2, rightCardX + cardW - 4, cY + 1.2);

  // 3. TABLE SECTION (Matching the 8-row Sage Green Grid)
  const tableStartY = cardsStartY + cardH + 7;
  const lineItems = getInvoiceLineItems(fee);

  // Prepare body with at least 8 rows to mirror the template design
  const minRows = 8;
  const tableBody: any[] = [];

  for (let i = 0; i < Math.max(lineItems.length, minRows); i++) {
    const item = lineItems[i];
    const rowNum = String(i + 1);

    if (item) {
      tableBody.push([
        rowNum,
        item.description,
        item.quantity ? String(item.quantity) : '1',
        item.rate !== undefined ? `₹${item.rate.toFixed(2)}` : '',
        item.amount !== undefined ? `₹${item.amount.toFixed(2)}` : ''
      ]);
    } else {
      // Empty row to preserve template aesthetic
      tableBody.push([rowNum, '', '', '', '']);
    }
  }

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['SL. NO.', 'DESCRIPTION', 'QUANTITY', 'RATE', 'AMOUNT']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [110, 154, 112], // Sage green #6E9A70
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 3.2,
      lineWidth: 0.3,
      lineColor: [90, 134, 92]
    },
    bodyStyles: {
      textColor: [40, 50, 40],
      fontSize: 8,
      cellPadding: 2.8,
      lineWidth: 0.2,
      lineColor: [162, 201, 166] // #A2C9A6
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 86, halign: 'left' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // 4. BOTTOM SECTION: NOTES ON LEFT, TOTALS SUMMARY ON RIGHT
  const subTotal = fee.subtotal !== undefined ? fee.subtotal : fee.amount;
  const discount = fee.discount || 0;
  const amountPaid = fee.amountPaid || 0;
  const balanceDue = Math.max(0, (subTotal - discount) - amountPaid);

  const bottomColW = (contentWidth - 6) / 2;

  // LEFT: NOTES BOX (Pastel Pink Header & Border)
  const notesBoxH = 26;
  doc.setFillColor(255, 250, 251); // Very soft pink
  doc.setDrawColor(252, 165, 165); // Soft rose #FCA5A5
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, finalY, bottomColW, notesBoxH, 2.5, 2.5, 'FD');

  // Pink NOTES Header banner
  doc.setFillColor(255, 228, 232); // #FFE4E8
  doc.roundedRect(margin, finalY, bottomColW, 7, 2.5, 2.5, 'F');
  doc.rect(margin, finalY + 4, bottomColW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(225, 75, 104); // Rose-red #E14B68
  doc.text('NOTES', margin + 4, finalY + 5);

  // Notes content & Bank instructions (only if user provided real details)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);

  let noteLines: string[] = [];
  if (fee.notes) {
    noteLines.push(fee.notes);
  }
  if (hasConfiguredBankDetails(bizSettings.financial)) {
    const f = bizSettings.financial;
    const bInfo = [
      f.bankName ? `Bank: ${f.bankName}` : '',
      f.accountNumber ? `A/C: ${f.accountNumber}` : '',
      f.ifscCode ? `IFSC: ${f.ifscCode}` : '',
      f.upiId ? `UPI: ${f.upiId}` : ''
    ].filter(Boolean).join(' | ');
    if (bInfo) noteLines.push(bInfo);
  }

  if (noteLines.length === 0) {
    noteLines = ['Thank you for your trust in Little Buds Child Care Centre.'];
  }

  const splitNotes = doc.splitTextToSize(noteLines.join('\n'), bottomColW - 8);
  doc.text(splitNotes, margin + 4, finalY + 11.5);

  // Authorised Signature below Notes
  const sigY = finalY + notesBoxH + 12;
  doc.setDrawColor(110, 154, 112);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + 55, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 100, 80);
  doc.text('Authorised Signature', margin, sigY + 4.5);

  // RIGHT: TOTALS BOX (Sub Total, Discount, Amount Paid, Balance Due)
  const totalsX = margin + bottomColW + 6;
  const totalsW = bottomColW;
  const totalsRowH = 7.5;
  const totalsBoxH = totalsRowH * 4;

  doc.setDrawColor(162, 201, 166); // #A2C9A6
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, finalY, totalsW, totalsBoxH, 2, 2, 'S');

  // Sub Total
  let tY = finalY;
  doc.setDrawColor(210, 230, 212);
  doc.line(totalsX, tY + totalsRowH, totalsX + totalsW, tY + totalsRowH);
  doc.line(totalsX + totalsW * 0.55, tY, totalsX + totalsW * 0.55, tY + totalsBoxH); // vertical column divider

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 60);
  doc.text('Sub Total', totalsX + 4, tY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`₹ ${subTotal.toFixed(2)}`, totalsX + totalsW - 4, tY + 5, { align: 'right' });

  // Discount
  tY += totalsRowH;
  doc.line(totalsX, tY + totalsRowH, totalsX + totalsW, tY + totalsRowH);
  doc.setFont('helvetica', 'bold');
  doc.text('Discount', totalsX + 4, tY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`₹ ${discount.toFixed(2)}`, totalsX + totalsW - 4, tY + 5, { align: 'right' });

  // Amount Paid
  tY += totalsRowH;
  doc.line(totalsX, tY + totalsRowH, totalsX + totalsW, tY + totalsRowH);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount Paid', totalsX + 4, tY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52); // green
  doc.text(`₹ ${amountPaid.toFixed(2)}`, totalsX + totalsW - 4, tY + 5, { align: 'right' });

  // Balance Due (Pink highlight bar)
  tY += totalsRowH;
  doc.setFillColor(254, 226, 226); // Light pink/red highlight #FEE2E2
  doc.roundedRect(totalsX + 0.3, tY + 0.3, totalsW - 0.6, totalsRowH - 0.6, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(185, 28, 28); // Bold red/pink
  doc.text('Balance Due', totalsX + 4, tY + 5);
  doc.text(`₹ ${balanceDue.toFixed(2)}`, totalsX + totalsW - 4, tY + 5, { align: 'right' });

  return doc;
}

/**
 * Generates standalone, print-perfect HTML document recreating the uploaded Little Buds Pastel Template.
 */
export function generatePrintableHtml(
  fee: Fee,
  settings: InvoiceSettings = defaultInvoiceSettings,
  student?: Student
): string {
  const invoiceNum = fee.invoiceNumber || (fee.id ? `INV-${fee.id.slice(0, 8).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
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

  const storedSettings = getStoredInvoiceSettings();
  const effectiveAddress = settings.address || storedSettings.address || '';
  const effectiveContact = settings.contactInfo || settings.phone || storedSettings.contactInfo || '';

  const subTotal = fee.subtotal !== undefined ? fee.subtotal : fee.amount;
  const discount = fee.discount || 0;
  const amountPaid = fee.amountPaid || 0;
  const balanceDue = Math.max(0, (subTotal - discount) - amountPaid);

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
        desc: '&nbsp;',
        qty: '&nbsp;',
        rate: '&nbsp;',
        amount: '&nbsp;'
      });
    }
  }

  // Status badge styling
  let badgeClass = 'status-pending';
  if (status === 'PAID') badgeClass = 'status-paid';
  if (status === 'OVERDUE') badgeClass = 'status-overdue';
  if (status === 'PARTIALLY PAID') badgeClass = 'status-partial';

  const logoSvg = getLogoSvgString(70);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${childName} (${invoiceNum})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #2D3748;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .invoice-wrapper {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
      background: #FFFFFF;
    }
    /* Header */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
    }
    .header-left {
      width: 52%;
      vertical-align: top;
      padding-right: 16px;
    }
    .header-divider {
      width: 2px;
      background: #6E9A70;
      padding: 0;
    }
    .header-right {
      width: 46%;
      vertical-align: top;
      padding-left: 20px;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.1;
      margin: 0;
    }
    .letter-l { color: #8B5CF6; }
    .letter-i { color: #EC4899; }
    .letter-t1 { color: #F59E0B; }
    .letter-t2 { color: #EAB308; }
    .letter-l2 { color: #38BDF8; }
    .letter-e { color: #A855F7; }
    .word-buds { color: #65A30D; margin-left: 4px; }
    .brand-sub {
      font-size: 11px;
      font-weight: 700;
      color: #558B2F;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin: 3px 0 0 0;
    }
    .brand-tagline {
      font-family: "Georgia", serif;
      font-style: italic;
      font-size: 11px;
      color: #8D5B4C;
      margin: 3px 0 0 0;
    }

    .invoice-title {
      font-size: 32px;
      font-weight: 800;
      color: #5F8B62;
      letter-spacing: 1px;
      margin: 0 0 10px 0;
    }
    .meta-row {
      display: flex;
      align-items: baseline;
      margin-bottom: 7px;
      font-size: 11.5px;
    }
    .meta-label {
      width: 100px;
      font-weight: 700;
      color: #556B55;
    }
    .meta-colon {
      margin-right: 8px;
      font-weight: 700;
      color: #556B55;
    }
    .meta-value {
      flex: 1;
      border-bottom: 1px solid #D6E4D8;
      padding-bottom: 2px;
      color: #2D3748;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 14px;
      border-radius: 9999px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .status-paid { background: #E4F0E3; color: #2D6A35; border: 1px solid #BDD9BF; }
    .status-pending { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
    .status-overdue { background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; }
    .status-partial { background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD; }

    /* Middle Cards */
    .cards-row {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .card-bill-to {
      flex: 1;
      border: 1px solid #BDD9BF;
      border-radius: 8px;
      overflow: hidden;
      background: #FBFDFB;
    }
    .card-child-details {
      flex: 1;
      border: 1px solid #B4D5F0;
      border-radius: 8px;
      overflow: hidden;
      background: #FBFCFE;
    }
    .card-header-green {
      background: #E4F0E3;
      color: #3F6A44;
      font-weight: 700;
      font-size: 11px;
      padding: 6px 12px;
      letter-spacing: 0.5px;
    }
    .card-header-blue {
      background: #E1EFFB;
      color: #2A69A4;
      font-weight: 700;
      font-size: 11px;
      padding: 6px 12px;
      letter-spacing: 0.5px;
    }
    .card-body {
      padding: 10px 12px;
    }
    .card-field {
      display: flex;
      align-items: baseline;
      margin-bottom: 6px;
      font-size: 11px;
    }
    .card-field:last-child {
      margin-bottom: 0;
    }
    .field-label {
      width: 82px;
      font-weight: 700;
      color: #4A5568;
    }
    .field-colon {
      margin-right: 6px;
      color: #718096;
    }
    .field-val {
      flex: 1;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 2px;
      color: #1A202C;
      min-height: 16px;
    }

    /* Main Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border: 1px solid #A2C9A6;
    }
    .items-table th {
      background: #6E9A70;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 10.5px;
      letter-spacing: 0.5px;
      padding: 7px 10px;
      border: 1px solid #5C885E;
      text-align: center;
    }
    .items-table td {
      border: 1px solid #A2C9A6;
      padding: 6px 10px;
      font-size: 11px;
      color: #2D3748;
    }
    .items-table tr:nth-child(even) td {
      background: #F9FCF9;
    }
    .col-sl { width: 10%; text-align: center; font-weight: 600; }
    .col-desc { width: 48%; text-align: left; }
    .col-qty { width: 14%; text-align: center; }
    .col-rate { width: 14%; text-align: right; }
    .col-amount { width: 14%; text-align: right; }

    /* Bottom Section */
    .bottom-row {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .bottom-left {
      flex: 1;
    }
    .notes-box {
      border: 1px solid #FCA5A5;
      border-radius: 8px;
      overflow: hidden;
      background: #FFFDFD;
      margin-bottom: 28px;
    }
    .notes-header {
      background: #FFE4E8;
      color: #E14B68;
      font-weight: 700;
      font-size: 11px;
      padding: 6px 12px;
      letter-spacing: 0.5px;
    }
    .notes-body {
      padding: 8px 12px;
      font-size: 10.5px;
      color: #4A5568;
      min-height: 48px;
    }
    .signature-area {
      padding-top: 28px;
    }
    .sig-line {
      width: 180px;
      border-bottom: 1px solid #6E9A70;
      margin-bottom: 4px;
    }
    .sig-label {
      font-size: 10.5px;
      font-weight: 600;
      color: #556B55;
    }

    /* Totals Box */
    .totals-box {
      flex: 1;
      border: 1px solid #A2C9A6;
      border-radius: 8px;
      overflow: hidden;
      background: #FFFFFF;
    }
    .totals-row {
      display: flex;
      border-bottom: 1px solid #E2E8F0;
      font-size: 11.5px;
    }
    .totals-row:last-child {
      border-bottom: none;
    }
    .totals-label {
      flex: 1;
      padding: 7px 12px;
      font-weight: 600;
      color: #4A5568;
      border-right: 1px solid #E2E8F0;
    }
    .totals-val {
      width: 110px;
      padding: 7px 12px;
      text-align: right;
      color: #1A202C;
      font-weight: 500;
    }
    .totals-row.balance {
      background: #FEE2E2;
      color: #B91C1C;
      font-weight: 700;
    }
    .totals-row.balance .totals-label,
    .totals-row.balance .totals-val {
      color: #B91C1C;
      font-weight: 700;
    }

    /* Print control banner (hidden during actual print) */
    .print-controls {
      position: sticky;
      top: 0;
      z-index: 999;
      background: #1C2430;
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-bottom: 2px solid #5F8B62;
    }
    .print-btn {
      background: #5F8B62;
      color: #FFFFFF;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .print-btn:hover {
      background: #4A704D;
    }
    .close-btn {
      background: rgba(255, 255, 255, 0.15);
      color: #FFFFFF;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      margin-left: 8px;
      transition: background 0.15s;
    }
    .close-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    @media print {
      .print-controls, .no-print {
        display: none !important;
      }
      body {
        padding: 0 !important;
        margin: 0 !important;
      }
      .invoice-wrapper {
        padding: 0 !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <!-- Print Controls Sticky Header (Visible in new tab, hidden in print) -->
  <div class="print-controls no-print">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 14px; font-weight: 800; letter-spacing: 0.3px; color: #FFFFFF;">Little Buds Invoice</span>
      <span style="font-family: monospace; background: rgba(255, 255, 255, 0.15); padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #E2E8F0;">
        ${invoiceNum}
      </span>
      <span style="font-size: 13px; color: #94A3B8;">• ${childName}</span>
    </div>
    <div>
      <button class="print-btn" onclick="window.print()">
        🖨️ Print Invoice
      </button>
      <button class="close-btn" onclick="window.close()">
        ✕ Close
      </button>
    </div>
  </div>

  <div class="invoice-wrapper">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="logo-container">
            <div>${logoSvg}</div>
            <div>
              <h1 class="brand-title">
                <span class="letter-l">L</span><span class="letter-i">i</span><span class="letter-t1">t</span><span class="letter-t2">t</span><span class="letter-l2">l</span><span class="letter-e">e</span><span class="word-buds">Buds</span>
              </h1>
              <p class="brand-sub">CHILD CARE CENTRE</p>
              <p class="brand-tagline">Where Every Child Can Bloom.</p>
            </div>
          </div>
          ${effectiveAddress ? `
            <div style="margin-top: 8px; font-size: 11px; color: #4B5563; line-height: 1.35; padding-left: 2px;">
              <div style="font-weight: 500;">${effectiveAddress}</div>
              ${effectiveContact ? `<div style="font-size: 10px; color: #6B7280; margin-top: 2px;">Ph: ${effectiveContact}</div>` : ''}
            </div>
          ` : ''}
        </td>
        <td class="header-divider"></td>
        <td class="header-right">
          <div class="invoice-title">INVOICE</div>
          <div class="meta-row">
            <span class="meta-label">Invoice No.</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${invoiceNum}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Date</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${issueDateFormatted}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Due Date</span>
            <span class="meta-colon">:</span>
            <span class="meta-value">${dueDateFormatted}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Payment Status</span>
            <span class="meta-colon">:</span>
            <div style="flex: 1;">
              <span class="status-badge ${badgeClass}">${status}</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Middle Two Cards -->
    <div class="cards-row">
      <div class="card-bill-to">
        <div class="card-header-green">BILL TO</div>
        <div class="card-body">
          <div class="card-field">
            <span class="field-label">Name</span>
            <span class="field-colon">:</span>
            <span class="field-val">${customerName}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Address</span>
            <span class="field-colon">:</span>
            <span class="field-val">${customerAddress ? customerAddress.slice(0, 40) : '&nbsp;'}</span>
          </div>
          <div class="card-field">
            <span class="field-label">&nbsp;</span>
            <span class="field-colon">&nbsp;</span>
            <span class="field-val">${customerAddress && customerAddress.length > 40 ? customerAddress.slice(40, 80) : '&nbsp;'}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Phone</span>
            <span class="field-colon">:</span>
            <span class="field-val">${customerPhone || '&nbsp;'}</span>
          </div>
        </div>
      </div>

      <div class="card-child-details">
        <div class="card-header-blue">CHILD'S DETAILS</div>
        <div class="card-body">
          <div class="card-field">
            <span class="field-label">Child's Name</span>
            <span class="field-colon">:</span>
            <span class="field-val">${childName}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Class / Age</span>
            <span class="field-colon">:</span>
            <span class="field-val">${childClassAge}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Parent's Name</span>
            <span class="field-colon">:</span>
            <span class="field-val">${parentName}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Phone</span>
            <span class="field-colon">:</span>
            <span class="field-val">${parentPhone || '&nbsp;'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-sl">SL. NO.</th>
          <th class="col-desc">DESCRIPTION</th>
          <th class="col-qty">QUANTITY</th>
          <th class="col-rate">RATE</th>
          <th class="col-amount">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td class="col-sl">${r.sl}</td>
            <td class="col-desc">${r.desc}</td>
            <td class="col-qty">${r.qty}</td>
            <td class="col-rate">${r.rate}</td>
            <td class="col-amount">${r.amount}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Bottom Section -->
    <div class="bottom-row">
      <div class="bottom-left">
        <div class="notes-box">
          <div class="notes-header">NOTES</div>
          <div class="notes-body">
            ${fee.notes ? `<div>${fee.notes}</div>` : '<div>Thank you for choosing Little Buds Child Care Centre.</div>'}
          </div>
        </div>
        <div class="signature-area">
          <div class="sig-line"></div>
          <div class="sig-label">Authorised Signature</div>
        </div>
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <div class="totals-label">Sub Total</div>
          <div class="totals-val">₹ ${subTotal.toFixed(2)}</div>
        </div>
        <div class="totals-row">
          <div class="totals-label">Discount</div>
          <div class="totals-val">₹ ${discount.toFixed(2)}</div>
        </div>
        <div class="totals-row">
          <div class="totals-label">Amount Paid</div>
          <div class="totals-val" style="color: #166534;">₹ ${amountPaid.toFixed(2)}</div>
        </div>
        <div class="totals-row balance">
          <div class="totals-label">Balance Due</div>
          <div class="totals-val">₹ ${balanceDue.toFixed(2)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Auto-trigger print dialogue box on window load -->
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.log('Auto print trigger:', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Opens a dedicated standalone browser tab/window with the complete pastel invoice
 * and automatically opens the native browser print dialogue box.
 */
export function openInvoicePrintWindow(
  fee: Fee,
  settings: InvoiceSettings = defaultInvoiceSettings,
  student?: Student
): Window | null {
  try {
    const html = generatePrintableHtml(fee, settings, student);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    // Open standalone print tab
    const printWin = window.open(blobUrl, '_blank');
    if (printWin) {
      try {
        printWin.focus();
      } catch (e) {}
      return printWin;
    }

    // If popups are blocked by browser, fallback to hidden iframe print
    console.warn('Popup blocked, attempting hidden iframe print fallback');
    printInvoiceDocument(fee, settings, student);
    return null;
  } catch (err) {
    console.error('openInvoicePrintWindow failed:', err);
    printInvoiceDocument(fee, settings, student);
    return null;
  }
}

/**
 * Standardizes a phone number into international format for WhatsApp links.
 * E.g. "9876543210" -> "919876543210", "+91 98765 43210" -> "919876543210"
 */
export function normalizeWhatsAppNumber(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

/**
 * Builds standard professional WhatsApp message text for an invoice.
 */
export function formatWhatsAppInvoiceMessage(fee: Fee, student?: Student, appOrigin?: string): string {
  const invoiceNum = fee.invoiceNumber || (fee.id ? `INV-${fee.id.slice(0, 8).toUpperCase()}` : 'INV-REC');
  const issueDateFormatted = formatDate(fee.issueDate || fee.createdAt || new Date());
  const dueDateFormatted = formatDate(fee.dueDate || new Date());
  const childName = fee.studentName || student?.name || 'Child';
  const subTotal = fee.subtotal !== undefined ? fee.subtotal : fee.amount;
  const discount = fee.discount || 0;
  const amountPaid = fee.amountPaid || 0;
  const balanceDue = Math.max(0, (subTotal - discount) - amountPaid);
  const status = (fee.status || 'Pending').toUpperCase();

  const origin = appOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  const onlineViewUrl = fee.id && origin ? `${origin}/invoice/${fee.id}` : '';

  return `Dear Parent / Guardian,

Please find the fee invoice for *${childName}* from *Little Buds Child Care Centre*.

*Invoice Details:*
• *Invoice No:* ${invoiceNum}
• *Date:* ${issueDateFormatted}
• *Due Date:* ${dueDateFormatted}
• *Total Fee:* ₹${(subTotal - discount).toFixed(2)}
• *Amount Paid:* ₹${amountPaid.toFixed(2)}
• *Balance Due:* ₹${balanceDue.toFixed(2)}
• *Payment Status:* ${status}

📄 *Attached PDF Invoice & Instant View:*
${onlineViewUrl ? `• Direct Invoice View & PDF:\n${onlineViewUrl}\n` : ''}
(The official PDF invoice document has been generated and downloaded.)

For any fee inquiries or payment support, please feel free to message or contact our accounts desk.

Warm regards,
*Little Buds Child Care Centre*
_Where Every Child Can Bloom._`;
}

/**
 * 100% reliable print execution for Little Buds invoices.
 * Checks for existing in-page invoice canvas or creates a designated print container.
 */
export async function printInvoiceDocument(
  fee: Fee,
  settings: InvoiceSettings = defaultInvoiceSettings,
  student?: Student
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = generatePrintableHtml(fee, settings, student);

      const oldFrame = document.getElementById('invoice-print-frame');
      if (oldFrame) oldFrame.remove();

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
        throw new Error('Could not access print frame context');
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe print error fallback:', err);
          window.print();
          resolve(false);
        } finally {
          setTimeout(() => {
            try { iframe.remove(); } catch {}
          }, 3000);
        }
      }, 400);
    } catch (e) {
      console.warn('In-page print failed, fallback:', e);
      window.print();
      resolve(false);
    }
  });
}

