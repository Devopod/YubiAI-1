import { useState, useEffect } from 'react';
import { X, User, Briefcase, MessageSquare, Sliders, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';
import type { UserProfile } from '../types';

interface PersonalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PersonalizationModal({ isOpen, onClose }: PersonalizationModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nickname, setNickname] = useState('');
  const [occupation, setOccupation] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [tone, setTone] = useState('balanced');
  const [responseStyle, setResponseStyle] = useState('default');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSaved(false);
      authAPI.getProfile()
        .then((res) => {
          const p: UserProfile = res.data;
          setNickname(p.nickname || '');
          setOccupation(p.occupation || '');
          setAboutYou(p.about_you || '');
          setCustomInstructions(p.custom_instructions || '');
          setTone(p.tone || 'balanced');
          setResponseStyle(p.response_style || 'default');
        })
        .catch(() => { /* use defaults */ })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authAPI.updateProfile({
        nickname: nickname || null,
        occupation: occupation || null,
        about_you: aboutYou || null,
        custom_instructions: customInstructions || null,
        tone,
        response_style: responseStyle,
      });
      setSaved(true);
      setTimeout(() => onClose(), 800);
    } catch (err) {
      console.error('Failed to save profile', err);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Personalization</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Set the style and tone of how YubiAI responds to you.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Nickname */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5">
                <User size={14} className="text-emerald-400" /> Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="What should YubiAI call you?"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
              />
            </div>

            {/* Occupation */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5">
                <Briefcase size={14} className="text-emerald-400" /> Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Software Engineer, Student, Designer"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
              />
            </div>

            {/* About You */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5">
                <MessageSquare size={14} className="text-emerald-400" /> More about you
              </label>
              <textarea
                value={aboutYou}
                onChange={(e) => setAboutYou(e.target.value)}
                placeholder="Tell YubiAI about yourself, your interests, projects, or anything that helps personalize responses..."
                rows={3}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm resize-none"
              />
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5">
                <Sliders size={14} className="text-emerald-400" /> Custom instructions
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="How would you like YubiAI to respond? e.g. 'Always explain with examples', 'Use Bangla when I write in Banglish'..."
                rows={3}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm resize-none"
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

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50'
              }`}
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : saved ? (
                'Saved!'
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
