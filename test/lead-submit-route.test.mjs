import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead submit route preserves guest handoff context in waiting URL', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('buildGuestWaitingPath'))
    assert.ok(source.includes('waiting_url'))
    assert.ok(source.includes('resolvedName'))
})

test('lead submit route does not block the response on Meta CAPI delivery', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.equal(source.includes('await maybeSendLeadFormQualifiedMetaEvent'), false)
})

test('lead submit route schedules qualified Meta CAPI sends with the Next after hook', () => {
    const source = readFileSync(new URL('../src/app/api/leads/submit/route.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('after'), 'expected lead submit route to import/use after')
    const afterIndex = source.indexOf('after(() =>')
    const sendIndex = source.indexOf('maybeSendLeadFormQualifiedMetaEvent({')

    assert.notEqual(afterIndex, -1, 'expected qualified Meta CAPI send to be scheduled with after')
    assert.notEqual(sendIndex, -1, 'expected qualified Meta CAPI send call to remain present')
    assert.ok(afterIndex < sendIndex, 'expected after to wrap the qualified Meta CAPI send')
    assert.equal(source.includes('void maybeSendLeadFormQualifiedMetaEvent'), false)
})
