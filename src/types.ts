export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface Character {
  id: string;
  ownerId: string;
  name: string;
  role: string;
  avatarUrl: string;
  personality: string;
  methodology: string;
  systemPrompt: string;
  voiceName: VoiceName;
  isPreset?: boolean;
}

export type ReminderPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReminderStatus = 'scheduled' | 'triggered' | 'completed';

export interface Reminder {
  id: string;
  ownerId: string;
  title: string;
  contextNote: string;
  actionPlan: string;
  dueAtIso: string;
  priority: ReminderPriority;
  status: ReminderStatus;
  characterId: string;
}

export type MemoryCategory = 'problem' | 'preference' | 'goal' | 'fact' | 'routine';

export interface MemoryItem {
  id: string;
  ownerId: string;
  category: MemoryCategory;
  title: string;
  content: string;
}

export interface ProblemBreakdown {
  rootCause: string;
  immediateNextStep: string;
  steps: string[];
}

export interface ChatMessage {
  id: string;
  ownerId: string;
  characterId: string;
  role: 'user' | 'assistant';
  content: string;
  timestampIso: string;
  problemBreakdown?: ProblemBreakdown;
  extractedRemindersCount?: number;
  extractedMemoriesCount?: number;
}

export type GeminiModelOption =
  | 'gemini-3.8-flash'
  | 'gemini-3.1-flash-lite'
  | 'gemini-flash-latest';

export type ThinkingLevelOption = 'HIGH' | 'LOW' | 'MINIMAL';
export type ResponseStyleOption = 'concise' | 'balanced' | 'comprehensive';
export type VoiceEngineOption = 'gemini-transcribe' | 'browser-speech';

export interface UserSettings {
  ownerId: string;
  model: GeminiModelOption;
  thinkingLevel: ThinkingLevelOption;
  temperature: number;
  topP: number;
  topK: number;
  responseStyle: ResponseStyleOption;
  autoExtractMemory: boolean;
  voiceEngine: VoiceEngineOption;
  autoSpeakResponses: boolean;
}
