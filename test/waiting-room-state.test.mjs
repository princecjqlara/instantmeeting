import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldStopWaitingRoomPolling } from '../src/lib/waiting-room-state.ts'

test('shouldStopWaitingRoomPolling stops polling when guest is admitted even before host joins', () => {
    const shouldStop = shouldStopWaitingRoomPolling({
        meetingStatus: 'active',
        guestStatus: 'admitted',
        hostJoinedAt: null,
    })

    assert.equal(shouldStop, true)
})

test('shouldStopWaitingRoomPolling stops polling when meeting is completed', () => {
    const shouldStop = shouldStopWaitingRoomPolling({
        meetingStatus: 'completed',
        guestStatus: 'waiting',
        hostJoinedAt: null,
    })

    assert.equal(shouldStop, true)
})

test('shouldStopWaitingRoomPolling stops polling when admitted guest can join', () => {
    const shouldStop = shouldStopWaitingRoomPolling({
        meetingStatus: 'active',
        guestStatus: 'admitted',
        hostJoinedAt: '2026-03-04T00:00:00.000Z',
    })

    assert.equal(shouldStop, true)
})
