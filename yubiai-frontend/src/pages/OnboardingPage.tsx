import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowRight, Loader2, User, Briefcase, MessageSquare, Sliders, Sparkles } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [nickname, setNickname] = useState('');
  const [occupation, setOccupation] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [tone, setTone] = useState('balanced');
  const [responseStyle, setResponseStyle] = useState('default');

  const handleComplete = async () => {
    setLoading(true);
    try {
      await authAPI.completeOnboarding({
        nickname: nickname || null,
        occupation: occupation || null,
        about_you: aboutYou || null,
        custom_instructions: customInstructions || null,
        tone,
        response_style: responseStyle,
      });
    } catch (err) {
      console.error('Failed to save onboarding', err);
    }
    setLoading(false);
    navigate('/chat');
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await authAPI.completeOnboarding({});
    } catch {
      // skip silently
    }
    setLoading(false);
    navigate('/chat');
  };

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="text-center">
      <div className="w-20 h-20 rounded-2xl bg-emerald-600/20 flex items-center justify-center mx-auto mb-6">
        <Bot size={40} className="text-emerald-400" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">
        Welcome to YubiAI{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
      </h1>
      <p className="text-zinc-400 text-base max-w-md mx-auto mb-8">
        Let's personalize your experience. This helps YubiAI give you better, more relevant responses.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setStep(1)}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          Get started <ArrowRight size={18} />
        </button>
        <button
          onClick={handleSkip}
          disabled={loading}
          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors border border-zinc-700"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Skip for now'}
        </button>
      </div>
    </div>,

    // Step 1: About You
    <div key="about" className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
          <User size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Tell us about yourself</h2>
          <p className="text-sm text-zinc-500">This helps YubiAI personalize responses for you.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="What should YubiAI call you?"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5">
            <Briefcase size={14} /> Occupation
          </label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g. Software Engineer, Student, Designer"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5">
            <MessageSquare size={14} /> More about you
          </label>
          <textarea
            value={aboutYou}
            onChange={(e) => setAboutYou(e.target.value)}
            placeholder="Your interests, projects, tech stack, goals..."
            rows={3}
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setStep(2)}
          className="flex-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Next <ArrowRight size={16} />
        </button>
        <button
          onClick={() => setStep(0)}
          className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-colors text-sm"
        >
          Back
        </button>
      </div>
    </div>,

    // Step 2: Preferences
    <div key="prefs" className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
          <Sliders size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Response preferences</h2>
          <p className="text-sm text-zinc-500">How should YubiAI communicate with you?</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Custom Instructions */}
        <div>
          <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Custom instructions</label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. 'Always explain with examples', 'Use Bangla when I write in Banglish', 'Focus on web development topics'..."
            rows={3}
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none"
          />
        </div>

        {/* Tone */}
        <div>
          <label className="text-sm font-medium text-zinc-300 mb-2 block">Tone</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'balanced', label: 'Balanced', desc: 'Default tone' },
              { value: 'friendly', label: 'Friendly', desc: 'Warm & encouraging' },
              { value: 'professional', label: 'Professional', desc: 'Formal & precise' },
              { value: 'casual', label: 'Casual', desc: 'Relaxed & conversational' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`p-2.5 rounded-lg border text-left transition-all text-sm ${
                  tone === t.value
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Response Style */}
        <div>
          <label className="text-sm font-medium text-zinc-300 mb-2 block">Response style</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'default', label: 'Default' },
              { value: 'concise', label: 'Concise' },
              { value: 'detailed', label: 'Detailed' },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setResponseStyle(s.value)}
                className={`p-2.5 rounded-lg border text-center transition-all text-sm ${
                  responseStyle === s.value
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleComplete}
          disabled={loading}
          className="flex-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Saving...</>
          ) : (
            <><Sparkles size={16} /> Start chatting</>
          )}
        </button>
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-colors text-sm"
        >
          Back
        </button>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicators */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s <= step ? 'w-12 bg-emerald-500' : 'w-8 bg-zinc-700'
                }`}
              />
            ))}
          </div>
        )}
        {steps[step]}
      </div>
    </div>
  );
}
