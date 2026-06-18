import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../store';
import { Question } from '../store/slices/questionSlice';

interface QuestionPanelProps {
  questions: Question[];
  isMentor: boolean;
  onSendQuestion: (text: string) => void;
  onAnswerQuestion: (questionId: string) => void;
}

export default function QuestionPanel({
  questions,
  isMentor,
  onSendQuestion,
  onAnswerQuestion,
}: QuestionPanelProps) {
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'unanswered'>('unanswered');
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = filter === 'unanswered' ? questions.filter((q) => !q.answered) : questions;
  const unansweredCount = questions.filter((q) => !q.answered).length;

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSendQuestion(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-sm text-white">Q&A</span>
          {unansweredCount > 0 && (
            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unansweredCount}
            </span>
          )}
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-800/60 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('unanswered')}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${filter === 'unanswered' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${filter === 'all' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All ({questions.length})
          </button>
        </div>
      </div>

      {/* Question List */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500">
            <svg className="w-10 h-10 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No questions yet</p>
          </div>
        ) : (
          filtered.map((q) => (
            <div
              key={q.id}
              className={`rounded-xl p-3 border transition-all duration-200 animate-fade-in ${
                q.answered
                  ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
                  : 'bg-slate-800/60 border-slate-700/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[9px] font-bold">
                        {q.user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-indigo-400 text-xs font-medium truncate">{q.user?.name}</span>
                    <span className="text-slate-600 text-xs">
                      {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed">{q.text}</p>
                </div>

                {/* Mentor: mark answered button */}
                {isMentor && !q.answered && (
                  <button
                    onClick={() => onAnswerQuestion(q.id)}
                    className="flex-shrink-0 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg p-1.5 transition-all duration-150"
                    title="Mark as answered"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
              </div>

              {q.answered && (
                <div className="mt-2 flex items-center gap-1 text-emerald-500 text-xs font-medium">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Answered
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input (Students only) */}
      {!isMentor && (
        <div className="p-3 border-t border-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              maxLength={500}
              className="flex-1 bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-all duration-150 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
