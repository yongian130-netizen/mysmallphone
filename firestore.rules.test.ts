/**
 * Phase 0: Hardened Red Team Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies all 12 adversarial payloads in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: string;
  description: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01',
    description: 'Identity Spoofing on Character Create (ownerId != request.auth.uid)',
    collectionPath: '/characters/char_1',
    operation: 'create',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      ownerId: 'user_B',
      name: 'Aria',
      role: 'Strategist',
      avatarUrl: '',
      personality: 'Direct',
      methodology: 'First Principles',
      systemPrompt: 'Help solve problems',
      voiceName: 'Kore',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    description: 'Unverified Email Write Attempt',
    collectionPath: '/memories/mem_1',
    operation: 'create',
    auth: { uid: 'user_A', email_verified: false },
    payload: {
      ownerId: 'user_A',
      category: 'problem',
      title: 'Server Latency',
      content: 'Need to reduce p99 latency below 120ms',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    description: 'Shadow Field Injection on Reminder Create',
    collectionPath: '/reminders/rem_1',
    operation: 'create',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      ownerId: 'user_A',
      title: 'Review Board Deck',
      contextNote: 'Q4 board meeting',
      actionPlan: '1. Verify revenue table 2. Check cohort slide',
      dueAtIso: '2026-10-09T15:00:00.000Z',
      priority: 'high',
      status: 'scheduled',
      characterId: 'char_1',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    description: 'Shadow Field Injection on Character Update',
    collectionPath: '/characters/char_1',
    operation: 'update',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      secretBypass: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    description: 'Owner Mutation on Memory Update',
    collectionPath: '/memories/mem_1',
    operation: 'update',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      ownerId: 'user_B',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    description: 'Forged Client Timestamp on Message Create',
    collectionPath: '/messages/msg_1',
    operation: 'create',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      ownerId: 'user_A',
      characterId: 'char_1',
      role: 'user',
      content: 'Hello',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    description: 'Terminal State Re-opening on Completed Reminder',
    collectionPath: '/reminders/rem_completed',
    operation: 'update',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      status: 'scheduled',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    description: 'Denial-of-Wallet Oversized String on Character System Prompt',
    collectionPath: '/characters/char_1',
    operation: 'update',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      systemPrompt: 'A'.repeat(10000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    description: 'ID Poisoning Attack with Non-Alphanumeric Path ID',
    collectionPath: '/memories/invalid$id!@#',
    operation: 'create',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      ownerId: 'user_A',
      category: 'fact',
      title: 'Test',
      content: 'Test content',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    description: 'Invalid Enum Value Poisoning on UserSettings Model',
    collectionPath: '/userSettings/user_A',
    operation: 'update',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      model: 'gemini-1.5-pro',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    description: 'Cross-Tenant List Scraping on Reminders',
    collectionPath: '/reminders',
    operation: 'list',
    auth: { uid: 'user_A', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    description: 'Immutable Message Update Attempt',
    collectionPath: '/messages/msg_1',
    operation: 'update',
    auth: { uid: 'user_A', email_verified: true },
    payload: {
      role: 'assistant',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
