import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('qualified leads are evaluated for auto-admit before offline-host booking fallback', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    const qualifiedIndex = source.indexOf("if (qualification.verdict === 'qualified')")
    const hostInactiveIndex = source.indexOf('if (!hostActive)')

    assert.notEqual(qualifiedIndex, -1)
    assert.notEqual(hostInactiveIndex, -1)
    assert.ok(qualifiedIndex < hostInactiveIndex)
    assert.ok(source.includes("if (hostActive && err.availabilityReason === 'no_clocked_in')"))
})
