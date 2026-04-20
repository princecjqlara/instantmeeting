import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead submit route reuses an existing lead session token instead of blindly inserting', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes(".eq('lead_session_token', normalizedSessionToken)"))
    assert.ok(source.includes('existingLeadSession'))
    assert.ok(source.includes("existingLeadSession?.status === 'admitted' ? 'admitted' : 'waiting'"))
})
