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

test('InstantMeeting payment pipeline is fixed to unqualified and sold', () => {
    assert.deepEqual(INSTANTMEETING_PAYMENT_PIPELINE_STAGES, ['unqualified', 'sold'])
    assert.equal(INSTANTMEETING_SOLD_VALUE_PHP, 699)
})

test('payment triggers map to the expected pipeline stages', () => {
    assert.deepEqual(resolveInstantMeetingPaymentTrigger('website_visit'), {
        trigger: 'website_visit',
        pipelineStage: 'unqualified',
        eventName: 'PageView',
        value: null,
    })

    assert.deepEqual(resolveInstantMeetingPaymentTrigger('payment_review_submit'), {
        trigger: 'payment_review_submit',
        pipelineStage: 'unqualified',
        eventName: 'Lead',
        value: null,
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
    assert.ok(!('value' in event.custom_data))
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
