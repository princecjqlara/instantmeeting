import test from 'node:test'
import assert from 'node:assert/strict'
import {
    DEFAULT_STARTING_EQUITIES,
    MODE_CONFIGS,
    buildScenarioMatrix,
    normalizeDateWindow,
    normalizeEquities,
    normalizeModes,
} from '../src/lib/backtest/config.mjs'

test('config exposes expected default modes and equities', () => {
    assert.deepEqual(Object.keys(MODE_CONFIGS), ['conservative', 'balanced', 'aggressive'])
    assert.deepEqual(DEFAULT_STARTING_EQUITIES, [10, 25, 50, 100])
})

test('normalize helpers validate and expand matrix', () => {
    assert.deepEqual(normalizeModes(['Balanced', 'aggressive']), ['balanced', 'aggressive'])
    assert.deepEqual(normalizeEquities(['10', '25']), [10, 25])
    assert.equal(normalizeDateWindow('2024-01-01', '2024-02-01').startMs < normalizeDateWindow('2024-01-01', '2024-02-01').endMs, true)
    assert.deepEqual(buildScenarioMatrix({ modes: ['conservative'], equities: [10, 25] }), [
        { mode: 'conservative', startingEquity: 10, key: 'conservative-10' },
        { mode: 'conservative', startingEquity: 25, key: 'conservative-25' },
    ])
})

test('normalizeModes rejects unknown mode', () => {
    assert.throws(() => normalizeModes(['invalid']), /Unknown mode/)
})
