import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
    DEFAULT_END_DATE,
    DEFAULT_INTERVAL,
    DEFAULT_START_DATE,
    buildScenarioMatrix,
    MODE_CONFIGS,
    normalizeDateWindow,
    normalizeEquities,
    normalizeModes,
    normalizeUniverse,
    parseCsvList,
} from '../src/lib/backtest/config.mjs'
import { fetchExchangeMinimums, fetchHistoricalCandles } from '../src/lib/backtest/binance-client.mjs'
import { runBacktest } from '../src/lib/backtest/engine.mjs'
import { buildComparisonInsights, buildComparisonReport, writeScenarioArtifacts } from '../src/lib/backtest/reporting.mjs'

function parseArgs(argv) {
    const args = {}
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index]
        if (!key?.startsWith('--')) {
            continue
        }

        const nextValue = argv[index + 1]
        if (!nextValue || nextValue.startsWith('--')) {
            args[key.slice(2)] = 'true'
            continue
        }

        args[key.slice(2)] = nextValue
        index += 1
    }
    return args
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    if (args.insecure === 'true') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const modes = normalizeModes(parseCsvList(args.modes))
    const equities = normalizeEquities(parseCsvList(args.equities))
    const symbols = normalizeUniverse(parseCsvList(args.symbols))
    const interval = args.interval || DEFAULT_INTERVAL
    const dateWindow = normalizeDateWindow(args.start || DEFAULT_START_DATE, args.end || DEFAULT_END_DATE)
    const outputDir = path.resolve(args.output || 'backtest-results')
    const scenarios = buildScenarioMatrix({ modes, equities })

    const settings = {
        modes,
        equities,
        symbols,
        interval,
        start: dateWindow.start,
        end: dateWindow.end,
    }

    const candlesBySymbol = {}
    for (const symbol of symbols) {
        candlesBySymbol[symbol] = await fetchHistoricalCandles({
            symbol,
            interval,
            startTime: dateWindow.startMs,
            endTime: dateWindow.endMs,
        })
    }

    const minimumsBySymbol = await fetchExchangeMinimums({ symbols })
    const results = scenarios.map((scenario) => ({
        mode: scenario.mode,
        startingEquity: scenario.startingEquity,
        ...runBacktest({
            candlesBySymbol,
            minimumsBySymbol,
            startingEquity: scenario.startingEquity,
            config: MODE_CONFIGS[scenario.mode],
        }),
    }))

    await mkdir(outputDir, { recursive: true })
    await writeScenarioArtifacts({ outputDir, settings, results })
    const insights = buildComparisonInsights(results)
    const report = buildComparisonReport({ settings, results, insights })
    const reportPath = path.join(outputDir, 'comparison-report.md')
    await writeFile(reportPath, report)

    process.stdout.write(`${report}\nSaved report to ${reportPath}\n`)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
