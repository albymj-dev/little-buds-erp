import React, { useState } from 'react';
import { X, Tag, Plus, Check } from 'lucide-react';
import { CustomCategory, ChartOfAccountItem } from '../types';
import { addCustomCategory } from '../services/accountingService';

interface CustomCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'Expense' | 'Income' | 'Asset' | 'Liability';
  accounts: ChartOfAccountItem[];
  onCategoryAdded: (newCat: CustomCategory) => void;
}

export const CustomCategoryModal: React.FC<CustomCategoryModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'Expense',
  accounts,
  onCategoryAdded
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'Expense' | 'Income' | 'Asset' | 'Liability'>(defaultType);
  const [defaultLedgerCode, setDefaultLedgerCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredAccounts = accounts.filter(acc => {
    if (type === 'Expense') return acc.type === 'Expense';
    if (type === 'Income') return acc.type === 'Revenue';
    if (type === 'Asset') return acc.type === 'Asset';
    if (type === 'Liability') return acc.type === 'Liability';
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const newCat = await addCustomCategory({
        name: name.trim(),
        type,
        defaultLedgerCode: defaultLedgerCode || undefined,
        description: description.trim() || undefined
      });
      onCategoryAdded(newCat);
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add custom category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Add Custom Category</h3>
              <p className="text-xs text-emerald-100">Create a personalized accounting category</p>
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
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Category Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Expense', 'Income', 'Asset', 'Liability'] as const).map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                    type === t
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Field Trips, Doctor On Call, Organic Milk..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Default General Ledger Head (Optional)
            </label>
            <select
              value={defaultLedgerCode}
              onChange={e => setDefaultLedgerCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">-- Auto-Assign General Ledger Account --</option>
              {filteredAccounts.map(acc => (
                <option key={acc.code} value={acc.code}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of expenses or revenues under this category..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-50"
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Category</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
