import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildComparisonInsights, buildComparisonReport, writeScenarioArtifacts } from '../src/lib/backtest/reporting.mjs'

test('reporting writes per-scenario artifacts and comparison report content', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'backtest-report-'))
    const results = [{
        mode: 'balanced',
        startingEquity: 25,
        metrics: {
            endingEquity: 30,
            rawReturnPct: 20,
            expectancyUsdt: 1.5,
            maxDrawdownPct: 5,
            totalTrades: 4,
            skippedDueMinimums: 2,
            skippedDueRiskConstraints: 1,
            feesPaid: 0.4,
            slippageCost: 0.2,
        },
        trades: [{ symbol: 'BTCUSDT', status: 'closed', pnlNet: 2 }],
    }]
    const settings = {
        symbols: ['BTCUSDT'],
        start: '2024-01-01',
        end: '2024-12-31',
        interval: '1d',
    }

    await writeScenarioArtifacts({ outputDir, settings, results })
    const insights = buildComparisonInsights(results)
    const report = buildComparisonReport({ settings, results, insights })

    assert.match(report, /Best raw return: balanced at 25 USDT/)
    assert.match(await readFile(path.join(outputDir, 'balanced-25usdt.json'), 'utf8'), /"endingEquity": 30/)
    assert.match(await readFile(path.join(outputDir, 'summary.csv'), 'utf8'), /balanced/)
})
