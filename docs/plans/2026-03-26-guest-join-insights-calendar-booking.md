# Guest Join Insights and Calendar-First Booking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show hosts when guests usually join by weekday/time and move booking to a calendar-first flow before the guest details form.

**Architecture:** Keep analytics client-side on the leads page using existing `/api/leads` data so no new backend contract is required for the first version. Refactor booking date/time generation into testable helpers, then update `BookingModal` to render a monthly calendar step before the details form.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS modules, Node test runner.

---

### Task 1: Guest join analytics helpers

**Files:**
- Create: `src/lib/guest-join-insights.ts`
- Test: `test/guest-join-insights.test.mjs`

**Step 1: Write the failing test**

Create tests that prove grouped weekday averages and overall average join time are calculated from `joined_at` timestamps.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/guest-join-insights.test.mjs`

**Step 3: Write minimal implementation**

Implement helper functions that group joins by weekday, compute average minutes after midnight, and format readable labels.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/guest-join-insights.test.mjs`

### Task 2: Booking calendar helpers

**Files:**
- Create: `src/lib/booking-calendar.ts`
- Test: `test/booking-calendar.test.mjs`

**Step 1: Write the failing test**

Create tests for month grid generation and time slot generation from host availability.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/booking-calendar.test.mjs`

**Step 3: Write minimal implementation**

Implement helpers for monthly calendar cells, visible day labels, and slot generation.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/booking-calendar.test.mjs`

### Task 3: Leads page insights UI

**Files:**
- Modify: `src/app/host/leads/page.tsx`
- Modify: `src/app/host/leads/page.module.css`

**Step 1: Consume helper output**

Use the loaded leads data to derive overall average join time and weekday cards.

**Step 2: Render the insights block**

Place a concise analytics section above filters so hosts immediately see peak join patterns.

**Step 3: Keep empty states safe**

Render a fallback message when there is not enough lead data.

### Task 4: Calendar-first booking flow

**Files:**
- Modify: `src/components/BookingModal.tsx`
- Modify: `src/components/BookingModal.module.css`

**Step 1: Reverse the flow**

Make the first step a monthly calendar plus available times, and only unlock the form after a slot is chosen.

**Step 2: Improve date selection UI**

Replace the flat button list with a real calendar grid and a selected-slot summary.

**Step 3: Preserve submission contract**

Keep the payload shape for `/api/meetings/public` and reschedule routes unchanged.

### Task 5: Verification

**Files:**
- Verify: `test/guest-join-insights.test.mjs`
- Verify: `test/booking-calendar.test.mjs`

**Step 1: Run targeted tests**

Run: `npm run test:node`

**Step 2: Run lint**

Run: `npm run lint`

**Step 3: Run production build**

Run: `npm run build`
