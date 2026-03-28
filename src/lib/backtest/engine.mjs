import { summarizeTrades } from './metrics.mjs'

function computeSma(candles, index, period) {
    if (index + 1 < period) {
        return null
    }

    let sum = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
        sum += candles[cursor].close
    }

    return sum / period
}

function floorToStep(value, stepSize) {
    if (!stepSize) {
        return value
    }

    return Math.floor(value / stepSize) * stepSize
}

function applyBps(price, bps, direction) {
    const multiplier = 1 + (bps / 10000) * direction
    return price * multiplier
}

function createSignalMap(candlesBySymbol, config) {
    return Object.fromEntries(Object.entries(candlesBySymbol).map(([symbol, candles]) => {
        const signals = candles.map((candle, index) => {
            const fast = computeSma(candles, index, config.fastSma)
            const slow = computeSma(candles, index, config.slowSma)
            const previousFast = index > 0 ? computeSma(candles, index - 1, config.fastSma) : null
            const previousSlow = index > 0 ? computeSma(candles, index - 1, config.slowSma) : null

            const enter = fast !== null && slow !== null && previousFast !== null && previousSlow !== null
                ? fast > slow && previousFast <= previousSlow
                : false

            const exit = fast !== null && slow !== null && previousFast !== null && previousSlow !== null
                ? fast < slow && previousFast >= previousSlow
                : false

            return {
                openTime: candle.openTime,
                close: candle.close,
                high: candle.high,
                low: candle.low,
                enter,
                exit,
            }
        })

        return [symbol, signals]
    }))
}

function indexByOpenTime(items) {
    return new Map(items.map((item) => [item.openTime, item]))
}

export function runBacktest({
    candlesBySymbol,
    minimumsBySymbol,
    startingEquity,
    config,
}) {
    const signalsBySymbol = createSignalMap(candlesBySymbol, config)
    const candleIndexBySymbol = Object.fromEntries(
        Object.entries(candlesBySymbol).map(([symbol, candles]) => [symbol, indexByOpenTime(candles)])
    )
    const signalIndexBySymbol = Object.fromEntries(
        Object.entries(signalsBySymbol).map(([symbol, signals]) => [symbol, indexByOpenTime(signals)])
    )
    const timestamps = [...new Set(Object.values(candlesBySymbol).flat().map((candle) => candle.openTime))].sort((a, b) => a - b)
    const positions = new Map()
    const trades = []
    let cash = startingEquity
    let feesPaid = 0
    let slippageCost = 0
    let skippedDueMinimums = 0
    let skippedDueRiskConstraints = 0
    const equityCurve = []

    for (const timestamp of timestamps) {
        for (const [symbol, candles] of Object.entries(candlesBySymbol)) {
            const candle = candleIndexBySymbol[symbol]?.get(timestamp)
            const signal = signalIndexBySymbol[symbol]?.get(timestamp)
            if (!candle || !signal) {
                continue
            }

            const openPosition = positions.get(symbol)
            if (openPosition) {
                const stopPrice = openPosition.entryPrice * (1 - config.stopLossPct)
                const targetPrice = openPosition.entryPrice * (1 + config.takeProfitPct)
                let exitReason = null
                let baseExitPrice = null

                if (candle.low <= stopPrice) {
                    exitReason = 'stop_loss'
                    baseExitPrice = stopPrice
                } else if (candle.high >= targetPrice) {
                    exitReason = 'take_profit'
                    baseExitPrice = targetPrice
                } else if (signal.exit) {
                    exitReason = 'signal_exit'
                    baseExitPrice = candle.close
                }

                if (exitReason && baseExitPrice !== null) {
                    const exitPrice = applyBps(baseExitPrice, config.slippageBps, -1)
                    const exitValue = openPosition.quantity * exitPrice
                    const exitFee = exitValue * (config.feeBps / 10000)
                    const pnlNet = exitValue - exitFee - openPosition.costBasis
                    cash += exitValue - exitFee
                    feesPaid += exitFee
                    slippageCost += Math.max(0, openPosition.quantity * (baseExitPrice - exitPrice))
                    trades.push({
                        symbol,
                        status: 'closed',
                        entryTime: openPosition.entryTime,
                        exitTime: timestamp,
                        entryPrice: openPosition.entryPrice,
                        exitPrice,
                        quantity: openPosition.quantity,
                        pnlNet,
                        exitReason,
                    })
                    positions.delete(symbol)
                }
            }

            if (!positions.has(symbol) && signal.enter) {
                if (positions.size >= config.maxConcurrentPositions) {
                    skippedDueRiskConstraints += 1
                    continue
                }

                const entryPrice = applyBps(candle.close, config.slippageBps, 1)
                const stopDistance = entryPrice * config.stopLossPct
                const riskBudget = cash * config.riskPerTradePct
                const maxPositionCost = cash * config.maxAllocationPct
                const desiredCost = Math.min(maxPositionCost, stopDistance > 0 ? riskBudget / config.stopLossPct : maxPositionCost)
                const minimums = minimumsBySymbol[symbol] || { minQty: 0, stepSize: 0, minNotional: 0 }
                let quantity = desiredCost / entryPrice
                quantity = floorToStep(quantity, minimums.stepSize)
                const notional = quantity * entryPrice
                const entryFee = notional * (config.feeBps / 10000)

                if (quantity <= 0 || quantity < minimums.minQty || notional < minimums.minNotional) {
                    skippedDueMinimums += 1
                    continue
                }

                if (notional + entryFee > cash) {
                    skippedDueRiskConstraints += 1
                    continue
                }

                cash -= notional + entryFee
                feesPaid += entryFee
                slippageCost += Math.max(0, quantity * (entryPrice - candle.close))
                positions.set(symbol, {
                    entryTime: timestamp,
                    entryPrice,
                    quantity,
                    costBasis: notional + entryFee,
                })
            }
        }

        const markedEquity = cash + [...positions.entries()].reduce((sum, [symbol, position]) => {
            const candle = candleIndexBySymbol[symbol]?.get(timestamp)
            if (!candle) {
                return sum
            }
            return sum + position.quantity * candle.close
        }, 0)

        equityCurve.push(markedEquity)
    }

    for (const [symbol, position] of positions.entries()) {
        const candles = candlesBySymbol[symbol]
        const finalCandle = candles[candles.length - 1]
        const exitPrice = applyBps(finalCandle.close, config.slippageBps, -1)
        const exitValue = position.quantity * exitPrice
        const exitFee = exitValue * (config.feeBps / 10000)
        const pnlNet = exitValue - exitFee - position.costBasis
        cash += exitValue - exitFee
        feesPaid += exitFee
        slippageCost += Math.max(0, position.quantity * (finalCandle.close - exitPrice))
        trades.push({
            symbol,
            status: 'closed',
            entryTime: position.entryTime,
            exitTime: finalCandle.openTime,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: position.quantity,
            pnlNet,
            exitReason: 'end_of_period',
        })
    }

    const endingEquity = cash
    const metrics = summarizeTrades({
        startingEquity,
        endingEquity,
        trades,
        skippedDueMinimums,
        skippedDueRiskConstraints,
        feesPaid,
        slippageCost,
        equityCurve: equityCurve.length ? equityCurve : [startingEquity, endingEquity],
    })

    return {
        trades,
        metrics,
        equityCurve,
    }
}
