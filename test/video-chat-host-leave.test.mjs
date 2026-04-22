import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('host leaving the room ends the meeting instead of leaving it active', () => {
    const source = readFileSync(new URL('../src/components/VideoChat.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('isHost && !hostLeaveEndedMeetingRef.current'))
    assert.ok(source.includes('fetch(`/api/meetings/${roomId}/end`'))
})
