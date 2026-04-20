import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead form avoids popup handoff when running inside an in-app browser', () => {
    const source = readFileSync(new URL('../src/app/leads/[slug]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('isLikelyInAppBrowser'))
    assert.ok(source.includes('window.location.href = data.join_url'))
    assert.ok(source.includes("window.open('about:blank', '_blank', 'noopener')"))
})

test('in-app browser gate blocks the room while attempting external browser handoff', () => {
    const source = readFileSync(new URL('../src/components/InAppBrowserGate.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('useLayoutEffect'))
    assert.ok(source.includes('attemptingExternalOpen'))
    assert.ok(source.includes('if (showGate || attemptingExternalOpen)'))
})
