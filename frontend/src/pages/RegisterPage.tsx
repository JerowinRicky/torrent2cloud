import React, { useState } from 'react';
import { 
  CloudLightning, 
  Lock, 
  Mail, 
  User, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { validateInvitationApi, registerApi } from '../lib/api';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const [invitationCode, setInvitationCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeMessage, setCodeMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleValidateCode = async () => {
    if (!invitationCode.trim()) return;
    setIsValidatingCode(true);
    setCodeMessage(null);
    try {
      const res = await validateInvitationApi(invitationCode);
      setCodeValid(res.valid);
      setCodeMessage(res.message);
      if (res.email) {
        setEmail(res.email);
      }
    } catch {
      setCodeValid(false);
      setCodeMessage('Failed to validate code');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await registerApi({
        invitation_code: invitationCode,
        full_name: fullName,
        email,
        password,
      });
      setSuccessMessage('Registration successful! You can now sign in.');
      setTimeout(() => {
        onNavigateToLogin();
      }, 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0C10] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <CloudLightning className="w-7 h-7 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            CloudTorrent
          </span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Private Cloud Platform
          </span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Claim Invitation
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Create your authorized private user account
            </p>
          </div>
          <button
            onClick={onNavigateToLogin}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to login"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-sm flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-sm flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Step 1: Invitation Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Invitation Code
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={invitationCode}
                  onChange={(e) => {
                    setInvitationCode(e.target.value);
                    setCodeValid(null);
                  }}
                  placeholder="ct-xxxxxxxxxxxxxxxx"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-xs shadow-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleValidateCode}
                disabled={isValidatingCode || !invitationCode.trim()}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-xs"
              >
                {isValidatingCode ? 'Checking...' : 'Verify'}
              </button>
            </div>
            {codeValid === true && (
              <p className="text-xs text-emerald-600 flex items-center space-x-1 mt-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{codeMessage}</span>
              </p>
            )}
            {codeValid === false && (
              <p className="text-xs text-rose-600 flex items-center space-x-1 mt-1.5 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{codeMessage}</span>
              </p>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || codeValid === false}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isLoading ? 'Creating Account...' : 'Complete Registration'}</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <button
              onClick={onNavigateToLogin}
              className="text-[#635BFF] hover:underline font-semibold"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
