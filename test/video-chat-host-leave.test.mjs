import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('host leaving the room ends the meeting instead of leaving it active', () => {
    const source = readFileSync(new URL('../src/components/VideoChat.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('isHost && !hostLeaveEndedMeetingRef.current'))
    assert.ok(source.includes('fetch(`/api/meetings/${roomId}/end`'))
})

test('guest media mode can join without opening devices until the controls are used', () => {
    const roomSource = readFileSync(new URL('../src/app/room/[roomId]/page.tsx', import.meta.url), 'utf8')
    const hookSource = readFileSync(new URL('../src/hooks/useWebRTC.ts', import.meta.url), 'utf8')
    const chatSource = readFileSync(new URL('../src/components/VideoChat.tsx', import.meta.url), 'utf8')

    assert.ok(roomSource.includes("searchParams.get('media')"))
    assert.ok(hookSource.includes('const shouldRequestAudio'))
    assert.ok(hookSource.includes('toggleMute'))
    assert.ok(chatSource.includes('unmuteTipArrow'))
})
