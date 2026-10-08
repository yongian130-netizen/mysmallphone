import React, { useState } from 'react';
import {
  Plus,
  Bell,
  CheckCircle2,
  Trash2,
  Play,
  Volume2,
  Sparkles,
  Loader2,
  Search,
  Brain,
  MessageSquare,
} from 'lucide-react';
import {
  Character,
  MemoryCategory,
  MemoryItem,
  Reminder,
  ReminderPriority,
  VoiceEngineOption,
} from '../types';
import { VoiceRecorderButton } from './VoiceRecorderButton';

interface ReminderManagerViewProps {
  reminders: Reminder[];
  memories: MemoryItem[];
  characters: Character[];
  selectedCharacter: Character;
  voiceEngine: VoiceEngineOption;
  onAddReminder: (reminder: Omit<Reminder, 'id' | 'ownerId'>) => Promise<void>;
  onUpdateReminderStatus: (id: string, status: Reminder['status']) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onAddMemory: (memory: Omit<MemoryItem, 'id' | 'ownerId'>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onSpeakText: (text: string, voiceName: Character['voiceName']) => Promise<void>;
  onAskAgentAboutReminder: (reminder: Reminder) => void;
}

export const ReminderManagerView: React.FC<ReminderManagerViewProps> = ({
  reminders,
  memories,
  characters,
  selectedCharacter,
  voiceEngine,
  onAddReminder,
  onUpdateReminderStatus,
  onDeleteReminder,
  onAddMemory,
  onDeleteMemory,
  onSpeakText,
  onAskAgentAboutReminder,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | Reminder['status']>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Reminder Form State
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [title, setTitle] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [dueDateInput, setDueDateInput] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [priority, setPriority] = useState<ReminderPriority>('high');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  // New Memory Form State
  const [showNewMemory, setShowNewMemory] = useState(false);
  const [memCategory, setMemCategory] = useState<MemoryCategory>('problem');
  const [memTitle, setMemTitle] = useState('');
  const [memContent, setMemContent] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  const handleGenerateActionPlan = async (customTitle?: string, customContext?: string) => {
    const targetTitle = (customTitle ?? title).trim();
    if (!targetTitle) return;

    setIsGeneratingPlan(true);
    try {
      const response = await fetch('/api/gemini/generate-action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: targetTitle,
          contextNote: (customContext ?? contextNote).trim(),
          character: selectedCharacter,
        }),
      });
      const data = await response.json();
      if (response.ok && data.actionPlan) {
        setActionPlan(data.actionPlan.slice(0, 2500));
      }
    } catch {
      // Fallback if offline
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !actionPlan.trim()) return;

    setIsSavingReminder(true);
    try {
      const parsedDate = new Date(dueDateInput);
      const validIso = isNaN(parsedDate.getTime())
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : parsedDate.toISOString();

      await onAddReminder({
        title: title.trim().slice(0, 200),
        contextNote: contextNote.trim().slice(0, 1500),
        actionPlan: actionPlan.trim().slice(0, 2500),
        dueAtIso: validIso,
        priority,
        status: 'scheduled',
        characterId: selectedCharacter.id,
      });

      setTitle('');
      setContextNote('');
      setActionPlan('');
      setShowNewReminder(false);
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memTitle.trim() || !memContent.trim()) return;

    setIsSavingMemory(true);
    try {
      await onAddMemory({
        category: memCategory,
        title: memTitle.trim().slice(0, 160),
        content: memContent.trim().slice(0, 2000),
      });
      setMemTitle('');
      setMemContent('');
      setShowNewMemory(false);
    } finally {
      setIsSavingMemory(false);
    }
  };

  const filteredReminders = reminders.filter((rem) => {
    if (filterStatus !== 'all' && rem.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        rem.title.toLowerCase().includes(q) ||
        rem.contextNote.toLowerCase().includes(q) ||
        rem.actionPlan.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto py-6 px-6 space-y-10">
      {/* Section 1: Time-Based Action Reminders */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Action Reminders & Scheduled Protocols
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Schedule what to remember and the exact step-by-step action protocol for what you should do when that time arrives.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <VoiceRecorderButton
              voiceEngine={voiceEngine}
              label="Voice Quick-Reminder"
              onTranscriptReady={async (transcript) => {
                setShowNewReminder(true);
                setTitle(transcript.slice(0, 200));
                setContextNote(`Captured via voice input: "${transcript}"`);
                await handleGenerateActionPlan(transcript.slice(0, 200), transcript);
              }}
            />
            <button
              type="button"
              onClick={() => setShowNewReminder((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Action Reminder</span>
            </button>
          </div>
        </div>

        {showNewReminder && (
          <form
            onSubmit={handleCreateReminder}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Schedule New Action Reminder
              </h2>
              <button
                type="button"
                onClick={() => setShowNewReminder(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  What to Remember (Title)
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Call supplier about Q4 component lead time"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  When (Trigger Date & Time)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dueDateInput}
                  onChange={(e) => setDueDateInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Problem / Context Note
                </label>
                <input
                  type="text"
                  maxLength={1500}
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="Why this matters or key facts you don't want to forget..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Urgency Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ReminderPriority)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Priority</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  On That Time, What Should I Do? (Step-by-Step Action Protocol)
                </label>
                <button
                  type="button"
                  disabled={!title.trim() || isGeneratingPlan}
                  onClick={() => handleGenerateActionPlan()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40"
                >
                  {isGeneratingPlan ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Steps with {selectedCharacter.name.split(' ')[0]}</span>
                </button>
              </div>
              <textarea
                rows={4}
                required
                maxLength={2500}
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                placeholder="1. First concrete action to take when the reminder rings&#10;2. Key question or metric to verify&#10;3. Follow-up confirmation step"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewReminder(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingReminder}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isSavingReminder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Action Reminder</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(
              [
                { id: 'all', label: 'All Reminders' },
                { id: 'scheduled', label: 'Scheduled' },
                { id: 'triggered', label: 'Due / Action Needed' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterStatus === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reminders or actions..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Reminders List */}
        {filteredReminders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <Bell className="w-6 h-6 text-slate-400 mx-auto" />
            <div className="text-sm font-medium text-slate-900">
              No reminders matching the current view
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tell the agent in chat &ldquo;Remind me in 20 minutes to review the pitch deck and tell me what to check&rdquo; or schedule one directly above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReminders.map((rem) => {
              const advisor =
                characters.find((c) => c.id === rem.characterId) || selectedCharacter;
              const isCompleted = rem.status === 'completed';
              const isTriggered = rem.status === 'triggered';

              return (
                <div
                  key={rem.id}
                  className={`bg-white rounded-xl p-5 border transition-colors ${
                    isTriggered
                      ? 'border-amber-500 ring-1 ring-amber-500/20'
                      : isCompleted
                      ? 'border-slate-200 opacity-75'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`font-semibold ${
                            isTriggered
                              ? 'text-red-600'
                              : isCompleted
                              ? 'text-emerald-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {isTriggered
                            ? 'Time Reached — Execute Protocol Now'
                            : isCompleted
                            ? 'Completed'
                            : 'Scheduled'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {new Date(rem.dueAtIso).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">Priority: {rem.priority}</span>
                        <span aria-hidden="true">·</span>
                        <span>Advisor: {advisor.name}</span>
                      </div>

                      <h3
                        className={`text-base font-semibold ${
                          isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {rem.title}
                      </h3>

                      {rem.contextNote && (
                        <p className="text-xs text-slate-600">{rem.contextNote}</p>
                      )}

                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-800 mb-1.5">
                          On That Time — What You Should Do:
                        </div>
                        <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                          {rem.actionPlan}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-end gap-2 shrink-0">
                      {!isCompleted && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUpdateReminderStatus(rem.id, 'completed')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Done</span>
                          </button>

                          {rem.status === 'scheduled' && (
                            <button
                              type="button"
                              onClick={() => onUpdateReminderStatus(rem.id, 'triggered')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Trigger Now</span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onSpeakText(
                            `Reminder: ${rem.title}. Here is what you should do right now: ${rem.actionPlan}`,
                            advisor.voiceName
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Read Protocol</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onAskAgentAboutReminder(rem)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Discuss in Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteReminder(rem.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Persistent Memory Vault */}
      <section className="space-y-5 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Persistent Agent Memory Vault
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Facts, ongoing problems, goals, and routines your AI agent remembers across every conversation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewMemory((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Brain className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Memory Fact</span>
          </button>
        </div>

        {showNewMemory && (
          <form
            onSubmit={handleCreateMemory}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Memory Category
                </label>
                <select
                  value={memCategory}
                  onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="problem">Active Problem</option>
                  <option value="goal">Key Goal</option>
                  <option value="preference">User Preference</option>
                  <option value="routine">Daily Routine</option>
                  <option value="fact">Important Fact</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Summary Label
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={memTitle}
                  onChange={(e) => setMemTitle(e.target.value)}
                  placeholder="e.g., Weekly Sprint Architecture Review"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Detailed Context to Remember
              </label>
              <textarea
                rows={2}
                required
                maxLength={2000}
                value={memContent}
                onChange={(e) => setMemContent(e.target.value)}
                placeholder="Write what the agent should permanently remember when helping you..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewMemory(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingMemory}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Save to Memory
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {memories.map((mem) => (
            <div
              key={mem.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="capitalize font-medium text-blue-600">
                    {mem.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteMemory(mem.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title="Forget memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {mem.title}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {mem.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
