import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead routes no longer send payment-funnel Lead events on qualified transitions', () => {
    const source = readFileSync(new URL('../src/app/api/leads/route.ts', import.meta.url), 'utf8')
    const submitSource = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.ok(!source.includes('maybeSendInstantMeetingQualifiedLeadEvent'))
    assert.ok(!submitSource.includes('maybeSendInstantMeetingQualifiedLeadEvent'))
    assert.ok(!source.includes('meta_qualified_sent_at'))
})

test('admin pending route no longer sends rejected signups to Meta', () => {
    const source = readFileSync(new URL('../src/app/api/admin/pending/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes("trigger: 'admin_verify'"))
    assert.ok(!source.includes("trigger: 'admin_reject'"))
})

test('signup route sends Lead when a receipt is submitted for review', () => {
    const source = readFileSync(new URL('../src/app/api/signup/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('sendInstantMeetingMetaCapiEvent'))
    assert.ok(source.includes("trigger: 'payment_review_submit'"))
    assert.ok(source.includes("status: 'pending'"))
})
