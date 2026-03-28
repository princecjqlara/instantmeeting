const BINANCE_BASE_URL = 'https://data-api.binance.vision'

export function buildKlinesUrl({ symbol, interval, startTime, endTime, limit = 1000 }) {
    const url = new URL('/api/v3/klines', BINANCE_BASE_URL)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('startTime', String(startTime))
    url.searchParams.set('endTime', String(endTime))
    url.searchParams.set('limit', String(limit))
    return url.toString()
}

function normalizeCandle(row) {
    return {
        openTime: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        closeTime: Number(row[6]),
    }
}

export async function fetchHistoricalCandles({
    symbol,
    interval,
    startTime,
    endTime,
    fetchImpl = fetch,
}) {
    const allRows = []
    let nextStartTime = startTime

    while (nextStartTime < endTime) {
        const url = buildKlinesUrl({
            symbol,
            interval,
            startTime: nextStartTime,
            endTime,
        })
        const response = await fetchImpl(url)
        if (!response.ok) {
            throw new Error(`Failed to fetch klines for ${symbol}: ${response.status}`)
        }

        const rows = await response.json()
        if (!Array.isArray(rows) || rows.length === 0) {
            break
        }

        allRows.push(...rows)
        const lastOpenTime = Number(rows[rows.length - 1][0])
        if (rows.length < 1000) {
            break
        }

        nextStartTime = lastOpenTime + 1
    }

    return allRows.map(normalizeCandle)
}

function parseFilterValue(filters, filterType, key, fallback = 0) {
    const filter = filters.find((item) => item.filterType === filterType)
    if (!filter || filter[key] === undefined) {
        return fallback
    }
    return Number(filter[key])
}

export async function fetchExchangeMinimums({ symbols, fetchImpl = fetch }) {
    const url = new URL('/api/v3/exchangeInfo', BINANCE_BASE_URL)
    url.searchParams.set('symbols', JSON.stringify(symbols))
    const response = await fetchImpl(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch exchange info: ${response.status}`)
    }

    const payload = await response.json()
    const entries = payload.symbols || []

    return Object.fromEntries(entries.map((symbolInfo) => [
        symbolInfo.symbol,
        {
            minQty: parseFilterValue(symbolInfo.filters || [], 'LOT_SIZE', 'minQty', 0),
            stepSize: parseFilterValue(symbolInfo.filters || [], 'LOT_SIZE', 'stepSize', 0),
            minNotional: parseFilterValue(symbolInfo.filters || [], 'MIN_NOTIONAL', 'minNotional', 0),
        },
    ]))
}
