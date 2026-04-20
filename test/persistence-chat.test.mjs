import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeProfileSettings } from '../src/lib/profile-settings.ts'
import { appendChatMessage, createChatMessage } from '../src/lib/chat-messages.ts'

test('normalizeProfileSettings returns safe defaults when no user exists', () => {
    const settings = normalizeProfileSettings(null, { fallbackName: 'Host User' })

    assert.deepStrictEqual(settings, {
        username: '',
        name: 'Host User',
        bio: '',
        avatar_url: null,
        availability_mode: 'always',
        auto_admit: false,
        available_from: null,
        available_to: null,
        timezone: 'UTC',
        scroll_threshold: 3,
        meeting_duration: 30,
        followers: 0,
        following: 0,
        welcome_audio_url: null,
        onboarding_completed: false,
        leads_pipeline_stages: ['prospect', 'qualified', 'unqualified', 'sold'],
        meta_capi_access_token: '',
        meta_capi_dataset_id: '',
    })
})

test('normalizeProfileSettings keeps persisted values when present', () => {
    const settings = normalizeProfileSettings({
        username: 'builder',
        name: 'Build Her',
        bio: 'shipped',
        avatar_url: 'https://cdn.example.com/avatar.jpg',
        availability_mode: 'scheduled',
        auto_admit: true,
        available_from: '09:00:00',
        available_to: '17:00:00',
        timezone: 'America/Chicago',
        scroll_threshold: 8,
        meeting_duration: 45,
        followers: 12,
        following: 34,
        welcome_audio_url: 'https://cdn.example.com/welcome.mp3',
        onboarding_completed: true,
        leads_pipeline_stages: ['prospect', 'qualified', 'sold'],
        meta_capi_access_token: 'token-abc',
        meta_capi_dataset_id: 'dataset-xyz',
    })

    assert.equal(settings.username, 'builder')
    assert.equal(settings.name, 'Build Her')
    assert.equal(settings.auto_admit, true)
    assert.equal(settings.scroll_threshold, 8)
    assert.equal(settings.meeting_duration, 45)
    assert.equal(settings.welcome_audio_url, 'https://cdn.example.com/welcome.mp3')
    assert.equal(settings.onboarding_completed, true)
    assert.deepEqual(settings.leads_pipeline_stages, ['prospect', 'qualified', 'sold'])
    assert.equal(settings.meta_capi_access_token, 'token-abc')
    assert.equal(settings.meta_capi_dataset_id, 'dataset-xyz')
})

test('createChatMessage trims input and rejects blank messages', () => {
    const blank = createChatMessage({
        peerId: 'peer-1',
        name: 'Alice',
        text: '    ',
        timestamp: '2026-02-26T00:00:00.000Z',
    })
    assert.equal(blank, null)

    const valid = createChatMessage({
        peerId: 'peer-1',
        name: 'Alice',
        text: '  hello world  ',
        timestamp: '2026-02-26T00:00:00.000Z',
    })

    assert.equal(valid?.text, 'hello world')
    assert.equal(valid?.name, 'Alice')
})

test('appendChatMessage caps message history length', () => {
    const base = Array.from({ length: 2 }).map((_, idx) => ({
        id: `m-${idx}`,
        peerId: 'peer-1',
        name: 'Alice',
        text: `msg-${idx}`,
        timestamp: '2026-02-26T00:00:00.000Z',
        isLocal: idx % 2 === 0,
    }))

    const next = appendChatMessage(base, {
        id: 'm-2',
        peerId: 'peer-2',
        name: 'Bob',
        text: 'msg-2',
        timestamp: '2026-02-26T00:00:00.000Z',
        isLocal: false,
    }, 2)

    assert.equal(next.length, 2)
    assert.equal(next[0].id, 'm-1')
    assert.equal(next[1].id, 'm-2')
})
