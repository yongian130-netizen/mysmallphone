import { Character, MemoryItem, Reminder, UserSettings } from './types';
import avatarAria from './assets/images/avatar_strategist_aria_1791452336630.jpg';
import avatarMarcus from './assets/images/avatar_architect_marcus_1791452357770.jpg';
import avatarElena from './assets/images/avatar_coach_elena_1791452373796.jpg';
import avatarKai from './assets/images/avatar_tactician_kai_1791452386737.jpg';

export const PRESET_CHARACTERS: Character[] = [
  {
    id: 'char_aria_strategist',
    ownerId: 'preset',
    name: 'Aria Vance',
    role: 'First-Principles Strategist',
    avatarUrl: avatarAria,
    personality: 'Incisive, structured, calm under pressure, zero-fluff executive clarity.',
    methodology: 'First-Principles & Root-Cause Decomposition',
    systemPrompt:
      'Break complex user problems down into fundamental truths, isolate the core bottleneck, and prescribe a time-bound execution protocol so the user knows exactly what to do and when.',
    voiceName: 'Kore',
    isPreset: true,
  },
  {
    id: 'char_marcus_architect',
    ownerId: 'preset',
    name: 'Marcus Chen',
    role: 'Systems & Technical Problem Solver',
    avatarUrl: avatarMarcus,
    personality: 'Methodical, pragmatic, detail-oriented, focuses on edge cases and reliability.',
    methodology: 'Systems Thinking & Bottleneck Analysis',
    systemPrompt:
      'Help the user debug technical, operational, or workflow problems. Turn vague obstacles into deterministic checklists with verification criteria.',
    voiceName: 'Charon',
    isPreset: true,
  },
  {
    id: 'char_elena_coach',
    ownerId: 'preset',
    name: 'Elena Rostova',
    role: 'Memory & Habit Continuity Coach',
    avatarUrl: avatarElena,
    personality: 'Warm, observant, proactive, keeps track of commitments and cognitive load.',
    methodology: 'Implementation Intentions (If-When-Then)',
    systemPrompt:
      'Act as the user’s external memory cortex. Whenever the user mentions a future task or worry, convert it into a clear "When X time arrives, do steps 1-2-3" protocol to eliminate decision fatigue.',
    voiceName: 'Zephyr',
    isPreset: true,
  },
  {
    id: 'char_kai_tactician',
    ownerId: 'preset',
    name: 'Kai Mercer',
    role: 'Rapid Triage & Decision Advisor',
    avatarUrl: avatarKai,
    personality: 'Direct, high-velocity, prioritizes 80/20 leverage and immediate next actions.',
    methodology: 'OODA Loop & High-Leverage Triage',
    systemPrompt:
      'Cut through overwhelm immediately. When the user is stuck or short on time, give them the single highest-impact action they can complete in the next 15 minutes.',
    voiceName: 'Fenrir',
    isPreset: true,
  },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  ownerId: 'local',
  model: 'gemini-3.1-flash-lite',
  thinkingLevel: 'LOW',
  temperature: 0.7,
  topP: 0.95,
  topK: 64,
  responseStyle: 'balanced',
  autoExtractMemory: true,
  voiceEngine: 'gemini-transcribe',
  autoSpeakResponses: false,
};

export const INITIAL_DEMO_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_demo_1',
    ownerId: 'local',
    category: 'problem',
    title: 'Q4 Product Launch Bottleneck',
    content:
      'Onboarding conversion drops by 38% at step 3 because users have to configure webhooks manually before seeing their first dashboard.',
  },
  {
    id: 'mem_demo_2',
    ownerId: 'local',
    category: 'preference',
    title: 'Deep Work & Meeting Schedule',
    content:
      'Prefers 90-minute uninterrupted engineering blocks before 11:30 AM; schedule review check-ins for late afternoon.',
  },
  {
    id: 'mem_demo_3',
    ownerId: 'local',
    category: 'goal',
    title: 'Cut API P95 Latency Under 180ms',
    content:
      'Target before Friday release: cache frequent tenant lookups and batch database writes.',
  },
];

export const INITIAL_DEMO_REMINDERS: Reminder[] = [
  {
    id: 'rem_demo_1',
    ownerId: 'local',
    title: 'Review Onboarding Step-3 Dropoff Fix',
    contextNote:
      'You wanted to solve the 38% onboarding dropoff before the Thursday product sync.',
    actionPlan:
      '1. Enable the 1-click sample data toggle on staging.\n2. Run 3 test signups without manual webhook setup.\n3. Share the before/after funnel metric in #product-launch.',
    dueAtIso: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    priority: 'high',
    status: 'scheduled',
    characterId: 'char_aria_strategist',
  },
  {
    id: 'rem_demo_2',
    ownerId: 'local',
    title: 'Pre-Release Latency Check & Cache Warmup',
    contextNote: 'Ensure API P95 stays below 180ms during peak traffic window.',
    actionPlan:
      '1. Inspect Redis hit ratio on tenant lookup endpoint.\n2. Verify batch write queue depth is under 50.\n3. Sign off on the release checklist.',
    dueAtIso: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    priority: 'critical',
    status: 'scheduled',
    characterId: 'char_marcus_architect',
  },
];
