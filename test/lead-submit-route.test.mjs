import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead submit route preserves guest handoff context in waiting URL', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('buildGuestWaitingPath'))
    assert.ok(source.includes('waiting_url'))
    assert.ok(source.includes('resolvedName'))
})
