import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LittleBudsLogo } from './Logo';
import { Eye, EyeOff, Lock, User as UserIcon, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { login, credentials, resetToDefaultCredentials } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');
    setIsSubmitting(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Invalid username or password');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsResetting(true);
    setError('');
    try {
      await resetToDefaultCredentials();
      setUsername('admin');
      setPassword('admin');
      setShowResetPrompt(false);
      setSuccessNotice('Credentials reset to default (admin / admin). You can now sign in.');
    } catch (err: any) {
      setError('Failed to reset credentials. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#F7FEE7]/40 via-stone-50 to-[#FEF3C7]/20 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-white rounded-3xl shadow-md border border-stone-200/80">
            <LittleBudsLogo className="w-20 h-20" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
          Little<span className="text-[#558B2F]">Buds</span>
        </h2>
        <p className="text-xs font-semibold text-[#8D5B4C] uppercase tracking-wider mt-0.5">
          Child Care Centre
        </p>
        <p className="mt-2 text-center text-sm text-stone-600">
          Sign in to Centre Management Platform
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-stone-200/50 rounded-2xl border border-stone-200/80 sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 text-rose-700 p-3.5 rounded-xl border border-rose-200 text-xs text-center font-bold flex items-center justify-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successNotice && (
              <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-xl border border-emerald-200 text-xs text-center font-bold flex items-center justify-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Username
              </label>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <UserIcon className="h-4 w-4 text-stone-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3.5 py-2.5 border border-stone-300 rounded-xl shadow-2xs placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E] text-sm font-medium"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4 text-stone-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-2.5 border border-stone-300 rounded-xl shadow-2xs placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#74B72E] focus:border-[#74B72E] text-sm font-medium"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#558B2F] hover:bg-[#436D25] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#558B2F] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In to Dashboard</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-stone-100 flex flex-col space-y-2 text-center text-xs text-stone-500">
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowResetPrompt(!showResetPrompt)}
                className="text-stone-400 hover:text-stone-700 underline text-[11px] font-semibold transition-colors"
              >
                Need credential recovery or locked out?
              </button>
            </div>

            {showResetPrompt && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-2 text-amber-900 animate-in fade-in">
                <p className="text-[11px] font-medium leading-relaxed">
                  Reset the administrator login to factory default: <strong className="font-mono">admin / admin</strong>.
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowResetPrompt(false)}
                    className="px-2.5 py-1 text-[11px] bg-white border border-stone-200 rounded-lg text-stone-600 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={handleResetToDefault}
                    className="px-2.5 py-1 text-[11px] bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold flex items-center space-x-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Default</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

