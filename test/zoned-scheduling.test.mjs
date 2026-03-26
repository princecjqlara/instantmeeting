import test from 'node:test'
import assert from 'node:assert/strict'

import { combineDateAndTimeInTimeZone } from '../src/lib/zoned-scheduling.ts'

test('combineDateAndTimeInTimeZone converts host local time into UTC ISO string', () => {
    const result = combineDateAndTimeInTimeZone('2026-03-02', '09:30', 'America/New_York')

    assert.equal(result, '2026-03-02T14:30:00.000Z')
})

test('combineDateAndTimeInTimeZone falls back to UTC for invalid timezones', () => {
    const result = combineDateAndTimeInTimeZone('2026-03-02', '09:30', 'Not/A_Zone')

    assert.equal(result, '2026-03-02T09:30:00.000Z')
})
