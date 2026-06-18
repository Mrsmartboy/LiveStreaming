import { useEffect, useRef, useCallback } from 'react';

export interface TranscriptEntry {
  id: string;
  userId: string;
  userName: string;
  text: string;
  isFinal: boolean;
  time: string;
  isSelf: boolean;
}

interface UseTranscriptOptions {
  sendTranscript: (text: string, isFinal: boolean, userId: string, userName: string) => void;
  sessionId: string;
  userId: string;
  userName: string;
  isEnabled: boolean;
  onTranscript: (entry: TranscriptEntry) => void;
}

// ── Manual Web Speech API types (not in standard TS lib) ──────────────────────
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionConstructor {
  new(): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor;
    webkitSpeechRecognition: ISpeechRecognitionConstructor;
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export function useTranscript({
  sendTranscript,
  userId,
  userName,
  isEnabled,
  onTranscript,
}: UseTranscriptOptions) {
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const sendTranscriptRef = useRef(sendTranscript);
  sendTranscriptRef.current = sendTranscript;

  const startRecognition = useCallback(() => {
    const SpeechRecognitionAPI: ISpeechRecognitionConstructor | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        const isFinal = result.isFinal;
        const entry: TranscriptEntry = {
          id: `${userId}-${Date.now()}-${i}`,
          userId,
          userName,
          text,
          isFinal,
          time: new Date().toISOString(),
          isSelf: true,
        };

        // Show locally immediately
        onTranscript(entry);

        // Broadcast final results to others
        if (isFinal) {
          sendTranscriptRef.current(text, true, userId, userName);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still enabled
      if (recognitionRef.current === recognition && isEnabled) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* ignore */ }
  }, [userId, userName, isEnabled, onTranscript]);

  useEffect(() => {
    if (!isEnabled) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }
    startRecognition();
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [isEnabled, startRecognition]);
}
