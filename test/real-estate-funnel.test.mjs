import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const COMPONENT_URL = new URL('../src/components/SellerLeadFunnel.tsx', import.meta.url)
const STYLES_URL = new URL('../src/components/SellerLeadFunnel.module.css', import.meta.url)
const PAGE_URL = new URL('../src/app/page.tsx', import.meta.url)

test('seller funnel component exists and exports a default', () => {
    const source = readFileSync(COMPONENT_URL, 'utf8')
    assert.ok(/export default function SellerLeadFunnel/.test(source))
})

test('seller funnel asks 4-6 diagnostic questions with real-estate framing', () => {
    const source = readFileSync(COMPONENT_URL, 'utf8')
    const page = readFileSync(PAGE_URL, 'utf8')
    const questionMatches = source.match(/id:\s*'(deals|drop-off|peso-loss|competitor|identity|future|role|volume|speed|bottleneck|goal)'/g) || []
    assert.ok(
        questionMatches.length >= 4 && questionMatches.length <= 6,
        `expected 4-6 diagnostic questions, got ${questionMatches.length}`
    )
    const combined = `${source}\n${page}`
    assert.ok(/real estate|broker|seller/i.test(combined), 'funnel should target real estate brokers/sellers')
})

test('seller funnel shows a visible progress indicator', () => {
    const source = readFileSync(COMPONENT_URL, 'utf8')
    const styles = readFileSync(STYLES_URL, 'utf8')
    assert.ok(source.includes('progressBar'))
    assert.ok(source.includes('progressFill'))
    assert.ok(styles.includes('.progressBar'))
    assert.ok(styles.includes('.progressFill'))
})

test('seller funnel ends on an honest recommendation rather than hard-pressure copy', () => {
    const source = readFileSync(COMPONENT_URL, 'utf8')
    assert.ok(/computeTier/.test(source))
    assert.ok(!/manipulate|brainwash|hypnosis|guaranteed listing/i.test(source))
    assert.ok(!/only \d+ spots left/i.test(source), 'no fake scarcity')
})

test('seller funnel exposes a primary signup action and a contact fallback', () => {
    const source = readFileSync(COMPONENT_URL, 'utf8')
    assert.ok(/onPrimaryAction/.test(source))
    assert.ok(/facebook\.com\/aresmediaph/.test(source) || /contactHref/.test(source))
})

test('landing page renders the diagnostic funnel and owns checkout inline', () => {
    const page = readFileSync(PAGE_URL, 'utf8')
    const source = readFileSync(COMPONENT_URL, 'utf8')
    assert.ok(/<SellerLeadFunnel\b/.test(page), 'page should render SellerLeadFunnel')
    assert.ok(/\/api\/signup/.test(source), 'funnel should post to /api/signup for inline checkout')
})

test('seller funnel has mobile layout guards', () => {
    const styles = readFileSync(STYLES_URL, 'utf8')
    assert.ok(/@media \(max-width: 640px\)/.test(styles))
    assert.ok(/flex-direction: column/.test(styles))
})
