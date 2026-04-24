import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
    INSTANTMEETING_PAYMENT_PIPELINE_STAGES,
    INSTANTMEETING_SOLD_VALUE_PHP,
    buildInstantMeetingMetaEvent,
    resolveInstantMeetingPaymentTrigger,
} from '../src/lib/instantmeeting-payment-capi.ts'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

test('InstantMeeting payment pipeline follows the paid signup ladder', () => {
    assert.deepEqual(INSTANTMEETING_PAYMENT_PIPELINE_STAGES, [
        'landing_visit',
        'diagnostic_started',
        'diagnostic_completed',
        'checkout_opened',
        'payment_info_added',
        'lead',
        'sold',
    ])
    assert.equal(INSTANTMEETING_SOLD_VALUE_PHP, 699)
})

test('payment triggers map to the expected pipeline stages', () => {
    assert.deepEqual(resolveInstantMeetingPaymentTrigger('website_visit'), {
        trigger: 'website_visit',
        pipelineStage: 'landing_visit',
        eventName: 'PageView',
        value: 699,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('diagnostic_start'), {
        trigger: 'diagnostic_start',
        pipelineStage: 'diagnostic_started',
        eventName: 'InstantMeetingDiagnosticStart',
        value: 699,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('diagnostic_complete'), {
        trigger: 'diagnostic_complete',
        pipelineStage: 'diagnostic_completed',
        eventName: 'InstantMeetingDiagnosticComplete',
        value: 699,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('checkout_opened'), {
        trigger: 'checkout_opened',
        pipelineStage: 'checkout_opened',
        eventName: 'InitiateCheckout',
        value: 699,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('payment_info_added'), {
        trigger: 'payment_info_added',
        pipelineStage: 'payment_info_added',
        eventName: 'AddPaymentInfo',
        value: 699,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('payment_review_submit'), {
        trigger: 'payment_review_submit',
        pipelineStage: 'lead',
        eventName: 'Lead',
        value: 699,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('admin_verify'), {
        trigger: 'admin_verify',
        pipelineStage: 'sold',
        eventName: 'Purchase',
        value: 699,
    })
})

test('buildInstantMeetingMetaEvent hashes identity fields and sets purchase value for sold events', () => {
    const event = buildInstantMeetingMetaEvent({
        trigger: 'admin_verify',
        eventSourceUrl: 'https://instantmeeting.ai/?fbclid=test-click',
        email: '  Test@Example.com ',
        phone: ' +63 912 345 6789 ',
        name: '  Jane Doe ',
        fbp: 'fb.1.123456.abcdef',
        fbc: 'fb.1.123456.test-click',
        clientIpAddress: '203.0.113.10',
        clientUserAgent: 'InstantMeetingTest/1.0',
    })

    assert.equal(event.event_name, 'Purchase')
    assert.equal(event.action_source, 'website')
    assert.equal(event.event_source_url, 'https://instantmeeting.ai/?fbclid=test-click')
    assert.equal(event.custom_data.currency, 'PHP')
    assert.equal(event.custom_data.value, 699)
    assert.equal(event.custom_data.pipeline_stage, 'sold')
    assert.equal(event.custom_data.funnel, 'instantmeeting_admin_landing')
    assert.equal(event.custom_data.landing_variant, 'real_estate_vsl')
    assert.equal(event.custom_data.plan, 'starter')
    assert.equal(event.user_data.em?.[0], sha256('test@example.com'))
    assert.equal(event.user_data.ph?.[0], sha256('639123456789'))
    assert.equal(event.user_data.fn?.[0], sha256('jane'))
    assert.equal(event.user_data.ln?.[0], sha256('doe'))
    assert.equal(event.user_data.client_ip_address, '203.0.113.10')
    assert.equal(event.user_data.client_user_agent, 'InstantMeetingTest/1.0')
    assert.equal(event.user_data.fbp, 'fb.1.123456.abcdef')
    assert.equal(event.user_data.fbc, 'fb.1.123456.test-click')
})

test('buildInstantMeetingMetaEvent supports overriding the purchase value', () => {
    const event = buildInstantMeetingMetaEvent({
        trigger: 'admin_verify',
        eventSourceUrl: 'https://instantmeeting.ai/admin',
        valueOverride: 1250,
    })

    assert.equal(event.event_name, 'Purchase')
    assert.equal(event.custom_data.value, 1250)
})

test('buildInstantMeetingMetaEvent marks receipt review submits as Lead events', () => {
    const event = buildInstantMeetingMetaEvent({
        trigger: 'payment_review_submit',
        eventSourceUrl: 'https://instantmeeting.ai/',
        email: 'lead@example.com',
    })

    assert.equal(event.event_name, 'Lead')
    assert.equal(event.custom_data.pipeline_stage, 'lead')
    assert.equal(event.custom_data.pipeline_trigger, 'payment_review_submit')
    assert.equal(event.custom_data.funnel, 'instantmeeting_admin_landing')
    assert.equal(event.custom_data.landing_variant, 'real_estate_vsl')
    assert.equal(event.custom_data.plan, 'starter')
    assert.equal(event.custom_data.currency, 'PHP')
    assert.equal(event.custom_data.value, 699)
})

test('buildInstantMeetingMetaEvent enriches landing diagnostic and checkout events', () => {
    const diagnostic = buildInstantMeetingMetaEvent({
        trigger: 'diagnostic_complete',
        eventSourceUrl: 'https://instantmeeting.ai/?utm=diag',
        diagnosticScore: 84,
        diagnosticVerdict: 'high_fit',
    })

    assert.equal(diagnostic.event_name, 'InstantMeetingDiagnosticComplete')
    assert.equal(diagnostic.custom_data.funnel, 'instantmeeting_admin_landing')
    assert.equal(diagnostic.custom_data.landing_variant, 'real_estate_vsl')
    assert.equal(diagnostic.custom_data.plan, 'starter')
    assert.equal(diagnostic.custom_data.pipeline_stage, 'diagnostic_completed')
    assert.equal(diagnostic.custom_data.diagnostic_score, 84)
    assert.equal(diagnostic.custom_data.diagnostic_verdict, 'high_fit')
    assert.equal(diagnostic.custom_data.currency, 'PHP')
    assert.equal(diagnostic.custom_data.value, 699)

    const checkout = buildInstantMeetingMetaEvent({
        trigger: 'checkout_opened',
        eventSourceUrl: 'https://instantmeeting.ai/#seller-funnel',
        diagnosticScore: 92,
        diagnosticVerdict: 'urgent',
        valueOverride: 799,
    })

    assert.equal(checkout.event_name, 'InitiateCheckout')
    assert.equal(checkout.custom_data.pipeline_stage, 'checkout_opened')
    assert.equal(checkout.custom_data.diagnostic_score, 92)
    assert.equal(checkout.custom_data.diagnostic_verdict, 'urgent')
    assert.equal(checkout.custom_data.value, 799)
})

test('payment funnel server helpers allow admin flows to force organizer-owned config', () => {
    const source = readFileSync(new URL('../src/lib/instantmeeting-payment-capi-server.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('sendInstantMeetingPaymentMetaCapiEvent'))
    assert.ok(source.includes('organizerId?: string | null'))
    assert.ok(source.includes('fetchInstantMeetingPaymentFunnelSettings(supabase, { organizerId: input.organizerId })'))
    assert.ok(source.includes('if (organizerId) {'))
})

test('payment funnel owner lookup tolerates a missing purchase value column', () => {
    const source = readFileSync(new URL('../src/lib/instantmeeting-payment-capi-server.ts', import.meta.url), 'utf8')
    const pendingRouteSource = readFileSync(new URL('../src/app/api/admin/pending/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('isMissingUsersColumnError'))
    assert.ok(source.includes('includePurchaseValueColumn'))
    assert.ok(source.includes('return runPaymentOwnerQuery(buildQuery, false)'))
    assert.ok(!pendingRouteSource.includes("select('id, role, instantmeeting_payment_purchase_value_php')"))
})
