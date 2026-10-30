import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BusinessSettings, BusinessFinancialDetails } from '../types';
import { removeUndefinedFields, logActivity } from './api';

const SETTINGS_STORAGE_KEY = 'little_buds_business_financial_settings_v2';

export const EMPTY_FINANCIAL_DETAILS: BusinessFinancialDetails = {
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  accountType: '',
  upiId: '',
  qrCodeUrl: '',
  paymentNotes: ''
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  centreName: 'Little Buds Child Care Centre',
  tagline: 'Where Every Child Can Bloom.',
  subName: 'Child Care & Early Development Centre',
  address: '',
  phone: '',
  email: '',
  regNumber: '',
  financial: EMPTY_FINANCIAL_DETAILS,
  terms: '1. Fees once paid are non-refundable.\n2. Please clear any balance on or before the due date.\n3. For any billing queries, please contact our centre accounts desk.',
  accentColor: '#558B2F'
};

/**
 * Checks if the user has configured actual business bank details.
 */
export function hasConfiguredBankDetails(details?: BusinessFinancialDetails | null): boolean {
  if (!details) return false;
  return Boolean(
    details.accountNumber?.trim() ||
    details.bankName?.trim() ||
    details.ifscCode?.trim() ||
    details.upiId?.trim()
  );
}

/**
 * Masks an account number for safe display in dashboards (e.g. "•••• •••• 5678").
 */
export function maskAccountNumber(acc?: string): string {
  if (!acc) return '';
  const clean = acc.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Fetches the centralized business and financial settings.
 * Checks Firestore first, falls back to localStorage, then default empty settings.
 */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  // 1. Try local cache first for instant UI response
  let cached: BusinessSettings | null = null;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cached = {
        ...DEFAULT_BUSINESS_SETTINGS,
        ...parsed,
        financial: {
          ...EMPTY_FINANCIAL_DETAILS,
          ...(parsed.financial || {})
        }
      };
    }
  } catch (err) {
    console.warn('Failed to parse cached business settings', err);
  }

  // 2. Query Firestore
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'business'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as Partial<BusinessSettings>;
      const merged: BusinessSettings = {
        ...DEFAULT_BUSINESS_SETTINGS,
        ...data,
        financial: {
          ...EMPTY_FINANCIAL_DETAILS,
          ...(data.financial || {})
        }
      };
      // Keep local cache synced
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Firestore business settings read fallback:', err);
  }

  if (cached) return cached;

  // Check legacy invoiceSettings in localStorage to migrate any real user-edited address/contact
  try {
    const legacy = localStorage.getItem('invoiceSettings');
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      const migrated: BusinessSettings = {
        ...DEFAULT_BUSINESS_SETTINGS,
        address: parsedLegacy.address || '',
        phone: parsedLegacy.contactInfo || '',
        regNumber: parsedLegacy.regNumber || '',
        financial: {
          ...EMPTY_FINANCIAL_DETAILS,
          upiId: parsedLegacy.upiId && !parsedLegacy.upiId.includes('littlebuds@upi') ? parsedLegacy.upiId : '',
          // Don't migrate hardcoded HDFC sample details!
          accountNumber: parsedLegacy.bankDetails && !parsedLegacy.bankDetails.includes('50200012345678') ? parsedLegacy.bankDetails : ''
        }
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // Ignore legacy error
  }

  return DEFAULT_BUSINESS_SETTINGS;
}

/**
 * Updates centralized business and financial settings.
 * Saves to Firestore and synchronizes with localStorage and dispatches a storage event.
 */
export async function saveBusinessSettings(settings: BusinessSettings): Promise<void> {
  const payload = removeUndefinedFields({
    ...settings,
    financial: {
      ...settings.financial,
      updatedAt: new Date().toISOString()
    }
  });

  // Save to localStorage immediately
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  // Backwards compatibility for legacy components reading invoiceSettings
  localStorage.setItem('invoiceSettings', JSON.stringify({
    centreName: settings.centreName,
    subName: settings.subName || '',
    address: settings.address,
    contactInfo: settings.phone ? `Phone: ${settings.phone}${settings.email ? ` | Email: ${settings.email}` : ''}` : settings.email,
    accentColor: settings.accentColor || '#558B2F',
    regNumber: settings.regNumber,
    upiId: settings.financial.upiId,
    bankDetails: settings.financial.accountNumber
      ? `${settings.financial.bankName} | A/C: ${settings.financial.accountNumber} | IFSC: ${settings.financial.ifscCode}`
      : '',
    terms: settings.terms
  }));

  // Notify listeners in same window
  window.dispatchEvent(new CustomEvent('businessSettingsUpdated', { detail: payload }));

  // Save to Firestore
  try {
    await setDoc(doc(db, 'settings', 'business'), payload, { merge: true });
    await logActivity('Updated Business Financial Settings', 'Saved business information and bank payment details');
  } catch (err) {
    console.warn('Firestore business settings write fallback:', err);
  }
}
