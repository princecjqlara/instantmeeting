import test from 'node:test'
import assert from 'node:assert/strict'
import { runBacktest } from '../src/lib/backtest/engine.mjs'

function buildCandles(closes) {
    return closes.map((close, index) => ({
        openTime: index + 1,
        open: close,
        high: close * 1.1,
        low: close * 0.9,
        close,
        volume: 100,
        closeTime: index + 2,
    }))
}

test('runBacktest tracks profits and skips', () => {
    const candlesBySymbol = {
        BTCUSDT: buildCandles([10, 10, 10, 11, 12, 13, 14, 13, 12, 11, 10]),
    }
    const result = runBacktest({
        candlesBySymbol,
        minimumsBySymbol: {
            BTCUSDT: { minQty: 0.001, stepSize: 0.001, minNotional: 5 },
        },
        startingEquity: 100,
        config: {
            fastSma: 2,
            slowSma: 3,
            riskPerTradePct: 0.02,
            maxAllocationPct: 0.5,
            stopLossPct: 0.05,
            takeProfitPct: 0.1,
            maxConcurrentPositions: 1,
            feeBps: 10,
            slippageBps: 0,
        },
    })

    assert.equal(result.metrics.totalTrades > 0, true)
    assert.equal(result.metrics.endingEquity > 100, true)
    assert.equal(result.metrics.skippedDueMinimums, 0)
})

test('runBacktest counts minimum constraint skips for tiny accounts', () => {
    const candlesBySymbol = {
        BTCUSDT: buildCandles([10, 10, 10, 11, 12, 13, 14, 13, 12]),
    }
    const result = runBacktest({
        candlesBySymbol,
        minimumsBySymbol: {
            BTCUSDT: { minQty: 1, stepSize: 1, minNotional: 50 },
        },
        startingEquity: 10,
        config: {
            fastSma: 2,
            slowSma: 3,
            riskPerTradePct: 0.01,
            maxAllocationPct: 0.2,
            stopLossPct: 0.05,
            takeProfitPct: 0.1,
            maxConcurrentPositions: 1,
            feeBps: 10,
            slippageBps: 0,
        },
    })

    assert.equal(result.metrics.totalTrades, 0)
    assert.equal(result.metrics.skippedDueMinimums > 0, true)
})
