import { useState, memo, useMemo } from 'react';
import { Copy, Check, Bot, Volume2, Square, ArrowRight } from 'lucide-react';
import { voiceAPI } from '../services/api';
import { audioManager } from '../services/audioManager';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  userName?: string;
  onContinue?: () => void;
}

// Lightweight code block — plain <pre>/<code> instead of heavy Prism tokenizer
function CodeBlock({ language, code, onCopy, isCopied }: {
  language: string;
  code: string;
  onCopy: (code: string) => void;
  isCopied: boolean;
}) {
  return (
    <div className="relative my-3">
      <div className="flex items-center justify-between bg-zinc-700 rounded-t-lg px-4 py-2 text-xs text-zinc-400">
        <span>{language}</span>
        <button
          onClick={() => onCopy(code)}
          className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-[#282c34] rounded-b-lg p-4 overflow-x-auto text-sm leading-relaxed">
        <code className={`language-${language} text-zinc-200`}>
          {code}
        </code>
      </pre>
    </div>
  );
}

function ChatMessageInner({ message, userName, onContinue }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === 'user';

  // Check if response contains [CONTINUE_AVAILABLE] marker
  const showContinue = !isUser && message.content.includes('[CONTINUE_AVAILABLE]');
  const rawContent = message.content.replace(/\[CONTINUE_AVAILABLE\]/g, '').trimEnd();
  
  // Pre-process content: fix tables + auto-linkify URLs
  const displayContent = useMemo(() => {
    // Step 1: Consolidate table rows — merge all consecutive pipe-delimited lines
    // into a single block with no extra blank lines between them.
    const lines = rawContent.split('\n');
    const result: string[] = [];
    const isTableRow = (l: string) => {
      const trimmed = l.trim();
      return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
    };
    const isSeparator = (l: string) => /^\|[\s:|-]+\|$/.test(l.trim());
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (isTableRow(line) || isSeparator(line)) {
        if (!inTable) {
          // Starting a new table — ensure blank line before it
          if (result.length > 0 && result[result.length - 1].trim() !== '') {
            result.push('');
          }
          inTable = true;
        }
        result.push(line);
      } else if (inTable && trimmed === '') {
        // Blank line inside what might be a continued table — peek ahead
        let nextNonEmpty = i + 1;
        while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') {
          nextNonEmpty++;
        }
        if (nextNonEmpty < lines.length && (isTableRow(lines[nextNonEmpty]) || isSeparator(lines[nextNonEmpty]))) {
          // Skip blank lines between table rows — keep them together
          continue;
        } else {
          // Table ended — add blank line after
          inTable = false;
          result.push('');
          result.push(line);
        }
      } else {
        if (inTable) {
          // Table just ended — ensure blank line after
          inTable = false;
          result.push('');
        }
        result.push(line);
      }
    }

    let processed = result.join('\n');

    // Step 2: Auto-linkify plain URLs
    processed = processed.replace(
      /(?<!\]\()(?<!")(?<!\()(?:^|\s)(https?:\/\/[^\s<>)"'\]]+)/gm,
      (match, url) => {
        const leading = match.startsWith(' ') || match.startsWith('\n') ? match[0] : '';
        const cleanUrl = url.trim();
        return `${leading}[${cleanUrl}](${cleanUrl})`;
      }
    );
    return processed;
  }, [rawContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(code);
    setTimeout(() => setCodeCopied(null), 2000);
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      // Stop speaking
      audioManager.stopCurrent();
      return;
    }

    try {
      setIsSpeaking(true);
      // Strip markdown for cleaner speech
      const plainText = message.content
        .replace(/```[\s\S]*?```/g, 'code block')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/#+\s/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n/g, ' ')
        .trim();

      const response = await voiceAPI.tts(plainText, 'en');
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsSpeaking(false);
        audioManager.clear();
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        audioManager.clear();
        URL.revokeObjectURL(audioUrl);
      };

      // Use global audio manager — stops any previous audio before playing
      audioManager.play(audio, () => setIsSpeaking(false));
    } catch {
      setIsSpeaking(false);
    }
  };

  return (
    <div className={`group py-5 ${isUser ? '' : 'bg-zinc-800/30'}`}>
      <div className="max-w-3xl mx-auto px-4 flex gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-emerald-600' : 'bg-violet-600'
        }`}>
          {isUser ? (
            <span className="text-white text-xs font-medium">{userName?.charAt(0)?.toUpperCase() || 'U'}</span>
          ) : (
            <Bot size={16} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-300 mb-1">
            {isUser ? (userName || 'You') : 'YubiAI'}
          </p>
          <div className="text-zinc-200 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-400/50 hover:decoration-emerald-300 transition-colors font-medium break-all"
                    {...props}
                  >
                    {children}
                  </a>
                ),
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-4 rounded-lg border border-zinc-600">
                    <table className="min-w-full border-collapse text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-zinc-700/80" {...props}>{children}</thead>
                ),
                tbody: ({ children, ...props }) => (
                  <tbody className="divide-y divide-zinc-700" {...props}>{children}</tbody>
                ),
                th: ({ children, ...props }) => (
                  <th className="border-b border-zinc-600 px-4 py-2.5 text-left text-xs font-bold text-emerald-400 uppercase tracking-wider" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="px-4 py-2.5 text-zinc-300 border-b border-zinc-700/50" {...props}>
                    {children}
                  </td>
                ),
                tr: ({ children, ...props }) => (
                  <tr className="hover:bg-zinc-700/40 transition-colors even:bg-zinc-800/30" {...props}>{children}</tr>
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  const codeString = String(children).replace(/\n$/, '');
                  return isInline ? (
                    <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-sm text-emerald-300" {...props}>
                      {children}
                    </code>
                  ) : (
                    <CodeBlock
                      language={match[1]}
                      code={codeString}
                      onCopy={handleCodeCopy}
                      isCopied={codeCopied === codeString}
                    />
                  );
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
          {/* Continue button when response was cut off */}
          {!isUser && showContinue && onContinue && (
            <button
              onClick={onContinue}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 rounded-lg text-emerald-400 text-sm font-medium transition-colors"
            >
              <ArrowRight size={14} />
              Continue generating
            </button>
          )}
          {!isUser && (
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleSpeak}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  isSpeaking ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
              >
                {isSpeaking ? <Square size={12} /> : <Volume2 size={12} />}
                {isSpeaking ? 'Stop' : 'Speak'}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// React.memo prevents re-rendering old messages when new ones are added
const ChatMessage = memo(ChatMessageInner, (prev, next) => {
  return prev.message.id === next.message.id && prev.message.content === next.message.content;
});

export default ChatMessage;
