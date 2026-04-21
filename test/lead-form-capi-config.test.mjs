import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead form editor exposes per-form Meta CAPI fields', () => {
    const source = readFileSync(new URL('../src/app/host/lead-forms/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('Meta CAPI access token'))
    assert.ok(source.includes('Meta dataset id'))
    assert.ok(source.includes('Meta test event code'))
    assert.ok(source.includes('Purchase value'))
    assert.ok(source.includes('Qualified sending to Facebook'))
    assert.ok(source.includes('Purchase sending to Facebook'))
})

test('lead forms API persists per-form Meta CAPI fields', () => {
    const source = readFileSync(new URL('../src/app/api/host/lead-forms/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('meta_capi_access_token'))
    assert.ok(source.includes('meta_capi_dataset_id'))
    assert.ok(source.includes('meta_capi_test_event_code'))
    assert.ok(source.includes('facebook_purchase_value'))
    assert.ok(source.includes('send_qualified_to_facebook'))
    assert.ok(source.includes('send_purchase_to_facebook'))
})
