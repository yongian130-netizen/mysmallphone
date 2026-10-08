import React, { useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Send,
  Volume2,
  Bell,
  CheckCircle2,
  Clock,
  Brain,
  Sparkles,
  Trash2,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Play,
  AlertTriangle,
} from 'lucide-react';
import {
  auth,
  db,
  signInWithGoogle,
  logOutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  Character,
  ChatMessage,
  MemoryCategory,
  MemoryItem,
  Reminder,
  ReminderPriority,
  UserSettings,
  VoiceName,
} from './types';
import {
  PRESET_CHARACTERS,
  DEFAULT_USER_SETTINGS,
  INITIAL_DEMO_MEMORIES,
  INITIAL_DEMO_REMINDERS,
} from './constants';
import { AvatarWithFallback } from './components/AvatarWithFallback';
import { VoiceRecorderButton } from './components/VoiceRecorderButton';
import { CharacterStudioView } from './components/CharacterStudioView';
import { ReminderManagerView } from './components/ReminderManagerView';
import { ApiSettingsView } from './components/ApiSettingsView';

type ActiveTab = 'chat' | 'reminders' | 'characters' | 'settings';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'id_default';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Application State
  const [customCharacters, setCustomCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    PRESET_CHARACTERS[0].id
  );
  const [reminders, setReminders] = useState<Reminder[]>(INITIAL_DEMO_REMINDERS);
  const [memories, setMemories] = useState<MemoryItem[]>(INITIAL_DEMO_MEMORIES);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome_1',
      ownerId: 'local',
      characterId: PRESET_CHARACTERS[0].id,
      role: 'assistant',
      content:
        'Welcome to ChronoMind. I am Aria Vance, your First-Principles Strategist. Tell me a problem you are working through, or tell me something to remember for a specific time—I will schedule the reminder and prepare a concrete checklist of what you should do when that time arrives.',
      timestampIso: new Date().toISOString(),
      problemBreakdown: {
        rootCause: 'Cognitive overload from tracking unscheduled tasks and unstructured problems simultaneously.',
        immediateNextStep: 'Share your top bottleneck or speak a voice reminder using the microphone button below.',
        steps: [
          'Describe or speak the problem or upcoming deadline.',
          'Review the root-cause breakdown and scheduled action protocol.',
          'Execute the step-by-step checklist when the timer triggers.',
        ],
      },
    },
  ]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  // Chat Input & Interaction State
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [checkedStepsMap, setCheckedStepsMap] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const allCharacters = [...PRESET_CHARACTERS, ...customCharacters];
  const selectedCharacter =
    allCharacters.find((c) => c.id === selectedCharacterId) || PRESET_CHARACTERS[0];

  // 1. Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Listeners when authenticated
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const uid = user.uid;

    // Characters listener
    const charQuery = query(
      collection(db, 'characters'),
      where('ownerId', '==', uid)
    );
    const unsubChars = onSnapshot(
      charQuery,
      (snap) => {
        const list: Character[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            name: data.name,
            role: data.role,
            avatarUrl: data.avatarUrl,
            personality: data.personality,
            methodology: data.methodology,
            systemPrompt: data.systemPrompt,
            voiceName: data.voiceName,
            isPreset: false,
          };
        });
        setCustomCharacters(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'characters')
    );

    // Reminders listener
    const remQuery = query(
      collection(db, 'reminders'),
      where('ownerId', '==', uid)
    );
    const unsubRems = onSnapshot(
      remQuery,
      (snap) => {
        if (snap.empty) return;
        const list: Reminder[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            title: data.title,
            contextNote: data.contextNote,
            actionPlan: data.actionPlan,
            dueAtIso: data.dueAtIso,
            priority: data.priority,
            status: data.status,
            characterId: data.characterId,
          };
        });
        list.sort(
          (a, b) =>
            new Date(a.dueAtIso).getTime() - new Date(b.dueAtIso).getTime()
        );
        setReminders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reminders')
    );

    // Memories listener
    const memQuery = query(
      collection(db, 'memories'),
      where('ownerId', '==', uid)
    );
    const unsubMems = onSnapshot(
      memQuery,
      (snap) => {
        if (snap.empty) return;
        const list: MemoryItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            category: data.category,
            title: data.title,
            content: data.content,
          };
        });
        setMemories(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'memories')
    );

    // Messages listener
    const msgQuery = query(
      collection(db, 'messages'),
      where('ownerId', '==', uid)
    );
    const unsubMsgs = onSnapshot(
      msgQuery,
      (snap) => {
        if (snap.empty) return;
        const list: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data();
          const createdMillis = data.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : Date.now();
          return {
            id: d.id,
            ownerId: data.ownerId,
            characterId: data.characterId,
            role: data.role,
            content: data.content,
            timestampIso: new Date(createdMillis).toISOString(),
          };
        });
        list.sort(
          (a, b) =>
            new Date(a.timestampIso).getTime() -
            new Date(b.timestampIso).getTime()
        );
        setMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'messages')
    );

    // UserSettings listener
    const settingsDocRef = doc(db, 'userSettings', uid);
    const unsubSettings = onSnapshot(
      settingsDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            ownerId: data.ownerId,
            model: data.model,
            thinkingLevel: data.thinkingLevel,
            temperature: data.temperature,
            topP: data.topP,
            topK: data.topK,
            responseStyle: data.responseStyle,
            autoExtractMemory: data.autoExtractMemory,
            voiceEngine: data.voiceEngine,
            autoSpeakResponses: data.autoSpeakResponses,
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `userSettings/${uid}`)
    );

    return () => {
      unsubChars();
      unsubRems();
      unsubMems();
      unsubMsgs();
      unsubSettings();
    };
  }, [authReady, user]);

  // 3. Live 1-Second Clock & Automatic Reminder Time Trigger Check
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentMillis = Date.now();
      setNowTick(currentMillis);

      reminders.forEach((rem) => {
        if (rem.status === 'scheduled') {
          const dueMillis = new Date(rem.dueAtIso).getTime();
          if (!isNaN(dueMillis) && currentMillis >= dueMillis) {
            handleUpdateReminderStatus(rem.id, 'triggered');
          }
        }
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reminders, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Speech Synthesis (Gemini TTS)
  const handleSpeakText = async (text: string, voiceName: VoiceName) => {
    if (isPlayingVoice) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlayingVoice(false);
      return;
    }

    setIsPlayingVoice(true);
    try {
      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.slice(0, 1000),
          voiceName,
          style: 'Clear, calm, and structured advisor',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'Speech synthesis unavailable.');
      }

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      currentAudioRef.current = audio;
      audio.onended = () => {
        setIsPlayingVoice(false);
        currentAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingVoice(false);
        currentAudioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      setIsPlayingVoice(false);
      setErrorBanner(
        err instanceof Error ? err.message : 'Could not play speech audio.'
      );
    }
  };

  // CRUD Handlers (Dual Local + Firestore Sync)
  const handleSaveCharacter = async (
    charData: Omit<Character, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    const id = existingId
      ? sanitizeId(existingId)
      : sanitizeId(`char_${Date.now()}`);

    if (user && user.emailVerified) {
      const path = `characters/${id}`;
      try {
        if (existingId) {
          await updateDoc(doc(db, 'characters', id), {
            name: charData.name.slice(0, 80),
            role: charData.role.slice(0, 120),
            avatarUrl: charData.avatarUrl.slice(0, 500),
            personality: charData.personality.slice(0, 500),
            methodology: charData.methodology.slice(0, 160),
            systemPrompt: charData.systemPrompt.slice(0, 3000),
            voiceName: charData.voiceName,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'characters', id), {
            ownerId: user.uid,
            name: charData.name.slice(0, 80),
            role: charData.role.slice(0, 120),
            avatarUrl: charData.avatarUrl.slice(0, 500),
            personality: charData.personality.slice(0, 500),
            methodology: charData.methodology.slice(0, 160),
            systemPrompt: charData.systemPrompt.slice(0, 3000),
            voiceName: charData.voiceName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          existingId ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    } else {
      const newChar: Character = {
        ...charData,
        id,
        ownerId: 'local',
        isPreset: false,
      };
      setCustomCharacters((prev) =>
        existingId
          ? prev.map((c) => (c.id === existingId ? newChar : c))
          : [...prev, newChar]
      );
    }
    setSelectedCharacterId(id);
  };

  const handleDeleteCharacter = async (id: string) => {
    if (user && user.emailVerified) {
      try {
        await deleteDoc(doc(db, 'characters', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `characters/${id}`);
      }
    } else {
      setCustomCharacters((prev) => prev.filter((c) => c.id !== id));
    }
    if (selectedCharacterId === id) {
      setSelectedCharacterId(PRESET_CHARACTERS[0].id);
    }
  };

  const handleAddReminder = async (
    remData: Omit<Reminder, 'id' | 'ownerId'>
  ) => {
    const id = sanitizeId(`rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const validPriority: ReminderPriority = ['low', 'medium', 'high', 'critical'].includes(
      remData.priority
    )
      ? remData.priority
      : 'high';

    if (user && user.emailVerified) {
      try {
        await setDoc(doc(db, 'reminders', id), {
          ownerId: user.uid,
          title: remData.title.slice(0, 200),
          contextNote: (remData.contextNote || '').slice(0, 1500),
          actionPlan: remData.actionPlan.slice(0, 2500),
          dueAtIso: remData.dueAtIso.slice(0, 64),
          priority: validPriority,
          status: remData.status,
          characterId: sanitizeId(remData.characterId || selectedCharacter.id),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reminders/${id}`);
      }
    } else {
      setReminders((prev) => [
        ...prev,
        {
          ...remData,
          id,
          ownerId: 'local',
          priority: validPriority,
        },
      ]);
    }
  };

  const handleUpdateReminderStatus = async (
    id: string,
    status: Reminder['status']
  ) => {
    const target = reminders.find((r) => r.id === id);
    if (!target || target.status === 'completed' || target.status === status) return;

    // Optimistically update local state immediately to prevent duplicate interval triggers
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );

    if (user && user.emailVerified && target.ownerId === user.uid) {
      try {
        await updateDoc(doc(db, 'reminders', id), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `reminders/${id}`);
      }
    }
  };

  const handleSnoozeReminder = async (id: string, minutes = 10) => {
    const target = reminders.find((r) => r.id === id);
    if (!target || target.status === 'completed') return;
    const newDueIso = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, dueAtIso: newDueIso, status: 'scheduled' } : r
      )
    );

    if (user && user.emailVerified && target.ownerId === user.uid) {
      try {
        await updateDoc(doc(db, 'reminders', id), {
          title: target.title,
          contextNote: target.contextNote,
          actionPlan: target.actionPlan,
          dueAtIso: newDueIso,
          priority: target.priority,
          status: 'scheduled',
          characterId: target.characterId,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `reminders/${id}`);
      }
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const target = reminders.find((r) => r.id === id);
    setReminders((prev) => prev.filter((r) => r.id !== id));

    if (user && user.emailVerified && target?.ownerId === user.uid) {
      try {
        await deleteDoc(doc(db, 'reminders', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `reminders/${id}`);
      }
    }
  };

  const handleAddMemory = async (
    memData: Omit<MemoryItem, 'id' | 'ownerId'>
  ) => {
    const id = sanitizeId(`mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const validCat: MemoryCategory = [
      'problem',
      'preference',
      'goal',
      'fact',
      'routine',
    ].includes(memData.category)
      ? memData.category
      : 'fact';

    if (user && user.emailVerified) {
      try {
        await setDoc(doc(db, 'memories', id), {
          ownerId: user.uid,
          category: validCat,
          title: memData.title.slice(0, 160),
          content: memData.content.slice(0, 2000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `memories/${id}`);
      }
    } else {
      setMemories((prev) => [
        {
          ...memData,
          category: validCat,
          id,
          ownerId: 'local',
        },
        ...prev,
      ]);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    const target = memories.find((m) => m.id === id);
    setMemories((prev) => prev.filter((m) => m.id !== id));

    if (user && user.emailVerified && target?.ownerId === user.uid) {
      try {
        await deleteDoc(doc(db, 'memories', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `memories/${id}`);
      }
    }
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    if (user && user.emailVerified) {
      const uid = user.uid;
      try {
        await setDoc(doc(db, 'userSettings', uid), {
          ownerId: uid,
          model: newSettings.model,
          thinkingLevel: newSettings.thinkingLevel,
          temperature: Number(newSettings.temperature),
          topP: Number(newSettings.topP),
          topK: Math.round(Number(newSettings.topK)),
          responseStyle: newSettings.responseStyle,
          autoExtractMemory: Boolean(newSettings.autoExtractMemory),
          voiceEngine: newSettings.voiceEngine,
          autoSpeakResponses: Boolean(newSettings.autoSpeakResponses),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `userSettings/${uid}`);
      }
    }
  };

  // Send Message to AI Agent
  const handleSendMessage = async (overrideMessage?: string) => {
    const textToSend = (overrideMessage ?? chatInput).trim();
    if (!textToSend || isSending) return;

    setErrorBanner(null);
    if (!overrideMessage) setChatInput('');

    const userMsgId = sanitizeId(`msg_${Date.now()}_u`);
    const userMsg: ChatMessage = {
      id: userMsgId,
      ownerId: user?.uid || 'local',
      characterId: selectedCharacter.id,
      role: 'user',
      content: textToSend.slice(0, 8000),
      timestampIso: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);

    if (user && user.emailVerified) {
      try {
        await setDoc(doc(db, 'messages', userMsgId), {
          ownerId: user.uid,
          characterId: sanitizeId(selectedCharacter.id),
          role: 'user',
          content: userMsg.content,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `messages/${userMsgId}`);
      }
    }

    setIsSending(true);
    try {
      const characterHistory = messages
        .filter((m) => m.characterId === selectedCharacter.id)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: characterHistory,
          character: selectedCharacter,
          memories,
          reminders,
          settings,
          currentLocalTime: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get a response from the agent.');
      }

      let extractedRemCount = 0;
      let extractedMemCount = 0;

      if (
        settings.autoExtractMemory &&
        Array.isArray(data.extractedReminders) &&
        data.extractedReminders.length > 0
      ) {
        for (const rem of data.extractedReminders) {
          if (rem.title && rem.actionPlan) {
            const parsedDate = new Date(rem.dueAtIso);
            const validDueIso = isNaN(parsedDate.getTime())
              ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
              : parsedDate.toISOString();

            await handleAddReminder({
              title: rem.title,
              contextNote: rem.contextNote || '',
              actionPlan: rem.actionPlan,
              dueAtIso: validDueIso,
              priority: (rem.priority as ReminderPriority) || 'high',
              status: 'scheduled',
              characterId: selectedCharacter.id,
            });
            extractedRemCount++;
          }
        }
      }

      if (
        settings.autoExtractMemory &&
        Array.isArray(data.extractedMemories) &&
        data.extractedMemories.length > 0
      ) {
        for (const mem of data.extractedMemories) {
          if (mem.title && mem.content) {
            await handleAddMemory({
              category: (mem.category as MemoryCategory) || 'fact',
              title: mem.title,
              content: mem.content,
            });
            extractedMemCount++;
          }
        }
      }

      const assistantMsgId = sanitizeId(`msg_${Date.now()}_a`);
      const replyContent =
        data.reply ||
        'I have processed your request and updated your action reminders.';

      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        ownerId: user?.uid || 'local',
        characterId: selectedCharacter.id,
        role: 'assistant',
        content: replyContent.slice(0, 8000),
        timestampIso: new Date().toISOString(),
        problemBreakdown: data.hasProblemBreakdown
          ? data.problemBreakdown
          : undefined,
        extractedRemindersCount: extractedRemCount,
        extractedMemoriesCount: extractedMemCount,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (user && user.emailVerified) {
        try {
          await setDoc(doc(db, 'messages', assistantMsgId), {
            ownerId: user.uid,
            characterId: sanitizeId(selectedCharacter.id),
            role: 'assistant',
            content: assistantMsg.content,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `messages/${assistantMsgId}`
          );
        }
      }

      if (settings.autoSpeakResponses) {
        handleSpeakText(replyContent, selectedCharacter.voiceName);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while communicating with the agent.'
      );
    } finally {
      setIsSending(false);
    }
  };

  // Format Countdown Helper
  const formatCountdown = (dueAtIso: string) => {
    const diffMs = new Date(dueAtIso).getTime() - nowTick;
    if (isNaN(diffMs)) return 'Scheduled';
    if (diffMs <= 0) return 'Due now';

    const totalSec = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 24) {
      const days = Math.floor(hrs / 24);
      return `in ${days}d ${hrs % 24}h`;
    }
    if (hrs > 0) {
      return `in ${hrs}h ${mins}m`;
    }
    return `in ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const triggeredReminders = reminders.filter((r) => r.status === 'triggered');
  const scheduledReminders = reminders.filter((r) => r.status === 'scheduled');
  const characterMessages = messages.filter(
    (m) => m.characterId === selectedCharacter.id
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: Strictly 3 Zones */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Single Text Element Brand Wordmark */}
        <a
          href="#chat"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('chat');
          }}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          ChronoMind
        </a>

        {/* Zone 2: 4 Clean Text Navigation Links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#chat"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('chat');
            }}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'chat'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Agent Chat
          </a>
          <a
            href="#reminders"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('reminders');
            }}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'reminders'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Action Reminders ({scheduledReminders.length + triggeredReminders.length})
          </a>
          <a
            href="#characters"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('characters');
            }}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'characters'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Character Studio
          </a>
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('settings');
            }}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'settings'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            API Settings
          </a>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <button
              type="button"
              onClick={logOutUser}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">
                {user.displayName || 'Synced Account'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Sync</span>
            </button>
          )}
        </div>
      </header>

      {/* Live Triggered Reminder Action Alert Drawer ("On That Time What Should I Do") */}
      {triggeredReminders.length > 0 && (
        <div className="bg-amber-50/90 border-b border-amber-300 px-6 py-4">
          <div className="max-w-7xl mx-auto space-y-3">
            {triggeredReminders.map((rem) => {
              const advisor =
                allCharacters.find((c) => c.id === rem.characterId) ||
                selectedCharacter;
              const actionLines = rem.actionPlan
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);

              return (
                <div
                  key={rem.id}
                  className="bg-white border border-amber-300 rounded-xl p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-amber-800">
                        Scheduled Time Reached — Action Protocol Ready
                      </span>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span className="text-slate-600">
                        Prepared by {advisor.name}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {rem.title}
                    </h3>

                    {rem.contextNote && (
                      <p className="text-xs text-slate-600">{rem.contextNote}</p>
                    )}

                    <div className="pt-2">
                      <div className="text-xs font-semibold text-slate-800 mb-2">
                        What You Should Do Right Now (Check off as you execute):
                      </div>
                      <div className="space-y-1.5">
                        {actionLines.map((line, idx) => {
                          const stepKey = `${rem.id}_step_${idx}`;
                          const isChecked = Boolean(checkedStepsMap[stepKey]);
                          return (
                            <label
                              key={stepKey}
                              className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 cursor-pointer text-xs text-slate-800 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setCheckedStepsMap((prev) => ({
                                    ...prev,
                                    [stepKey]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                              />
                              <span
                                className={
                                  isChecked
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800'
                                }
                              >
                                {line}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateReminderStatus(rem.id, 'completed')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Protocol</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSpeakText(
                          `It is time for ${rem.title}. Here is what you should do right now: ${rem.actionPlan}`,
                          advisor.voiceName
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Read Aloud</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSnoozeReminder(rem.id, 10)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Snooze +10m</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Workspace Router */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'characters' && (
          <CharacterStudioView
            characters={allCharacters}
            selectedCharacterId={selectedCharacter.id}
            onSelectCharacter={(id) => {
              setSelectedCharacterId(id);
              setActiveTab('chat');
            }}
            onSaveCharacter={handleSaveCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onPreviewVoice={handleSpeakText}
            isPlayingVoice={isPlayingVoice}
          />
        )}

        {activeTab === 'reminders' && (
          <ReminderManagerView
            reminders={reminders}
            memories={memories}
            characters={allCharacters}
            selectedCharacter={selectedCharacter}
            voiceEngine={settings.voiceEngine}
            onAddReminder={handleAddReminder}
            onUpdateReminderStatus={handleUpdateReminderStatus}
            onDeleteReminder={handleDeleteReminder}
            onAddMemory={handleAddMemory}
            onDeleteMemory={handleDeleteMemory}
            onSpeakText={handleSpeakText}
            onAskAgentAboutReminder={(rem) => {
              setActiveTab('chat');
              handleSendMessage(
                `Let's review my reminder "${rem.title}". Walk me through the best way to execute these steps: ${rem.actionPlan}`
              );
            }}
          />
        )}

        {activeTab === 'settings' && (
          <ApiSettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 max-w-[1440px] w-full mx-auto">
            {/* Left Sidebar: Active Character Personas (3 cols on lg) */}
            <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-5 flex flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-500 tracking-wide">
                    AI Advisor Personas
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('characters')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Customize</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {allCharacters.map((char) => {
                    const isSelected = char.id === selectedCharacter.id;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => setSelectedCharacterId(char.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <AvatarWithFallback
                          src={char.avatarUrl}
                          name={char.name}
                          sizeClass="w-10 h-10 text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">
                            {char.name}
                          </div>
                          <div
                            className={`text-xs truncate mt-0.5 ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {char.role}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Active Persona Details */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-semibold text-slate-900">
                    Active Methodology
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {selectedCharacter.methodology}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                    <span>Model: {settings.model}</span>
                    <span aria-hidden="true">·</span>
                    <span>Voice: {selectedCharacter.voiceName}</span>
                  </div>
                </div>
              </div>

              {/* Quick Voice-to-Reminder Box in Sidebar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="text-xs font-semibold text-slate-900">
                  Quick Voice Problem or Reminder
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Speak a worry, task, or deadline—{selectedCharacter.name.split(' ')[0]} will transcribe it and build your action plan.
                </p>
                <VoiceRecorderButton
                  voiceEngine={settings.voiceEngine}
                  label="Speak to Agent Now"
                  onTranscriptReady={(transcript) => {
                    handleSendMessage(transcript);
                  }}
                  onError={(err) => setErrorBanner(err)}
                />
              </div>
            </aside>

            {/* Center Column: Interactive Problem-Solving Chat Box (6 cols on lg) */}
            <section className="lg:col-span-6 flex flex-col h-[calc(100vh-57px)] bg-[#F8FAFC]">
              {/* Character Context Header */}
              <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarWithFallback
                    src={selectedCharacter.avatarUrl}
                    name={selectedCharacter.name}
                    sizeClass="w-9 h-9 text-xs"
                  />
                  <div className="min-w-0">
                    <h1 className="text-sm font-semibold text-slate-900 truncate">
                      {selectedCharacter.name}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                      <span>{selectedCharacter.role}</span>
                      <span aria-hidden="true">·</span>
                      <span>Auto-Memory: {settings.autoExtractMemory ? 'On' : 'Off'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleSpeakText(
                        characterMessages[characterMessages.length - 1]?.content ||
                          `Hello, I am ${selectedCharacter.name}.`,
                        selectedCharacter.voiceName
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isPlayingVoice ? 'Stop Audio' : 'Read Last Reply'}</span>
                  </button>
                </div>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {errorBanner && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-3">
                    <span>{errorBanner}</span>
                    <button
                      type="button"
                      onClick={() => setErrorBanner(null)}
                      className="font-semibold underline shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {characterMessages.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3 my-8">
                    <div className="text-base font-semibold text-slate-900">
                      Start a problem-solving session with {selectedCharacter.name}
                    </div>
                    <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                      {selectedCharacter.personality} Ask {selectedCharacter.name.split(' ')[0]} to help solve a problem or set a time-based reminder with an action checklist.
                    </p>
                  </div>
                ) : (
                  characterMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isUser ? 'items-end' : 'items-start'
                        } space-y-2`}
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                          <span className="font-medium text-slate-600">
                            {isUser ? 'You' : selectedCharacter.name}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {new Date(msg.timestampIso).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {!isUser && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSpeakText(
                                    msg.content,
                                    selectedCharacter.voiceName
                                  )
                                }
                                className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>Listen</span>
                              </button>
                            </>
                          )}
                        </div>

                        <div
                          className={`max-w-[90%] rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-slate-900 text-white'
                              : 'bg-white text-slate-900 border border-slate-200'
                          }`}
                        >
                          {msg.content}
                        </div>

                        {/* Problem Breakdown Framework Output */}
                        {msg.problemBreakdown && (
                          <div className="max-w-[90%] w-full bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>
                                Structured Problem Breakdown ({selectedCharacter.methodology})
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-800">
                                Root Cause Identified:
                              </div>
                              <p className="text-xs text-slate-600">
                                {msg.problemBreakdown.rootCause}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-800">
                                Immediate High-Leverage Next Step:
                              </div>
                              <p className="text-xs text-slate-900 font-medium bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                                {msg.problemBreakdown.immediateNextStep}
                              </p>
                            </div>

                            {msg.problemBreakdown.steps?.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-800">
                                  Execution Protocol:
                                </div>
                                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700">
                                  {msg.problemBreakdown.steps.map((s, idx) => (
                                    <li key={idx}>{s}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Auto-Extracted Reminders / Memories Notification */}
                        {((msg.extractedRemindersCount ?? 0) > 0 ||
                          (msg.extractedMemoriesCount ?? 0) > 0) && (
                          <div className="flex items-center gap-2 text-xs text-emerald-700 px-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {[
                                (msg.extractedRemindersCount ?? 0) > 0
                                  ? `Scheduled ${msg.extractedRemindersCount} action reminder`
                                  : '',
                                (msg.extractedMemoriesCount ?? 0) > 0
                                  ? `Saved ${msg.extractedMemoriesCount} item to Memory Vault`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {isSending && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-500 px-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>
                      {selectedCharacter.name} is analyzing your problem and checking your memory vault...
                    </span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Starter Prompts & Input Bar */}
              <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        'Remind me in 2 minutes to call the client about the Q4 proposal, and tell me what I should do when that time comes.'
                      )
                    }
                    className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                  >
                    Remind me in 2m + what to do
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        'I am overwhelmed with 4 competing priorities today and keep missing deep work blocks. Help me solve this and schedule a check-in.'
                      )
                    }
                    className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                  >
                    Solve priority overload
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        'Remember that our staging deployment window is every Tuesday and Thursday at 4:00 PM, and we must run migration dry-runs 30 minutes prior.'
                      )
                    }
                    className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                  >
                    Remember deployment rule
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-2.5"
                >
                  <VoiceRecorderButton
                    voiceEngine={settings.voiceEngine}
                    compact
                    label="Voice"
                    onTranscriptReady={(transcript) => {
                      setChatInput((prev) =>
                        prev ? `${prev} ${transcript}` : transcript
                      );
                    }}
                    onError={(err) => setErrorBanner(err)}
                  />

                  <textarea
                    rows={2}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Ask ${selectedCharacter.name.split(' ')[0]} to solve a problem, remember a fact, or set a reminder...`}
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 resize-none"
                  />

                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </section>

            {/* Right Column: Live Reminders & Memory Rail (3 cols on lg) */}
            <aside className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-57px)]">
              {/* Upcoming Action Reminders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    <h2 className="text-xs font-semibold text-slate-900">
                      Scheduled Action Protocols
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reminders')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Manage All
                  </button>
                </div>

                {scheduledReminders.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    No upcoming reminders scheduled. Ask the agent in chat to remind you at a specific time.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {scheduledReminders.slice(0, 4).map((rem) => (
                      <div
                        key={rem.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono-tabular font-semibold text-blue-600">
                            {formatCountdown(rem.dueAtIso)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateReminderStatus(rem.id, 'triggered')
                            }
                            title="Simulate reminder time arriving now"
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900"
                          >
                            <Play className="w-3 h-3" />
                            <span>Trigger Now</span>
                          </button>
                        </div>

                        <div className="text-xs font-semibold text-slate-900">
                          {rem.title}
                        </div>

                        <div className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line">
                          <span className="font-medium text-slate-800">
                            What to do then:{' '}
                          </span>
                          {rem.actionPlan}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Memory Cortex */}
              <div className="pt-5 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-blue-600" />
                    <h2 className="text-xs font-semibold text-slate-900">
                      Remembered Context ({memories.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reminders')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    + Add
                  </button>
                </div>

                {memories.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Facts and problems you share will appear here automatically.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {memories.slice(0, 5).map((mem) => (
                      <div
                        key={mem.id}
                        className="p-3 rounded-xl border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="capitalize font-medium text-slate-600">
                            {mem.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="hover:text-red-600 transition-colors"
                            title="Delete memory"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs font-semibold text-slate-900">
                          {mem.title}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {mem.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
