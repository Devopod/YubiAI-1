import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, Home, Key, Book, LogOut, Menu, X, Bot, UserX, Settings, LayoutDashboard, CreditCard } from 'lucide-react';
import type { Chat } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { chatAPI, authAPI } from '../services/api';
import PersonalizationModal from './PersonalizationModal';

interface SidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onRefreshChats: () => void;
}

export default function Sidebar({ chats, currentChatId, onSelectChat, onNewChat, onDeleteChat }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setDeletingId(chatId);
    try {
      await chatAPI.delete(chatId);
      onDeleteChat(chatId);
    } catch (err) {
      console.error('Failed to delete chat', err);
    }
    setDeletingId(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-zinc-900 w-64">
      {/* Header */}
      <div className="p-3 border-b border-zinc-700">
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-zinc-600 hover:bg-zinc-800 transition-colors text-sm text-zinc-200"
        >
          <Plus size={16} />
          New chat
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="text-xs text-zinc-500 px-2 py-1 mb-1">Recent</div>
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => { onSelectChat(chat.id); setIsOpen(false); }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left group transition-colors mb-0.5 ${
              currentChatId === chat.id ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <MessageSquare size={14} className="flex-shrink-0 text-zinc-500" />
            <span className="truncate flex-1">{chat.title}</span>
            <button
              onClick={(e) => handleDelete(e, chat.id)}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all p-0.5"
              disabled={deletingId === chat.id}
            >
              <Trash2 size={14} />
            </button>
          </button>
        ))}
        {chats.length === 0 && (
          <p className="text-xs text-zinc-600 px-3 py-4 text-center">No conversations yet</p>
        )}
      </div>

      {/* Navigation */}
      <div className="border-t border-zinc-700 p-2 space-y-0.5">
        <button onClick={() => { navigate('/'); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Home size={16} /> Home
        </button>
        <button onClick={() => { navigate('/dashboard'); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button onClick={() => { navigate('/chat'); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Bot size={16} /> YubiAI Chat
        </button>
        <button onClick={() => { navigate('/api-keys'); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Key size={16} /> API Keys
        </button>
        <button onClick={() => { navigate('/billing'); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <CreditCard size={16} /> Billing
        </button>
        <button onClick={() => { navigate('/docs'); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Book size={16} /> Documentation
        </button>
        <button onClick={() => { setShowPersonalization(true); setIsOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Settings size={16} /> Personalization
        </button>
      </div>

      {/* User */}
      <div className="border-t border-zinc-700 p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{user?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="text-zinc-400 hover:text-red-400 transition-colors p-1" title="Delete Account">
            <UserX size={16} />
          </button>
          <button onClick={logout} className="text-zinc-400 hover:text-red-400 transition-colors p-1" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
        {showDeleteConfirm && (
          <div className="mt-3 p-3 bg-red-950/50 border border-red-800 rounded-lg">
            <p className="text-xs text-red-300 mb-2">Are you sure? This will permanently delete your account and all data.</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setDeletingAccount(true);
                  try {
                    await authAPI.deleteAccount();
                    logout();
                  } catch (err) {
                    console.error('Failed to delete account', err);
                    setDeletingAccount(false);
                  }
                }}
                disabled={deletingAccount}
                className="flex-1 px-2 py-1.5 text-xs bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded transition-colors"
              >
                {deletingAccount ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-2 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <PersonalizationModal isOpen={showPersonalization} onClose={() => setShowPersonalization(false)} />
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors lg:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar */}
      <div className={`fixed left-0 top-0 h-full z-40 transform transition-transform duration-300 lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>
    </>
  );
}
