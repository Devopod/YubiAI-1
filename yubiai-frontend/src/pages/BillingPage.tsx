import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, Bot, ArrowLeft, Loader2, Check, Zap,
  MessageSquare, Key, HardDrive, Crown, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';

interface PlanInfo {
  name: string;
  messages_limit: number;
  messages_used: number;
  api_calls_limit: number;
  api_calls_used: number;
  storage_limit_mb: number;
  storage_used_mb: number;
}

interface BillingStats {
  total_messages: number;
  total_api_usage: number;
  plan: PlanInfo;
  account: {
    name: string;
    email: string;
    created_at: string;
    days_active: number;
  };
}

const ALL_PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    desc: 'Get started with YubiAI',
    features: [
      '1,000 messages/month',
      '500 API calls/month',
      '100 MB storage',
      '4 AI models',
      'Email support',
      'Basic analytics',
    ],
    color: 'zinc',
    defaultCta: 'Current Plan',
    otherCta: 'Downgrade',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    desc: 'For power users & developers',
    features: [
      '50,000 messages/month',
      '25,000 API calls/month',
      '10 GB storage',
      'All AI models + priority',
      'Priority support',
      'Advanced analytics',
      'Custom system prompts',
      'Webhook integrations',
    ],
    color: 'emerald',
    defaultCta: 'Coming Soon',
    otherCta: 'Coming Soon',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For teams & organizations',
    features: [
      'Unlimited messages',
      'Unlimited API calls',
      'Unlimited storage',
      'All models + fine-tuning',
      'Dedicated support',
      'Custom analytics & SLA',
      'SSO & team management',
      'On-premise deployment',
    ],
    color: 'violet',
    defaultCta: 'Contact Sales',
    otherCta: 'Contact Sales',
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    dashboardAPI.getStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error('Failed to load billing stats', err))
      .finally(() => setLoading(false));
  }, [user]);

  const currentPlanName = stats?.plan.name || 'Free';

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="text-zinc-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-emerald-500" />
            <span className="font-semibold">YubiAI</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span className="text-sm text-zinc-400">Billing & Usage</span>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-zinc-400 hover:text-white">Dashboard</Link>
            <Link to="/chat" className="text-sm text-zinc-400 hover:text-white">Chat</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                <CreditCard size={24} className="text-emerald-400" />
                Billing & Usage
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Manage your subscription and monitor your usage
              </p>
            </div>

            {/* Current Usage */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
              <UsageCard
                icon={MessageSquare}
                label="Messages"
                used={stats?.plan.messages_used || 0}
                limit={stats?.plan.messages_limit || 1000}
                color="emerald"
              />
              <UsageCard
                icon={Key}
                label="API Calls"
                used={stats?.plan.api_calls_used || 0}
                limit={stats?.plan.api_calls_limit || 500}
                color="blue"
              />
              <UsageCard
                icon={HardDrive}
                label="Storage"
                used={stats?.plan.storage_used_mb || 0}
                limit={stats?.plan.storage_limit_mb || 100}
                color="violet"
                unit="MB"
              />
            </div>

            {/* Plans */}
            <div className="mb-8 sm:mb-10">
              <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2">
                <Crown size={20} className="text-amber-400" /> Plans
              </h2>
              <p className="text-zinc-400 text-sm mb-6">Choose the plan that fits your needs. Payment gateway coming soon.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {ALL_PLANS.map((plan) => {
                  const isCurrent = plan.name === currentPlanName;
                  const borderColor = isCurrent
                    ? 'border-emerald-500/50'
                    : plan.color === 'emerald'
                    ? 'border-emerald-500/30 hover:border-emerald-500/50'
                    : plan.color === 'violet'
                    ? 'border-violet-500/30 hover:border-violet-500/50'
                    : 'border-zinc-700 hover:border-zinc-600';

                  return (
                    <div
                      key={plan.name}
                      className={`relative p-5 sm:p-6 rounded-xl bg-zinc-800 border-2 ${borderColor} transition-colors`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-4 px-3 py-0.5 bg-emerald-600 rounded-full text-xs font-bold">
                          Current
                        </div>
                      )}
                      <div className="mb-4">
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">{plan.desc}</p>
                      </div>
                      <div className="mb-5">
                        <span className="text-3xl sm:text-4xl font-bold">{plan.price}</span>
                        <span className="text-zinc-400 text-sm">{plan.period}</span>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                            <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        disabled={isCurrent}
                        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isCurrent
                            ? 'bg-zinc-700 text-zinc-400 cursor-default'
                            : plan.color === 'emerald'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : plan.color === 'violet'
                            ? 'bg-violet-600 hover:bg-violet-500 text-white'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                        }`}
                      >
                        {isCurrent ? 'Current Plan' : plan.otherCta}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Billing Info */}
            <div className="p-4 sm:p-6 rounded-xl bg-zinc-800 border border-zinc-700 mb-8">
              <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap size={18} className="text-amber-400" /> Billing Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Account Holder</p>
                  <p className="text-sm text-zinc-200">{stats?.account.name || user?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Email</p>
                  <p className="text-sm text-zinc-200">{stats?.account.email || user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Current Plan</p>
                  <p className="text-sm text-zinc-200">{currentPlanName}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Member Since</p>
                  <p className="text-sm text-zinc-200">
                    {stats?.account.created_at ? new Date(stats.account.created_at).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <p className="text-xs text-zinc-500">
                  Payment gateway integration coming soon. You'll be able to upgrade your plan and manage payments directly from here.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center p-6 sm:p-8 rounded-xl bg-gradient-to-br from-emerald-600/10 to-violet-600/10 border border-emerald-500/20">
              <h3 className="text-lg font-bold mb-2">Need more power?</h3>
              <p className="text-zinc-400 text-sm mb-4 max-w-md mx-auto">
                Contact us for custom enterprise solutions with unlimited usage, dedicated support, and SLA guarantees.
              </p>
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
              >
                Start Chatting <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UsageCard({ icon: Icon, label, used, limit, color, unit }: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  color: string;
  unit?: string;
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = isUnlimited ? (color === 'emerald' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-500' : 'bg-violet-500') : pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-500' : 'bg-violet-500';

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-zinc-800 border border-zinc-700">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={color === 'emerald' ? 'text-emerald-400' : color === 'blue' ? 'text-blue-400' : 'text-violet-400'} />
        <span className="text-sm font-medium text-zinc-300">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-xl sm:text-2xl font-bold">{used.toLocaleString()}</span>
        {isUnlimited ? (
          <span className="text-sm text-emerald-400 font-medium">/ Unlimited</span>
        ) : (
          <span className="text-sm text-zinc-500">/ {limit.toLocaleString()} {unit || ''}</span>
        )}
      </div>
      {isUnlimited ? (
        <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full`} style={{ width: '100%' }} />
        </div>
      ) : (
        <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-xs text-zinc-500 mt-1.5">{isUnlimited ? 'Unlimited usage' : `${pct.toFixed(0)}% used`}</p>
    </div>
  );
}
