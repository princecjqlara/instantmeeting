import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('landing page posts an InstantMeeting CAPI visit event once per session', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('/api/capi/instantmeeting'))
    assert.ok(source.includes('instantmeeting:landing-capi-visit'))
    assert.ok(source.includes('fbclid'))
    assert.ok(source.includes('_fbp'))
    assert.ok(source.includes('_fbc'))
})
