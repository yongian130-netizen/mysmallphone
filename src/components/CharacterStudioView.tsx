import React, { useState } from 'react';
import { Plus, Volume2, Check, Trash2, Edit3, Loader2 } from 'lucide-react';
import { Character, VoiceName } from '../types';
import { PRESET_CHARACTERS } from '../constants';
import { AvatarWithFallback } from './AvatarWithFallback';

interface CharacterStudioViewProps {
  characters: Character[];
  selectedCharacterId: string;
  onSelectCharacter: (id: string) => void;
  onSaveCharacter: (characterData: Omit<Character, 'id' | 'ownerId'>, existingId?: string) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onPreviewVoice: (text: string, voiceName: VoiceName) => Promise<void>;
  isPlayingVoice: boolean;
}

const VOICE_OPTIONS: { name: VoiceName; description: string }[] = [
  { name: 'Kore', description: 'Crisp, composed executive tone' },
  { name: 'Charon', description: 'Deep, methodical analytical voice' },
  { name: 'Zephyr', description: 'Warm, empathetic coaching cadence' },
  { name: 'Fenrir', description: 'Direct, high-energy tactical voice' },
  { name: 'Puck', description: 'Bright, conversational brainstorming voice' },
];

const METHODOLOGY_PRESETS = [
  'First-Principles & Root-Cause Decomposition',
  'Systems Thinking & Bottleneck Analysis',
  'Implementation Intentions (If-When-Then)',
  'OODA Loop & High-Leverage Triage',
  'Socratic Questioning & Cognitive Reframing',
  'Eisenhower Priority Matrix & Timeboxing',
];

export const CharacterStudioView: React.FC<CharacterStudioViewProps> = ({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  onSaveCharacter,
  onDeleteCharacter,
  onPreviewVoice,
  isPlayingVoice,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_CHARACTERS[0].avatarUrl);
  const [personality, setPersonality] = useState('');
  const [methodology, setMethodology] = useState(METHODOLOGY_PRESETS[0]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  const [formError, setFormError] = useState<string | null>(null);

  const startNewCharacter = () => {
    setEditingId(null);
    setIsCreating(true);
    setName('');
    setRole('');
    setAvatarUrl(PRESET_CHARACTERS[0].avatarUrl);
    setPersonality('Analytical, supportive, structured, and focused on clear action steps.');
    setMethodology(METHODOLOGY_PRESETS[0]);
    setSystemPrompt(
      'Help the user break down complex problems into manageable steps, remember key details, and define clear action checklists for scheduled reminders.'
    );
    setVoiceName('Kore');
    setFormError(null);
  };

  const startEditCharacter = (char: Character) => {
    setIsCreating(true);
    setEditingId(char.isPreset ? null : char.id);
    setName(char.isPreset ? `${char.name} (Custom)` : char.name);
    setRole(char.role);
    setAvatarUrl(char.avatarUrl);
    setPersonality(char.personality);
    setMethodology(char.methodology);
    setSystemPrompt(char.systemPrompt);
    setVoiceName(char.voiceName);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim().slice(0, 80);
    const trimmedRole = role.trim().slice(0, 120);
    const trimmedPersonality = personality.trim().slice(0, 500);
    const trimmedMethodology = methodology.trim().slice(0, 160);
    const trimmedPrompt = systemPrompt.trim().slice(0, 3000);
    const trimmedAvatar = avatarUrl.trim().slice(0, 500);

    if (!trimmedName || !trimmedRole || !trimmedPersonality || !trimmedMethodology || !trimmedPrompt) {
      setFormError('Please fill in all required character fields.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveCharacter(
        {
          name: trimmedName,
          role: trimmedRole,
          avatarUrl: trimmedAvatar,
          personality: trimmedPersonality,
          methodology: trimmedMethodology,
          systemPrompt: trimmedPrompt,
          voiceName,
        },
        editingId || undefined
      );
      setIsCreating(false);
      setEditingId(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save character.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Character Persona Studio
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure specialized AI problem-solving personas, reasoning methodologies, and voice synthesis profiles.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewCharacter}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Build New Character</span>
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Custom Character' : 'Create Custom AI Character'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define how this agent approaches your problems and formulates time-based action plans.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Character Name (max 80 chars)
              </label>
              <input
                type="text"
                maxLength={80}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dr. Julian Vance"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Role / Specialization (max 120 chars)
              </label>
              <input
                type="text"
                maxLength={120}
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Decision Architecture & Memory Advisor"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Portrait Avatar Selection
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {PRESET_CHARACTERS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarUrl(preset.avatarUrl)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs transition-colors ${
                    avatarUrl === preset.avatarUrl
                      ? 'border-blue-600 bg-blue-50/50 text-slate-900 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <AvatarWithFallback
                    src={preset.avatarUrl}
                    name={preset.name}
                    sizeClass="w-8 h-8 text-xs"
                  />
                  <span className="pr-1">{preset.name.split(' ')[0]} Portrait</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Problem-Solving Methodology
              </label>
              <select
                value={
                  METHODOLOGY_PRESETS.includes(methodology)
                    ? methodology
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setMethodology(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 mb-2"
              >
                {METHODOLOGY_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
                <option value="custom">Custom Methodology...</option>
              </select>
              <input
                type="text"
                maxLength={160}
                required
                value={methodology}
                onChange={(e) => setMethodology(e.target.value)}
                placeholder="Describe problem-solving framework..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Voice Persona (Gemini TTS)
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value as VoiceName)}
                  className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} — {v.description}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isPlayingVoice}
                  onClick={() =>
                    onPreviewVoice(
                      `Hello, I am ${name || 'your advisor'}. When your reminder triggers, I will walk you through your action plan step by step.`,
                      voiceName
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  {isPlayingVoice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>Test Voice</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Used when reading aloud chat responses or due reminder action plans.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Personality & Communication Style (max 500 chars)
            </label>
            <input
              type="text"
              maxLength={500}
              required
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="e.g., Direct, empathetic, challenges assumptions constructively."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              System Instructions & Directives (max 3000 chars)
            </label>
            <textarea
              rows={4}
              maxLength={3000}
              required
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Detailed instructions for how this character solves problems and structures reminder action checklists..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Save Changes' : 'Create Character'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {characters.map((char) => {
          const isSelected = char.id === selectedCharacterId;
          return (
            <div
              key={char.id}
              className={`bg-white rounded-xl p-5 border transition-colors flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-600 ring-1 ring-blue-600/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <AvatarWithFallback
                      src={char.avatarUrl}
                      name={char.name}
                      sizeClass="w-12 h-12 text-base"
                    />
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {char.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{char.role}</span>
                        <span aria-hidden="true">·</span>
                        <span>Voice: {char.voiceName}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 pt-1">
                  <span className="font-medium text-slate-700">Methodology:</span>{' '}
                  {char.methodology}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {char.systemPrompt}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewVoice(
                        `Hi, I'm ${char.name}, your ${char.role}. How can I help solve your problem today?`,
                        char.voiceName
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Voice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startEditCharacter(char)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{char.isPreset ? 'Clone & Customize' : 'Edit'}</span>
                  </button>

                  {!char.isPreset && (
                    <button
                      type="button"
                      onClick={() => onDeleteCharacter(char.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectCharacter(char.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-100 text-slate-800'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isSelected ? 'Selected Agent' : 'Activate Agent'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
