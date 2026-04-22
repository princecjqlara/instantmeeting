import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('AI assistant uses guest-side recognition instead of host-local speech recognition', () => {
    const source = readFileSync(new URL('../src/components/AIAssistantPanel.tsx', import.meta.url), 'utf8')

    assert.ok(source.includes('startGuestRecognition'))
    assert.ok(source.includes('stopGuestRecognition'))
    assert.equal(source.includes('const SpeechRecognition = (window as any).SpeechRecognition'), false)
    assert.equal(source.includes('localRecognitionRef'), false)
})
