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

test('admin pending route no longer sends rejected signups to Meta', () => {
    const source = readFileSync(new URL('../src/app/api/admin/pending/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('sendInstantMeetingPaymentMetaCapiEvent'))
    assert.ok(!source.includes("trigger: 'admin_reject'"))
    assert.ok(!source.includes('organizerId: organizer.id'))
})

test('signup route sends Lead when a receipt is submitted for review', () => {
    const source = readFileSync(new URL('../src/app/api/signup/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('sendInstantMeetingPaymentMetaCapiEvent'))
    assert.ok(source.includes("trigger: 'payment_review_submit'"))
    assert.ok(source.includes("status: 'pending'"))
})
