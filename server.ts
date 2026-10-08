import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ALLOWED_MODELS = new Set([
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
]);

/**
 * Resilient multi-model execution helper.
 * Prioritizes fast, available models and automatically falls back on 503/429/transient errors.
 */
async function generateWithFallback(
  ai: GoogleGenAI,
  requestedModel: string,
  params: Omit<GenerateContentParameters, 'model'>
): Promise<{ response: GenerateContentResponse; usedModel: string }> {
  // Prioritize gemini-3.1-flash-lite when gemini-3.8-flash is experiencing 503 demand spikes
  const primaryModel =
    requestedModel === 'gemini-3.8-flash' ? 'gemini-3.1-flash-lite' : requestedModel;

  const fallbackOrder = Array.from(
    new Set([
      primaryModel,
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ])
  );

  let lastError: unknown = null;
  for (const modelName of fallbackOrder) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: modelName,
      });
      return { response, usedModel: modelName };
    } catch (err) {
      console.warn(`Model ${modelName} failed, trying next fallback:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models are temporarily unavailable.');
}

function cleanJsonString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // 1. Health & API Status Endpoint
  app.get('/api/gemini/status', (_req, res) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim().length > 0
    );
    res.json({
      ok: true,
      configured: hasKey,
      defaultModel: 'gemini-3.1-flash-lite',
      transcriptionModel: 'gemini-3.5-transcribe',
      ttsModel: 'gemini-3.8-flash-lite-tts',
      serverTime: new Date().toISOString(),
    });
  });

  // 2. Main Agent Chat + Problem Solving + Auto Reminder & Memory Extraction
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        character,
        memories = [],
        reminders = [],
        settings = {},
        currentLocalTime,
      } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const ai = getGenAIClient();
      const requestedModel =
        typeof settings.model === 'string' && ALLOWED_MODELS.has(settings.model)
          ? settings.model
          : 'gemini-3.1-flash-lite';

      const temperature =
        typeof settings.temperature === 'number'
          ? Math.max(0, Math.min(2, settings.temperature))
          : 0.7;
      const topP =
        typeof settings.topP === 'number'
          ? Math.max(0.1, Math.min(1, settings.topP))
          : 0.95;
      const topK =
        typeof settings.topK === 'number'
          ? Math.max(1, Math.min(100, Math.round(settings.topK)))
          : 64;

      const styleInstruction =
        settings.responseStyle === 'concise'
          ? 'Keep your response concise, direct, and scannable (under 150 words unless a detailed step-by-step plan is requested).'
          : settings.responseStyle === 'comprehensive'
          ? 'Provide a thorough, deeply reasoned breakdown with concrete steps, trade-offs, and contingencies.'
          : 'Provide a balanced, well-structured response with clear action items.';

      const memoryContext =
        Array.isArray(memories) && memories.length > 0
          ? memories
              .slice(0, 15)
              .map(
                (m: { category?: string; title?: string; content?: string }) =>
                  `- [${m.category || 'fact'}] ${m.title}: ${m.content}`
              )
              .join('\n')
          : 'No stored memories yet.';

      const reminderContext =
        Array.isArray(reminders) && reminders.length > 0
          ? reminders
              .slice(0, 10)
              .map(
                (r: {
                  title?: string;
                  dueAtIso?: string;
                  status?: string;
                  actionPlan?: string;
                }) =>
                  `- "${r.title}" (Due: ${r.dueAtIso}, Status: ${r.status}) -> Action Plan: ${r.actionPlan}`
              )
              .join('\n')
          : 'No scheduled reminders yet.';

      const referenceTime = currentLocalTime || new Date().toISOString();

      const systemInstruction = `You are ${character?.name || 'Aria Vance'}, ${
        character?.role || 'Executive Problem-Solving & Memory Agent'
      }.
Personality & Tone: ${
        character?.personality ||
        'Analytical, calm, incisive, and action-oriented.'
      }
Problem-Solving Methodology: ${
        character?.methodology || 'First-Principles Decomposition & Action Protocols'
      }
Character System Directive: ${
        character?.systemPrompt ||
        'Help the user solve complex problems by isolating root causes, remembering critical context, and formulating concrete time-bound action checklists.'
      }

Current Reference Time (ISO-8601): ${referenceTime}

USER'S PERSISTENT MEMORY VAULT:
${memoryContext}

USER'S CURRENT SCHEDULED REMINDERS:
${reminderContext}

RESPONSE & EXTRACTION INSTRUCTIONS:
1. ${styleInstruction}
2. Directly address the user's question, problem, or request in your persona's voice inside "reply".
3. If the user asks you to remember something for a specific time, set a reminder, or asks "remind me at [time] and tell me what I should do then" (even relative times like "in 2 minutes", "in 1 hour", "tomorrow at 9am"), populate "extractedReminders" with:
   - "title": Clear reminder title
   - "contextNote": Why this reminder matters
   - "actionPlan": Concrete numbered steps detailing EXACTLY what the user should do when that time arrives (e.g., "1. Open the metrics dashboard. 2. Verify cohort retention. 3. Send summary note.")
   - "dueAtIso": Valid ISO-8601 timestamp calculated relative to Current Reference Time (${referenceTime}).
   - "priority": "low", "medium", "high", or "critical"
4. If the user shares an ongoing problem, personal preference, goal, constraint, or fact worth remembering across sessions (and autoExtractMemory is not false), populate "extractedMemories".
5. If the user is presenting a problem or dilemma to solve, populate "hasProblemBreakdown": true and fill "problemBreakdown" with a crisp rootCause, immediateNextStep, and 2-4 concrete steps.`;

      const recentHistoryText = Array.isArray(history)
        ? history
            .slice(-10)
            .map(
              (h: { role: string; content: string }) =>
                `${h.role === 'user' ? 'User' : character?.name || 'Agent'}: ${h.content}`
            )
            .join('\n\n')
        : '';

      const promptContent = recentHistoryText
        ? `CONVERSATION HISTORY:\n${recentHistoryText}\n\nCURRENT USER MESSAGE:\n${message}`
        : `CURRENT USER MESSAGE:\n${message}`;

      const { response } = await generateWithFallback(ai, requestedModel, {
        contents: promptContent,
        config: {
          systemInstruction,
          temperature,
          topP,
          topK,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'The natural conversational response from the AI character to display in the chat box.',
              },
              hasProblemBreakdown: {
                type: Type.BOOLEAN,
                description:
                  'True if the user asked for help solving a problem or making a decision.',
              },
              problemBreakdown: {
                type: Type.OBJECT,
                properties: {
                  rootCause: {
                    type: Type.STRING,
                    description: 'Core bottleneck or root cause of the problem.',
                  },
                  immediateNextStep: {
                    type: Type.STRING,
                    description: 'The single highest-leverage action to take right now.',
                  },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Step-by-step execution sequence.',
                  },
                },
                required: ['rootCause', 'immediateNextStep', 'steps'],
              },
              extractedReminders: {
                type: Type.ARRAY,
                description:
                  'Any time-based reminders or scheduled action plans requested by the user.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    contextNote: { type: Type.STRING },
                    actionPlan: {
                      type: Type.STRING,
                      description:
                        'Specific step-by-step instructions on what the user should do when the reminder time arrives.',
                    },
                    dueAtIso: {
                      type: Type.STRING,
                      description: 'ISO-8601 timestamp for when the reminder is due.',
                    },
                    priority: {
                      type: Type.STRING,
                      description: 'low, medium, high, or critical',
                    },
                  },
                  required: ['title', 'contextNote', 'actionPlan', 'dueAtIso', 'priority'],
                },
              },
              extractedMemories: {
                type: Type.ARRAY,
                description:
                  'Important facts, problems, goals, or preferences to save to long-term memory.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: 'problem, preference, goal, fact, or routine',
                    },
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ['category', 'title', 'content'],
                },
              },
            },
            required: [
              'reply',
              'hasProblemBreakdown',
              'extractedReminders',
              'extractedMemories',
            ],
          },
        },
      });

      const rawText = cleanJsonString(response.text || '{}');
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error) {
      console.error('Gemini chat error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate agent response.',
      });
    }
  });

  // 3. Server-Side Voice-to-Text Transcription via gemini-3.5-transcribe (with fallback)
  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Audio data is required for transcription.' });
        return;
      }

      const ai = getGenAIClient();
      let transcript = '';

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: 'Transcribe this spoken audio accurately into clean text. Output only the spoken words without commentary.',
              },
            ],
          },
        });
        transcript = (response.text || '').trim();
      } catch {
        const fallback = await generateWithFallback(ai, 'gemini-3.1-flash-lite', {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: 'Transcribe this spoken audio accurately into clean text. Output only the spoken words without commentary.',
              },
            ],
          },
        });
        transcript = (fallback.response.text || '').trim();
      }

      res.json({ transcript });
    } catch (error) {
      console.error('Gemini transcription error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to transcribe voice input.',
      });
    }
  });

  // 4. Server-Side Speech Generation (TTS) via gemini-3.8-flash-lite-tts
  app.post('/api/gemini/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Kore', style = 'Clear, calm, and helpful advisor' } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const allowedVoices = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
      const selectedVoice = allowedVoices.has(voiceName) ? voiceName : 'Kore';

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.slice(0, 1200),
                speechMetadata: {
                  style,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(500).json({ error: 'No audio returned from TTS model.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error) {
      console.error('Gemini TTS error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to synthesize speech.',
      });
    }
  });

  // 5. Generate Action Plan ("On that time what should I do") for a Reminder
  app.post('/api/gemini/generate-action-plan', async (req, res) => {
    try {
      const { title, contextNote, character } = req.body;
      if (!title || typeof title !== 'string') {
        res.status(400).json({ error: 'Reminder title is required.' });
        return;
      }

      const ai = getGenAIClient();
      const { response } = await generateWithFallback(ai, 'gemini-3.1-flash-lite', {
        contents: `Create a concrete, 3-to-4 step action checklist for what the user should immediately do when this reminder triggers.
Reminder Title: ${title}
Context / Problem Note: ${contextNote || 'None provided'}
Advisor Persona: ${character?.name || 'Aria Vance'} (${character?.methodology || 'First-Principles'})

Format as numbered lines (1. ..., 2. ..., 3. ...). Keep it under 500 characters, practical, and immediately executable.`,
      });

      res.json({
        actionPlan: (response.text || '').trim(),
      });
    } catch (error) {
      console.error('Action plan generation error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate action plan.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChronoMind server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
