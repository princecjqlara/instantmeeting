import test from 'node:test'
import assert from 'node:assert/strict'

import { buildLeadSummaryRows } from '../src/lib/lead-summary.ts'

test('buildLeadSummaryRows includes lead details, form responses, and timeline fields', () => {
    const rows = buildLeadSummaryRows([
        {
            id: 'lead-1',
            guest_name: 'Jane Doe',
            guest_email: 'jane@example.com',
            guest_phone: '+1 555-0100',
            status: 'admitted',
            joined_at: '2026-03-18T14:55:00.000Z',
            admitted_at: '2026-03-18T15:02:00.000Z',
            note: 'Needs pricing details',
            custom_fields: [
                { id: 'company', label: 'Company', value: 'Acme' },
                { id: 'team-size', label: 'Team Size', value: '12' },
            ],
            meetings: {
                id: 'meeting-1',
                title: 'Growth Call',
                scheduled_at: '2026-03-18T15:00:00.000Z',
                status: 'active',
            },
        },
    ], 'UTC')

    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0], {
        id: 'lead-1',
        name: 'Jane Doe',
        meetingTitle: 'Growth Call',
        email: 'jane@example.com',
        phone: '+1 555-0100',
        status: 'Admitted',
        scheduledAt: 'Mar 18, 2026, 03:00 PM',
        joinedAt: 'Mar 18, 2026, 02:55 PM',
        admittedAt: 'Mar 18, 2026, 03:02 PM',
        waitDuration: '7 min',
        details: 'Company: Acme | Team Size: 12 | Note: Needs pricing details',
    })
})

test('buildLeadSummaryRows falls back cleanly when optional details are missing', () => {
    const rows = buildLeadSummaryRows([
        {
            id: 'lead-2',
            guest_name: 'John Smith',
            status: 'waiting',
            joined_at: '2026-03-19T08:30:00.000Z',
            meetings: {
                id: 'meeting-2',
                title: 'Demo',
                status: 'pending',
            },
        },
    ], 'UTC')

    assert.deepEqual(rows[0], {
        id: 'lead-2',
        name: 'John Smith',
        meetingTitle: 'Demo',
        email: '-',
        phone: '-',
        status: 'Waiting',
        scheduledAt: '-',
        joinedAt: 'Mar 19, 2026, 08:30 AM',
        admittedAt: '-',
        waitDuration: '-',
        details: '-',
    })
})
