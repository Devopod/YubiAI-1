import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Bot, Key, ArrowLeft, Loader2,
  TrendingUp, Clock, Zap, BarChart3, ArrowRight, CreditCard,
} from 'lucide-react';
import { dashboardAPI } from '../services/api';

interface DashboardStats {
  total_chats: number;
  total_messages: number;
  user_messages: number;
  ai_responses: number;
  api_keys_count: number;
  active_api_keys: number;
  total_api_usage: number;
  recent_chats: { id: string; title: string; created_at: string; updated_at: string }[];
  daily_activity: { date: string; messages: number }[];
  account: {
    name: string;
    email: string;
    is_verified: boolean;
    is_google_user: boolean;
    avatar_url: string | null;
    created_at: string;
    days_active: number;
  };
  plan: {
    name: string;
    messages_limit: number;
    messages_used: number;
    api_calls_limit: number;
    api_calls_used: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error('Failed to load dashboard stats', err))
      .finally(() => setLoading(false));
  }, []);

  const maxMessages = Math.max(...(stats?.daily_activity?.map(d => d.messages) || [1]), 1);

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="text-zinc-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-emerald-500" />
            <span className="font-semibold">YubiAI</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span className="text-sm text-zinc-400">Dashboard</span>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-4">
            <Link to="/chat" className="text-sm text-zinc-400 hover:text-white">Chat</Link>
            <Link to="/billing" className="text-sm text-zinc-400 hover:text-white">Billing</Link>
            <Link to="/api-keys" className="text-sm text-zinc-400 hover:text-white">API Keys</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-zinc-500" />
          </div>
        ) : stats ? (
          <>
            {/* Welcome */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                <LayoutDashboard size={24} className="text-emerald-400" />
                Welcome back, {stats.account.name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Here's your YubiAI usage overview &middot; Member for {stats.account.days_active} days
              </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <StatCard icon={MessageSquare} label="Total Chats" value={stats.total_chats} color="emerald" />
              <StatCard icon={TrendingUp} label="Messages Sent" value={stats.user_messages} color="blue" />
              <StatCard icon={Bot} label="AI Responses" value={stats.ai_responses} color="violet" />
              <StatCard icon={Key} label="API Calls" value={stats.total_api_usage} color="amber" />
            </div>

            {/* Activity Chart + Account Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Activity Chart */}
              <div className="lg:col-span-2 p-4 sm:p-6 rounded-xl bg-zinc-800 border border-zinc-700">
                <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 size={18} className="text-emerald-400" /> 7-Day Activity
                </h2>
                <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40">
                  {stats.daily_activity.map((day) => {
                    const height = maxMessages > 0 ? (day.messages / maxMessages) * 100 : 0;
                    const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] sm:text-xs text-zinc-400">{day.messages}</span>
                        <div
                          className="w-full rounded-t-md bg-emerald-500/80 min-h-[4px] transition-all"
                          style={{ height: `${Math.max(height, 3)}%` }}
                        />
                        <span className="text-[10px] sm:text-xs text-zinc-500">{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Account Card */}
              <div className="p-4 sm:p-6 rounded-xl bg-zinc-800 border border-zinc-700">
                <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap size={18} className="text-amber-400" /> Account
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium">
                      {stats.account.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{stats.account.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{stats.account.email}</p>
                    </div>
                  </div>
                  <div className="border-t border-zinc-700 pt-3 space-y-2">
                    <InfoRow label="Plan" value={stats.plan.name} badge />
                    <InfoRow label="Verified" value={stats.account.is_verified ? 'Yes' : 'No'} />
                    <InfoRow label="Auth" value={stats.account.is_google_user ? 'Google' : 'Email'} />
                    <InfoRow label="API Keys" value={`${stats.active_api_keys} active`} />
                  </div>
                  <Link
                    to="/billing"
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CreditCard size={14} /> View Billing <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Chats + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Recent Chats */}
              <div className="lg:col-span-2 p-4 sm:p-6 rounded-xl bg-zinc-800 border border-zinc-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <Clock size={18} className="text-blue-400" /> Recent Chats
                  </h2>
                  <Link to="/chat" className="text-xs text-emerald-400 hover:text-emerald-300">View all</Link>
                </div>
                {stats.recent_chats.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">No chats yet. Start a conversation!</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recent_chats.map((chat) => (
                      <Link
                        key={chat.id}
                        to="/chat"
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-700/50 transition-colors"
                      >
                        <MessageSquare size={16} className="text-zinc-500 flex-shrink-0" />
                        <span className="text-sm text-zinc-300 truncate flex-1">{chat.title}</span>
                        <span className="text-xs text-zinc-600 flex-shrink-0 hidden sm:block">
                          {chat.updated_at ? new Date(chat.updated_at).toLocaleDateString() : ''}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-4 sm:p-6 rounded-xl bg-zinc-800 border border-zinc-700">
                <h2 className="text-base sm:text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <QuickAction to="/chat" icon={MessageSquare} label="New Chat" desc="Start a conversation" />
                  <QuickAction to="/api-keys" icon={Key} label="API Keys" desc="Manage API access" />
                  <QuickAction to="/billing" icon={CreditCard} label="Billing" desc="View usage & plans" />
                  <QuickAction to="/docs" icon={BarChart3} label="Documentation" desc="API reference & guides" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-zinc-500 text-center py-20">Failed to load dashboard. Please try again.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    violet: 'bg-violet-500/10 text-violet-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-zinc-800 border border-zinc-700">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-2 sm:mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-xl sm:text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      {badge ? (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-600 text-white">{value}</span>
      ) : (
        <span className="text-zinc-200">{value}</span>
      )}
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, desc }: {
  to: string;
  icon: React.ElementType;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-700/50 transition-colors group"
    >
      <Icon size={18} className="text-zinc-400 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{desc}</p>
      </div>
      <ArrowRight size={14} className="text-zinc-600 group-hover:text-zinc-400 ml-auto flex-shrink-0" />
    </Link>
  );
}
