import test from 'node:test'
import assert from 'node:assert/strict'

import {
    DEFAULT_LEADS_PIPELINE_STAGES,
    deriveLeadPipelineStage,
    normalizeLeadsPipelineStages,
    canManuallyMoveLeadToStage,
} from '../src/lib/lead-pipeline.ts'

test('normalizeLeadsPipelineStages returns default ordered stages', () => {
    assert.deepEqual(normalizeLeadsPipelineStages(null), DEFAULT_LEADS_PIPELINE_STAGES)
})

test('normalizeLeadsPipelineStages keeps unique non-empty stages and preserves sold', () => {
    assert.deepEqual(
        normalizeLeadsPipelineStages([' qualified ', '', 'sold', 'qualified', 'Custom']),
        ['qualified', 'sold', 'custom']
    )
})

test('deriveLeadPipelineStage maps unfinished leads to prospect', () => {
    assert.equal(
        deriveLeadPipelineStage({ submittedAt: null, qualificationVerdict: null, isDraft: true }),
        'prospect'
    )
})

test('deriveLeadPipelineStage maps review leads to prospect', () => {
    assert.equal(
        deriveLeadPipelineStage({ submittedAt: '2026-04-20T10:00:00.000Z', qualificationVerdict: 'review' }),
        'prospect'
    )
})

test('deriveLeadPipelineStage does not auto-place submitted leads without a verdict into prospect', () => {
    assert.equal(
        deriveLeadPipelineStage({ submittedAt: '2026-04-20T10:00:00.000Z', qualificationVerdict: null }),
        ''
    )
})

test('deriveLeadPipelineStage maps unqualified leads to unqualified', () => {
    assert.equal(
        deriveLeadPipelineStage({ submittedAt: '2026-04-20T10:00:00.000Z', qualificationVerdict: 'unqualified' }),
        'unqualified'
    )
})

test('deriveLeadPipelineStage maps qualified leads to qualified', () => {
    assert.equal(
        deriveLeadPipelineStage({ submittedAt: '2026-04-20T10:00:00.000Z', qualificationVerdict: 'qualified' }),
        'qualified'
    )
})

test('deriveLeadPipelineStage preserves explicit sold stage', () => {
    assert.equal(
        deriveLeadPipelineStage({
            submittedAt: '2026-04-20T10:00:00.000Z',
            qualificationVerdict: 'qualified',
            currentStage: 'sold',
        }),
        'sold'
    )
})

test('canManuallyMoveLeadToStage allows qualified to sold', () => {
    assert.equal(canManuallyMoveLeadToStage({ from: 'qualified', to: 'sold' }), true)
})

test('canManuallyMoveLeadToStage blocks prospect to sold', () => {
    assert.equal(canManuallyMoveLeadToStage({ from: 'prospect', to: 'sold' }), false)
})
