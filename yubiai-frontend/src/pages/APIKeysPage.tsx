import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Key, Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight, Loader2, ArrowLeft, Bot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiKeyAPI } from '../services/api';
import type { APIKey } from '../types';

export default function APIKeysPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadKeys();
  }, [user, navigate]);

  const loadKeys = async () => {
    try {
      const res = await apiKeyAPI.list();
      setKeys(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await apiKeyAPI.create(newKeyName.trim());
      setNewKey(res.data.key);
      setNewKeyName('');
      loadKeys();
    } catch (err) { console.error(err); }
    setCreating(false);
  };

  const handleDelete = async (keyId: string) => {
    try {
      await apiKeyAPI.delete(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) { console.error(err); }
  };

  const handleToggle = async (keyId: string) => {
    try {
      await apiKeyAPI.toggle(keyId);
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, is_active: !k.is_active } : k));
    } catch (err) { console.error(err); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="text-zinc-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-emerald-500" />
            <span className="font-semibold">YubiAI</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span className="text-sm text-zinc-400">API Keys</span>
          <div className="flex-1" />
          <Link to="/chat" className="text-sm text-zinc-400 hover:text-white">Chat</Link>
          <Link to="/docs" className="text-sm text-zinc-400 hover:text-white">Docs</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Key size={24} className="text-emerald-400" /> API Keys
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Manage your API keys for programmatic access to YubiAI</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} /> Create Key
          </button>
        </div>

        {/* New Key Created Modal */}
        {newKey && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-emerald-400 font-medium mb-2">API Key Created!</p>
            <p className="text-sm text-zinc-400 mb-3">Copy this key now. You won't be able to see it again.</p>
            <div className="flex items-center gap-2 bg-zinc-800 p-3 rounded-lg">
              <code className="flex-1 text-sm text-zinc-200 font-mono break-all">{newKey}</code>
              <button onClick={() => copyKey(newKey)} className="text-zinc-400 hover:text-white p-1">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="mt-3 text-sm text-zinc-400 hover:text-white">Dismiss</button>
          </div>
        )}

        {/* Create Key Form */}
        {showCreate && !newKey && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-800 border border-zinc-700">
            <form onSubmit={handleCreate} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Key Name</label>
                <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g., My App Key" required />
              </div>
              <button type="submit" disabled={creating}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center gap-2">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">Cancel</button>
            </form>
          </div>
        )}

        {/* Keys List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-zinc-500" /></div>
        ) : keys.length === 0 ? (
          <div className="text-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-800">
            <Key size={48} className="text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No API keys yet</p>
            <p className="text-sm text-zinc-600 mt-1">Create your first key to start using the YubiAI API</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${key.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-200">{key.name}</p>
                  <p className="text-sm text-zinc-500 font-mono">{key.key_preview || key.key}</p>
                </div>
                <div className="text-right text-xs text-zinc-500 hidden sm:block">
                  <p>Used {key.usage_count} times</p>
                  <p>{new Date(key.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(key.id)} className="text-zinc-400 hover:text-white p-1" title={key.is_active ? 'Deactivate' : 'Activate'}>
                    {key.is_active ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => handleDelete(key.id)} className="text-zinc-400 hover:text-red-400 p-1" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Model Info */}
        <div className="mt-12 mb-8">
          <h2 className="text-lg font-bold mb-4">Available Models</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', desc: 'Most capable reasoning model', badge: 'Default' },
              { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Fast & versatile general-purpose', badge: '' },
              { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Ultra-fast lightweight model', badge: 'Fast' },
              { id: 'llama3-8b-8192', name: 'Llama 3 8B', desc: 'Efficient with 8K context', badge: '' },
            ].map((m) => (
              <div key={m.id} className="p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-zinc-200">{m.name}</span>
                  {m.badge && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white">{m.badge}</span>}
                </div>
                <p className="text-xs text-zinc-500">{m.desc}</p>
                <code className="text-[10px] text-zinc-600 mt-1 block">{m.id}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Generation Parameters */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Generation Parameters</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-800 border-b border-zinc-700">
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Parameter</th>
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Default</th>
                  <th className="text-left py-2 px-3 text-zinc-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {[
                  ['message', 'string', 'required', 'The user message to send'],
                  ['model', 'string', '"gpt-oss-120b"', 'AI model to use'],
                  ['system_prompt', 'string', 'null', 'Custom system prompt (overrides default)'],
                  ['conversation_history', 'array', 'null', 'Previous messages for context'],
                  ['temperature', 'float', '0.7', 'Randomness (0.0 = deterministic, 2.0 = creative)'],
                  ['top_p', 'float', '0.9', 'Nucleus sampling threshold'],
                  ['top_k', 'int', '50', 'Top-k sampling (limits vocabulary)'],
                  ['frequency_penalty', 'float', '0.0', 'Penalize repeated tokens (-2.0 to 2.0)'],
                  ['presence_penalty', 'float', '0.0', 'Penalize tokens already present (-2.0 to 2.0)'],
                  ['repetition_penalty', 'float', '1.0', 'Penalize repetition (1.0 = no penalty)'],
                  ['max_tokens', 'int', '2048', 'Max tokens to generate (up to 32768)'],
                  ['min_tokens', 'int', '1', 'Minimum tokens to generate'],
                  ['stop', 'array', 'null', 'Stop sequences (e.g. ["\\nUser:"])'],
                  ['seed', 'int', 'null', 'Random seed for reproducibility'],
                ].map(([param, type, def_, desc]) => (
                  <tr key={param} className="border-b border-zinc-700/50">
                    <td className="py-2 px-3 font-mono text-emerald-300 text-xs">{param}</td>
                    <td className="py-2 px-3 text-xs">{type}</td>
                    <td className="py-2 px-3 text-xs text-zinc-500">{def_}</td>
                    <td className="py-2 px-3 text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Start */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Quick Start</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { lang: 'Python', code: `import requests\n\nAPI_URL = "${window.location.origin}/api/v1/chat"\nAPI_KEY = "YOUR_API_KEY"\n\nresponse = requests.post(\n    API_URL,\n    headers={"Authorization": f"Bearer {API_KEY}"},\n    json={\n        "message": "Hello, Yubi!",\n        "model": "gpt-oss-120b",\n        "temperature": 0.7,\n        "top_p": 0.9,\n        "max_tokens": 2048\n    }\n)\ndata = response.json()\nprint(f"Model: {data['model']}")\nprint(f"Response: {data['response']}")\nprint(f"Tokens: {data['usage']['total_tokens']}")` },
              { lang: 'Node.js', code: `const axios = require('axios');\n\nconst API_URL = '${window.location.origin}/api/v1/chat';\nconst API_KEY = 'YOUR_API_KEY';\n\nconst res = await axios.post(\n  API_URL,\n  {\n    message: 'Hello, Yubi!',\n    model: 'gpt-oss-120b',\n    temperature: 0.7,\n    top_p: 0.9,\n    max_tokens: 2048\n  },\n  { headers: { Authorization: \`Bearer \${API_KEY}\` } }\n);\nconsole.log('Model:', res.data.model);\nconsole.log('Response:', res.data.response);\nconsole.log('Tokens:', res.data.usage.total_tokens);` },
              { lang: 'Python (Custom Prompt)', code: `import requests\n\nAPI_URL = "${window.location.origin}/api/v1/chat"\nAPI_KEY = "YOUR_API_KEY"\n\nresponse = requests.post(\n    API_URL,\n    headers={"Authorization": f"Bearer {API_KEY}"},\n    json={\n        "message": "Explain quantum computing",\n        "model": "llama-3.3-70b-versatile",\n        "system_prompt": "You are a physics professor. Explain concepts clearly.",\n        "temperature": 0.5,\n        "max_tokens": 4096,\n        "frequency_penalty": 0.3,\n        "seed": 42\n    }\n)\nprint(response.json()["response"])` },
              { lang: 'cURL', code: `curl -X POST ${window.location.origin}/api/v1/chat \\\\\n  -H "Content-Type: application/json" \\\\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\\\n  -d '{\n    "message": "Hello, Yubi!",\n    "model": "gpt-oss-120b",\n    "temperature": 0.7,\n    "top_p": 0.9,\n    "max_tokens": 2048\n  }'` },
            ].map((example) => (
              <div key={example.lang} className="rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden">
                <div className="px-4 py-2 bg-zinc-700 text-sm font-medium text-zinc-300">{example.lang}</div>
                <pre className="p-4 text-xs text-zinc-300 overflow-x-auto"><code>{example.code}</code></pre>
              </div>
            ))}
          </div>
        </div>

        {/* Response Format */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Response Format</h2>
          <div className="rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden">
            <div className="px-4 py-2 bg-zinc-700 text-sm font-medium text-zinc-300">JSON Response</div>
            <pre className="p-4 text-xs text-zinc-300 overflow-x-auto"><code>{`{
  "response": "Hello! I'm Yubi, the AI assistant by Devopods...",
  "model": "gpt-oss-120b",
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 42,
    "total_tokens": 67
  }
}`}</code></pre>
          </div>
        </div>
      </div>
    </div>
  );
}
