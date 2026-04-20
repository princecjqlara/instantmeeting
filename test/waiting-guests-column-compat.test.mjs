import test from 'node:test'
import assert from 'node:assert/strict'

import {
    insertWaitingGuestWithCompat,
    isMissingWaitingGuestsColumnError,
    updateWaitingGuestWithCompat,
} from '../src/lib/waiting-guests-column-compat.ts'

test('isMissingWaitingGuestsColumnError detects Postgres missing column errors', () => {
    assert.equal(
        isMissingWaitingGuestsColumnError(
            { message: 'column waiting_guests.pipeline_stage_changed_at does not exist' },
            'pipeline_stage_changed_at'
        ),
        true
    )
})

test('isMissingWaitingGuestsColumnError detects PostgREST schema cache errors', () => {
    assert.equal(
        isMissingWaitingGuestsColumnError(
            { message: "Could not find the 'submitted_at' column of 'waiting_guests' in the schema cache" },
            'submitted_at'
        ),
        true
    )
})

test('insertWaitingGuestWithCompat retries without optional missing columns', async () => {
    const calls = []
    const responses = [
        { data: null, error: { message: "Could not find the 'lead_form_id' column of 'waiting_guests' in the schema cache" } },
        { data: null, error: { message: "Could not find the 'pipeline_stage_changed_at' column of 'waiting_guests' in the schema cache" } },
        { data: { id: 'guest-123' }, error: null },
    ]

    let responseIndex = 0
    const supabase = {
        from(table) {
            assert.equal(table, 'waiting_guests')

            return {
                insert(payload) {
                    calls.push(structuredClone(payload))

                    return {
                        select() {
                            return {
                                single: async () => responses[responseIndex++],
                            }
                        },
                    }
                },
            }
        },
    }

    const result = await insertWaitingGuestWithCompat(supabase, {
        meeting_id: 'meeting-1',
        guest_name: 'Jane',
        status: 'waiting',
        lead_form_id: 'form-123',
        submitted_at: '2026-04-21T00:00:00.000Z',
        pipeline_stage_changed_at: '2026-04-21T00:00:00.000Z',
    })

    assert.deepEqual(result, { data: { id: 'guest-123' }, error: null })
    assert.equal(calls.length, 3)
    assert.ok('lead_form_id' in calls[0])
    assert.ok('pipeline_stage_changed_at' in calls[0])
    assert.ok('submitted_at' in calls[0])
    assert.ok(!('lead_form_id' in calls[1]))
    assert.ok('pipeline_stage_changed_at' in calls[1])
    assert.ok('submitted_at' in calls[1])
    assert.ok(!('pipeline_stage_changed_at' in calls[2]))
    assert.ok('submitted_at' in calls[2])
})

test('updateWaitingGuestWithCompat retries without optional missing columns', async () => {
    const calls = []
    const responses = [
        { data: null, error: { message: "Could not find the 'pipeline_stage' column of 'waiting_guests' in the schema cache" } },
        { data: null, error: { message: "Could not find the 'submitted_at' column of 'waiting_guests' in the schema cache" } },
        { data: { id: 'guest-123', status: 'waiting' }, error: null },
    ]

    let responseIndex = 0
    const eqCalls = []
    const supabase = {
        from(table) {
            assert.equal(table, 'waiting_guests')

            return {
                update(payload) {
                    calls.push(structuredClone(payload))

                    return {
                        eq(column, value) {
                            eqCalls.push([column, value])

                            return {
                                select() {
                                    return {
                                        single: async () => responses[responseIndex++],
                                    }
                                },
                            }
                        },
                    }
                },
            }
        },
    }

    const result = await updateWaitingGuestWithCompat(supabase, 'guest-123', {
        guest_name: 'Jane',
        status: 'waiting',
        pipeline_stage: 'qualified',
        submitted_at: '2026-04-21T00:00:00.000Z',
    })

    assert.deepEqual(result, { data: { id: 'guest-123', status: 'waiting' }, error: null })
    assert.deepEqual(eqCalls, [
        ['id', 'guest-123'],
        ['id', 'guest-123'],
        ['id', 'guest-123'],
    ])
    assert.equal(calls.length, 3)
    assert.ok('pipeline_stage' in calls[0])
    assert.ok('submitted_at' in calls[0])
    assert.ok(!('pipeline_stage' in calls[1]))
    assert.ok('submitted_at' in calls[1])
    assert.ok(!('submitted_at' in calls[2]))
})
