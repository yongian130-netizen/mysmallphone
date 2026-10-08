import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Sliders,
  Mic,
  Cpu,
} from 'lucide-react';
import {
  GeminiModelOption,
  ResponseStyleOption,
  ThinkingLevelOption,
  UserSettings,
  VoiceEngineOption,
} from '../types';
import { DEFAULT_USER_SETTINGS } from '../constants';

interface ApiSettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => Promise<void>;
}

interface ApiStatusResponse {
  ok: boolean;
  configured: boolean;
  defaultModel: string;
  transcriptionModel: string;
  ttsModel: string;
  serverTime: string;
}

export const ApiSettingsView: React.FC<ApiSettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const checkBackendStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/gemini/status');
      const data = await res.json();
      setApiStatus(data);
    } catch {
      setApiStatus(null);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings(localSettings);
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetDefaults = async () => {
    const reset: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ownerId: settings.ownerId,
    };
    setLocalSettings(reset);
    await onUpdateSettings(reset);
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            API & Engine Configuration
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure server-side Gemini reasoning models, sampling parameters, memory extraction, and speech engines.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Server-Side Gemini Endpoint Connection Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {apiStatus?.configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            )}
            <span className="text-sm font-semibold text-slate-900">
              {apiStatus?.configured
                ? 'Server-Side Gemini API Proxy Active'
                : 'Checking Server-Side Gemini API Proxy'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Chat Engine: {localSettings.model}</span>
            <span aria-hidden="true">·</span>
            <span>STT: {apiStatus?.transcriptionModel || 'gemini-3.5-transcribe'}</span>
            <span aria-hidden="true">·</span>
            <span>TTS: {apiStatus?.ttsModel || 'gemini-3.8-flash-lite-tts'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={checkBackendStatus}
          disabled={isCheckingStatus}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`}
          />
          <span>Verify Connection</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Model & Reasoning */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Gemini Model & Reasoning Depth
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Primary Agent Model
              </label>
              <select
                value={localSettings.model}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    model: e.target.value as GeminiModelOption,
                  })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="gemini-3.8-flash">
                  gemini-3.8-flash (Recommended — Reasoning & Speed)
                </option>
                <option value="gemini-3.1-flash-lite">
                  gemini-3.1-flash-lite (Ultra-Low Latency Quick Actions)
                </option>
                <option value="gemini-flash-latest">
                  gemini-flash-latest (Latest Flash Alias)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Thinking Level (Reasoning Budget)
              </label>
              <select
                value={localSettings.thinkingLevel}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    thinkingLevel: e.target.value as ThinkingLevelOption,
                  })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="HIGH">
                  HIGH — Deep multi-step problem decomposition
                </option>
                <option value="LOW">
                  LOW — Fast tactical responses & quick reminders
                </option>
                <option value="MINIMAL">
                  MINIMAL — Instantaneous chat replies
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Response Structure & Verbosity
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  {
                    id: 'concise',
                    title: 'Concise & Direct',
                    desc: 'Short bullet points for rapid execution.',
                  },
                  {
                    id: 'balanced',
                    title: 'Balanced Advisor',
                    desc: 'Clear context plus structured action items.',
                  },
                  {
                    id: 'comprehensive',
                    title: 'Comprehensive Analysis',
                    desc: 'Full root-cause breakdown and contingencies.',
                  },
                ] as { id: ResponseStyleOption; title: string; desc: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setLocalSettings({ ...localSettings, responseStyle: opt.id })
                  }
                  className={`text-left p-3.5 rounded-lg border transition-colors ${
                    localSettings.responseStyle === opt.id
                      ? 'border-blue-600 bg-blue-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">
                    {opt.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Generation Sampling Parameters */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Sampling & Generation Parameters
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">Temperature</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {localSettings.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={localSettings.temperature}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-blue-600"
              />
              <p className="text-xs text-slate-500 mt-1">
                Lower for deterministic plans; higher for creative brainstorming.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">Top-P</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {localSettings.topP.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={localSettings.topP}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    topP: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-blue-600"
              />
              <p className="text-xs text-slate-500 mt-1">
                Nucleus sampling probability threshold.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">Top-K</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {localSettings.topK}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={localSettings.topK}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    topK: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-blue-600"
              />
              <p className="text-xs text-slate-500 mt-1">
                Token candidate pool size per step.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Voice-to-Text & Autonomous Memory */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mic className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Voice-to-Text & Autonomous Extraction
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Voice-to-Text Input Engine
              </label>
              <select
                value={localSettings.voiceEngine}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    voiceEngine: e.target.value as VoiceEngineOption,
                  })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="gemini-transcribe">
                  Gemini 3.5 Audio Transcribe (Server-Side High Accuracy)
                </option>
                <option value="browser-speech">
                  Browser Web Speech API (With Gemini Fallback)
                </option>
              </select>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoExtractMemory}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      autoExtractMemory: e.target.checked,
                    })
                  }
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Auto-Extract Reminders & Memories from Chat
                  </div>
                  <div className="text-xs text-slate-500">
                    Automatically schedule action reminders and store key facts when mentioned in conversation.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoSpeakResponses}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      autoSpeakResponses: e.target.checked,
                    })
                  }
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Auto-Speak Agent Replies (Gemini TTS)
                  </div>
                  <div className="text-xs text-slate-500">
                    Automatically read aloud agent responses using the active character’s voice.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>API & Engine settings saved</span>
            </span>
          )}
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
