import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('landing page uses monthly pricing copy and exposes a Facebook contact CTA', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/app/page.module.css', import.meta.url), 'utf8')

    assert.ok(source.includes('₱699/month'))
    assert.ok(source.includes('monthly payment'))
    assert.ok(source.includes('Contact us'))
    assert.ok(source.includes('https://www.facebook.com/aresmediaph'))
    assert.ok(source.includes('Free Facebook ads setup'))
    assert.ok(source.includes('joinArrow'))
    assert.ok(styles.includes('.joinGlow'))
    assert.ok(styles.includes('@keyframes joinArrowNudge'))
})

test('landing page removes the old feature strip cards', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(!source.includes('Scored intake forms'))
    assert.ok(!source.includes('Instant admission or booking'))
    assert.ok(!source.includes('Deploy anywhere'))
    assert.ok(!source.includes('className={styles.features}'))
})

test('landing page includes dedicated mobile layout guards for nav, testimonials, and pricing', () => {
    const styles = readFileSync(new URL('../src/app/page.module.css', import.meta.url), 'utf8')

    assert.ok(styles.includes('@media (max-width: 720px)'))
    assert.ok(styles.includes('.navActions'))
    assert.ok(styles.includes('justify-content: space-between'))
    assert.ok(styles.includes('.testimonialsGrid'))
    assert.ok(styles.includes('grid-template-columns: 1fr'))
    assert.ok(styles.includes('.pricingPriceRow'))
    assert.ok(styles.includes('flex-wrap: wrap'))
})
