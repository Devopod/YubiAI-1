import { useState, memo, useMemo } from 'react';
import { Copy, Check, Bot, Volume2, Square, ArrowRight } from 'lucide-react';
import { voiceAPI } from '../services/api';
import { audioManager } from '../services/audioManager';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
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

    // Step 2: Convert LaTeX math notation to $$ / $ for remark-math
    // Handle \[ ... \] → $$ ... $$ (display math)
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `$$${inner}$$`);
    // Handle \( ... \) → $ ... $ (inline math)
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`);
    // Handle standalone [ ... ] with LaTeX content (display math without backslash)
    // Only match if content looks like LaTeX (contains \frac, \int, \sum, \sqrt, etc.)
    processed = processed.replace(/^\[\s*([\s\S]*?)\s*\]$/gm, (_m, inner) => {
      if (/\\(?:frac|int|sum|sqrt|prod|lim|infty|partial|nabla|cdot|text|displaystyle|begin|end|left|right|bigl|bigr|zeta|alpha|beta|gamma|delta|theta|phi|psi|omega|sin|cos|tan|log|ln)/.test(inner)) {
        return `$$${inner}$$`;
      }
      return _m; // Not LaTeX — leave as is
    });
    // Handle inline (\zeta) or (\alpha) etc. → $\zeta$ or $\alpha$
    processed = processed.replace(/\(\\((?:zeta|alpha|beta|gamma|delta|theta|phi|psi|omega|epsilon|lambda|mu|sigma|pi|rho|tau|eta|xi|kappa|nu|chi|iota|upsilon)(?:[^)]*))\)/g, (_m, inner) => `$\\${inner}$`);

    // Step 2b: Catch raw LaTeX lines that aren't wrapped in any delimiters
    // If a line starts with a LaTeX command and contains typical math patterns, wrap in $$
    const latexCommandPattern = /\\(?:frac|int|sum|sqrt|prod|lim|infty|partial|nabla|cdot|text|displaystyle|begin|end|left|right|bigl|bigr|zeta|alpha|beta|gamma|delta|theta|phi|psi|omega|sin|cos|tan|log|ln|vec|hat|bar|dot|ddot|tilde|mathbb|mathcal|mathbf|mathrm|operatorname|binom)/;
    processed = processed.split('\n').map(line => {
      const trimmed = line.trim();
      // Skip lines already in math delimiters, code blocks, or empty
      if (!trimmed || trimmed.startsWith('$') || trimmed.startsWith('```') || trimmed.startsWith('|')) return line;
      // Skip lines that are clearly not math (start with letters/words forming sentences)
      if (/^[A-Za-z]{4,}\s/.test(trimmed) && !latexCommandPattern.test(trimmed)) return line;
      // If the line is predominantly LaTeX (starts with \ command or has multiple LaTeX commands)
      if (latexCommandPattern.test(trimmed)) {
        const commandCount = (trimmed.match(/\\(?:frac|int|sum|sqrt|prod|lim|partial|nabla|cdot|left|right|begin|end|alpha|beta|gamma|delta|theta|phi|psi|omega|sin|cos|tan|log|ln|vec|hat|bar|infty|pm|mp|times|div|neq|leq|geq|approx|equiv|subset|supset|cup|cap|forall|exists|in|notin|mathbb|mathcal|displaystyle|binom|operatorname)/g) || []).length;
        // If the line has 2+ LaTeX commands and isn't already wrapped, wrap as display math
        if (commandCount >= 2 && !trimmed.startsWith('$') && !trimmed.endsWith('$')) {
          // Check it's not inside a sentence (no long English words before the LaTeX)
          const beforeLatex = trimmed.split('\\')[0];
          if (beforeLatex.length < 10 || !/[a-zA-Z]{5,}/.test(beforeLatex)) {
            return `$$${trimmed}$$`;
          }
        }
      }
      return line;
    }).join('\n');

    // Step 3: Auto-linkify plain URLs
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
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
              components={{
                /* ─── HEADINGS ─── */
                h1: ({ children, ...props }) => (
                  <h1 className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-zinc-700" {...props}>{children}</h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-xl font-bold text-white mt-5 mb-2 pb-1.5 border-b border-zinc-700/50" {...props}>{children}</h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props}>{children}</h3>
                ),
                h4: ({ children, ...props }) => (
                  <h4 className="text-base font-semibold text-zinc-200 mt-3 mb-1.5" {...props}>{children}</h4>
                ),
                h5: ({ children, ...props }) => (
                  <h5 className="text-sm font-semibold text-zinc-300 mt-3 mb-1" {...props}>{children}</h5>
                ),
                h6: ({ children, ...props }) => (
                  <h6 className="text-xs font-semibold text-zinc-400 mt-2 mb-1 uppercase tracking-wide" {...props}>{children}</h6>
                ),

                /* ─── PARAGRAPHS ─── */
                p: ({ children, ...props }) => (
                  <p className="my-2 leading-relaxed text-zinc-200" {...props}>{children}</p>
                ),

                /* ─── BOLD / ITALIC / STRIKETHROUGH ─── */
                strong: ({ children, ...props }) => (
                  <strong className="font-bold text-white" {...props}>{children}</strong>
                ),
                em: ({ children, ...props }) => (
                  <em className="italic text-zinc-300" {...props}>{children}</em>
                ),
                del: ({ children, ...props }) => (
                  <del className="line-through text-zinc-500" {...props}>{children}</del>
                ),

                /* ─── LINKS ─── */
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

                /* ─── IMAGES ─── */
                img: ({ src, alt, ...props }) => (
                  <span className="block my-3">
                    <img
                      src={src}
                      alt={alt || 'image'}
                      className="max-w-full h-auto rounded-lg border border-zinc-700 shadow-lg"
                      loading="lazy"
                      {...props}
                    />
                    {alt && alt !== 'image' && (
                      <span className="block text-xs text-zinc-500 mt-1 text-center italic">{alt}</span>
                    )}
                  </span>
                ),

                /* ─── BLOCKQUOTES ─── */
                blockquote: ({ children, ...props }) => (
                  <blockquote
                    className="border-l-4 border-emerald-500 bg-zinc-800/60 pl-4 pr-3 py-2 my-3 rounded-r-lg text-zinc-300 italic"
                    {...props}
                  >
                    {children}
                  </blockquote>
                ),

                /* ─── LISTS ─── */
                ul: ({ children, ...props }) => (
                  <ul className="list-disc list-outside ml-6 my-2 space-y-1 text-zinc-200 marker:text-emerald-500" {...props}>{children}</ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="list-decimal list-outside ml-6 my-2 space-y-1 text-zinc-200 marker:text-emerald-500" {...props}>{children}</ol>
                ),
                li: ({ children, className, ...props }) => {
                  const isTaskItem = className?.includes('task-list-item');
                  return (
                    <li className={`leading-relaxed ${isTaskItem ? 'list-none -ml-6 flex items-start gap-2' : ''}`} {...props}>
                      {children}
                    </li>
                  );
                },

                /* ─── TASK LIST CHECKBOX ─── */
                input: ({ type, checked, ...props }) => {
                  if (type === 'checkbox') {
                    return (
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded border mt-1 flex-shrink-0 ${
                          checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 bg-zinc-800'
                        }`}
                        {...props}
                      >
                        {checked && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    );
                  }
                  return <input type={type} checked={checked} {...props} />;
                },

                /* ─── HORIZONTAL RULE ─── */
                hr: ({ ...props }) => (
                  <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent" {...props} />
                ),

                /* ─── TABLES ─── */
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
                /* ─── CODE (inline + block) ─── */
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  const codeString = String(children).replace(/\n$/, '');
                  return isInline ? (
                    <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-sm text-emerald-300 font-mono" {...props}>
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

                /* ─── PRE (wraps code blocks) ─── */
                pre: ({ children }) => (
                  <div>{children}</div>
                ),

                /* ─── DETAILS / SUMMARY (collapsible) ─── */
                details: ({ children, ...props }) => (
                  <details className="my-3 bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden" {...props}>
                    {children}
                  </details>
                ),
                summary: ({ children, ...props }) => (
                  <summary className="px-4 py-2 cursor-pointer font-semibold text-zinc-200 hover:bg-zinc-700/50 transition-colors select-none" {...props}>
                    {children}
                  </summary>
                ),

                /* ─── SUBSCRIPT / SUPERSCRIPT ─── */
                sub: ({ children, ...props }) => (
                  <sub className="text-xs text-zinc-400" {...props}>{children}</sub>
                ),
                sup: ({ children, ...props }) => (
                  <sup className="text-xs text-emerald-400 ml-0.5" {...props}>{children}</sup>
                ),

                /* ─── KEYBOARD INPUT ─── */
                kbd: ({ children, ...props }) => (
                  <kbd className="inline-block px-2 py-0.5 text-xs font-mono font-semibold text-zinc-300 bg-zinc-700 border border-zinc-600 rounded shadow-sm" {...props}>
                    {children}
                  </kbd>
                ),

                /* ─── MARK (highlight) ─── */
                mark: ({ children, ...props }) => (
                  <mark className="bg-yellow-500/30 text-yellow-200 px-1 rounded" {...props}>{children}</mark>
                ),

                /* ─── ABBREVIATION ─── */
                abbr: ({ children, title, ...props }) => (
                  <abbr className="underline decoration-dotted decoration-zinc-500 cursor-help text-zinc-200" title={title} {...props}>
                    {children}
                  </abbr>
                ),

                /* ─── SECTION / DIV ─── */
                section: ({ children, ...props }) => (
                  <section className="my-2" {...props}>{children}</section>
                ),
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
