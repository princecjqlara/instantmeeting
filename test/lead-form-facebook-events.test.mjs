import test from 'node:test'
import assert from 'node:assert/strict'

import {
    maybeSendLeadFormQualifiedMetaEvent,
    maybeSendLeadFormPurchaseMetaEvent,
} from '../src/lib/lead-form-qualified-capi.ts'

test('qualified lead send skips when the form toggle is off', async () => {
    let sendCalls = 0

    const result = await maybeSendLeadFormQualifiedMetaEvent(
        {
            supabase: {},
            leadForm: {
                meta_capi_access_token: 'token',
                meta_capi_dataset_id: 'dataset',
                send_qualified_to_facebook: false,
            },
            lead: { id: 'lead-1', guest_email: 'lead@example.com' },
            eventSourceUrl: 'https://instantmeeting.ai/leads/demo',
        },
        {
            sendWithConfig: async () => {
                sendCalls += 1
                return { sent: true }
            },
        }
    )

    assert.deepEqual(result, { sent: false, reason: 'disabled' })
    assert.equal(sendCalls, 0)
})

test('qualified lead send falls back to the form owner Meta config when the form has none', async () => {
    let usedConfig = null
    let markCalls = 0

    const result = await maybeSendLeadFormQualifiedMetaEvent(
        {
            supabase: {},
            leadForm: {
                user_id: 'host-1',
                send_qualified_to_facebook: true,
            },
            lead: { id: 'lead-1', guest_email: 'lead@example.com' },
            eventSourceUrl: 'https://instantmeeting.ai/leads/demo',
        },
        {
            resolveConfig: async () => ({
                accessToken: 'owner-token',
                datasetId: 'owner-dataset',
                testEventCode: 'TEST123',
            }),
            sendWithConfig: async (config) => {
                usedConfig = config
                return { sent: true }
            },
            markLeadFlags: async () => {
                markCalls += 1
                return { error: null }
            },
        }
    )

    assert.deepEqual(result, { sent: true })
    assert.deepEqual(usedConfig, {
        accessToken: 'owner-token',
        datasetId: 'owner-dataset',
        testEventCode: 'TEST123',
    })
    assert.equal(markCalls, 1)
})

test('purchase send uses the form purchase value on sold when enabled', async () => {
    const sentPayloads = []

    const result = await maybeSendLeadFormPurchaseMetaEvent(
        {
            supabase: {},
            leadForm: {
                meta_capi_access_token: 'token',
                meta_capi_dataset_id: 'dataset',
                send_purchase_to_facebook: true,
                facebook_purchase_value: 1250,
            },
            lead: { id: 'lead-1', guest_name: 'Jane Doe', guest_email: 'lead@example.com' },
            eventSourceUrl: 'https://instantmeeting.ai/leads/demo',
        },
        {
            claimSend: async () => ({ claimed: true, error: null }),
            sendWithConfig: async (_config, payload) => {
                sentPayloads.push(payload)
                return { sent: true }
            },
        }
    )

    assert.deepEqual(result, { sent: true })
    assert.equal(sentPayloads.length, 1)
    assert.equal(sentPayloads[0].event_name, 'Purchase')
    assert.equal(sentPayloads[0].custom_data.value, 1250)
    assert.equal(sentPayloads[0].custom_data.pipeline_trigger, 'sold')
})

test('purchase send skips when a lead was already marked as purchased', async () => {
    let sendCalls = 0

    const result = await maybeSendLeadFormPurchaseMetaEvent(
        {
            supabase: {},
            leadForm: {
                meta_capi_access_token: 'token',
                meta_capi_dataset_id: 'dataset',
                send_purchase_to_facebook: true,
                facebook_purchase_value: 1250,
            },
            lead: {
                id: 'lead-1',
                guest_name: 'Jane Doe',
                guest_email: 'lead@example.com',
                meta_purchase_sent_at: '2026-04-21T00:00:00.000Z',
            },
            eventSourceUrl: 'https://instantmeeting.ai/leads/demo',
        },
        {
            claimSend: async () => ({ claimed: true, error: null }),
            sendWithConfig: async () => {
                sendCalls += 1
                return { sent: true }
            },
        }
    )

    assert.deepEqual(result, { sent: false, reason: 'already_sent' })
    assert.equal(sendCalls, 0)
})

test('purchase send skips when the form purchase toggle is off', async () => {
    let sendCalls = 0

    const result = await maybeSendLeadFormPurchaseMetaEvent(
        {
            supabase: {},
            leadForm: {
                meta_capi_access_token: 'token',
                meta_capi_dataset_id: 'dataset',
                send_purchase_to_facebook: false,
                facebook_purchase_value: 1250,
            },
            lead: { id: 'lead-1', guest_name: 'Jane Doe', guest_email: 'lead@example.com' },
            eventSourceUrl: 'https://instantmeeting.ai/leads/demo',
        },
        {
            sendWithConfig: async () => {
                sendCalls += 1
                return { sent: true }
            },
        }
    )

    assert.deepEqual(result, { sent: false, reason: 'disabled' })
    assert.equal(sendCalls, 0)
})
