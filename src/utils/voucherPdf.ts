import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinanceTransaction } from '../types';
import { format, parseISO } from 'date-fns';
import { numberToWords } from './invoicePdf';

export interface VoucherSettings {
  centreName: string;
  subName: string;
  address: string;
  contactInfo: string;
  accentColor: string;
  regNumber?: string;
  panNumber?: string;
  bankDetails?: string;
}

export const defaultVoucherSettings: VoucherSettings = {
  centreName: 'Little Buds Child Care Centre',
  subName: 'Child Care & Early Childhood Development Centre',
  address: 'Plot No. 42, Green Avenue, Early Childhood Campus, City - 560001',
  contactInfo: 'Phone: +91 98765 43210 | Email: accounts@littlebuds.in',
  accentColor: '#4f46e5',
  regNumber: 'Reg. No: LBDC/2023/8842',
  panNumber: 'PAN: AABCL8842K',
  bankDetails: 'HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234'
};

const VOUCHER_SETTINGS_KEY = 'littlebuds_voucher_settings_v2';

export function getStoredVoucherSettings(): VoucherSettings {
  try {
    const raw = localStorage.getItem(VOUCHER_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultVoucherSettings, ...parsed };
    }
  } catch {
    // fallback to defaults
  }
  return defaultVoucherSettings;
}

export function saveStoredVoucherSettings(settings: Partial<VoucherSettings>): void {
  try {
    const current = getStoredVoucherSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(VOUCHER_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save voucher settings', e);
  }
}

export interface EditableVoucherDetails {
  centreName?: string;
  subName?: string;
  address?: string;
  contactInfo?: string;
  regNumber?: string;
  panNumber?: string;
  voucherNumber?: string;
  voucherDate?: string;
  payeeName?: string;
  paymentMode?: string;
  referenceNumber?: string;
  accountCode?: string;
  accountHead?: string;
  amount?: number;
  amountInWords?: string;
  narration?: string;
  disbursedFrom?: string;
  preparedBy?: string;
  preparedByTitle?: string;
  checkedBy?: string;
  checkedByTitle?: string;
  authorizedBy?: string;
  authorizedByTitle?: string;
  receivedBy?: string;
  receivedByTitle?: string;
  notesOrRemarks?: string;
}

/**
 * Maps transaction to appropriate Chart of Accounts code and name
 */
export function getAccountHeadInfo(tx: FinanceTransaction): { code: string; name: string } {
  if (tx.depositDetails || tx.purchaseType === 'Deposit' || tx.type === 'Deposit') {
    return { code: '#1300', name: tx.depositDetails?.depositCategory || tx.category || 'Security Deposits (Current Asset)' };
  }
  if (tx.assetDetails || tx.purchaseType === 'Asset' || tx.type === 'Asset') {
    return { code: '#1500', name: tx.assetDetails?.category || tx.category || 'Capital Assets & Educational Equipment (Fixed Asset)' };
  }
  
  const cat = (tx.category || '').toLowerCase();
  if (cat.includes('rent') || cat.includes('lease')) {
    return { code: '#5000', name: 'Premises Rent & Facility Lease' };
  }
  if (cat.includes('electric') || cat.includes('utilit') || cat.includes('water') || cat.includes('power')) {
    return { code: '#5100', name: 'Utilities, Electricity & Power' };
  }
  if (cat.includes('salar') || cat.includes('staff') || cat.includes('educator') || cat.includes('caregiver') || cat.includes('therapist') || cat.includes('wage')) {
    return { code: '#5200', name: 'Staff, Educator & Caregiver Salaries' };
  }
  if (cat.includes('material') || cat.includes('suppl') || cat.includes('consumable') || cat.includes('toy')) {
    return { code: '#5300', name: 'Learning, Play & Activity Materials' };
  }
  if (cat.includes('repair') || cat.includes('maint')) {
    return { code: '#5400', name: 'Facility Repairs & Equipment Maintenance' };
  }
  if (cat.includes('food') || cat.includes('snack') || cat.includes('kitchen') || cat.includes('cater')) {
    return { code: '#5500', name: 'Student Nutrition, Food & Pantry' };
  }
  if (cat.includes('advertis') || cat.includes('market') || cat.includes('print')) {
    return { code: '#5600', name: 'Marketing, Printing & Outreach' };
  }
  if (cat.includes('admin') || cat.includes('office') || cat.includes('software')) {
    return { code: '#5700', name: 'Administrative & Office Overheads' };
  }

  return { code: '#5900', name: tx.category || 'General Operating Expense' };
}

/**
 * Returns formatted Payee Name
 */
export function getPayeeName(tx: FinanceTransaction): string {
  if (tx.depositDetails?.payeeName) {
    return tx.depositDetails.payeeName;
  }
  if (tx.partnerName) {
    return tx.partnerName;
  }
  if (tx.assetDetails?.notes && tx.assetDetails.notes.toLowerCase().includes('from')) {
    const match = tx.assetDetails.notes.match(/from\s+([^,.-]+)/i);
    if (match) return match[1].trim();
  }
  // Try extracting payee from description (e.g. "Paid to Landlord" or "Advance to vendor")
  const desc = tx.description || '';
  const toMatch = desc.match(/(?:paid to|to:?|favour of)\s+([A-Za-z0-9\s&]+?)(?:\s*(?:for|via|ref|\(|$))/i);
  if (toMatch && toMatch[1].trim().length > 2) {
    return toMatch[1].trim();
  }
  
  if (tx.assetDetails?.assetName) {
    return `Vendor - ${tx.assetDetails.assetName}`;
  }

  return tx.category || 'Authorized Payee / Beneficiary';
}

/**
 * Generates an official Voucher Number based on date and id
 */
export function getVoucherNumber(tx: FinanceTransaction): string {
  let datePart = '202609';
  try {
    datePart = format(parseISO(tx.date), 'yyyyMM');
  } catch {
    datePart = format(new Date(), 'yyyyMM');
  }
  const idPart = (tx.id || '00001').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase().padStart(5, '0');
  return `PV-${datePart}-${idPart}`;
}

/**
 * Generates clean, print-optimized HTML for an Official Payment Voucher
 */
export function generatePrintableVoucherHtml(
  tx: FinanceTransaction,
  settings: VoucherSettings = defaultVoucherSettings,
  customDetails?: EditableVoucherDetails
): string {
  const effectiveSettings: VoucherSettings = {
    ...settings,
    centreName: customDetails?.centreName || settings.centreName,
    subName: customDetails?.subName || settings.subName,
    address: customDetails?.address || settings.address,
    contactInfo: customDetails?.contactInfo || settings.contactInfo,
    regNumber: customDetails?.regNumber || settings.regNumber,
    panNumber: customDetails?.panNumber || settings.panNumber
  };

  const voucherNo = customDetails?.voucherNumber || getVoucherNumber(tx);
  let voucherDate = customDetails?.voucherDate || tx.date;
  try {
    if (voucherDate && voucherDate.includes('-') && voucherDate.length === 10) {
      voucherDate = format(parseISO(voucherDate), 'dd MMMM yyyy');
    }
  } catch {
    // preserve voucherDate as is
  }

  const defaultAccount = getAccountHeadInfo(tx);
  const accountInfo = {
    code: customDetails?.accountCode || defaultAccount.code,
    name: customDetails?.accountHead || defaultAccount.name
  };
  const payee = customDetails?.payeeName || getPayeeName(tx);
  const paymentMode = customDetails?.paymentMode || tx.paymentMode || 'Bank Transfer';
  const amount = customDetails?.amount !== undefined ? customDetails.amount : tx.amount;
  const amountWords = customDetails?.amountInWords || numberToWords(amount);
  const accent = effectiveSettings.accentColor || '#4f46e5';

  const defaultRef =
    tx.depositDetails?.referenceNumber ||
    tx.assetDetails?.serialNumber ||
    (tx.description?.match(/(?:ref|cheque|utr|chq|txn|inv)[\s#:]*([A-Za-z0-9-]+)/i)?.[1]) ||
    'N/A';
  const refNumber = customDetails?.referenceNumber !== undefined ? customDetails.referenceNumber : defaultRef;
  const narration = customDetails?.narration || tx.description || tx.category || 'Disbursement for operational obligations';

  const preparedBy = customDetails?.preparedBy || 'Accounts Assistant';
  const preparedByTitle = customDetails?.preparedByTitle || 'Prepared By';
  const checkedBy = customDetails?.checkedBy || 'Internal Auditor';
  const checkedByTitle = customDetails?.checkedByTitle || 'Checked & Verified';
  const authorizedBy = customDetails?.authorizedBy || 'Managing Director';
  const authorizedByTitle = customDetails?.authorizedByTitle || 'Authorized Signatory';
  const receivedBy = customDetails?.receivedBy || payee || 'Payee / Beneficiary';
  const receivedByTitle = customDetails?.receivedByTitle || "Receiver's Signature";
  const notesOrRemarks = customDetails?.notesOrRemarks || 'This payment has been verified against bills, supporting invoices, or contractual agreements, and debited to the respective account head in Little Buds Child Care Centre accounts.';
  const disbursedFrom = customDetails?.disbursedFrom || (paymentMode.toLowerCase().includes('cash') ? 'Petty Cash In-Hand Drawer' : 'Primary Centre Bank Account');

  const isDeposit = tx.purchaseType === 'Deposit' || tx.type === 'Deposit';
  const isAsset = tx.purchaseType === 'Asset' || tx.type === 'Asset';

  let voucherTypeLabel = 'OPERATING PAYMENT VOUCHER';
  if (isDeposit) voucherTypeLabel = 'SECURITY DEPOSIT PAYMENT VOUCHER';
  else if (isAsset) voucherTypeLabel = 'CAPITAL ASSET PAYMENT VOUCHER';
  else if (paymentMode.toLowerCase().includes('cash')) voucherTypeLabel = 'CASH PAYMENT VOUCHER';
  else if (paymentMode.toLowerCase().includes('bank')) voucherTypeLabel = 'BANK PAYMENT VOUCHER';
  else if (paymentMode.toLowerCase().includes('cheque')) voucherTypeLabel = 'CHEQUE PAYMENT VOUCHER';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Voucher - ${voucherNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      padding: 24px 16px;
      font-size: 13px;
      line-height: 1.45;
    }
    .voucher-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      border: 2px solid #cbd5e1;
      padding: 28px 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    /* Official double border effect */
    .inner-border {
      border: 1px solid #94a3b8;
      padding: 24px;
      border-radius: 4px;
    }
    .voucher-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 14px;
    }
    .org-details {
      max-width: 64%;
    }
    .org-details h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .org-details .sub {
      font-size: 12px;
      font-weight: 700;
      color: ${accent};
      margin-top: 2px;
    }
    .org-details .address {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.4;
    }
    .voucher-badge-box {
      text-align: right;
    }
    .voucher-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      border-radius: 4px;
      display: inline-block;
    }
    .voucher-sub-type {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .meta-row.meta-full-row {
      grid-column: 1 / -1;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 4px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .payee-card {
      border: 1px solid #e2e8f0;
      border-left: 4px solid ${accent};
      background: #fafafa;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 4px;
    }
    .payee-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .payee-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .payee-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .voucher-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .voucher-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #0f172a;
    }
    .voucher-table td {
      padding: 10px 10px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
      vertical-align: top;
    }
    .voucher-table tr.total-row td {
      background: #f1f5f9;
      font-weight: 800;
      border-top: 2px solid #0f172a;
    }
    .amount-words-box {
      background: #f8fafc;
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
      font-size: 12px;
    }
    .amount-words-label {
      font-weight: 800;
      color: #475569;
      white-space: nowrap;
    }
    .amount-words-val {
      font-weight: 700;
      color: #0f172a;
      font-style: italic;
    }
    .notes-box {
      font-size: 11px;
      color: #475569;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-top: 28px;
      padding-top: 14px;
    }
    .sig-block {
      text-align: center;
    }
    .sig-line {
      border-bottom: 1px solid #0f172a;
      height: 38px;
      margin-bottom: 6px;
    }
    .sig-label {
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 1px;
    }
    .stamp-badge {
      display: inline-block;
      margin-top: 6px;
      border: 1px dashed #94a3b8;
      color: #475569;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      border-radius: 3px;
      background: #f8fafc;
    }
    .print-controls {
      max-width: 820px;
      margin: 0 auto 14px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 6px;
    }
    .print-btn {
      background: ${accent};
      color: #ffffff;
      border: none;
      padding: 7px 16px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    @media print {
      .print-controls { display: none !important; }
      body { padding: 0 !important; background: #ffffff !important; }
      .voucher-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      .inner-border {
        border: 1.5px solid #0f172a !important;
        padding: 18px !important;
      }
      .stamp-badge {
        border-color: #64748b !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-controls">
    <div style="font-weight: 700; font-size: 13px;">Payment Voucher: ${voucherNo}</div>
    <button class="print-btn" onclick="window.print()">
      🖨️ Print Payment Voucher
    </button>
  </div>

  <div class="voucher-container">
    <div class="inner-border">
      <!-- HEADER -->
      <div class="voucher-header">
        <div class="org-details">
          <h1>${effectiveSettings.centreName}</h1>
          <div class="sub">${effectiveSettings.subName}</div>
          <div class="address">
            ${effectiveSettings.address}<br>
            ${effectiveSettings.contactInfo} | ${effectiveSettings.regNumber || ''} ${effectiveSettings.panNumber ? `| ${effectiveSettings.panNumber}` : ''}
          </div>
        </div>
        <div class="voucher-badge-box">
          <div class="voucher-badge">PAYMENT VOUCHER</div>
          <div class="voucher-sub-type">${voucherTypeLabel}</div>
          <div>
            <div class="stamp-badge">VERIFIED & PASSED FOR PAYMENT</div>
          </div>
        </div>
      </div>

      <!-- VOUCHER METADATA -->
      <div class="meta-grid">
        <div class="meta-row">
          <span class="meta-label">Voucher Number:</span>
          <span class="meta-val" style="font-family:monospace; color:${accent};">${voucherNo}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Disbursement Source:</span>
          <span class="meta-val">${disbursedFrom}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Date of Payment:</span>
          <span class="meta-val">${voucherDate}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Accounting Type:</span>
          <span class="meta-val">${isDeposit ? 'Current Asset (1300)' : (isAsset ? 'Fixed Asset (1500)' : 'Operating Expense')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Payment Mode:</span>
          <span class="meta-val">${paymentMode}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Ref / Cheque / UTR:</span>
          <span class="meta-val" style="font-family:monospace;">${refNumber}</span>
        </div>
        <div class="meta-row meta-full-row">
          <span class="meta-label">Debit Account Head:</span>
          <span class="meta-val"><strong style="color:#0f172a; font-family:monospace;">#${accountInfo.code}</strong> - ${accountInfo.name}</span>
        </div>
      </div>

      <!-- PAYEE DETAILS -->
      <div class="payee-card">
        <div class="payee-title">Paid To / In Favour Of:</div>
        <div class="payee-name">${payee}</div>
        ${tx.depositDetails?.premisesOrAccount ? `<div class="payee-sub"><strong>Premises / Account / Meter:</strong> ${tx.depositDetails.premisesOrAccount}</div>` : ''}
        ${tx.assetDetails?.locationOrRoom ? `<div class="payee-sub"><strong>Facility Location:</strong> ${tx.assetDetails.locationOrRoom}</div>` : ''}
      </div>

      <!-- PARTICULAR ITEMS TABLE -->
      <table class="voucher-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="text-align: left;">Particulars & Account Narration</th>
            <th style="width: 140px; text-align: left;">Head of Account</th>
            <th style="width: 120px; text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; font-weight: 700;">1</td>
            <td>
              <strong>${narration}</strong>
              ${isDeposit ? `<div style="font-size:11px; color:#0f766e; margin-top:3px;">• Refundable Security Deposit recorded under Current Assets (#1300)</div>` : ''}
              ${isAsset ? `<div style="font-size:11px; color:#4338ca; margin-top:3px;">• Capital Asset capitalized on Balance Sheet (#1500)</div>` : ''}
              ${tx.depositDetails?.termsOrDuration ? `<div style="font-size:11px; color:#475569; margin-top:2px;">• Lease Tenure / Duration: ${tx.depositDetails.termsOrDuration}</div>` : ''}
            </td>
            <td style="font-size:11px; color:#475569;">
              <span style="font-weight:700; color:#0f172a;">${accountInfo.code}</span><br>
              ${accountInfo.name}
            </td>
            <td style="text-align: right; font-weight: 700; font-family: monospace; font-size: 13px;">
              ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
          <tr class="total-row">
            <td colspan="3" style="text-align: right; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.5px;">
              Total Amount Paid:
            </td>
            <td style="text-align: right; font-size: 14px; color: ${accent}; font-family: monospace;">
              ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- AMOUNT IN WORDS -->
      <div class="amount-words-box">
        <span class="amount-words-label">Amount in Words:</span>
        <span class="amount-words-val">${amountWords}</span>
      </div>

      <!-- NOTES / REMARKS -->
      <div class="notes-box">
        <strong>Accounting Certification:</strong> ${notesOrRemarks}
      </div>

      <!-- 4 SIGNATURE BLOCKS -->
      <div class="signatures-grid">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">${preparedByTitle}</div>
          <div class="sig-sub">${preparedBy}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">${checkedByTitle}</div>
          <div class="sig-sub">${checkedBy}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">${authorizedByTitle}</div>
          <div class="sig-sub">${authorizedBy}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">${receivedByTitle}</div>
          <div class="sig-sub">${receivedBy}</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.log('Auto print:', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Print utility via hidden iframe (safe within sandboxed environments)
 */
export function printVoucherDocument(
  tx: FinanceTransaction,
  settings: VoucherSettings = defaultVoucherSettings,
  customDetails?: EditableVoucherDetails
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = generatePrintableVoucherHtml(tx, settings, customDetails);

      const oldFrame = document.getElementById('voucher-print-frame');
      if (oldFrame) oldFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'voucher-print-frame';
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
    } catch (error) {
      console.error('printVoucherDocument failed:', error);
      window.print();
      resolve(false);
    }
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [79, 70, 229];
}

/**
 * Generates an official vector PDF voucher using jsPDF and autotable
 */
export async function generateVoucherPdf(
  tx: FinanceTransaction,
  settings: VoucherSettings = defaultVoucherSettings,
  customDetails?: EditableVoucherDetails
): Promise<jsPDF> {
  const effectiveSettings: VoucherSettings = {
    ...settings,
    centreName: customDetails?.centreName || settings.centreName,
    subName: customDetails?.subName || settings.subName,
    address: customDetails?.address || settings.address,
    contactInfo: customDetails?.contactInfo || settings.contactInfo,
    regNumber: customDetails?.regNumber || settings.regNumber,
    panNumber: customDetails?.panNumber || settings.panNumber
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  const primaryRgb = hexToRgb(effectiveSettings.accentColor || '#4f46e5');
  const voucherNo = customDetails?.voucherNumber || getVoucherNumber(tx);

  let formattedDate = customDetails?.voucherDate || tx.date;
  try {
    if (formattedDate && formattedDate.includes('-') && formattedDate.length === 10) {
      formattedDate = format(parseISO(formattedDate), 'dd MMMM yyyy');
    }
  } catch {
    // keep as is
  }

  const defaultAccount = getAccountHeadInfo(tx);
  const accountInfo = {
    code: customDetails?.accountCode || defaultAccount.code,
    name: customDetails?.accountHead || defaultAccount.name
  };
  const payee = customDetails?.payeeName || getPayeeName(tx);
  const paymentMode = customDetails?.paymentMode || tx.paymentMode || 'Bank Transfer';
  const amount = customDetails?.amount !== undefined ? customDetails.amount : tx.amount;
  const amountWords = customDetails?.amountInWords || numberToWords(amount);
  const defaultRef = tx.depositDetails?.referenceNumber || tx.assetDetails?.serialNumber || 'N/A';
  const refText = customDetails?.referenceNumber !== undefined ? customDetails.referenceNumber : defaultRef;
  const narration = customDetails?.narration || tx.description || tx.category || 'Operating disbursement';
  const certText = customDetails?.notesOrRemarks || 'Certification: Paid against validated vouchers and debited to the respective account in Little Buds Child Care Centre general ledger.';

  const preparedBy = customDetails?.preparedBy || 'Accounts Assistant';
  const preparedByTitle = customDetails?.preparedByTitle || 'PREPARED BY';
  const checkedBy = customDetails?.checkedBy || 'Internal Auditor';
  const checkedByTitle = customDetails?.checkedByTitle || 'CHECKED & VERIFIED';
  const authorizedBy = customDetails?.authorizedBy || 'Managing Director';
  const authorizedByTitle = customDetails?.authorizedByTitle || 'AUTHORIZED SIGNATORY';
  const receivedBy = customDetails?.receivedBy || payee || 'Payee / Beneficiary';
  const receivedByTitle = customDetails?.receivedByTitle || "RECEIVER'S SIGNATURE";

  // Top header banner
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(margin, margin, contentWidth, 30, 3, 3, 'F');
  doc.rect(margin, margin + 22, contentWidth, 8, 'F'); // square bottom

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(effectiveSettings.centreName.toUpperCase(), margin + 6, margin + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(241, 245, 249);
  doc.text(effectiveSettings.subName, margin + 6, margin + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(effectiveSettings.address, margin + 6, margin + 19.5, { maxWidth: contentWidth - 58 });
  doc.text(`${effectiveSettings.contactInfo}${effectiveSettings.regNumber ? ` | Reg. No: ${effectiveSettings.regNumber}` : ''}`, margin + 6, margin + 24.5, { maxWidth: contentWidth - 58 });

  // Badge on header right
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(pageWidth - margin - 50, margin + 5, 46, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PAYMENT VOUCHER', pageWidth - margin - 27, margin + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(voucherNo, pageWidth - margin - 27, margin + 18, { align: 'center' });

  let yPos = margin + 35;

  // Metadata block: 2 columns for top 3 rows, plus dedicated full-width row for Debit Account Head
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin + 4, yPos, contentWidth - 8, 34, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Date of Payment:', margin + 8, yPos + 6);
  doc.text('Payment Mode:', margin + 8, yPos + 12);
  doc.text('Ref / UTR / Cheque:', margin + 8, yPos + 18);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(formattedDate, margin + 44, yPos + 6, { maxWidth: 44 });
  doc.text(paymentMode, margin + 44, yPos + 12, { maxWidth: 44 });
  doc.text(refText, margin + 44, yPos + 18, { maxWidth: 44 });

  // Right column of meta block
  const rightColX = margin + 98;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Disbursement Source:', rightColX, yPos + 6);
  doc.text('Accounting Type:', rightColX, yPos + 12);
  doc.text('Centre Reg. No.:', rightColX, yPos + 18);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(customDetails?.disbursedFrom || (paymentMode.toLowerCase().includes('cash') ? 'Petty Cash Drawer' : 'Primary Bank A/C'), rightColX + 36, yPos + 6, { maxWidth: 44 });
  doc.text(tx.type === 'Deposit' ? 'Current Asset (1300)' : (tx.type === 'Asset' ? 'Fixed Asset (1500)' : 'Operating Expense'), rightColX + 36, yPos + 12, { maxWidth: 44 });
  doc.text(effectiveSettings.regNumber || 'LBDC/2023/8842', rightColX + 36, yPos + 18, { maxWidth: 44 });

  // Divider line before Debit Account Head
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 8, yPos + 22, margin + contentWidth - 8, yPos + 22);

  // Dedicated highlight background for Debit Account Head
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 5, yPos + 23, contentWidth - 10, 9.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Debit Account Head:', margin + 8, yPos + 29);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`#${accountInfo.code} - ${accountInfo.name}`, margin + 44, yPos + 29, { maxWidth: contentWidth - 54 });

  yPos += 38;

  // Payee Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin + 4, yPos, contentWidth - 8, 16, 2, 2, 'FD');
  // Accent side bar
  doc.setFillColor(...primaryRgb);
  doc.rect(margin + 4, yPos, 2.5, 16, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID TO / IN FAVOUR OF:', margin + 10, yPos + 5.5);

  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(payee, margin + 10, yPos + 12, { maxWidth: contentWidth - 20 });

  yPos += 20;

  // Table
  autoTable(doc, {
    startY: yPos,
    margin: { left: margin + 4, right: margin + 4 },
    head: [['#', 'Particulars / Description', 'Head of Account', 'Amount (INR)']],
    body: [
      [
        '1',
        narration,
        `${accountInfo.code}\n${accountInfo.name}`,
        `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      ]
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 92 },
      2: { cellWidth: 40 },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 35;

  // Total summary row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 4, finalY, contentWidth - 8, 8, 'F');
  doc.setDrawColor(15, 23, 42);
  doc.line(margin + 4, finalY, pageWidth - margin - 4, finalY);
  doc.line(margin + 4, finalY + 8, pageWidth - margin - 4, finalY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT PAID:', pageWidth - margin - 4 - 36, finalY + 5.5, { align: 'right' });
  doc.setTextColor(...primaryRgb);
  doc.text(`Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 6, finalY + 5.5, { align: 'right' });

  // Amount in words
  const wordsY = finalY + 12;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + 4, wordsY, contentWidth - 8, 12, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Amount in Words:', margin + 8, wordsY + 5.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(15, 23, 42);
  doc.text(amountWords, margin + 35, wordsY + 5.5, { maxWidth: contentWidth - 44 });

  // Accounting Certification text
  const certY = wordsY + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(certText, margin + 6, certY, { maxWidth: contentWidth - 14 });

  // 4 Signature Blocks
  const sigY = certY + 14;
  const colWidth = (contentWidth - 8) / 4;

  const signatures = [
    { title: preparedByTitle, sub: preparedBy },
    { title: checkedByTitle, sub: checkedBy },
    { title: authorizedByTitle, sub: authorizedBy },
    { title: receivedByTitle, sub: receivedBy }
  ];

  signatures.forEach((sig, idx) => {
    const x = margin + 4 + idx * colWidth;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(x + 4, sigY + 12, x + colWidth - 4, sigY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.title, x + colWidth / 2, sigY + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.sub, x + colWidth / 2, sigY + 20, { align: 'center' });
  });

  // Outer border with dynamic height
  const outerBorderHeight = Math.max(260, sigY + 26 - margin);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, margin, contentWidth, outerBorderHeight, 3, 3);

  return doc;
}

/**
 * Triggers direct browser download of the PDF voucher
 */
export async function downloadVoucherPdf(
  tx: FinanceTransaction,
  settings: VoucherSettings = defaultVoucherSettings,
  customDetails?: EditableVoucherDetails
): Promise<void> {
  const doc = await generateVoucherPdf(tx, settings, customDetails);
  const voucherNo = customDetails?.voucherNumber || getVoucherNumber(tx);
  doc.save(`Payment_Voucher_${voucherNo}.pdf`);
}
