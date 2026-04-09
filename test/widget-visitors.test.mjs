import test from 'node:test'
import assert from 'node:assert/strict'

import { buildWidgetVisitorLeavePatch, buildWidgetVisitorPresenceRecord } from '../src/lib/widget-visitors.ts'

test('buildWidgetVisitorPresenceRecord automatically enables mirror for active visitors', () => {
    const now = '2026-04-09T12:00:00.000Z'

    const record = buildWidgetVisitorPresenceRecord({
        hostId: 'host-1',
        sessionId: 'session-1',
        page: 'https://example.com/pricing',
        title: 'Pricing',
        scrollDepth: 37,
        now,
    })

    assert.deepEqual(record, {
        host_id: 'host-1',
        session_id: 'session-1',
        current_page_url: 'https://example.com/pricing',
        current_page_title: 'Pricing',
        scroll_depth: 37,
        last_heartbeat_at: now,
        mirror_active: true,
    })
})

test('buildWidgetVisitorPresenceRecord normalizes missing values and clamps scroll depth', () => {
    const record = buildWidgetVisitorPresenceRecord({
        hostId: 'host-2',
        sessionId: 'session-2',
        page: '',
        title: '',
        scrollDepth: 240,
        now: '2026-04-09T12:00:00.000Z',
    })

    assert.equal(record.current_page_url, null)
    assert.equal(record.current_page_title, null)
    assert.equal(record.scroll_depth, 100)
    assert.equal(record.mirror_active, true)
})

test('buildWidgetVisitorLeavePatch marks visitor as left and disables mirror', () => {
    const now = '2026-04-09T12:00:00.000Z'

    assert.deepEqual(buildWidgetVisitorLeavePatch(now), {
        status: 'left',
        last_heartbeat_at: now,
        mirror_active: false,
    })
})
