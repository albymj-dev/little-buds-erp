import React, { useState, useEffect } from 'react';
import { 
  Building, CreditCard, QrCode, Save, ShieldCheck, CheckCircle, 
  AlertCircle, Eye, EyeOff, Info, Landmark, Phone, Mail, MapPin
} from 'lucide-react';
import { 
  BusinessSettings, 
  BusinessFinancialDetails 
} from '../types';
import { 
  getBusinessSettings, 
  saveBusinessSettings, 
  maskAccountNumber, 
  hasConfiguredBankDetails,
  EMPTY_FINANCIAL_DETAILS 
} from '../services/financialSettingsService';

interface Props {
  onSavedNotification?: (msg: string) => void;
}

export const FinancialDetailsSettingsTab: React.FC<Props> = ({ onSavedNotification }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getBusinessSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load financial settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinancialChange = (field: keyof BusinessFinancialDetails, value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      financial: {
        ...settings.financial,
        [field]: value
      }
    });
  };

  const handleBusinessChange = (field: keyof BusinessSettings, value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await saveBusinessSettings(settings);
      setSuccessMessage('Business and financial details saved successfully! All invoices and reports are synchronized.');
      if (onSavedNotification) {
        onSavedNotification('Financial details saved successfully');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage(err.message || 'Failed to save financial details.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDetails = async () => {
    if (!settings) return;
    if (confirm('Are you sure you want to clear your bank and payment details? Fields will remain blank until reconfigured.')) {
      const cleared: BusinessSettings = {
        ...settings,
        financial: { ...EMPTY_FINANCIAL_DETAILS }
      };
      setSettings(cleared);
      await saveBusinessSettings(cleared);
      setSuccessMessage('Payment details cleared.');
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 text-center text-stone-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">Loading business and financial settings...</p>
      </div>
    );
  }

  const isConfigured = hasConfiguredBankDetails(settings.financial);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900">Business & Bank Financial Details</h2>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" />
                Configured & Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                No Bank Details Configured
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Configure official banking, UPI, and organisation credentials. These appear in official invoices, payment receipts, and journal ledgers. No default bank details are assumed.
          </p>
        </div>

        {isConfigured && (
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3.5 py-2 rounded-xl text-xs">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="font-semibold text-stone-800">{settings.financial.bankName || 'Active Bank'}</div>
              <div className="font-mono text-stone-500">
                {showFullAccount ? settings.financial.accountNumber : maskAccountNumber(settings.financial.accountNumber)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFullAccount(!showFullAccount)}
              className="p-1 text-stone-400 hover:text-stone-700 transition"
              title={showFullAccount ? 'Mask Account' : 'Show Full Account'}
            >
              {showFullAccount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Official Bank Account */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Landmark className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Bank Account Credentials
              </h3>
            </div>
            <span className="text-xs text-stone-500">Official Receiving Account</span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={settings.financial.accountHolderName || ''}
                onChange={e => handleFinancialChange('accountHolderName', e.target.value)}
                placeholder="e.g. Little Buds Child Care Centre"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">Exact legal name registered with the bank</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={settings.financial.bankName || ''}
                onChange={e => handleFinancialChange('bankName', e.target.value)}
                placeholder="e.g. State Bank of India / HDFC Bank / ICICI Bank"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700">
                  Account Number
                </label>
                <button
                  type="button"
                  onClick={() => setShowFullAccount(!showFullAccount)}
                  className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                >
                  {showFullAccount ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showFullAccount ? 'Mask number' : 'Show full'}
                </button>
              </div>
              <input
                type={showFullAccount ? 'text' : 'password'}
                value={settings.financial.accountNumber || ''}
                onChange={e => handleFinancialChange('accountNumber', e.target.value)}
                placeholder="Enter complete bank account number"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Preview in invoices: {maskAccountNumber(settings.financial.accountNumber) || 'No account number set'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={settings.financial.ifscCode || ''}
                onChange={e => handleFinancialChange('ifscCode', e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Branch Name / Location
              </label>
              <input
                type="text"
                value={settings.financial.branchName || ''}
                onChange={e => handleFinancialChange('branchName', e.target.value)}
                placeholder="e.g. Main Branch, MG Road"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Type
              </label>
              <select
                value={settings.financial.accountType || ''}
                onChange={e => handleFinancialChange('accountType', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="">Select Account Type</option>
                <option value="Current Account">Current Account</option>
                <option value="Savings Account">Savings Account</option>
                <option value="Overdraft / Cash Credit">Overdraft / Cash Credit</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: UPI & Digital Payment Details */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                UPI & Quick QR Payments
              </h3>
            </div>
            <span className="text-xs text-stone-500">For Parents Paying via UPI</span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Centre UPI VPA / ID
              </label>
              <input
                type="text"
                value={settings.financial.upiId || ''}
                onChange={e => handleFinancialChange('upiId', e.target.value.toLowerCase())}
                placeholder="e.g. littlebuds@upi or 9876543210@paytm"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">UPI ID printed on parent payment notices</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Payment Instructions / Notes
              </label>
              <input
                type="text"
                value={settings.financial.paymentNotes || ''}
                onChange={e => handleFinancialChange('paymentNotes', e.target.value)}
                placeholder="e.g. Please mention Child's Name in transfer narration"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Centre Identity & Address Details */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Building className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Centre Address & Official Contact
              </h3>
            </div>
            <span className="text-xs text-stone-500">Invoice Header & Footer</span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Physical Campus Address
              </label>
              <textarea
                rows={2}
                value={settings.address || ''}
                onChange={e => handleBusinessChange('address', e.target.value)}
                placeholder="Plot / Door No, Street Name, Area, City, PIN Code"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Official Phone / WhatsApp
              </label>
              <input
                type="text"
                value={settings.phone || ''}
                onChange={e => handleBusinessChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={settings.email || ''}
                onChange={e => handleBusinessChange('email', e.target.value)}
                placeholder="accounts@littlebuds.in"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Govt. Registration / License Number
              </label>
              <input
                type="text"
                value={settings.regNumber || ''}
                onChange={e => handleBusinessChange('regNumber', e.target.value)}
                placeholder="e.g. LBDC/2023/8842"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Default Terms & Payment Conditions
              </label>
              <textarea
                rows={2}
                value={settings.terms || ''}
                onChange={e => handleBusinessChange('terms', e.target.value)}
                placeholder="1. Fees once paid are non-refundable..."
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleClearDetails}
            className="px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition"
          >
            Clear Bank Details
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Details...' : 'Save Financial Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
