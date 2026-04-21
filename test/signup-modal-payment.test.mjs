import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('signup modal makes the GCash receipt requirement explicit', () => {
    const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('Upload GCash receipt'))
    assert.ok(source.includes('Submit GCash receipt'))
    assert.ok(source.includes('disabled={submitting || !receipt}'))
})
