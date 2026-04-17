import { chatCompletion } from '@/lib/nvidia-ai'
import type {
    LeadAnswer,
    LeadFormQuestion,
    LeadQualificationResult,
    LeadQuestionOption,
    LeadScoringRule,
    LeadVerdict,
} from '@/lib/lead-forms-types'

export interface QualifierInput {
    criteria: string
    threshold: number
    questions: LeadFormQuestion[]
    answers: LeadAnswer[]
}

function asText(a: LeadAnswer | undefined): string {
    if (!a) return ''
    if (Array.isArray(a.answer)) return a.answer.join(', ')
    return String(a.answer ?? '')
}

function asArray(a: LeadAnswer | undefined): string[] {
    if (!a) return []
    if (Array.isArray(a.answer)) return a.answer
    return a.answer ? [String(a.answer)] : []
}

function checkHardDisqualify(questions: LeadFormQuestion[], answers: LeadAnswer[]): string | null {
    for (const q of questions) {
        if (!q.disqualify_on) continue
        const a = answers.find((x) => x.question_id === q.id)
        if (!a) continue
        const text = asText(a).toLowerCase()
        const rules = q.disqualify_on
            .split(/[,|\n]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        for (const rule of rules) {
            if (rule.startsWith('/') && rule.endsWith('/')) {
                try {
                    if (new RegExp(rule.slice(1, -1), 'i').test(text)) {
                        return `Matched rule "${rule}" on "${q.question_text}"`
                    }
                } catch {
                    /* ignore bad regex */
                }
            } else if (text.includes(rule)) {
                return `Matched keyword "${rule}" on "${q.question_text}"`
            }
        }
    }
    return null
}

function verdictFromScore(score: number, threshold: number): LeadVerdict {
    if (score >= threshold) return 'qualified'
    if (score >= Math.max(0, threshold - 20)) return 'review'
    return 'unqualified'
}

function scoreChoiceQuestion(q: LeadFormQuestion, a: LeadAnswer | undefined) {
    const options = (q.options || []) as LeadQuestionOption[]
    if (!options.length) return { earned: 0, max: 0, note: '' }

    if (q.type === 'single_choice') {
        const value = asText(a)
        const opt = options.find((o) => o.value === value || o.label === value)
        const earned = opt ? Math.max(0, Number(opt.points) || 0) : 0
        const max = Math.max(0, ...options.map((o) => Number(o.points) || 0))
        return {
            earned,
            max,
            note: opt ? `Selected "${opt.label}" (${earned} pts)` : 'No matching option',
        }
    }

    // multi_choice
    const values = asArray(a)
    let earned = 0
    const labels: string[] = []
    for (const v of values) {
        const opt = options.find((o) => o.value === v || o.label === v)
        if (opt) {
            earned += Math.max(0, Number(opt.points) || 0)
            labels.push(`${opt.label} (+${Number(opt.points) || 0})`)
        }
    }
    const max = options.reduce((sum, o) => sum + Math.max(0, Number(o.points) || 0), 0)
    return { earned, max, note: labels.length ? labels.join(', ') : 'None selected' }
}

function scoreTextRules(q: LeadFormQuestion, a: LeadAnswer | undefined) {
    const rules = (q.scoring_rules || []) as LeadScoringRule[]
    if (!rules.length) return { earned: 0, max: 0, note: '' }
    const text = asText(a).toLowerCase()
    let earned = 0
    const hits: string[] = []
    let max = 0
    for (const r of rules) {
        max += Math.max(0, Number(r.points) || 0)
        const kws = (r.keywords || '')
            .split(/[,|\n]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        if (kws.some((k) => text.includes(k))) {
            earned += Math.max(0, Number(r.points) || 0)
            hits.push(`matched "${r.keywords}" (+${r.points})`)
        }
    }
    return { earned, max, note: hits.join('; ') }
}

async function scoreIdealAnswer(q: LeadFormQuestion, a: LeadAnswer | undefined): Promise<{ earned: number; max: number; note: string }> {
    const ideal = (q.ideal_answer || '').trim()
    if (!ideal) return { earned: 0, max: 0, note: '' }
    const answerText = asText(a).trim()
    if (!answerText) return { earned: 0, max: 10, note: 'No answer' }

    try {
        const raw = await chatCompletion(
            [
                {
                    role: 'system',
                    content:
                        'Rate how well an answer matches an ideal answer on a 0-10 integer scale. ' +
                        'Return ONLY JSON: {"score":<0-10>,"note":"<short reason>"}.',
                },
                {
                    role: 'user',
                    content: `Question: ${q.question_text}\nIdeal answer: ${ideal}\nActual answer: ${answerText}\n\nReturn JSON only.`,
                },
            ],
            { temperature: 0.1, maxTokens: 120 }
        )
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) return { earned: 0, max: 10, note: 'AI parse failed' }
        const parsed = JSON.parse(match[0])
        const s = Math.max(0, Math.min(10, Math.round(Number(parsed.score) || 0)))
        return { earned: s, max: 10, note: String(parsed.note || `${s}/10 vs ideal`) }
    } catch {
        return { earned: 0, max: 10, note: 'AI unavailable' }
    }
}

async function runAiRubric(input: QualifierInput): Promise<{ score: number; reasoning: string }> {
    const criteria = (input.criteria || '').trim()
    if (!criteria) return { score: 50, reasoning: 'No criteria set; defaulting to neutral.' }

    const lines = input.questions.map((q) => {
        const a = input.answers.find((x) => x.question_id === q.id)
        return `- Q: ${q.question_text}\n  A: ${asText(a) || '(no answer)'}`
    })
    const user = [
        `Criteria:\n${criteria}`,
        `\nThreshold for auto-admit: ${input.threshold}.`,
        `\nAnswers:`,
        ...lines,
        `\nReturn strict JSON: {"score":<0-100 int>,"reasoning":"<text>"}`,
    ].join('\n')

    try {
        const raw = await chatCompletion(
            [
                {
                    role: 'system',
                    content:
                        'You are a strict but fair lead-qualification judge. Return ONLY valid JSON.',
                },
                { role: 'user', content: user },
            ],
            { temperature: 0.2, maxTokens: 300 }
        )
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) return { score: 50, reasoning: 'AI parse failed; neutral score.' }
        const parsed = JSON.parse(match[0])
        const s = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
        return { score: s, reasoning: String(parsed.reasoning || '').slice(0, 500) }
    } catch {
        return { score: 50, reasoning: 'AI unavailable; neutral score.' }
    }
}

export async function qualifyLead(input: QualifierInput): Promise<LeadQualificationResult> {
    const threshold = Math.max(0, Math.min(100, input.threshold || 70))

    const hard = checkHardDisqualify(input.questions, input.answers)
    if (hard) {
        return { score: 0, verdict: 'unqualified', reasoning: `Hard rule: ${hard}` }
    }

    let totalEarned = 0
    let totalMax = 0
    const notes: Array<{ question_id: string; note: string }> = []

    for (const q of input.questions) {
        const a = input.answers.find((x) => x.question_id === q.id)

        if (q.type === 'single_choice' || q.type === 'multi_choice') {
            const r = scoreChoiceQuestion(q, a)
            totalEarned += r.earned
            totalMax += r.max
            if (r.note) notes.push({ question_id: q.id, note: r.note })
            continue
        }

        // Text-like
        const rule = scoreTextRules(q, a)
        totalEarned += rule.earned
        totalMax += rule.max
        if (rule.note) notes.push({ question_id: q.id, note: rule.note })

        const ideal = await scoreIdealAnswer(q, a)
        totalEarned += ideal.earned
        totalMax += ideal.max
        if (ideal.note) notes.push({ question_id: q.id, note: ideal.note })
    }

    let reasoning = ''
    let score = 0

    if (totalMax > 0) {
        score = Math.round((totalEarned / totalMax) * 100)
        reasoning = `${totalEarned}/${totalMax} points (${score}%).`
    } else if ((input.criteria || '').trim()) {
        // Fall back to free-form AI rubric when no points were set
        const ai = await runAiRubric(input)
        score = ai.score
        reasoning = `AI rubric: ${ai.reasoning}`
    } else {
        return {
            score: 0,
            verdict: 'review',
            reasoning: 'No scoring rules or criteria configured; routing to manual review.',
            per_question_notes: notes,
        }
    }

    return {
        score,
        verdict: verdictFromScore(score, threshold),
        reasoning,
        per_question_notes: notes,
    }
}
