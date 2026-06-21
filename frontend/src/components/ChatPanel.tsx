import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../store';

interface ChatPanelProps {
  onSendMessage: (text: string) => void;
}

export default function ChatPanel({ onSendMessage }: ChatPanelProps) {
  const { messages } = useAppSelector((s) => s.chat);
  const { user } = useAppSelector((s) => s.auth);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="font-semibold text-sm text-white">Live Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs my-auto">
            <span className="text-xl mb-1">💬</span>
            <p>Welcome to the chat!</p>
            <p>Send a message to start.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.id;
            const isMentor = msg.role === 'MENTOR' || msg.role === 'ADMIN';

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}
              >
                {/* Author Info */}
                {!isMe && (
                  <span className="text-[10px] text-slate-400 font-medium mb-0.5 ml-1 flex items-center gap-1.5">
                    {msg.userName}
                    {isMentor && (
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[8px] font-bold px-1 rounded-full uppercase tracking-wider">
                        Mentor
                      </span>
                    )}
                  </span>
                )}

                {/* Message Bubble */}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm break-words ${
                    isMe
                      ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-500/10'
                      : isMentor
                      ? 'bg-slate-800 border border-indigo-500/30 text-slate-200 rounded-bl-none'
                      : 'bg-slate-800/80 border border-slate-700/50 text-slate-300 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Timestamp */}
                <span className="text-[9px] text-slate-500 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/40 flex-shrink-0 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message..."
          maxLength={500}
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-2 rounded-xl transition-colors flex items-center justify-center flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
