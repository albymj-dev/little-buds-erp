import React, { useState, useEffect } from 'react';
import { X, Layers, Plus, Check } from 'lucide-react';
import { ChartOfAccountItem } from '../types';
import { addChartOfAccount } from '../services/chartOfAccountsService';

interface CustomLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAccounts: ChartOfAccountItem[];
  defaultType?: ChartOfAccountItem['type'];
  onAccountAdded: (newAccount: ChartOfAccountItem) => void;
}

const SUBTYPE_OPTIONS: Record<ChartOfAccountItem['type'], string[]> = {
  Asset: ['Current Asset', 'Fixed Asset', 'Cash & Bank', 'Accounts Receivable', 'Prepaid Expense', 'Other Asset'],
  Liability: ['Current Liability', 'Non-Current Liability', 'Accounts Payable', 'Accrued Expenses', 'Other Liability'],
  Equity: ['Partner Capital', 'Retained Earnings', 'Capital Reserve', 'Current Surplus'],
  Revenue: ['Operating Revenue', 'Fee Income', 'Auxiliary Revenue', 'Other Income'],
  Expense: ['Staffing', 'Premises', 'Utilities', 'Care Materials', 'Nutrition', 'Facilities', 'Marketing', 'Administrative', 'Professional Development', 'Financial', 'Non-Cash Expense', 'Other Operational']
};

export const CustomLedgerModal: React.FC<CustomLedgerModalProps> = ({
  isOpen,
  onClose,
  existingAccounts,
  defaultType = 'Expense',
  onAccountAdded
}) => {
  const [type, setType] = useState<ChartOfAccountItem['type']>(defaultType);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subtype, setSubtype] = useState(SUBTYPE_OPTIONS[defaultType][0]);
  const [normalBalance, setNormalBalance] = useState<'Debit' | 'Credit'>(
    defaultType === 'Asset' || defaultType === 'Expense' ? 'Debit' : 'Credit'
  );
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest next available code when type changes
  useEffect(() => {
    let prefix = '5';
    if (type === 'Asset') prefix = '1';
    else if (type === 'Liability') prefix = '2';
    else if (type === 'Equity') prefix = '3';
    else if (type === 'Revenue') prefix = '4';
    else prefix = '5';

    const existingCodes = existingAccounts
      .map(a => a.code)
      .filter(c => c.startsWith(prefix) && c.length === 4)
      .map(c => parseInt(c, 10))
      .filter(n => !isNaN(n));

    const highest = existingCodes.length > 0 ? Math.max(...existingCodes) : parseInt(`${prefix}000`, 10);
    const nextCode = (highest + 10).toString();
    setCode(nextCode);

    setSubtype(SUBTYPE_OPTIONS[type][0]);
    setNormalBalance(type === 'Asset' || type === 'Expense' ? 'Debit' : 'Credit');
  }, [type, existingAccounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Account code is required.');
      return;
    }

    if (existingAccounts.some(a => a.code === code.trim())) {
      setError(`Account code ${code} is already in use.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Omit<ChartOfAccountItem, 'id'> = {
        code: code.trim(),
        name: name.trim(),
        type,
        subtype,
        normalBalance,
        description: description.trim() || undefined,
        isActive: true,
        isSystem: false,
        linkedCategory: name.trim()
      };

      const newId = await addChartOfAccount(payload);
      const createdItem: ChartOfAccountItem = {
        id: newId,
        ...payload,
        createdAt: new Date().toISOString()
      };

      onAccountAdded(createdItem);
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create ledger account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">New General Ledger Account</h3>
              <p className="text-xs text-indigo-100">Add an account directly to the Chart of Accounts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Account Classification *
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-2 px-1 text-center text-xs font-bold rounded-lg border transition-all ${
                    type === t
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-800 ring-2 ring-indigo-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Account Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. 5150"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Subtype / Group *
              </label>
              <select
                value={subtype}
                onChange={e => setSubtype(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {SUBTYPE_OPTIONS[type].map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Account Title / Ledger Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Activity Materials & Toys, Pediatric Doctor Retainer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Normal Balance
              </label>
              <select
                value={normalBalance}
                onChange={e => setNormalBalance(e.target.value as 'Debit' | 'Credit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Debit">Debit (Dr) - Standard for Assets & Expenses</option>
                <option value="Credit">Credit (Cr) - Standard for Liabilities, Equity, Revenue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Description / Narration
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Accounting purpose and guidelines for entries posted to this head..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-50"
            >
              {saving ? (
                <span>Creating...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Account Head</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
