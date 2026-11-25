import React, { useState } from 'react';
import { 
  CloudLightning, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { loginApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface LoginPageProps {
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister }) => {
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await loginApi(email, password);
      setAuth(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@cloudtorrent.io');
    setPassword('admin_password_123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0C10] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
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

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-card">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Sign In to Your Workspace
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access your cloud downloads, direct HTTPS links, and storage
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-sm flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Demo Fast-Fill Pill */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={fillAdminCredentials}
            className="w-full py-2 px-3 text-xs font-semibold rounded-xl text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100/70 border border-indigo-200/60 dark:border-indigo-800/60 transition-colors flex items-center justify-center space-x-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Fill Default Admin Credentials</span>
          </button>
        </div>

        {/* Invitation Switcher */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Have an invitation code?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
            >
              Register Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
