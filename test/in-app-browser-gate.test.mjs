import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('lead form keeps qualified guests in the current browser instead of opening a popup', () => {
    const source = readFileSync(new URL('../src/app/leads/[slug]/page.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('window.location.href = data.join_url'))
    assert.equal(source.includes("window.open('about:blank', '_blank', 'noopener')"), false)
})

test('guest pages expose a manual external-browser assist button', () => {
    const waitingSource = readFileSync(new URL('../src/app/waiting/[meetingId]/page.tsx', import.meta.url), 'utf8')
    const roomSource = readFileSync(new URL('../src/app/room/[roomId]/page.tsx', import.meta.url), 'utf8')

    assert.ok(waitingSource.includes('GuestExternalBrowserAssist'))
    assert.ok(roomSource.includes('GuestExternalBrowserAssist'))
})
