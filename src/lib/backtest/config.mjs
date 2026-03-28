export const DEFAULT_PAIR_UNIVERSE = [
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'SOLUSDT',
    'XRPUSDT',
    'ADAUSDT',
    'DOGEUSDT',
]

export const DEFAULT_START_DATE = '2024-01-01'
export const DEFAULT_END_DATE = '2024-12-31'
export const DEFAULT_INTERVAL = '1d'
export const DEFAULT_STARTING_EQUITIES = [10, 25, 50, 100]

export const MODE_CONFIGS = {
    conservative: {
        id: 'conservative',
        label: 'Conservative',
        fastSma: 10,
        slowSma: 30,
        riskPerTradePct: 0.01,
        maxAllocationPct: 0.2,
        stopLossPct: 0.03,
        takeProfitPct: 0.06,
        maxConcurrentPositions: 1,
        feeBps: 10,
        slippageBps: 5,
    },
    balanced: {
        id: 'balanced',
        label: 'Balanced',
        fastSma: 7,
        slowSma: 21,
        riskPerTradePct: 0.015,
        maxAllocationPct: 0.35,
        stopLossPct: 0.04,
        takeProfitPct: 0.1,
        maxConcurrentPositions: 2,
        feeBps: 10,
        slippageBps: 8,
    },
    aggressive: {
        id: 'aggressive',
        label: 'Aggressive',
        fastSma: 5,
        slowSma: 13,
        riskPerTradePct: 0.025,
        maxAllocationPct: 0.5,
        stopLossPct: 0.05,
        takeProfitPct: 0.14,
        maxConcurrentPositions: 3,
        feeBps: 10,
        slippageBps: 12,
    },
}

function unique(values) {
    return [...new Set(values)]
}

export function parseCsvList(value) {
    if (!value) {
        return []
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
}

export function normalizeModes(input) {
    const requested = input?.length ? input : Object.keys(MODE_CONFIGS)
    const normalized = unique(requested.map((mode) => mode.toLowerCase()))

    for (const mode of normalized) {
        if (!MODE_CONFIGS[mode]) {
            throw new Error(`Unknown mode: ${mode}`)
        }
    }

    return normalized
}

export function normalizeEquities(input) {
    const requested = input?.length ? input : DEFAULT_STARTING_EQUITIES
    const normalized = unique(requested.map((value) => Number(value)))

    for (const equity of normalized) {
        if (!Number.isFinite(equity) || equity <= 0) {
            throw new Error(`Invalid starting equity: ${equity}`)
        }
    }

    return normalized
}

export function normalizeUniverse(input) {
    const requested = input?.length ? input : DEFAULT_PAIR_UNIVERSE
    return unique(requested.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))
}

export function normalizeDateWindow(start = DEFAULT_START_DATE, end = DEFAULT_END_DATE) {
    const startMs = Date.parse(start)
    const endMs = Date.parse(end)

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        throw new Error('Invalid date window')
    }

    if (startMs >= endMs) {
        throw new Error('Start date must be before end date')
    }

    return {
        start,
        end,
        startMs,
        endMs,
    }
}

export function buildScenarioMatrix({ modes, equities }) {
    const normalizedModes = normalizeModes(modes)
    const normalizedEquities = normalizeEquities(equities)

    return normalizedModes.flatMap((mode) =>
        normalizedEquities.map((startingEquity) => ({
            mode,
            startingEquity,
            key: `${mode}-${startingEquity}`,
        }))
    )
}
