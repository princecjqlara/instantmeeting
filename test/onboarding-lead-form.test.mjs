import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildOnboardingLeadFormPayload } from '../src/lib/onboarding-lead-form.ts'

test('onboarding lead form payload skips ads setup fields', () => {
    const payload = buildOnboardingLeadFormPayload({
        title: 'Lead form',
        description: 'Find qualified buyers',
        ai_criteria: 'Decision-makers with budget and active need.',
        auto_admit_threshold: 70,
        unqualified_message: 'Thanks for your response.',
        questions: [{ question_text: 'Full name', type: 'short_answer', required: true }],
    })

    assert.deepEqual(payload, {
        title: 'Lead form',
        description: 'Find qualified buyers',
        ai_criteria: 'Decision-makers with budget and active need.',
        auto_admit_threshold: 70,
        unqualified_message: 'Thanks for your response.',
        fallback_to_waiting: true,
        questions: [{ question_text: 'Full name', type: 'short_answer', required: true }],
    })
    assert.ok(!('meta_capi_access_token' in payload))
    assert.ok(!('meta_capi_dataset_id' in payload))
    assert.ok(!('meta_capi_test_event_code' in payload))
    assert.ok(!('send_qualified_to_facebook' in payload))
    assert.ok(!('send_purchase_to_facebook' in payload))
})

test('onboarding page requests onboarding AI mode', () => {
    const source = readFileSync(new URL('../src/app/onboarding/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes("mode: 'onboarding'"))
    assert.ok(source.includes('buildOnboardingLeadFormPayload'))
})
