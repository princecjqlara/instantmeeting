import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead routes send qualified Meta events using per-form config', () => {
    const source = readFileSync(new URL('../src/app/api/leads/route.ts', import.meta.url), 'utf8')
    const submitSource = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')
    const pageSource = readFileSync(new URL('../src/app/leads/[slug]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('maybeSendLeadFormQualifiedMetaEvent'))
    assert.ok(submitSource.includes('maybeSendLeadFormQualifiedMetaEvent'))
    assert.ok(source.includes('lead_form_id'))
    assert.ok(source.includes('meta_qualified_sent_at'))
    assert.ok(pageSource.includes('page_url:'))
    assert.ok(pageSource.includes('fbp:'))
    assert.ok(pageSource.includes('fbc:'))
    assert.ok(pageSource.includes('fbclid:'))
})

test('lead routes only send per-form Purchase when transitioning into sold', () => {
    const source = readFileSync(new URL('../src/app/api/leads/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes("nextStage === 'sold' &&"))
    assert.ok(source.includes("pipeline_stage?: string | null"))
})

test('admin pending route keeps reject disabled but uses the signed-in organizer for purchase sends', () => {
    const source = readFileSync(new URL('../src/app/api/admin/pending/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('sendInstantMeetingPaymentMetaCapiEvent'))
    assert.ok(!source.includes("trigger: 'admin_reject'"))
    assert.ok(source.includes('organizerId: organizer.id'))
    assert.ok(source.includes("select('id, password_hash')"))
    assert.ok(source.includes(".is('password_hash', null)"))
})

test('signup route sends Lead when a receipt is submitted for review', () => {
    const source = readFileSync(new URL('../src/app/api/signup/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('sendInstantMeetingPaymentMetaCapiEvent'))
    assert.ok(source.includes("trigger: 'payment_review_submit'"))
    assert.ok(source.includes("status: 'pending'"))
})

test('auth recovers verified pending-signup passwords for existing passwordless users', () => {
    const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('recoverVerifiedSignupPasswordHash'))
    assert.ok(source.includes("from('pending_signups')"))
    assert.ok(source.includes(".eq('status', 'verified')"))
    assert.ok(source.includes(".is('password_hash', null)"))
})

test('auth resolves existing users by normalized email instead of case-sensitive equality', () => {
    const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('normalizeCredentialEmail'))
    assert.ok(source.includes(".ilike('email', normalizedEmail)"))
    assert.ok(source.includes('normalizeCredentialEmail(user.email) === normalizedEmail'))
    assert.ok(!source.includes(".eq('email', credentials.email.toLowerCase().trim())"))
})

test('auth provisions verified pending signups that are missing a users row', () => {
    const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('provisionVerifiedSignupUser'))
    assert.ok(source.includes("role: 'tenant'"))
    assert.ok(source.includes('.insert({'))
    assert.ok(source.includes('const provisionedUser = await provisionVerifiedSignupUser'))
})

test('auth tries every verified pending-signup password for duplicate approvals', () => {
    const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('findMatchingVerifiedPendingSignup'))
    assert.ok(source.includes('for (const signup of verifiedSignups)'))
    assert.ok(source.includes('return signup'))
})

test('auth repairs existing users whose stored hash differs from verified signup password', () => {
    const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('replaceExistingHash = false'))
    assert.ok(source.includes('if (!replaceExistingHash)'))
    assert.ok(source.includes('true'))
})

test('auth uses localhost-compatible cookies outside production', () => {
    const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')

    assert.ok(source.includes("useSecureCookies: process.env.NODE_ENV === 'production'"))
})
