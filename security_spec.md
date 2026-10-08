# ChronoMind Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership & Verified Identity**: Every document across `/characters/{characterId}`, `/reminders/{reminderId}`, `/memories/{memoryId}`, `/messages/{messageId}`, and `/userSettings/{userId}` MUST belong exclusively to the authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true && incoming().ownerId == request.auth.uid`).
2. **Path & Document ID Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) MUST validate the path ID using `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`). For `/userSettings/{userId}`, `userId` MUST strictly equal `request.auth.uid`.
3. **Immutable Audit & Ownership Fields**: `ownerId` and `createdAt` (and `characterId` + `role` on `/messages/{messageId}`) are strictly immutable after creation (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
4. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps MUST equal the server timestamp `request.time`.
5. **Terminal State Locking**: Once a `Reminder` document reaches `status == 'completed'`, it is in a terminal state and NO further `update` operations are permitted (`existing().status != 'completed'`).
6. **Zero Shadow Fields (Strict Key Allowlisting)**: Every `create` and `update` must validate exact keys via `hasAll` and `hasOnly`, and `update` operations must begin with `isValid[Entity](incoming())` and restrict changed fields via `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
7. **Secure List Queries**: Every `allow list` rule MUST enforce `resource.data.ownerId == request.auth.uid` on the server side without delegating filtering trust to the client.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Identity Spoofing on Character Create)**: Authenticated user `user_A` creates `/characters/char_1` with `ownerId: "user_B"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Unverified Email Write)**: Authenticated user `user_A` with `email_verified: false` creates `/memories/mem_1`. -> `PERMISSION_DENIED`
3. **Payload 3 (Shadow Field Injection on Create)**: User creates `/reminders/rem_1` with all required fields plus `"isAdmin": true`. -> `PERMISSION_DENIED`
4. **Payload 4 (Shadow Field Injection on Update)**: User updates `/characters/char_1` adding `"secretBypass": "true"`. -> `PERMISSION_DENIED`
5. **Payload 5 (Owner Mutation on Update)**: User updates `/memories/mem_1` changing `ownerId` from `"user_A"` to `"user_B"`. -> `PERMISSION_DENIED`
6. **Payload 6 (Forged Client Timestamp)**: User creates `/messages/msg_1` with `createdAt` set to a past timestamp instead of `request.time`. -> `PERMISSION_DENIED`
7. **Payload 7 (Terminal State Re-opening on Reminder)**: User attempts to update `/reminders/rem_completed` (where `existing().status == "completed"`) back to `status: "scheduled"`. -> `PERMISSION_DENIED`
8. **Payload 8 (Denial-of-Wallet Oversized String)**: User updates `/characters/char_1` with a `systemPrompt` of 10,000 characters (`> 3000` max). -> `PERMISSION_DENIED`
9. **Payload 9 (ID Poisoning Attack)**: User attempts to create `/memories/invalid$id!@#` with non-alphanumeric characters. -> `PERMISSION_DENIED`
10. **Payload 10 (Invalid Enum Value Poisoning)**: User updates `/userSettings/user_A` with `model: "gemini-1.5-pro"` (not in allowlisted enum). -> `PERMISSION_DENIED`
11. **Payload 11 (Cross-Tenant List Scraping)**: User `user_A` runs an unconstrained `list` query on `/reminders` attempting to read `user_B`'s reminders. -> `PERMISSION_DENIED`
12. **Payload 12 (Immutable Message Role Tampering)**: User updates `/messages/msg_1` attempting to change `role` from `"user"` to `"assistant"`. -> `PERMISSION_DENIED`
