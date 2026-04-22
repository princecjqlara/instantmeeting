import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldHostAutoEndMeetingWhenEmpty } from '../src/lib/meeting-presence.ts'

test('host auto-ends when no guest is waiting or active', () => {
    assert.equal(
        shouldHostAutoEndMeetingWhenEmpty({
            isHost: true,
            meetingStatus: 'active',
            waitingGuestCount: 0,
            activeGuestCount: 0,
        }),
        true
    )
})

test('host does not auto-end while a guest is still waiting', () => {
    assert.equal(
        shouldHostAutoEndMeetingWhenEmpty({
            isHost: true,
            meetingStatus: 'active',
            waitingGuestCount: 1,
            activeGuestCount: 0,
        }),
        false
    )
})

test('host does not auto-end completed meetings twice', () => {
    assert.equal(
        shouldHostAutoEndMeetingWhenEmpty({
            isHost: true,
            meetingStatus: 'completed',
            waitingGuestCount: 0,
            activeGuestCount: 0,
        }),
        false
    )
})
