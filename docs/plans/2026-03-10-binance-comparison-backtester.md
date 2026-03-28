# Binance Comparison Backtester Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone Node.js CLI backtester that fetches Binance spot kline history, runs conservative/balanced/aggressive comparison backtests across multiple starting equities, saves separate result files, and produces a final comparison report.

**Architecture:** Add a small backtesting module under `src/lib/backtest/` with isolated pieces for Binance data fetching, strategy configuration, trade simulation, metrics, and report generation. Expose a single CLI entrypoint that can run one scenario or a full mode/equity matrix and write deterministic outputs under `backtest-results/`.

**Tech Stack:** Node.js, built-in `fetch`, plain JavaScript/ESM, Node test runner, JSON/CSV/Markdown file output.

---

### Task 1: Backtest config model

**Files:**
- Create: `src/lib/backtest/config.mjs`
- Test: `test/backtest-config.test.mjs`

**Step 1: Write the failing test**

Verify the module exposes three modes, four default starting equities, and normalized CLI-friendly config parsing.

**Step 2: Run test to verify it fails**

Run: `node --test test/backtest-config.test.mjs`
Expected: FAIL because the module does not exist yet.

**Step 3: Write minimal implementation**

Define default pair universe, default historical window, conservative/balanced/aggressive risk profiles, and helpers to normalize CLI inputs.

**Step 4: Run test to verify it passes**

Run: `node --test test/backtest-config.test.mjs`
Expected: PASS.

### Task 2: Binance historical data loader

**Files:**
- Create: `src/lib/backtest/binance-client.mjs`
- Test: `test/binance-client.test.mjs`

**Step 1: Write the failing test**

Cover query building, pagination behavior, and candle normalization with a mocked `fetch`.

**Step 2: Run test to verify it fails**

Run: `node --test test/binance-client.test.mjs`
Expected: FAIL because the loader is missing.

**Step 3: Write minimal implementation**

Fetch spot klines from Binance REST, page through the requested window, and map rows into typed candle objects.

**Step 4: Run test to verify it passes**

Run: `node --test test/binance-client.test.mjs`
Expected: PASS.

### Task 3: Trade simulator and metrics

**Files:**
- Create: `src/lib/backtest/engine.mjs`
- Create: `src/lib/backtest/metrics.mjs`
- Test: `test/backtest-engine.test.mjs`

**Step 1: Write the failing test**

Cover fee/slippage-adjusted entries/exits, exchange minimum skips, risk-constraint skips, expectancy, drawdown, and final equity.

**Step 2: Run test to verify it fails**

Run: `node --test test/backtest-engine.test.mjs`
Expected: FAIL because the engine does not exist yet.

**Step 3: Write minimal implementation**

Implement a simple parameterized strategy, position sizing, skip accounting, equity tracking, and final metrics.

**Step 4: Run test to verify it passes**

Run: `node --test test/backtest-engine.test.mjs`
Expected: PASS.

### Task 4: Matrix runner and result writer

**Files:**
- Create: `src/lib/backtest/reporting.mjs`
- Create: `scripts/run-backtests.mjs`
- Test: `test/backtest-reporting.test.mjs`
- Modify: `package.json`

**Step 1: Write the failing test**

Assert that a matrix run emits one result file per scenario plus a summary report with comparison rankings.

**Step 2: Run test to verify it fails**

Run: `node --test test/backtest-reporting.test.mjs`
Expected: FAIL because the runner/reporter do not exist yet.

**Step 3: Write minimal implementation**

Create a CLI that fetches candles once per pair, reuses the same universe and period across all scenarios, writes JSON/CSV per run, and emits a final Markdown comparison report.

**Step 4: Run test to verify it passes**

Run: `node --test test/backtest-reporting.test.mjs`
Expected: PASS.

### Task 5: End-to-end verification

**Files:**
- Modify: `README.md`

**Step 1: Run focused tests**

Run: `node --test test/backtest-config.test.mjs test/binance-client.test.mjs test/backtest-engine.test.mjs test/backtest-reporting.test.mjs`
Expected: PASS.

**Step 2: Run project node tests**

Run: `npm run test:node`
Expected: PASS.

**Step 3: Run sample backtest matrix**

Run: `node scripts/run-backtests.mjs --modes conservative,balanced,aggressive --equities 10,25,50,100`
Expected: Result files under `backtest-results/` and a final comparison Markdown report.

**Step 4: Commit**

```bash
git add package.json README.md src/lib/backtest scripts/run-backtests.mjs test docs/plans/2026-03-10-binance-comparison-backtester.md
git commit -m "feat: add Binance comparison backtester"
```
