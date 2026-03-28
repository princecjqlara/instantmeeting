import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKlinesUrl, fetchExchangeMinimums, fetchHistoricalCandles } from '../src/lib/backtest/binance-client.mjs'

test('buildKlinesUrl includes expected query params', () => {
    const url = buildKlinesUrl({ symbol: 'BTCUSDT', interval: '1d', startTime: 1, endTime: 2 })
    assert.match(url, /symbol=BTCUSDT/)
    assert.match(url, /interval=1d/)
    assert.match(url, /startTime=1/)
    assert.match(url, /endTime=2/)
})

test('fetchHistoricalCandles paginates and normalizes rows', async () => {
    let calls = 0
    const fetchImpl = async () => {
        calls += 1
        const rows = calls === 1
            ? Array.from({ length: 1000 }, (_, index) => [index + 1, '1', '2', '0.5', '1.5', '10', index + 2])
            : [[1002, '2', '3', '1', '2.5', '11', 1003]]
        return {
            ok: true,
            async json() {
                return rows
            },
        }
    }

    const candles = await fetchHistoricalCandles({ symbol: 'BTCUSDT', interval: '1d', startTime: 1, endTime: 2000, fetchImpl })
    assert.equal(calls, 2)
    assert.equal(candles.length, 1001)
    assert.deepEqual(candles[0], {
        openTime: 1,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
        closeTime: 2,
    })
})

test('fetchExchangeMinimums maps Binance filters', async () => {
    const fetchImpl = async () => ({
        ok: true,
        async json() {
            return {
                symbols: [{
                    symbol: 'BTCUSDT',
                    filters: [
                        { filterType: 'LOT_SIZE', minQty: '0.001', stepSize: '0.001' },
                        { filterType: 'MIN_NOTIONAL', minNotional: '10' },
                    ],
                }],
            }
        },
    })

    const minimums = await fetchExchangeMinimums({ symbols: ['BTCUSDT'], fetchImpl })
    assert.deepEqual(minimums.BTCUSDT, { minQty: 0.001, stepSize: 0.001, minNotional: 10 })
})
