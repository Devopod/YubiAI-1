import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Loader2, ArrowLeft } from 'lucide-react';
import { authAPI } from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await authAPI.forgotPassword(email); } catch { /* ignore */ }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 mb-4">
            <Bot size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
        </div>
        <div className="bg-zinc-800 rounded-2xl p-6 shadow-xl border border-zinc-700">
          {sent ? (
            <div className="text-center py-4">
              <p className="text-zinc-200">If an account exists with that email, we've sent a password reset link.</p>
              <Link to="/login" className="inline-flex items-center gap-2 mt-4 text-emerald-400 hover:text-emerald-300">
                <ArrowLeft size={16} /> Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="you@example.com" required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                Send reset link
              </button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-zinc-300">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
