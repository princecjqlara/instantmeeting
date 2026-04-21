import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('admin page exposes InstantMeeting Meta CAPI settings and payment pipeline copy', () => {
    const source = readFileSync(new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('InstantMeeting payment funnel'))
    assert.ok(source.includes('Meta CAPI access token'))
    assert.ok(source.includes('Meta dataset id'))
    assert.ok(source.includes('Meta test event code'))
    assert.ok(source.includes('Landing page visit'))
    assert.ok(source.includes('Receipt submitted'))
    assert.ok(source.includes('Admin verify'))
    assert.ok(source.includes('Purchase value'))
    assert.ok(source.includes("/api/admin/payment-settings"))
})

test('admin payment settings route reads and writes the signed-in organizer payment owner', () => {
    const source = readFileSync(new URL('../src/app/api/admin/payment-settings/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('fetchInstantMeetingPaymentFunnelSettings'))
    assert.ok(source.includes('organizerId: organizer.id'))
    assert.ok(source.includes('isMissingUsersColumnError'))
})
