import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Bot, Sparkles, Mic, Plus, X, FileText, ImageIcon, Square, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { chatAPI, suggestionsAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import VoiceMode from '../components/VoiceMode';
import type { Chat, Message } from '../types';

export default function ChatPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; is_image?: boolean }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([
    'Write a Python function to sort a list',
    'Explain quantum computing simply',
    'Help me write a professional email',
    'Create a React component for a todo app',
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent]);

  const loadChats = useCallback(async () => {
    try {
      const res = await chatAPI.list();
      setChats(res.data);
    } catch (err) {
      console.error('Failed to load chats', err);
    }
    setLoadingChats(false);
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  useEffect(() => {
    suggestionsAPI.get()
      .then((res) => {
        if (res.data.prompts && res.data.prompts.length === 4) {
          setSuggestions(res.data.prompts);
        }
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    try {
      const res = await chatAPI.get(chatId);
      setMessages(res.data.messages);
    } catch (err) {
      console.error('Failed to load chat', err);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInput('');
  };

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatId === chatId) {
      handleNewChat();
    }
  };

  // Image file extensions (will be read as base64 and sent for OCR)
  const IMAGE_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp',
    'heic', 'heif', 'ico',
  ]);

  // Non-readable binary file types (rejected)
  const REJECTED_EXTENSIONS = new Set([
    'mp3', 'mp4', 'avi', 'mov', 'mkv', 'wav', 'flac', 'ogg',
    'zip', 'rar', 'tar', 'gz', '7z', 'bz2',
    'exe', 'dll', 'so', 'dylib', 'bin', 'dat',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
  ]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: { name: string; content: string; is_image?: boolean }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // Reject non-readable binary files
      if (REJECTED_EXTENSIONS.has(ext)) {
        alert(`"${file.name}" is not supported. Only text, code, and image files are accepted.`);
        continue;
      }
      // Max 5MB for images, 512KB for text/code
      const maxSize = IMAGE_EXTENSIONS.has(ext) ? 5 * 1024 * 1024 : 512 * 1024;
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large (max ${IMAGE_EXTENSIONS.has(ext) ? '5MB' : '512KB'})`);
        continue;
      }
      // Max 10 total files
      if (attachedFiles.length + newFiles.length >= 10) {
        alert('Maximum 10 files allowed');
        break;
      }

      try {
        if (IMAGE_EXTENSIONS.has(ext)) {
          // Read image as base64 for OCR
          const base64 = await readFileAsBase64(file);
          newFiles.push({ name: file.name, content: base64, is_image: true });
        } else {
          // Read as text for code/text files
          const text = await file.text();
          if (text.includes('\0')) {
            alert(`"${file.name}" appears to be a binary file.`);
            continue;
          }
          newFiles.push({ name: file.name, content: text });
        }
      } catch {
        alert(`Could not read file "${file.name}"`);
      }
    }
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSend = async (overrideMessage?: string) => {
    const messageToSend = overrideMessage || input.trim();
    if ((!messageToSend && attachedFiles.length === 0) || loading || streaming) return;

    const filesToSend = attachedFiles.length > 0 ? [...attachedFiles] : undefined;
    const displayContent = messageToSend + (filesToSend ? `\n\n📎 ${filesToSend.length} file(s) attached: ${filesToSend.map(f => f.name).join(', ')}` : '');

    if (!overrideMessage) setInput('');
    setAttachedFiles([]);
    setLoading(true);
    setStreamingContent('');
    setSearchStatus(null);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      chat_id: currentChatId || '',
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Use streaming SSE endpoint
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let streamedContent = '';

    try {
      const response = await chatAPI.sendMessageStream(
        messageToSend || 'Analyze these files',
        currentChatId || undefined,
        false,
        filesToSend,
        controller.signal,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setLoading(false);
      setStreaming(true);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let chatId = currentChatId || '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);

            if (event.type === 'chat_info') {
              chatId = event.chat_id;
              if (!currentChatId) {
                setCurrentChatId(chatId);
              }
              setMessages((prev) => prev.map(m =>
                m.id === tempUserMsg.id ? { ...m, chat_id: chatId, id: 'user-' + Date.now() } : m
              ));
            } else if (event.type === 'status') {
              setSearchStatus(event.message || 'Processing...');
            } else if (event.type === 'token') {
              setSearchStatus(null);
              streamedContent += event.content;
              setStreamingContent(streamedContent);
            } else if (event.type === 'done') {
              setMessages((prev) => [
                ...prev,
                {
                  id: event.ai_message_id || 'ai-' + Date.now(),
                  chat_id: chatId,
                  role: 'assistant',
                  content: streamedContent,
                  created_at: new Date().toISOString(),
                },
              ]);
              setStreamingContent('');
              loadChats();
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User stopped generation
        if (streamedContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: 'stopped-' + Date.now(),
              chat_id: currentChatId || '',
              role: 'assistant',
              content: streamedContent + '\n\n*[Generation stopped]*',
              created_at: new Date().toISOString(),
            },
          ]);
        }
        setStreamingContent('');
      } else {
        console.error('Failed to send message', err);
        setMessages((prev) => [
          ...prev,
          {
            id: 'error-' + Date.now(),
            chat_id: currentChatId || '',
            role: 'assistant',
            content: 'Sorry, an error occurred. Please try again.',
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }
    setLoading(false);
    setStreaming(false);
    setSearchStatus(null);
    abortControllerRef.current = null;
  };

  const handleContinue = () => {
    handleSend('Continue');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  return (
    <div className="flex h-screen bg-zinc-900">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={loadChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRefreshChats={loadChats}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-zinc-800 flex items-center justify-center px-4 flex-shrink-0">
          <span className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Bot size={16} className="text-emerald-500" /> YubiAI
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loadingChats ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center mb-6">
                <Sparkles size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-200 mb-2">How can I help you today?</h2>
              <p className="text-zinc-500 text-sm max-w-md text-center mb-8">
                I'm Yubi, your AI assistant by Devopods. Ask me anything - coding, writing, analysis, or just chat.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-300 text-left transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  userName={user?.name}
                  onContinue={idx === messages.length - 1 && !streaming ? handleContinue : undefined}
                />
              ))}
              {/* Streaming AI response (live token-by-token) */}
              {streaming && streamingContent && (
                <ChatMessage
                  message={{
                    id: 'streaming-live',
                    chat_id: currentChatId || '',
                    role: 'assistant',
                    content: streamingContent,
                    created_at: new Date().toISOString(),
                  }}
                  userName={user?.name}
                />
              )}
              {/* Loading / Search status indicator */}
              {(loading || (streaming && !streamingContent)) && (
                <div className="py-5 bg-zinc-800/30">
                  <div className="max-w-3xl mx-auto px-4 flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                      {searchStatus ? (
                        <>
                          <Globe size={16} className="animate-pulse text-emerald-400" />
                          <span className="text-emerald-400">{searchStatus}</span>
                        </>
                      ) : (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Thinking...
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attached files chips */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300"
                  >
                    {file.is_image ? (
                      <ImageIcon size={12} className="text-blue-400 flex-shrink-0" />
                    ) : (
                      <FileText size={12} className="text-emerald-400 flex-shrink-0" />
                    )}
                    <span className="max-w-32 truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-3 bg-zinc-800 rounded-2xl border border-zinc-700 p-3 focus-within:border-zinc-600 transition-colors">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors flex-shrink-0"
                title="Attach files"
              >
                <Plus size={16} className="text-zinc-300" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message YubiAI..."
                rows={1}
                className="flex-1 bg-transparent text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none text-sm leading-6 max-h-48"
              />
              <button
                onClick={() => setVoiceMode(true)}
                className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors flex-shrink-0"
                title="Voice Mode"
              >
                <Mic size={16} className="text-zinc-300" />
              </button>
              {/* Send or Stop button */}
              {streaming ? (
                <button
                  onClick={handleStop}
                  className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors flex-shrink-0"
                  title="Stop generating"
                >
                  <Square size={14} className="text-white" fill="white" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                  className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {loading ? (
                    <Loader2 size={16} className="text-white animate-spin" />
                  ) : (
                    <Send size={16} className="text-white" />
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-600 text-center mt-2">
              YubiAI by Devopods. AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
      {voiceMode && (
        <VoiceMode
          onClose={() => setVoiceMode(false)}
          currentChatId={currentChatId}
          onNewMessage={(userMsg, aiMsg, chatId) => {
            if (!currentChatId) setCurrentChatId(chatId);
            setMessages((prev) => [
              ...prev,
              {
                id: 'voice-user-' + Date.now(),
                chat_id: chatId,
                role: 'user',
                content: userMsg,
                created_at: new Date().toISOString(),
              },
              {
                id: 'voice-ai-' + Date.now(),
                chat_id: chatId,
                role: 'assistant',
                content: aiMsg,
                created_at: new Date().toISOString(),
              },
            ]);
            loadChats();
          }}
        />
      )}
    </div>
  );
}
