import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Send, Bot, User, Loader2, Zap } from 'lucide-react';
import clsx from 'clsx';

const SUGGESTED_QUESTIONS = [
  'What does the heatmap tell us about the affected region?',
  'What are the next recommended diagnostic steps?',
  'How confident should we be in this result?',
  'What are the treatment options for this finding?',
];

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (question: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, onSend, isLoading, disabled,
}) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || isLoading || disabled) return;
    onSend(q);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20
                        flex items-center justify-center">
          <Zap size={14} className="text-accent-cyan" />
        </div>
        <div>
          <p className="font-body font-medium text-sm text-white">Clinical Q&A</p>
          <p className="font-mono text-xs text-slate-500">Powered by RAG + LLM</p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-accent-teal animate-pulse-slow" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
        {messages.length === 0 && !disabled && (
          <div className="space-y-2">
            <p className="font-mono text-xs text-slate-500 mb-3">Suggested questions</p>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => onSend(q)}
                className="w-full text-left p-3 rounded-lg border border-bg-border bg-bg-elevated
                           hover:border-accent-cyan/30 hover:bg-accent-cyan/5 transition-all group"
              >
                <p className="font-body text-xs text-slate-400 group-hover:text-slate-300 leading-relaxed">
                  {q}
                </p>
              </button>
            ))}
          </div>
        )}

        {disabled && messages.length === 0 && (
          <div className="text-center py-8">
            <p className="font-body text-sm text-slate-500">
              Complete an analysis to start the clinical Q&A
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={clsx(
              'flex gap-3 animate-fade-up',
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {/* Avatar */}
            <div className={clsx(
              'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
              msg.role === 'user'
                ? 'bg-accent-cyan/10 border border-accent-cyan/20'
                : 'bg-accent-teal/10 border border-accent-teal/20'
            )}>
              {msg.role === 'user'
                ? <User size={12} className="text-accent-cyan" />
                : <Bot size={12} className="text-accent-teal" />}
            </div>

            {/* Bubble */}
            <div className={clsx(
              'max-w-[85%] rounded-xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-accent-cyan/10 border border-accent-cyan/15 text-slate-200'
                : 'bg-bg-elevated border border-bg-border text-slate-300'
            )}>
              <p className="font-body text-sm leading-relaxed">{msg.content}</p>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-bg-border space-y-1">
                  {msg.sources.map((s: { source: string }, i: number) => (
                    <p key={i} className="font-mono text-[10px] text-slate-500">
                      ↗ {s.source}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 animate-fade-up">
            <div className="w-7 h-7 rounded-lg bg-accent-teal/10 border border-accent-teal/20
                            flex items-center justify-center">
              <Bot size={12} className="text-accent-teal" />
            </div>
            <div className="bg-bg-elevated border border-bg-border rounded-xl px-4 py-3">
              <Loader2 size={14} className="text-accent-teal animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={disabled ? 'Run analysis first…' : 'Ask about this scan…'}
          disabled={disabled || isLoading}
          className="flex-1 bg-bg-elevated border border-bg-border rounded-xl px-4 py-3
                     font-body text-sm text-slate-300 placeholder-slate-600
                     focus:outline-none focus:border-accent-cyan/50 focus:bg-bg-base
                     transition-all disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || disabled}
          className="w-11 h-11 rounded-xl bg-accent-cyan/15 border border-accent-cyan/30
                     flex items-center justify-center text-accent-cyan
                     hover:bg-accent-cyan/25 transition-all
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
