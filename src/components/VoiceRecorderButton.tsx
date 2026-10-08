import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { VoiceEngineOption } from '../types';

interface VoiceRecorderButtonProps {
  voiceEngine: VoiceEngineOption;
  onTranscriptReady: (transcript: string) => void;
  onError?: (errMessage: string) => void;
  compact?: boolean;
  label?: string;
}

export const VoiceRecorderButton: React.FC<VoiceRecorderButtonProps> = ({
  voiceEngine,
  onTranscriptReady,
  onError,
  compact = false,
  label = 'Voice Input',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startTimer = () => {
    setSeconds(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const startGeminiMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        stopTimer();
        setIsRecording(false);

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType.split(';')[0],
        });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              const base64 = res.split(',')[1] || '';
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          const response = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: mimeType.split(';')[0],
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to transcribe voice audio.');
          }
          if (data.transcript) {
            onTranscriptReady(data.transcript);
          } else {
            onError?.('No speech was detected in the recording.');
          }
        } catch (err) {
          onError?.(
            err instanceof Error
              ? err.message
              : 'Voice transcription failed.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      startTimer();
    } catch (err) {
      onError?.(
        err instanceof Error
          ? `Microphone access error: ${err.message}`
          : 'Could not access microphone. Please check browser permissions.'
      );
    }
  };

  const startBrowserSpeechRecognition = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      // Fallback to Gemini MediaRecorder transcription if Web Speech API is unavailable
      startGeminiMediaRecorder();
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsRecording(true);
        startTimer();
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onTranscriptReady(transcript.trim());
        }
      };

      recognition.onerror = () => {
        stopTimer();
        setIsRecording(false);
        // Fallback to MediaRecorder + Gemini Transcribe if browser speech recognition fails
        startGeminiMediaRecorder();
      };

      recognition.onend = () => {
        stopTimer();
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      startGeminiMediaRecorder();
    }
  };

  const handleToggleRecording = () => {
    if (isTranscribing) return;

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
      stopTimer();
      setIsRecording(false);
      return;
    }

    if (voiceEngine === 'browser-speech') {
      startBrowserSpeechRecognition();
    } else {
      startGeminiMediaRecorder();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggleRecording}
      disabled={isTranscribing}
      title={
        isRecording
          ? 'Stop voice recording'
          : 'Speak your problem or reminder (Voice-to-Text)'
      }
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2 text-xs'
      } ${
        isRecording
          ? 'bg-red-600 text-white hover:bg-red-700'
          : isTranscribing
          ? 'bg-slate-100 text-slate-500 cursor-wait border border-slate-200'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
      }`}
    >
      {isTranscribing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Transcribing...</span>
        </>
      ) : isRecording ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
          <span className="font-mono-tabular">{formatTime(seconds)}</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5 text-slate-600" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
