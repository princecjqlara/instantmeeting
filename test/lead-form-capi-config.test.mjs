import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead form editor exposes per-form Meta CAPI fields', () => {
    const source = readFileSync(new URL('../src/app/host/lead-forms/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('Meta CAPI access token'))
    assert.ok(source.includes('Meta dataset id'))
    assert.ok(source.includes('Meta test event code'))
    assert.ok(source.includes('Purchase value'))
    assert.ok(source.includes('Qualified sending to Facebook'))
    assert.ok(source.includes('Purchase sending to Facebook'))
})

test('lead forms API persists per-form Meta CAPI fields', () => {
    const source = readFileSync(new URL('../src/app/api/host/lead-forms/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('meta_capi_access_token'))
    assert.ok(source.includes('meta_capi_dataset_id'))
    assert.ok(source.includes('meta_capi_test_event_code'))
    assert.ok(source.includes('facebook_purchase_value'))
    assert.ok(source.includes('send_qualified_to_facebook'))
    assert.ok(source.includes('send_purchase_to_facebook'))
})

test('onboarding saves forms without ads setup fields', () => {
    const source = readFileSync(new URL('../src/app/onboarding/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('buildOnboardingLeadFormPayload'))
    assert.ok(!source.includes('send_qualified_to_facebook: hasMetaCapiConfig'))
})

test('new lead forms default qualified Meta CAPI sending on', () => {
    const pageSource = readFileSync(new URL('../src/app/host/lead-forms/page.tsx', import.meta.url), 'utf8')
    const routeSource = readFileSync(new URL('../src/app/api/host/lead-forms/route.ts', import.meta.url), 'utf8')

    assert.ok(pageSource.includes('send_qualified_to_facebook: true'))
    assert.ok(routeSource.includes('normalizeBooleanField(send_qualified_to_facebook, true)'))
})

test('public lead form page sends PageView and LeadFormStart events with the current URL', () => {
    const source = readFileSync(new URL('../src/app/leads/[slug]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('/api/leads/event'))
    assert.ok(source.includes("eventName: 'PageView'"))
    assert.ok(source.includes("eventName: 'InstantMeetingLeadFormStart'"))
    assert.ok(source.includes('page_url: window.location.href'))
    assert.ok(source.includes('sessionStorage'))
})

test('lead form event route supports PageView and LeadFormStart without exposing Meta credentials', () => {
    const source = readFileSync(new URL('../src/app/api/leads/event/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('maybeSendLeadFormFunnelMetaEvent'))
    assert.ok(source.includes('PageView'))
    assert.ok(source.includes('InstantMeetingLeadFormStart'))
    assert.ok(source.includes('meta_capi_access_token'))
    assert.ok(!source.includes('NextResponse.json({ form'))
})

test('booking flow forwards lead context and sends Schedule events', () => {
    const modalSource = readFileSync(new URL('../src/components/BookingModal.tsx', import.meta.url), 'utf8')
    const routeSource = readFileSync(new URL('../src/app/api/meetings/public/route.ts', import.meta.url), 'utf8')

    assert.ok(modalSource.includes('sourceMeetingId'))
    assert.ok(modalSource.includes('sourceGuestId'))
    assert.ok(modalSource.includes('pageUrl'))
    assert.ok(modalSource.includes('window.location.href'))
    assert.ok(routeSource.includes('maybeSendLeadFormFunnelMetaEvent'))
    assert.ok(routeSource.includes("eventName: 'Schedule'"))
    assert.ok(routeSource.includes('lead_form_id'))
})
