import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Bot, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      authAPI.verifyEmail(token)
        .then(() => { setStatus('success'); setMessage('Your email has been verified successfully!'); })
        .catch(() => { setStatus('error'); setMessage('Invalid or expired verification link.'); });
    } else {
      setStatus('error');
      setMessage('No verification token provided.');
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 mb-4">
          <Bot size={28} className="text-white" />
        </div>
        <div className="bg-zinc-800 rounded-2xl p-8 shadow-xl border border-zinc-700">
          {status === 'loading' && <Loader2 size={48} className="animate-spin text-emerald-500 mx-auto" />}
          {status === 'success' && <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />}
          {status === 'error' && <XCircle size={48} className="text-red-500 mx-auto mb-4" />}
          <p className="text-zinc-200 mt-4">{message}</p>
          <Link to="/login" className="inline-block mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
