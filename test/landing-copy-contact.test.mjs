import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('landing page keeps the Facebook contact CTA and animated join cue', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/app/page.module.css', import.meta.url), 'utf8')

    assert.ok(source.includes('Contact us'))
    assert.ok(source.includes('https://www.facebook.com/aresmediaph'))
    assert.ok(source.includes('joinArrow'))
    assert.ok(styles.includes('.joinGlow'))
    assert.ok(styles.includes('@keyframes joinArrowNudge'))
})

test('landing page targets real estate agents with a VSL-first hero and funnel CTA', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(/real estate/i.test(source), 'hero should reference real estate audience')
    assert.ok(source.includes('vslWrap'), 'hero should include a VSL video frame')
    assert.ok(source.includes('#seller-funnel'), 'hero CTA should scroll to the seller funnel section')
    assert.ok(source.includes('SellerLeadFunnel'), 'page should render the SellerLeadFunnel component')
})

test('landing page no longer renders the old feature strip or manipulative accordion', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(!source.includes('Scored intake forms'))
    assert.ok(!source.includes('Instant admission or booking'))
    assert.ok(!source.includes('Deploy anywhere'))
    assert.ok(!source.includes('className={styles.features}'))
    assert.ok(!source.includes('funnelAccordion'), 'static accordion should be replaced by the diagnostic component')
    assert.ok(!source.includes("You're the #1 reason your leads"), 'manipulative blame headline should be gone')
})

test('landing page hides subscription pricing until after the diagnostic', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(!source.includes('id="pricing"'), 'standalone pricing section should be removed')
    assert.ok(!source.includes('Single plan, monthly payment'), 'standalone pricing header should be gone')

    const heroMatch = source.match(/<section className=\{styles\.hero\}>([\s\S]*?)<\/section>/)
    assert.ok(heroMatch, 'expected a hero section')
    assert.ok(!/₱699|₱1,499|\/month/i.test(heroMatch[1]), 'hero should not reveal subscription pricing before the diagnostic')
})

test('landing page includes dedicated mobile layout guards', () => {
    const styles = readFileSync(new URL('../src/app/page.module.css', import.meta.url), 'utf8')

    assert.ok(styles.includes('@media (max-width: 720px)'))
    assert.ok(styles.includes('.navActions'))
    assert.ok(styles.includes('justify-content: space-between'))
    assert.ok(styles.includes('.testimonialsGrid'))
    assert.ok(styles.includes('grid-template-columns: 1fr'))
    assert.ok(styles.includes('.pricingPriceRow'))
    assert.ok(styles.includes('flex-wrap: wrap'))
})
