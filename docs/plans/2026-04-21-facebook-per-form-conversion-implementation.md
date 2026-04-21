# Facebook Per-Form Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Facebook conversion controls to each lead form, add per-form purchase value and on/off toggles for qualified and purchase sends, and add a separate editable admin/payment purchase value.

**Architecture:** Keep the admin/payment funnel on user-level settings and move lead-form conversion settings onto `lead_forms`. Lead-form qualification and sold-stage sends should read only the owning form’s Meta config and toggles, while the payment hero keeps using its separate admin config. Implement the change test-first in small slices so schema, API, UI, and event routing stay aligned.

**Tech Stack:** Next.js App Router, React client components, Supabase, node:test, TypeScript

---

### Task 1: Add failing tests for per-form Facebook config ownership

**Files:**
- Modify: `test/leads-page-layout.test.mjs`
- Create: `test/lead-form-facebook-config.test.mjs`
- Modify: `test/leads-qualified-capi-routes.test.mjs`

**Step 1: Write the failing tests**

Cover:
- `src/app/host/leads/page.tsx` no longer exposes shared Meta token/dataset/test-code inputs
- `src/app/host/lead-forms/page.tsx` exposes per-form Facebook fields
- `src/app/api/host/lead-forms/route.ts` persists per-form Facebook fields
- lead-form submission/manual qualify code paths reference a form-specific helper instead of the shared user-level config

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs test/leads-qualified-capi-routes.test.mjs`

Expected: FAIL because the lead-form editor and API do not yet own those fields.

**Step 3: Write minimal implementation**

Do not touch runtime event logic yet. Only add the test scaffolding and the smallest file-level changes needed to make the ownership expectations true.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs test/leads-qualified-capi-routes.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs test/leads-qualified-capi-routes.test.mjs
git commit -m "test: lock per-form facebook config ownership"
```

### Task 2: Add schema and lead-form API persistence

**Files:**
- Modify: `supabase/migration_instant_leads.sql`
- Modify: `supabase/schema_updates.sql`
- Modify: `src/app/api/host/lead-forms/route.ts`

**Step 1: Write the failing test**

Extend `test/lead-form-facebook-config.test.mjs` to assert these exact keys are accepted by the lead-form route:
- `meta_capi_access_token`
- `meta_capi_dataset_id`
- `meta_capi_test_event_code`
- `facebook_purchase_value`
- `send_qualified_to_facebook`
- `send_purchase_to_facebook`

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/lead-form-facebook-config.test.mjs`

Expected: FAIL because the API route does not yet persist the new fields.

**Step 3: Write minimal implementation**

Add the six fields to `lead_forms` in both SQL files. In `src/app/api/host/lead-forms/route.ts`, normalize string fields, persist booleans safely, and include the fields on GET-by-id.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/lead-form-facebook-config.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migration_instant_leads.sql supabase/schema_updates.sql src/app/api/host/lead-forms/route.ts test/lead-form-facebook-config.test.mjs
git commit -m "feat: persist facebook config on lead forms"
```

### Task 3: Add the lead-form editor fields and remove shared host-leads fields

**Files:**
- Modify: `src/app/host/lead-forms/page.tsx`
- Modify: `src/app/host/leads/page.tsx`
- Test: `test/leads-page-layout.test.mjs`
- Test: `test/lead-form-facebook-config.test.mjs`

**Step 1: Write the failing test**

Add assertions that the lead-form editor UI includes:
- Meta CAPI access token
- Meta dataset id
- Meta test event code
- Purchase value
- Qualified sending to Facebook
- Purchase sending to Facebook

Also assert the host leads page no longer shows the shared Meta settings block.

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs`

Expected: FAIL because the editor and host leads page still use the old ownership model.

**Step 3: Write minimal implementation**

Add the new fields to the `FullForm` editor state, new-form defaults, save payload, and edit form loader. Remove the shared token/dataset/test-code controls from `src/app/host/leads/page.tsx`, but keep pipeline stage settings there.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/host/lead-forms/page.tsx src/app/host/leads/page.tsx test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs
git commit -m "feat: move facebook controls into lead form editor"
```

### Task 4: Implement per-form qualified Lead sends

**Files:**
- Create: `src/lib/lead-form-facebook-capi.ts`
- Modify: `src/app/api/leads/submit/route.ts`
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/app/leads/[slug]/page.tsx`
- Modify: `src/lib/instantmeeting-payment-capi-server.ts`
- Test: `test/leads-qualified-capi-routes.test.mjs`
- Create: `test/lead-form-facebook-events.test.mjs`

**Step 1: Write the failing test**

Cover:
- per-form helper skips when `send_qualified_to_facebook` is off
- per-form helper sends `Lead` when `send_qualified_to_facebook` is on and form config exists
- public lead-form submit page passes `_fbp`, `_fbc`, `fbclid`, and `page_url`
- manual move to `qualified` uses the lead’s `lead_form_id` to load the form config
- dedupe marker is respected for qualified sends

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/leads-qualified-capi-routes.test.mjs test/lead-form-facebook-events.test.mjs`

Expected: FAIL because qualified sends are not yet per-form or toggle-controlled.

**Step 3: Write minimal implementation**

Create a focused helper for form-owned conversions. Use each lead form’s config and `send_qualified_to_facebook` toggle. Reuse the existing generic Meta send plumbing where possible. Ensure dedupe write results are checked and logged.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/leads-qualified-capi-routes.test.mjs test/lead-form-facebook-events.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/lead-form-facebook-capi.ts src/app/api/leads/submit/route.ts src/app/api/leads/route.ts src/app/leads/[slug]/page.tsx src/lib/instantmeeting-payment-capi-server.ts test/leads-qualified-capi-routes.test.mjs test/lead-form-facebook-events.test.mjs
git commit -m "feat: send qualified facebook events per lead form"
```

### Task 5: Implement per-form Purchase-on-sold with per-form purchase value

**Files:**
- Modify: `src/lib/lead-form-facebook-capi.ts`
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/app/host/lead-forms/page.tsx`
- Test: `test/lead-form-facebook-events.test.mjs`

**Step 1: Write the failing test**

Cover:
- `send_purchase_to_facebook = false` skips Purchase
- `send_purchase_to_facebook = true` sends Purchase only on `sold`
- Purchase uses the lead form’s own `facebook_purchase_value`
- qualified and purchase toggles are independent

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/lead-form-facebook-events.test.mjs`

Expected: FAIL because per-form Purchase-on-sold is not implemented yet.

**Step 3: Write minimal implementation**

Extend the helper to send `Purchase` only for `sold`, only when the purchase toggle is on, and only with the form’s purchase value.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/lead-form-facebook-events.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/lead-form-facebook-capi.ts src/app/api/leads/route.ts src/app/host/lead-forms/page.tsx test/lead-form-facebook-events.test.mjs
git commit -m "feat: add per-form purchase event controls"
```

### Task 6: Add separate admin/payment purchase value

**Files:**
- Modify: `supabase/migration_instant_leads.sql`
- Modify: `supabase/schema_updates.sql`
- Modify: `src/lib/profile-settings.ts`
- Modify: `src/app/api/profile/settings/route.ts`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/api/admin/pending/route.ts`
- Modify: `src/lib/instantmeeting-payment-capi.ts`
- Test: `test/admin-payment-controls.test.mjs`
- Test: `test/profile-settings.test.mjs`
- Test: `test/instantmeeting-payment-capi.test.mjs`

**Step 1: Write the failing test**

Cover:
- admin payment settings exposes editable purchase value
- profile settings normalizes/persists admin payment purchase value
- admin verify uses that admin-configured value instead of the old fixed constant

**Step 2: Run test to verify it fails**

Run: `npm run test:node -- test/admin-payment-controls.test.mjs test/profile-settings.test.mjs test/instantmeeting-payment-capi.test.mjs`

Expected: FAIL because the admin payment value is still fixed.

**Step 3: Write minimal implementation**

Add a user-level payment purchase value field (separate from lead forms), persist it via `/api/profile/settings`, surface it in `/admin`, and pass it into the admin verify Meta send.

**Step 4: Run test to verify it passes**

Run: `npm run test:node -- test/admin-payment-controls.test.mjs test/profile-settings.test.mjs test/instantmeeting-payment-capi.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migration_instant_leads.sql supabase/schema_updates.sql src/lib/profile-settings.ts src/app/api/profile/settings/route.ts src/app/admin/page.tsx src/app/api/admin/pending/route.ts src/lib/instantmeeting-payment-capi.ts test/admin-payment-controls.test.mjs test/profile-settings.test.mjs test/instantmeeting-payment-capi.test.mjs
git commit -m "feat: make admin payment purchase value configurable"
```

### Task 7: Final verification

**Files:**
- Tests: `test/*.test.mjs`

**Step 1: Run targeted regression tests**

Run:

```bash
npm run test:node -- test/leads-page-layout.test.mjs test/lead-form-facebook-config.test.mjs test/leads-qualified-capi-routes.test.mjs test/lead-form-facebook-events.test.mjs test/admin-payment-controls.test.mjs test/profile-settings.test.mjs test/instantmeeting-payment-capi.test.mjs test/signup-modal-payment.test.mjs
```

Expected: all pass.

**Step 2: Run full verification**

Run:

```bash
npm run test:node
npx tsc --noEmit
```

Expected: no failures, no type errors.

**Step 3: Commit final polish if needed**

```bash
git add .
git commit -m "chore: finalize per-form facebook conversion controls"
```
