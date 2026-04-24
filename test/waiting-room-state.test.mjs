import test from 'node:test'
import assert from 'node:assert/strict'

import {
    canGuestJoinRoom,
    isHostCurrentlyAvailable,
    shouldAutoOpenBookingModal,
    shouldShowBookingCallToAction,
    shouldStopWaitingRoomPolling,
} from '../src/lib/waiting-room-state.ts'

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

test('scheduled hosts are available during their active window', () => {
    const isAvailable = isHostCurrentlyAvailable(
        {
            availabilityMode: 'scheduled',
            availableFrom: '09:00',
            availableTo: '17:00',
            timezone: 'UTC',
        },
        new Date('2026-04-22T10:00:00.000Z')
    )

    assert.equal(isAvailable, true)
})

test('waiting room does not auto-open booking when a scheduled host is currently available', () => {
    const shouldAutoOpen = shouldAutoOpenBookingModal(
        {
            guestStatus: 'waiting',
            meetingStatus: 'active',
            autoScheduleRequired: false,
            availabilityMode: 'scheduled',
            availableFrom: '09:00',
            availableTo: '17:00',
            timezone: 'UTC',
        },
        new Date('2026-04-22T10:00:00.000Z')
    )

    assert.equal(shouldAutoOpen, false)
})

test('waiting room still shows booking when host is outside their scheduled window', () => {
    const shouldShowBooking = shouldShowBookingCallToAction(
        {
            autoScheduleRequired: false,
            availabilityMode: 'scheduled',
            availableFrom: '09:00',
            availableTo: '17:00',
            timezone: 'UTC',
        },
        new Date('2026-04-22T19:00:00.000Z')
    )

    assert.equal(shouldShowBooking, true)
})

test('admitted guests cannot join the room when booking is required', () => {
    const canJoin = canGuestJoinRoom({
        meetingStatus: 'active',
        guestStatus: 'admitted',
        autoScheduleRequired: true,
    })

    assert.equal(canJoin, false)
})

test('waiting room auto-opens booking for admitted guests when booking is required', () => {
    const shouldAutoOpen = shouldAutoOpenBookingModal({
        guestStatus: 'admitted',
        meetingStatus: 'active',
        autoScheduleRequired: true,
    })

    assert.equal(shouldAutoOpen, true)
})
