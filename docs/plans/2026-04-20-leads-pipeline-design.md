# Leads Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a host-facing leads pipeline with default stages, automatic stage assignment, manual qualified→sold drag/drop, per-lead editing, and host-level Meta CAPI settings.

**Architecture:** Extend `waiting_guests` with pipeline-stage metadata plus editable lead fields, and extend `users` profile settings with CAPI credentials. Keep the qualification engine as the source of truth for verdicts, then derive pipeline stages from lifecycle state: unfinished/review → `prospect`, unqualified → `unqualified`, qualified/admitted/manual review completion → `qualified`, and user drag/drop to `sold`. Implement the board and lead editor in `/host/leads` using the existing fetch flow and a small shared helper module for pipeline logic.

**Tech Stack:** Next.js App Router, React client components, Supabase, node:test

---

### Task 1: Add failing tests for pipeline rules

**Files:**
- Create: `test/lead-pipeline.test.mjs`
- Create: `src/lib/lead-pipeline.ts`

**Step 1: Write the failing test**

Cover:
- `unqualified` verdict maps to `unqualified`
- `qualified` verdict maps to `qualified`
- `review` verdict maps to `prospect`
- abandoned / draft / unfinished submission maps to `prospect`
- explicit manual stage `sold` is preserved

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/lead-pipeline.test.mjs`

**Step 3: Write minimal implementation**

Add pure helpers in `src/lib/lead-pipeline.ts` for:
- default stage list
- stage normalization
- automatic stage resolution from verdict + submission state
- manual move guardrails

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/lead-pipeline.test.mjs`

### Task 2: Add failing tests for settings normalization

**Files:**
- Modify: `test/users-column-compat.test.mjs`
- Create: `test/profile-settings.test.mjs`
- Modify: `src/lib/profile-settings.ts`

**Step 1: Write the failing test**

Cover normalized defaults for:
- `leads_pipeline_stages`
- `meta_capi_access_token`
- `meta_capi_dataset_id`

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/profile-settings.test.mjs`

**Step 3: Write minimal implementation**

Extend profile-settings types/defaults/normalizer to support the new fields.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/profile-settings.test.mjs`

### Task 3: Add schema support

**Files:**
- Modify: `supabase/schema_updates.sql`
- Modify: `supabase/migration_instant_leads.sql`

**Step 1: Add schema changes**

Add to `waiting_guests`:
- `pipeline_stage TEXT`
- `pipeline_stage_changed_at TIMESTAMPTZ`
- `lead_profile JSONB DEFAULT '{}'::jsonb`

Add to `lead_drafts`:
- `pipeline_stage TEXT`

Add to `users`:
- `leads_pipeline_stages JSONB DEFAULT '["prospect","qualified","unqualified","sold"]'::jsonb`
- `meta_capi_access_token TEXT`
- `meta_capi_dataset_id TEXT`

Keep changes idempotent.

### Task 4: Add API support for lead updates and settings

**Files:**
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/app/api/leads/submit/route.ts`
- Modify: `src/app/api/profile/settings/route.ts`
- Modify: `src/lib/profile-settings.ts`
- Modify: `src/lib/lead-summary.ts`
- Modify: `src/app/api/waiting/route.ts`

**Step 1: Write failing tests for new pure helpers first**

If logic needs extraction, add tests before implementation.

**Step 2: Implement minimal API changes**

`/api/leads`:
- include `pipeline_stage` and `lead_profile`
- support single-lead PATCH for editable fields and manual stage changes

`/api/leads/submit`:
- assign automatic pipeline stage when saving full lead submission
- store qualified as `qualified`, unqualified as `unqualified`, review as `prospect`

Profile settings API:
- select, normalize, and persist stage config + CAPI values

Waiting API:
- expose new lead fields for admitted/waiting guests where useful

### Task 5: Add prospect handling for unfinished forms

**Files:**
- Modify: `src/app/api/leads/submit/route.ts`
- Modify: existing lead draft autosave path(s) if present
- Modify: `src/app/host/leads/page.tsx`

**Step 1: Find current draft/autosave path**

If unfinished form saves only to `lead_drafts`, extend the host leads data source or merge drafts into `/api/leads` results as prospect cards.

**Step 2: Implement minimal behavior**

Ensure both of these appear as `prospect`:
- form started but not completed
- submitted leads with review-ish outcome / unfinished routing

### Task 6: Build the leads pipeline board UI

**Files:**
- Modify: `src/app/host/leads/page.tsx`
- Modify: `src/app/host/leads/page.module.css`

**Step 1: Write/adjust tests for shared helpers first**

Keep board behavior logic in tested helpers where possible.

**Step 2: Implement UI**

Add:
- pipeline board columns from host settings
- default stages: `prospect`, `qualified`, `unqualified`, `sold`
- drag/drop with optimistic update
- manual drop allowed for `qualified` → `sold` and general host organization if desired, but automatic rules must still set new leads correctly
- a pipeline/settings card in the leads page for CAPI token + dataset id
- richer lead editor modal for email, phone, note, custom info fields, and lead profile metadata

### Task 7: Verify end-to-end behavior

**Files:**
- Tests: `test/lead-pipeline.test.mjs`, `test/profile-settings.test.mjs`, existing lead summary tests

**Step 1: Run targeted tests**

Run: `npm run test:node`

**Step 2: Run app verification if needed**

Run: `npm run build` if changes are broad enough to justify build verification.

**Step 3: Review manually**

Confirm:
- new unqualified leads land in `unqualified`
- qualified submissions land in `qualified`
- started-but-unfinished and review-ish leads land in `prospect`
- hosts can drag to `sold`
- hosts can edit lead details
- CAPI settings save and reload
