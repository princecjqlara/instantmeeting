import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
    buildGuestRoomPath,
    buildGuestWaitingPath,
    consumeExternalBrowserHandoff,
    getGuestNameFromSearch,
    markExternalBrowserHandoff,
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

test('browser handoff marker is consumed once for same path within the suppression window', () => {
    const storage = new Map()
    const sessionStorage = {
        setItem(key, value) {
            storage.set(key, value)
        },
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null
        },
        removeItem(key) {
            storage.delete(key)
        },
    }

    markExternalBrowserHandoff('/waiting/meeting-123', sessionStorage, 1_000)

    assert.equal(
        consumeExternalBrowserHandoff('/waiting/meeting-123', sessionStorage, 5_000),
        true
    )
    assert.equal(
        consumeExternalBrowserHandoff('/waiting/meeting-123', sessionStorage, 5_100),
        false
    )
})

test('join route forwards guest context into room or waiting URLs', () => {
    const source = readFileSync(new URL('../src/app/api/join/[token]/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('buildGuestRoomPath'))
    assert.ok(source.includes('buildGuestWaitingPath'))
})

test('universal link route creates a guest and redirects with guest context', () => {
    const source = readFileSync(new URL('../src/app/join/[username]/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes("from('waiting_guests')"))
    assert.ok(source.includes('buildGuestWaitingPath'))
})

test('room page restores guest identity from query string for external browsers', () => {
    const source = readFileSync(new URL('../src/app/room/[roomId]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('useSearchParams'))
    assert.ok(source.includes('guestName'))
    assert.ok(source.includes('<InAppBrowserGate>'))
})

test('waiting page persists guest identity into the URL for external-browser handoff', () => {
    const source = readFileSync(new URL('../src/app/waiting/[meetingId]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('guestName'))
    assert.ok(source.includes('getGuestNameFromSearch'))
    assert.ok(source.includes('consumeExternalBrowserHandoff'))
    assert.ok(source.includes('buildGuestWaitingPath'))
    assert.ok(source.includes('window.history.replaceState'))
})
