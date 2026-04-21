# Lead Form Meta CAPI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move lead-form Meta CAPI settings from tenant user profile settings to each individual lead form while keeping the admin/payment Meta config separate.

**Architecture:** Store the Meta token, dataset ID, and optional test event code on `lead_forms`, expose those fields only in the lead-form editor, and use that form-specific config when lead-form submissions trigger Meta events. Keep the existing user-level Meta config for the admin/payment funnel so the payment hero continues to use its own dataset independently.

**Tech Stack:** Next.js App Router, React, Supabase, node:test

---

### Task 1: Add failing tests for per-form Meta config ownership

**Files:**
- Modify: `test/leads-page-layout.test.mjs`
- Create/modify: `test/lead-form-capi-config.test.mjs`
- Modify: `test/leads-qualified-capi-routes.test.mjs`

Assert:
- host leads page no longer exposes shared Meta config fields
- lead-form editor exposes per-form Meta token/dataset/test code fields
- lead-form API route persists those fields
- lead-form submit/manual qualify routes use the per-form config path

### Task 2: Implement schema, API, and editor changes

**Files:**
- Modify: `supabase/migration_instant_leads.sql`
- Modify: `supabase/schema_updates.sql`
- Modify: `src/app/api/host/lead-forms/route.ts`
- Modify: `src/app/host/lead-forms/page.tsx`
- Modify: `src/app/host/leads/page.tsx`

Add the three Meta fields to `lead_forms`, allow POST/PATCH persistence, show them in the form editor, and remove the misleading shared fields from the host leads page.

### Task 3: Reconnect qualified lead events to per-form config

**Files:**
- Create/modify: `src/lib/lead-form-qualified-capi.ts`
- Modify: `src/lib/instantmeeting-payment-capi-server.ts`
- Modify: `src/app/api/leads/submit/route.ts`
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/app/leads/[slug]/page.tsx`

Use each form’s own Meta config for qualified lead events, pass browser Meta cookies/click id through submission, and dedupe lead events once per lead.

### Task 4: Verify

**Files:**
- Tests: `test/*.test.mjs`

Run targeted tests first, then `npm run test:node`.
