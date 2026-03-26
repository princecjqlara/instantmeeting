import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGuestJoinInsights } from '../src/lib/guest-join-insights.ts'

test('buildGuestJoinInsights returns overall and weekday averages in timezone order', () => {
    const insights = buildGuestJoinInsights([
        { joined_at: '2026-03-02T09:00:00.000Z' },
        { joined_at: '2026-03-02T11:00:00.000Z' },
        { joined_at: '2026-03-03T15:30:00.000Z' },
        { joined_at: '2026-03-03T16:30:00.000Z' },
    ], 'UTC')

    assert.equal(insights.totalJoins, 4)
    assert.equal(insights.overallAverage.label, '01:00 PM')
    assert.deepEqual(insights.weekdays.map((day) => ({
        weekday: day.weekday,
        count: day.count,
        label: day.averageTime.label,
    })), [
        { weekday: 'Monday', count: 2, label: '10:00 AM' },
        { weekday: 'Tuesday', count: 2, label: '04:00 PM' },
    ])
})

test('buildGuestJoinInsights returns an empty result when no joins exist', () => {
    const insights = buildGuestJoinInsights([], 'UTC')

    assert.equal(insights.totalJoins, 0)
    assert.equal(insights.overallAverage, null)
    assert.deepEqual(insights.weekdays, [])
})

test('buildGuestJoinInsights averages late-night joins across midnight', () => {
    const insights = buildGuestJoinInsights([
        { joined_at: '2026-03-06T23:50:00.000Z' },
        { joined_at: '2026-03-07T00:10:00.000Z' },
    ], 'UTC')

    assert.equal(insights.overallAverage?.label, '12:00 AM')
})

test('buildGuestJoinInsights skips invalid timestamps instead of throwing', () => {
    const insights = buildGuestJoinInsights([
        { joined_at: 'not-a-date' },
        { joined_at: '2026-03-02T09:00:00.000Z' },
    ], 'UTC')

    assert.equal(insights.totalJoins, 1)
    assert.equal(insights.overallAverage?.label, '09:00 AM')
    assert.equal(insights.weekdays[0]?.weekday, 'Monday')
})
