# Real Estate VSL Funnel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the home landing page into a real-estate-agent-focused VSL page with a simple headline + video + start CTA, then add a transparent seller-lead diagnostic funnel that routes qualified interest into the existing signup flow.

**Architecture:** Keep the existing landing page shell, pricing section, CAPI visit event, and signup/login modal behavior in `src/app/page.tsx`. Add a new isolated `SellerLeadFunnel` component for the multi-step diagnostic so the new behavior is modular, testable, and easy to restyle. Reuse the existing signup modal (`setShowSignup(true)`) and Facebook contact CTA instead of adding new backend endpoints.

**Tech Stack:** Next.js App Router, React client components, CSS Modules, node:test, TypeScript

---

### Task 1: Lock the new landing-page structure with failing tests

**Files:**
- Modify: `test/landing-copy-contact.test.mjs`
- Create: `test/real-estate-funnel.test.mjs`

**Step 1: Write the failing tests**

Cover these expectations:
- `src/app/page.tsx` targets real estate agents and seller leads explicitly
- the hero contains a headline above a dedicated VSL section
- the hero exposes a primary CTA with start-oriented copy (for example `Start your seller lead funnel`)
- the page renders a `SellerLeadFunnel` component or equivalent dedicated funnel section
- the funnel copy is diagnostic/transparent rather than coercive (for example: no `manipulate`, `brainwash`, `hypnosis`, or fake-certainty wording)

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs`

Expected: FAIL because the current landing page is generic and has no real-estate VSL funnel.

**Step 3: Write minimal implementation**

Do not build the full funnel yet. Only add the smallest test scaffolding and file-level references needed to make the intended structure explicit.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs
git commit -m "test: lock real estate vsl landing structure"
```

### Task 2: Add the seller diagnostic funnel as an isolated component

**Files:**
- Create: `src/components/SellerLeadFunnel.tsx`
- Create: `src/components/SellerLeadFunnel.module.css`
- Test: `test/real-estate-funnel.test.mjs`

**Step 1: Write the failing test**

Add assertions for a small multi-step funnel with these durable behaviors:
- includes 4-6 seller-agent diagnostic questions
- includes a visible progress indicator
- ends with an honest recommendation state instead of a hard-pressure close
- exposes two final actions: one that starts the existing signup flow and one that lets the visitor contact the team

Recommended questions:
- role/team type
- monthly seller leads or listings handled
- current lead response speed
- biggest bottleneck
- whether they want live qualification, booked appointments, or both

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/real-estate-funnel.test.mjs`

Expected: FAIL because `SellerLeadFunnel` does not exist yet.

**Step 3: Write minimal implementation**

Create a self-contained client component that:
- stores the current step in local state
- renders predefined option sets (no backend)
- computes a simple recommendation tier such as `ready now`, `needs follow-up`, or `book a walkthrough`
- accepts callbacks like `onPrimaryAction` and `onSecondaryAction`

Keep the copy direct and value-based. Do not add deceptive urgency, false scarcity, or language implying guaranteed listings.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/real-estate-funnel.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/SellerLeadFunnel.tsx src/components/SellerLeadFunnel.module.css test/real-estate-funnel.test.mjs
git commit -m "feat: add seller lead diagnostic funnel"
```

### Task 3: Replace the top hero with the real-estate VSL layout

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`
- Test: `test/landing-copy-contact.test.mjs`

**Step 1: Write the failing test**

Extend the landing-page test to assert:
- a real-estate-specific hero headline exists above the video
- a dedicated VSL wrapper exists near the top of the page
- the primary CTA targets the funnel section (for example `href="#seller-funnel"` or an equivalent button action)
- the existing Facebook contact CTA still exists
- the existing monthly pricing/sign-up flow still exists

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs`

Expected: FAIL because the current hero does not use the VSL-first layout.

**Step 3: Write minimal implementation**

In `src/app/page.tsx`:
- keep the nav, CAPI logic, pricing section, guest quick-join, and modals intact
- replace the current generic hero copy with seller-agent positioning
- add a hero media frame that uses an existing testimonial video endpoint as the temporary VSL source (`/api/testimonials/testimonial-1`) until a final VSL asset is provided
- add a primary CTA that scrolls to `#seller-funnel`
- keep a secondary CTA for pricing or contact

In `src/app/page.module.css`:
- add styles for the VSL frame, hero proof chips, and cleaner above-the-fold spacing
- preserve the existing dark aesthetic, but make the hero feel more editorial and industry-specific
- add mobile rules for stacked hero media + CTA layout

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css test/landing-copy-contact.test.mjs
git commit -m "feat: add real estate vsl hero"
```

### Task 4: Wire the funnel into the existing signup/contact actions

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/SellerLeadFunnel.tsx`
- Test: `test/real-estate-funnel.test.mjs`

**Step 1: Write the failing test**

Cover these integration behaviors:
- the funnel primary action opens the existing signup modal through `setShowSignup(true)`
- the funnel secondary action points to the existing Facebook contact flow
- the funnel result copy references InstantMeeting as a workflow tool, not a guaranteed-outcome machine

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/real-estate-funnel.test.mjs`

Expected: FAIL because the new component is not yet connected to the page-level actions.

**Step 3: Write minimal implementation**

Mount `SellerLeadFunnel` below the hero and above pricing. Pass page-owned callbacks so the funnel can:
- open the current signup modal
- send users to the existing Facebook contact CTA
- optionally scroll them to pricing after they complete the diagnostic

Do not introduce a new form submission backend or CRM integration in this slice.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/components/SellerLeadFunnel.tsx test/real-estate-funnel.test.mjs test/landing-copy-contact.test.mjs
git commit -m "feat: connect seller funnel to signup flow"
```

### Task 5: Polish responsive behavior and verify the page end-to-end

**Files:**
- Modify: `src/app/page.module.css`
- Modify: `src/components/SellerLeadFunnel.module.css`
- Test: `test/landing-copy-contact.test.mjs`
- Test: `test/real-estate-funnel.test.mjs`

**Step 1: Write the failing test**

Extend the tests to assert the new layout has mobile guards for:
- the hero VSL stack
- the funnel card/grid layout
- the final CTA button stack

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs`

Expected: FAIL because the new responsive selectors are not all present yet.

**Step 3: Write minimal implementation**

Add responsive CSS for small screens and tighten spacing/typography so the page remains readable on mobile. Preserve current behavior for login/signup modals and guest quick-join.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs`

Expected: PASS.

**Step 5: Run broader verification**

Run:
- `npm run test:node -- test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs test/signup-modal-payment.test.mjs test/landing-page-capi.test.mjs`
- `npm run build`

Expected:
- PASS on all targeted tests
- successful production build

**Step 6: Commit**

```bash
git add src/app/page.module.css src/components/SellerLeadFunnel.module.css test/landing-copy-contact.test.mjs test/real-estate-funnel.test.mjs
git commit -m "style: polish real estate landing funnel"
```

## Notes for Implementation

- Keep the existing payment/signup flow intact; this plan changes positioning and front-end UX, not billing.
- Reuse the current offer countdown only if it reflects a real offer; do not invent urgency.
- Use persuasive but truthful copy focused on speed-to-lead, qualification clarity, and better seller conversations.
- Explicitly avoid coercive or manipulative tactics, including “micro compliance,” “brainwashing,” fake scarcity, or guaranteed listing claims.
