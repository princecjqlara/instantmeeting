import test from 'node:test'
import assert from 'node:assert/strict'

import { buildMetaCapiRequestBody } from '../src/lib/meta-capi-request.ts'

test('buildMetaCapiRequestBody includes test_event_code when provided', () => {
    const payload = buildMetaCapiRequestBody(
        { event_name: 'PageView', action_source: 'website' },
        { testEventCode: 'TEST123' }
    )

    assert.deepEqual(payload, {
        data: [{ event_name: 'PageView', action_source: 'website' }],
        test_event_code: 'TEST123',
    })
})

test('buildMetaCapiRequestBody omits test_event_code when blank', () => {
    const payload = buildMetaCapiRequestBody(
        { event_name: 'PageView', action_source: 'website' },
        { testEventCode: '   ' }
    )

    assert.deepEqual(payload, {
        data: [{ event_name: 'PageView', action_source: 'website' }],
    })
})
