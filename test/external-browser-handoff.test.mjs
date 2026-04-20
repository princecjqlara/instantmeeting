import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
    buildGuestRoomPath,
    buildGuestWaitingPath,
    getGuestNameFromSearch,
} from '../src/lib/external-browser-handoff.ts'

test('browser handoff helpers preserve guest identity in URLs', () => {
    assert.equal(
        buildGuestRoomPath('meeting-123', '  Jane Doe  '),
        '/room/meeting-123?guestName=Jane+Doe'
    )

    assert.equal(
        buildGuestWaitingPath('meeting-123', 'guest-456', '  Jane Doe  '),
        '/waiting/meeting-123?guestId=guest-456&guestName=Jane+Doe'
    )

    assert.equal(getGuestNameFromSearch('?guestName=Jane+Doe'), 'Jane Doe')
    assert.equal(getGuestNameFromSearch('?guestName='), null)
})

test('join route forwards guest context into room or waiting URLs', () => {
    const source = readFileSync(new URL('../src/app/api/join/[token]/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('buildGuestRoomPath'))
    assert.ok(source.includes('buildGuestWaitingPath'))
})

test('room page restores guest identity from query string for external browsers', () => {
    const source = readFileSync(new URL('../src/app/room/[roomId]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('useSearchParams'))
    assert.ok(source.includes('guestName'))
})

test('waiting page stores guest identity from query string for later auto-join', () => {
    const source = readFileSync(new URL('../src/app/waiting/[meetingId]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('guestName'))
    assert.ok(source.includes('getGuestNameFromSearch'))
})
