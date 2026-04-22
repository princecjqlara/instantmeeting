import test from 'node:test'
import assert from 'node:assert/strict'

import {
    buildLeadFormAiSystemPrompt,
    buildOnboardingFallbackLeadForm,
} from '../src/lib/lead-form-ai.ts'

test('onboarding AI prompt forces an immediate draft', () => {
    const prompt = buildLeadFormAiSystemPrompt('onboarding')

    assert.match(prompt, /do not ask clarifying questions/i)
    assert.match(prompt, /return a complete draft on the first reply/i)
})

test('onboarding fallback lead form creates a complete starter draft', () => {
    const draft = buildOnboardingFallbackLeadForm(
        'I help B2B agencies book more retainers with owners who want to grow this quarter.'
    )

    assert.ok(draft.title.length > 0)
    assert.ok(draft.description.length > 0)
    assert.ok(draft.questions.length >= 4 && draft.questions.length <= 6)
    assert.equal(draft.questions[0].question_text, 'Full name')
    assert.equal(draft.questions[0].type, 'short_answer')

    const emailQuestions = draft.questions.filter((question) => question.type === 'email')
    assert.equal(emailQuestions.length, 1)

    const qualifyingGates = draft.questions.filter((question) => question.type === 'single_choice')
    assert.ok(qualifyingGates.length >= 2)
    for (const gate of qualifyingGates.slice(0, 2)) {
        const points = gate.options.map((option) => option.points)
        assert.ok(points.includes(0))
        assert.ok(points.includes(10))
    }
})
