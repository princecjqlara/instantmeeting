import test from 'node:test'
import assert from 'node:assert/strict'

import {
    humanizeLeadAnswers,
    normalizeSubmittedLeadAnswers,
} from '../src/lib/lead-answer-display.ts'

const questions = [
    {
        id: 'property-type',
        type: 'single_choice',
        options: [
            { id: 'ai_2_2_tk6v4v', label: 'Condominium', value: 'ai_2_2_tk6v4v' },
            { id: 'ai_2_2_house', label: 'House and lot', value: 'ai_2_2_house' },
        ],
    },
    {
        id: 'budget',
        type: 'multi_choice',
        options: [
            { id: 'ai_3_2_5brcme', label: '₱3M to ₱5M', value: 'ai_3_2_5brcme' },
            { id: 'ai_3_2_10m', label: '₱5M to ₱10M', value: 'ai_3_2_10m' },
        ],
    },
]

test('humanizeLeadAnswers maps stored option codes to labels for display', () => {
    const answers = humanizeLeadAnswers([
        { question_id: 'property-type', question_text: 'What type of property are you looking for?', type: 'single_choice', answer: 'ai_2_2_tk6v4v' },
        { question_id: 'budget', question_text: 'What is your estimated budget?', type: 'multi_choice', answer: ['ai_3_2_5brcme', 'ai_3_2_10m'] },
    ], questions)

    assert.deepEqual(answers.map((answer) => answer.answer), [
        'Condominium',
        ['₱3M to ₱5M', '₱5M to ₱10M'],
    ])
})

test('normalizeSubmittedLeadAnswers stores readable labels for choice answers', () => {
    const answers = normalizeSubmittedLeadAnswers([
        { question_id: 'property-type', question_text: 'What type of property are you looking for?', type: 'single_choice', answer: 'ai_2_2_house' },
    ], questions)

    assert.equal(answers[0].answer, 'House and lot')
})
