import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('landing page posts an InstantMeeting CAPI visit event once per session', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('/api/capi/instantmeeting'))
    assert.ok(source.includes('instantmeeting:landing-capi-visit'))
    assert.ok(source.includes('fbclid'))
    assert.ok(source.includes('_fbp'))
    assert.ok(source.includes('_fbc'))
})

test('landing page and diagnostic checkout use the paid signup event ladder', () => {
    const pageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
    const funnelSource = readFileSync(new URL('../src/components/SellerLeadFunnel.tsx', import.meta.url), 'utf8')
    const routeSource = readFileSync(new URL('../src/app/api/capi/instantmeeting/route.ts', import.meta.url), 'utf8')
    const signupSource = readFileSync(new URL('../src/app/api/signup/route.ts', import.meta.url), 'utf8')

    assert.ok(routeSource.includes('sendInstantMeetingPaymentMetaCapiEvent'))
    assert.ok(routeSource.includes('diagnostic_start'))
    assert.ok(routeSource.includes('diagnostic_complete'))
    assert.ok(routeSource.includes('checkout_opened'))
    assert.ok(routeSource.includes('payment_info_added'))

    assert.ok(funnelSource.includes("sendLandingFunnelEvent('diagnostic_start'"))
    assert.ok(funnelSource.includes("sendLandingFunnelEvent('diagnostic_complete'"))
    assert.ok(funnelSource.includes("sendLandingFunnelEvent('checkout_opened'"))
    assert.ok(funnelSource.includes("sendLandingFunnelEvent('payment_info_added'"))
    assert.ok(funnelSource.includes('diagnostic_score'))
    assert.ok(funnelSource.includes('diagnostic_verdict'))

    assert.ok(pageSource.includes("sendInstantMeetingCheckoutEvent('checkout_opened'"))
    assert.ok(pageSource.includes("sendInstantMeetingCheckoutEvent('payment_info_added'"))
    assert.ok(signupSource.includes('diagnostic_score'))
    assert.ok(signupSource.includes('diagnostic_verdict'))
})

test('landing page only marks the CAPI visit after a confirmed send', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    const fetchIndex = source.indexOf("const response = await fetch('/api/capi/instantmeeting'")
    const payloadIndex = source.indexOf('const payload = await response.json()')
    const setSessionIndex = source.indexOf("window.sessionStorage.setItem(sessionKey, '1')")

    assert.notEqual(fetchIndex, -1, 'expected landing page to await the CAPI response')
    assert.notEqual(payloadIndex, -1, 'expected landing page to inspect the JSON response')
    assert.notEqual(setSessionIndex, -1, 'expected landing page to store the sent marker')
    assert.ok(payloadIndex > fetchIndex, 'expected JSON parsing after the fetch call')
    assert.ok(setSessionIndex > payloadIndex, 'expected session marker to be stored only after the send result is known')
    assert.ok(source.includes('if (payload?.sent) {'), 'expected sent confirmation guard before storing the session marker')
})
