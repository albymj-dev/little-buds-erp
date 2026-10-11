import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTypography } from '../contexts/TypographyContext';
import { 
  X, 
  User, 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  Lock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentUser, credentials, updateCredentials, resetToDefaultCredentials } = useAuth();
  const { accentColor, secondaryAccentColor } = useTypography();

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Form fields
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUsername(credentials.username || currentUser?.username || 'admin');
      setDisplayName(credentials.name || currentUser?.name || 'Admin User');
      setEmail(credentials.email || currentUser?.email || 'admin@littlebuds.com');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatusMessage(null);
      setShowResetConfirm(false);
    }
  }, [isOpen, credentials, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setStatusMessage({ type: 'error', text: 'Username cannot be blank.' });
      return;
    }

    if (!currentPassword) {
      setStatusMessage({ 
        type: 'error', 
        text: 'Please enter your Current Password to authorize changes.' 
      });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setStatusMessage({ type: 'error', text: 'New password must be at least 4 characters long.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatusMessage({ type: 'error', text: 'New password and confirmation do not match.' });
        return;
      }
    }

    setLoading(true);
    try {
      const result = await updateCredentials({
        currentPassword,
        newUsername: trimmedUser,
        newPassword: newPassword.trim() ? newPassword : undefined,
        newName: displayName.trim(),
        newEmail: email.trim(),
      });

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: newPassword.trim() 
            ? 'Username, password, and profile updated successfully!' 
            : 'Username and profile updated successfully!'
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: result.error || 'Failed to update credentials.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsResetting(true);
    setStatusMessage(null);
    try {
      await resetToDefaultCredentials();
      setUsername('admin');
      setDisplayName('Admin User');
      setEmail('admin@littlebuds.com');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowResetConfirm(false);
      setStatusMessage({
        type: 'success',
        text: 'Credentials reset to default (username: "admin" / password: "admin").'
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to reset credentials.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center space-x-3">
            <div 
              className="p-2.5 rounded-2xl text-white shadow-2xs"
              style={{ backgroundColor: accentColor }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900 leading-tight">
                Account & Security Settings
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Manage your login credentials, username, and password
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 px-6 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 font-bold text-xs uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-[#558B2F] text-[#558B2F]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Username</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-4 font-bold text-xs uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-[#558B2F] text-[#558B2F]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div className={`mx-6 mt-4 p-3.5 rounded-2xl flex items-start space-x-3 border text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <p className="flex-1">{statusMessage.text}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Username (Login Identifier) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <User className="h-4 w-4 text-stone-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or alby_admin"
                    className="block w-full rounded-xl border border-stone-300 pl-10 pr-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E]"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  This is the username used to sign in to the Little Buds centre management portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Display Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Administrator / Alby Mathew"
                  className="block w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Shown in the top header, sidebar, payment vouchers, and activity logs.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@littlebuds.com"
                  className="block w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E]"
                />
              </div>

              <div className="pt-2">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-stone-800">Assigned Privilege Role</p>
                    <p className="text-[11px] text-stone-500">Full System & Financial Administrator</p>
                  </div>
                  <span 
                    className="px-2.5 py-1 text-xs font-extrabold uppercase rounded-full text-white shadow-2xs"
                    style={{ backgroundColor: secondaryAccentColor }}
                  >
                    Admin
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 4 characters)"
                    className="block w-full rounded-xl border border-stone-300 pl-3.5 pr-10 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Leave blank if you only wish to change your username or display name.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="block w-full rounded-xl border border-stone-300 pl-3.5 pr-10 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Password Authorization (Always required to commit changes) */}
          <div className="pt-3 border-t border-stone-200">
            <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password to authorize changes"
                className="block w-full rounded-xl border border-stone-300 pl-3.5 pr-10 py-2.5 text-sm font-medium text-stone-900 bg-amber-50/20 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Required for security before updating credentials (default is <strong className="text-stone-700 font-semibold">admin</strong>).
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowResetConfirm(!showResetConfirm)}
              className="text-xs font-bold text-stone-500 hover:text-rose-600 transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to default</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-xs font-extrabold text-white rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Reset Confirmation Drawer */}
          {showResetConfirm && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
              <div className="flex items-start space-x-2 text-rose-800 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <p>Are you sure you want to reset your login to default (<strong className="font-mono">admin / admin</strong>)?</p>
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1 bg-white border border-stone-200 rounded-lg text-stone-600 font-bold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleResetToDefault}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center space-x-1"
                >
                  {isResetting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />}
                  <span>Confirm Reset</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
