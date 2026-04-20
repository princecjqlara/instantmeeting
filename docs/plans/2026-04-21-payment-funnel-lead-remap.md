# Payment Funnel Lead Remap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remap the admin/payment Meta CAPI funnel so it only sends `PageView` for the payment hero, `Lead` when a receipt is submitted for review, and `Purchase` when an admin confirms payment.

**Architecture:** Reuse the existing organizer-managed Meta CAPI settings and server helper, but move the `Lead` send point from the general qualified-lead flow into the payment signup route. Remove the temporary qualified-event wiring so the payment dataset has a single clear meaning for `Lead`, while keeping `PageView` and `Purchase` intact.

**Tech Stack:** Next.js App Router, React, Supabase, node:test

---

### Task 1: Lock the desired payment-funnel mapping with tests

**Files:**
- Modify: `test/instantmeeting-payment-capi.test.mjs`
- Create/modify: `test/signup-payment-capi.test.mjs`
- Modify: `test/leads-qualified-capi-routes.test.mjs`

Add failing tests that assert:
- payment helper maps `website_visit -> PageView`, `payment_review_submit -> Lead`, `admin_verify -> Purchase`
- payment signup route is the receipt-submission send point
- lead qualification routes no longer send payment-funnel `Lead`

### Task 2: Implement the minimal payment-funnel send points

**Files:**
- Modify: `src/lib/instantmeeting-payment-pipeline.ts`
- Modify: `src/lib/instantmeeting-payment-pipeline.js`
- Modify: `src/app/api/signup/route.ts`
- Modify: `src/app/api/admin/pending/route.ts`
- Remove/modify: `src/lib/instantmeeting-qualified-lead.ts`, `src/app/api/leads/submit/route.ts`, `src/app/api/leads/route.ts`

Wire `Lead` to receipt submission, keep `Purchase` on admin verify, and remove payment-funnel sends from the qualified-lead path.

### Task 3: Verify everything

**Files:**
- Tests: `test/*.test.mjs`

Run targeted tests first, then `npm run test:node`.
