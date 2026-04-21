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
