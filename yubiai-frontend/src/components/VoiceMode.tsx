import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Volume2, VolumeX, Globe, Phone } from 'lucide-react';
import { voiceAPI, chatAPI } from '../services/api';

interface VoiceModeProps {
  onClose: () => void;
  currentChatId: string | null;
  onNewMessage: (userMsg: string, aiMsg: string, chatId: string) => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English', speechCode: 'en-US' },
  { code: 'bn', name: 'Bengali', speechCode: 'bn-BD' },
  { code: 'hi', name: 'Hindi', speechCode: 'hi-IN' },
  { code: 'ur', name: 'Urdu', speechCode: 'ur-PK' },
  { code: 'ar', name: 'Arabic', speechCode: 'ar-SA' },
];

export default function VoiceMode({ onClose, currentChatId, onNewMessage }: VoiceModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatIdRef = useRef<string | null>(currentChatId);
  const isMutedRef = useRef(isMuted);
  const languageRef = useRef(language);
  const onNewMessageRef = useRef(onNewMessage);
  const startListeningRef = useRef<() => void>(() => {});

  useEffect(() => { chatIdRef.current = currentChatId; }, [currentChatId]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  // Timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Stop AI speech
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      try { URL.revokeObjectURL(audioRef.current.src); } catch (e) { /* ignore */ }
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Simple flow: get AI response → speak it → auto-listen again
  const processAndSpeak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setAiResponse('');

    try {
      const res = await chatAPI.sendMessage(text, chatIdRef.current || undefined, true);
      const aiMsg = res.data;
      const responseText = aiMsg.content;
      setAiResponse(responseText);
      onNewMessageRef.current(text, responseText, aiMsg.chat_id);
      chatIdRef.current = aiMsg.chat_id;
      setIsProcessing(false);

      // Speak the response if not muted
      if (!isMutedRef.current) {
        try {
          const audioRes = await voiceAPI.tts(responseText, languageRef.current.code);
          const audioBlob = new Blob([audioRes.data], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);

          if (audioRef.current) {
            audioRef.current.pause();
            try { URL.revokeObjectURL(audioRef.current.src); } catch (e) { /* ignore */ }
          }

          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          setIsSpeaking(true);

          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            // Auto-listen again after AI finishes speaking
            startListeningRef.current();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            startListeningRef.current();
          };
          await audio.play();
        } catch (ttsErr) {
          console.error('TTS error:', ttsErr);
          setIsSpeaking(false);
          startListeningRef.current();
        }
      } else {
        // Muted - auto-listen immediately
        startListeningRef.current();
      }
    } catch (err) {
      console.error('Chat error:', err);
      setAiResponse('Sorry, an error occurred.');
      setIsProcessing(false);
      startListeningRef.current();
    }
  }, []);

  // Simple speech recognition: listen once → user speaks → stops naturally → process
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Single utterance - clean, no duplicates
    recognition.interimResults = true; // Show live feedback while speaking
    recognition.lang = languageRef.current.speechCode;
    recognitionRef.current = recognition;

    let capturedText = '';
    setTranscript('');

    recognition.onresult = (event: any) => {
      const result = event.results[0];
      capturedText = result[0].transcript;
      setTranscript(capturedText);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      // User finished speaking → process immediately
      if (capturedText.trim()) {
        processAndSpeak(capturedText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      }
      // On no-speech or other errors, just stop quietly
    };

    try {
      recognition.start();
      setIsListening(true);
      setError('');
      if (!isActive) setIsActive(true);
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }, [processAndSpeak, isActive]);

  // Keep ref in sync for auto-listen callbacks
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const handleClose = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }
    stopSpeaking();
    setIsActive(false);
    setIsListening(false);
    onClose();
  }, [onClose, stopSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      if (audioRef.current) {
        audioRef.current.pause();
        try { URL.revokeObjectURL(audioRef.current.src); } catch (e) { /* ignore */ }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const pulseClass = isListening
    ? 'animate-pulse shadow-lg shadow-emerald-500/50'
    : isSpeaking
    ? 'animate-pulse shadow-lg shadow-violet-500/50'
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
      >
        <X size={20} />
      </button>

      {/* Language picker */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
        >
          <Globe size={16} />
          {language.name}
        </button>
        {showLangPicker && (
          <div className="absolute top-12 left-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-10">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang);
                  setShowLangPicker(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors ${
                  language.code === lang.code ? 'text-emerald-400 bg-zinc-700/50' : 'text-zinc-300'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/80 border border-zinc-700">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-zinc-300 font-mono text-sm">{formatTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Mute button */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-4 right-16 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        title={isMuted ? 'Unmute AI voice' : 'Mute AI voice'}
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* Status */}
      <div className="mb-8 text-center">
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : isProcessing ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <p className="text-amber-400 text-sm ml-2">Thinking...</p>
          </div>
        ) : isSpeaking ? (
          <p className="text-violet-400 text-sm">Yubi is speaking...</p>
        ) : isListening ? (
          <p className="text-emerald-400 text-sm">Listening...</p>
        ) : isActive ? (
          <p className="text-zinc-400 text-sm">Ready for your next question</p>
        ) : (
          <p className="text-zinc-500 text-sm">Tap the microphone to start talking</p>
        )}
      </div>

      {/* Visualization circle */}
      <div className="relative mb-8">
        <div
          className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? 'bg-emerald-600/20 border-2 border-emerald-500'
              : isSpeaking
              ? 'bg-violet-600/20 border-2 border-violet-500'
              : isProcessing
              ? 'bg-amber-600/20 border-2 border-amber-500'
              : 'bg-zinc-800 border-2 border-zinc-700'
          } ${pulseClass}`}
        >
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-emerald-600/40'
                : isSpeaking
                ? 'bg-violet-600/40'
                : isProcessing
                ? 'bg-amber-600/40'
                : 'bg-zinc-700'
            }`}
          >
            {isSpeaking ? (
              <Volume2 size={36} className="text-violet-300" />
            ) : isProcessing ? (
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            ) : (
              <Mic size={36} className={isListening ? 'text-emerald-300' : 'text-zinc-400'} />
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="mb-4 max-w-lg px-4 text-center">
          <p className="text-xs text-zinc-500 mb-1">You said:</p>
          <p className="text-zinc-200 text-sm" data-voice-transcript>{transcript}</p>
        </div>
      )}

      {/* AI Response */}
      {aiResponse && (
        <div className="mb-8 max-w-lg px-4 text-center">
          <p className="text-xs text-zinc-500 mb-1">Yubi:</p>
          <p className="text-zinc-300 text-sm leading-relaxed max-h-40 overflow-y-auto">{aiResponse}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6">
        {/* Mic button - tap to start listening (disabled during processing/speaking) */}
        <button
          onClick={startListening}
          disabled={isListening || isProcessing || isSpeaking}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
            isListening
              ? 'bg-emerald-600 scale-110 cursor-default'
              : isProcessing || isSpeaking
              ? 'bg-zinc-700 opacity-50 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105'
          }`}
        >
          <Mic size={24} className="text-white" />
        </button>

        {/* Stop speaking button */}
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-violet-600 hover:bg-violet-500 transition-colors"
            title="Stop speaking"
          >
            <VolumeX size={20} className="text-white" />
          </button>
        )}

        {/* End call */}
        <button
          onClick={handleClose}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
          title="End voice mode"
        >
          <Phone size={20} className="text-white rotate-[135deg]" />
        </button>
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        Voice: {language.name} | Powered by Yubi AI
      </p>
    </div>
  );
}
