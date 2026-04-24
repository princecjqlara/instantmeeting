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
    assert.ok(!source.includes('maybeSendInstantMeetingQualifiedLeadEvent'))
})

test('qualified leads require booking when the team clock has nobody clocked in', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.equal(
        source.includes("if (hostActive && err.availabilityReason === 'no_clocked_in')"),
        false,
        'no_clocked_in should not retry auto-admit into a room'
    )
    assert.ok(
        source.includes('return NextResponse.json({') && source.includes("verdict: 'needs_booking'"),
        'expected no available team member path to return needs_booking'
    )
})
