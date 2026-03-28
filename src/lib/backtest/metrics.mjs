export function calculateMaxDrawdownPct(equityCurve) {
    let peak = equityCurve[0] || 0
    let maxDrawdown = 0

    for (const point of equityCurve) {
        if (point > peak) {
            peak = point
        }

        if (peak > 0) {
            const drawdown = ((peak - point) / peak) * 100
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown
            }
        }
    }

    return maxDrawdown
}

export function roundMetric(value) {
    return Number(value.toFixed(4))
}

export function summarizeTrades({
    startingEquity,
    endingEquity,
    trades,
    skippedDueMinimums,
    skippedDueRiskConstraints,
    feesPaid,
    slippageCost,
    equityCurve,
}) {
    const closedTrades = trades.filter((trade) => trade.status === 'closed')
    const wins = closedTrades.filter((trade) => trade.pnlNet > 0)
    const losses = closedTrades.filter((trade) => trade.pnlNet <= 0)
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnlNet, 0)
    const grossLoss = losses.reduce((sum, trade) => sum + trade.pnlNet, 0)
    const expectancyUsdt = closedTrades.length
        ? closedTrades.reduce((sum, trade) => sum + trade.pnlNet, 0) / closedTrades.length
        : 0

    return {
        startingEquity: roundMetric(startingEquity),
        endingEquity: roundMetric(endingEquity),
        netProfit: roundMetric(endingEquity - startingEquity),
        rawReturnPct: roundMetric(((endingEquity - startingEquity) / startingEquity) * 100),
        maxDrawdownPct: roundMetric(calculateMaxDrawdownPct(equityCurve)),
        totalTrades: closedTrades.length,
        wins: wins.length,
        losses: losses.length,
        winRatePct: roundMetric(closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0),
        expectancyUsdt: roundMetric(expectancyUsdt),
        expectancyPct: roundMetric(startingEquity ? (expectancyUsdt / startingEquity) * 100 : 0),
        grossProfit: roundMetric(grossProfit),
        grossLoss: roundMetric(grossLoss),
        feesPaid: roundMetric(feesPaid),
        slippageCost: roundMetric(slippageCost),
        skippedDueMinimums,
        skippedDueRiskConstraints,
    }
}
