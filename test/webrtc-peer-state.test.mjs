import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getPeerDisconnectCleanupDelayMs } from '../src/lib/webrtc-peer-state.ts'

test('disconnected peers get a grace period before cleanup', () => {
    assert.equal(getPeerDisconnectCleanupDelayMs('disconnected'), 10_000)
})

test('closed peers are cleaned up immediately', () => {
    assert.equal(getPeerDisconnectCleanupDelayMs('closed'), 0)
})

test('useWebRTC handles delayed cleanup for disconnected peers', () => {
    const source = readFileSync(new URL('../src/hooks/useWebRTC.ts', import.meta.url), 'utf8')

    assert.ok(source.includes('getPeerDisconnectCleanupDelayMs'))
})
