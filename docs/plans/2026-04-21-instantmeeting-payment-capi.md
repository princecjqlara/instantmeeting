# InstantMeeting Payment CAPI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add organizer-managed Meta CAPI settings for the InstantMeeting landing/payment funnel, track website visits and payment review outcomes into the fixed `unqualified -> sold` pipeline, and send `sold` with value `699` only after admin verification.

**Architecture:** Reuse the organizer's existing profile settings row to store the global Meta CAPI access token and dataset ID. Add a small shared helper that maps InstantMeeting payment triggers (`website_visit`, `admin_reject`, `admin_verify`) into pipeline metadata and Meta payloads, then call it from a dedicated landing-page tracking route and the existing admin payment review route. Surface the settings plus a fixed payment pipeline preview in `/admin`.

**Tech Stack:** Next.js App Router, React client components, Supabase, node:test

---

### Task 1: Add failing tests for payment pipeline mapping

**Files:**
- Create: `test/instantmeeting-payment-capi.test.mjs`
- Create: `src/lib/instantmeeting-payment-capi.ts`

**Step 1: Write the failing test**

Cover:
- `website_visit` resolves to pipeline stage `unqualified`
- `admin_reject` resolves to pipeline stage `unqualified`
- `admin_verify` resolves to pipeline stage `sold` with value `699`
- payload builder hashes and trims identity fields correctly

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/instantmeeting-payment-capi.test.mjs`

**Step 3: Write minimal implementation**

Add pure helpers for trigger mapping, user-data normalization, and Meta payload construction.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/instantmeeting-payment-capi.test.mjs`

### Task 2: Add failing tests for admin and landing wiring

**Files:**
- Create: `test/admin-payment-controls.test.mjs`
- Create: `test/landing-page-capi.test.mjs`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Write the failing tests**

Cover:
- admin page exposes Meta CAPI token + dataset controls and the fixed payment pipeline copy
- landing page posts a visit tracking event to the new InstantMeeting CAPI route

**Step 2: Run tests to verify they fail**

Run: `npm run test:node -- test/admin-payment-controls.test.mjs test/landing-page-capi.test.mjs`

**Step 3: Write minimal implementation**

Add the admin settings card + pipeline preview and wire landing visits to the new route once per browser session.

**Step 4: Run tests to verify they pass**

Run: `npm run test:node -- test/admin-payment-controls.test.mjs test/landing-page-capi.test.mjs`

### Task 3: Implement server-side Meta CAPI routing

**Files:**
- Create: `src/app/api/capi/instantmeeting/route.ts`
- Modify: `src/app/api/admin/pending/route.ts`
- Modify: `src/lib/instantmeeting-payment-capi.ts`

**Step 1: Implement minimal route + helper wiring**

Add:
- landing route for website visits
- organizer settings lookup for token/dataset
- fire-and-log behavior for admin reject and admin verify
- `sold` value fixed to `699`

**Step 2: Keep business flow resilient**

Meta failures must not block signup review actions.

### Task 4: Verify end-to-end behavior

**Files:**
- Tests: `test/instantmeeting-payment-capi.test.mjs`, `test/admin-payment-controls.test.mjs`, `test/landing-page-capi.test.mjs`

**Step 1: Run targeted tests**

Run: `npm run test:node -- test/instantmeeting-payment-capi.test.mjs test/admin-payment-controls.test.mjs test/landing-page-capi.test.mjs`

**Step 2: Run broader verification if needed**

Run: `npm run test:node`

**Step 3: Manual review checklist**

Confirm:
- organizer can save Meta dataset ID + access token in `/admin`
- landing page visit posts to `/api/capi/instantmeeting`
- admin reject routes to `unqualified`
- admin verify routes to `sold` with value `699`
- missing Meta config skips sending without breaking payment review
