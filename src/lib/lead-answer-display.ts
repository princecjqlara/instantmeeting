import type { LeadAnswer, LeadFormQuestion, LeadQuestionOption } from '@/lib/lead-forms-types'

type LeadQuestionLike = Pick<LeadFormQuestion, 'id' | 'type' | 'options'>
type LeadAnswerLike = Pick<LeadAnswer, 'question_id' | 'question_text' | 'type' | 'answer'>

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice'])

function resolveOptionLabel(value: string, options: LeadQuestionOption[] | null | undefined) {
    const normalized = value.trim()
    if (!normalized || !options?.length) {
        return value
    }

    const match = options.find((option) => {
        const optionId = typeof option.id === 'string' ? option.id.trim() : ''
        const optionValue = typeof option.value === 'string' ? option.value.trim() : ''
        const optionLabel = typeof option.label === 'string' ? option.label.trim() : ''

        return normalized === optionId || normalized === optionValue || normalized === optionLabel
    })

    return match?.label?.trim() || value
}

function humanizeLeadAnswerValue(answer: string | string[], question: LeadQuestionLike | undefined) {
    if (!question || !CHOICE_TYPES.has(question.type)) {
        return answer
    }

    if (Array.isArray(answer)) {
        return answer.map((value) => resolveOptionLabel(String(value || ''), question.options))
    }

    return resolveOptionLabel(String(answer || ''), question.options)
}

export function humanizeLeadAnswers<T extends LeadAnswerLike>(answers: T[], questions: LeadQuestionLike[]) {
    const questionById = new Map(questions.map((question) => [question.id, question]))

    return answers.map((answer) => ({
        ...answer,
        answer: humanizeLeadAnswerValue(answer.answer, questionById.get(answer.question_id)),
    }))
}

export function normalizeSubmittedLeadAnswers<T extends LeadAnswerLike>(answers: T[], questions: LeadQuestionLike[]) {
    return humanizeLeadAnswers(answers, questions)
}
