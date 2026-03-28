import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

function toCsv(rows) {
    if (!rows.length) {
        return ''
    }

    const headers = Object.keys(rows[0])
    const lines = [headers.join(',')]
    for (const row of rows) {
        lines.push(headers.map((header) => JSON.stringify(row[header] ?? '')).join(','))
    }
    return `${lines.join('\n')}\n`
}

export function buildComparisonInsights(results) {
    const byRawReturn = [...results].sort((a, b) => b.metrics.rawReturnPct - a.metrics.rawReturnPct)
    const byExpectancy = [...results].sort((a, b) => b.metrics.expectancyUsdt - a.metrics.expectancyUsdt)
    const byDrawdown = [...results].sort((a, b) => a.metrics.maxDrawdownPct - b.metrics.maxDrawdownPct)
    const smallAccount = results.filter((result) => result.startingEquity <= 25)
    const bySmallAccount = [...smallAccount].sort((a, b) => b.metrics.rawReturnPct - a.metrics.rawReturnPct)
    const equities = [...new Set(results.map((result) => result.startingEquity))]
    const equityAverages = equities.map((equity) => {
        const subset = results.filter((result) => result.startingEquity === equity)
        const averageReturn = subset.reduce((sum, result) => sum + result.metrics.rawReturnPct, 0) / subset.length
        const averageSkips = subset.reduce((sum, result) => sum + result.metrics.skippedDueMinimums + result.metrics.skippedDueRiskConstraints, 0) / subset.length
        return { equity, averageReturn, averageSkips }
    }).sort((a, b) => (b.averageReturn - b.averageSkips) - (a.averageReturn - a.averageSkips))

    const aggressive = results.filter((result) => result.mode === 'aggressive')
    const balanced = results.filter((result) => result.mode === 'balanced')
    const aggressiveAverageReturn = aggressive.reduce((sum, result) => sum + result.metrics.rawReturnPct, 0) / aggressive.length
    const aggressiveAverageCost = aggressive.reduce((sum, result) => sum + result.metrics.feesPaid + result.metrics.slippageCost, 0) / aggressive.length
    const balancedAverageReturn = balanced.reduce((sum, result) => sum + result.metrics.rawReturnPct, 0) / balanced.length

    return {
        bestRawReturn: byRawReturn[0],
        bestExpectancy: byExpectancy[0],
        lowestDrawdown: byDrawdown[0],
        bestSmallAccount: bySmallAccount[0] || byRawReturn[0],
        mostPracticalEquity: equityAverages[0],
        aggressiveWorthIt: aggressiveAverageReturn > balancedAverageReturn && aggressiveAverageCost < aggressiveAverageReturn,
    }
}

export function buildComparisonReport({ settings, results, insights }) {
    const lines = [
        '# Backtest Comparison Report',
        '',
        `- Pair universe: ${settings.symbols.join(', ')}`,
        `- Historical period: ${settings.start} to ${settings.end}`,
        `- Interval: ${settings.interval}`,
        '',
        '## Best Rankings',
        '',
        `- Best raw return: ${insights.bestRawReturn.mode} at ${insights.bestRawReturn.startingEquity} USDT (${insights.bestRawReturn.metrics.rawReturnPct}%)`,
        `- Best expectancy: ${insights.bestExpectancy.mode} at ${insights.bestExpectancy.startingEquity} USDT (${insights.bestExpectancy.metrics.expectancyUsdt} USDT/trade)`,
        `- Lowest drawdown: ${insights.lowestDrawdown.mode} at ${insights.lowestDrawdown.startingEquity} USDT (${insights.lowestDrawdown.metrics.maxDrawdownPct}%)`,
        `- Best small account result: ${insights.bestSmallAccount.mode} at ${insights.bestSmallAccount.startingEquity} USDT (${insights.bestSmallAccount.metrics.rawReturnPct}%)`,
        `- Most practical starting equity: ${insights.mostPracticalEquity.equity} USDT`,
        `- Aggressive worth it after fees/slippage: ${insights.aggressiveWorthIt ? 'yes' : 'no'}`,
        '',
        '## Scenario Metrics',
        '',
        '| Mode | Equity | Final Equity | Raw Return % | Expectancy USDT | Max DD % | Trades | Skipped Minimums | Skipped Risk | Fees | Slippage |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...results.map((result) => `| ${result.mode} | ${result.startingEquity} | ${result.metrics.endingEquity} | ${result.metrics.rawReturnPct} | ${result.metrics.expectancyUsdt} | ${result.metrics.maxDrawdownPct} | ${result.metrics.totalTrades} | ${result.metrics.skippedDueMinimums} | ${result.metrics.skippedDueRiskConstraints} | ${result.metrics.feesPaid} | ${result.metrics.slippageCost} |`),
        '',
    ]

    return `${lines.join('\n')}\n`
}

export async function writeScenarioArtifacts({ outputDir, settings, results }) {
    await mkdir(outputDir, { recursive: true })
    const summaryRows = []

    for (const result of results) {
        const fileStem = `${result.mode}-${result.startingEquity}usdt`
        const jsonPath = path.join(outputDir, `${fileStem}.json`)
        const csvPath = path.join(outputDir, `${fileStem}.csv`)
        const payload = {
            settings,
            mode: result.mode,
            startingEquity: result.startingEquity,
            metrics: result.metrics,
            trades: result.trades,
        }

        await writeFile(jsonPath, JSON.stringify(payload, null, 2))
        await writeFile(csvPath, toCsv(result.trades))
        summaryRows.push({
            mode: result.mode,
            startingEquity: result.startingEquity,
            finalEquity: result.metrics.endingEquity,
            rawReturnPct: result.metrics.rawReturnPct,
            expectancyUsdt: result.metrics.expectancyUsdt,
            maxDrawdownPct: result.metrics.maxDrawdownPct,
            totalTrades: result.metrics.totalTrades,
            skippedDueMinimums: result.metrics.skippedDueMinimums,
            skippedDueRiskConstraints: result.metrics.skippedDueRiskConstraints,
            feesPaid: result.metrics.feesPaid,
            slippageCost: result.metrics.slippageCost,
        })
    }

    await writeFile(path.join(outputDir, 'summary.csv'), toCsv(summaryRows))
}
