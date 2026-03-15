import { Link } from 'react-router-dom';
import { Bot, Zap, Shield, Code, Globe, Brain, Rocket, ArrowRight, MessageSquare, Key, Book } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold">YubiAI</span>
              <span className="text-xs text-zinc-500 ml-1">by Devopod Private Limited</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/docs" className="text-sm text-zinc-400 hover:text-white transition-colors">Documentation</Link>
              <Link to="/api-keys" className="text-sm text-zinc-400 hover:text-white transition-colors">API</Link>
              {user ? (
                <Link to="/chat" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">
                  Open Chat
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-sm text-zinc-300 hover:text-white transition-colors">Log in</Link>
                  <Link to="/signup" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-6">
            <Zap size={14} /> Powered by Advanced AI
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Meet <span className="text-emerald-400">YubiAI</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The next-generation AI assistant by Devopod Private Limited. Built for developers, creators, and businesses.
            Experience intelligent conversations, code generation, and powerful API access.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={user ? '/chat' : '/signup'}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-lg font-semibold transition-colors flex items-center gap-2">
              {user ? 'Start Chatting' : 'Get Started Free'} <ArrowRight size={20} />
            </Link>
            <Link to="/docs"
              className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-lg font-semibold transition-colors">
              View Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-zinc-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Why Choose YubiAI?</h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Built by Devopod Private Limited, YubiAI combines cutting-edge AI technology with enterprise-grade reliability.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: 'Advanced AI', desc: 'Powered by state-of-the-art language models for intelligent, context-aware conversations.' },
              { icon: Code, title: 'Developer-First API', desc: 'Easy-to-use REST API with SDKs for Python, Node.js, and JavaScript. Build AI into your apps.' },
              { icon: Shield, title: 'Secure & Private', desc: 'Enterprise-grade security with encrypted data, email verification, and OAuth authentication.' },
              { icon: Zap, title: 'Lightning Fast', desc: 'Optimized for speed with streaming responses and efficient token processing.' },
              { icon: Globe, title: 'Multilingual', desc: 'Supports multiple languages including English, Bangla, and Banglish for global reach.' },
              { icon: Rocket, title: 'Scalable', desc: 'From personal projects to enterprise deployments, YubiAI scales with your needs.' },
            ].map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-emerald-500/50 transition-colors">
                <feature.icon size={24} className="text-emerald-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Cards */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Explore YubiAI</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link to={user ? '/chat' : '/signup'} className="group p-8 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-500/30 hover:border-emerald-500/60 transition-all">
              <MessageSquare size={32} className="text-emerald-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">YubiAI Chat</h3>
              <p className="text-zinc-400 text-sm mb-4">ChatGPT-like conversational AI. Ask anything, generate code, get help with writing and analysis.</p>
              <span className="text-emerald-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Try it now <ArrowRight size={14} />
              </span>
            </Link>
            <Link to="/api-keys" className="group p-8 rounded-xl bg-gradient-to-br from-violet-600/20 to-violet-600/5 border border-violet-500/30 hover:border-violet-500/60 transition-all">
              <Key size={32} className="text-violet-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">API Access</h3>
              <p className="text-zinc-400 text-sm mb-4">Generate API keys to integrate YubiAI into your applications. Available for Python, Node.js, and more.</p>
              <span className="text-violet-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Get API Key <ArrowRight size={14} />
              </span>
            </Link>
            <Link to="/docs" className="group p-8 rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-500/30 hover:border-blue-500/60 transition-all">
              <Book size={32} className="text-blue-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">Documentation</h3>
              <p className="text-zinc-400 text-sm mb-4">Comprehensive guides, API reference, and code examples to help you get started quickly.</p>
              <span className="text-blue-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Read Docs <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-20 px-4 bg-zinc-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">About Devopod Private Limited</h2>
          <p className="text-zinc-400 leading-relaxed mb-8">
            Devopod Private Limited is a forward-thinking technology company specializing in artificial intelligence,
            machine learning, and innovative software solutions. Founded by <strong className="text-zinc-200">Ayoob Mohamed Elias</strong>,
            with the AI engineering team led by <strong className="text-zinc-200">Dewan Sakibul Islam</strong>,
            Devopod Private Limited is committed to building cutting-edge AI products that transform how people work and create.
          </p>
          <p className="text-zinc-400 leading-relaxed mb-8">
            YubiAI represents our flagship AI product - a powerful, versatile AI assistant that combines
            natural language understanding, code generation, and knowledge synthesis into a single,
            seamless experience. Our mission is to make advanced AI accessible to everyone.
          </p>
          <div className="grid grid-cols-3 gap-6 mt-12">
            <div className="p-4">
              <p className="text-3xl font-bold text-emerald-400">AI-First</p>
              <p className="text-sm text-zinc-500 mt-1">Technology Company</p>
            </div>
            <div className="p-4">
              <p className="text-3xl font-bold text-emerald-400">Global</p>
              <p className="text-sm text-zinc-500 mt-1">Multilingual Support</p>
            </div>
            <div className="p-4">
              <p className="text-3xl font-bold text-emerald-400">Secure</p>
              <p className="text-sm text-zinc-500 mt-1">Enterprise Grade</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-emerald-500" />
            <span className="font-semibold">YubiAI</span>
            <span className="text-zinc-500 text-sm">by Devopod Private Limited</span>
          </div>
          <p className="text-sm text-zinc-500">&copy; 2026 Devopod Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
