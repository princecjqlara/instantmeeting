import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { chatCompletion } from '@/lib/nvidia-ai'

export const dynamic = 'force-dynamic'

const SYSTEM = `You design lead qualification forms that determine if a
visitor should be auto-admitted into a live meeting. The form's scoring
drives the decision, so the scoring MUST be explicit.

HOW QUALIFICATION WORKS (you must design for this):
- Each single_choice/multi_choice option has a "points" value. At submit
  time the system sums earned vs. max possible points -> percentage.
  If percentage >= auto_admit_threshold the lead is AUTO-ADMITTED.
- Picking a 0-point option on a scoring question is treated as a HARD
  DISQUALIFY (lead is rejected, shown unqualified_message).
- disqualify_on keywords on a text answer are ALSO a hard disqualify.
- For open-ended questions you can provide scoring_rules (keyword -> pts)
  and an ideal_answer (the system asks an LLM to rate 0-10 how close the
  answer is to the ideal).
- ai_criteria is a natural-language fallback used only when no points are
  set anywhere. Always write it anyway so it appears in the host's UI.

Return ONLY valid JSON, no prose. Schema:
{
  "title": string,
  "description": string,
  "auto_admit_threshold": number,     // integer 55-80
  "ai_criteria": string,              // 1-3 sentences, the qualified-lead profile
  "unqualified_message": string,
  "questions": [
    {
      "question_text": string,
      "help_text": string | null,
      "type": "short_answer" | "long_answer" | "email" | "phone" | "single_choice" | "multi_choice" | "date",
      "required": boolean,
      "options": [                    // required for single_choice / multi_choice
        { "label": string, "points": number }
      ],
      "scoring_rules": [              // optional for text-like questions
        { "keywords": string, "points": number }
      ] | null,
      "ideal_answer": string | null,  // optional for text-like questions
      "disqualify_on": string | null  // optional hard-rule keywords
    }
  ]
}

HARD RULES (you will be rejected if these are missing):
- Exactly 4-6 questions total. No fluff.
- First question: full name (short_answer, required).
- Include exactly one email question (type=email, required).
- Include AT LEAST 2 qualification gates as single_choice questions.
  Each gate must have 3-5 options with a CLEAR points gradient:
    * 1 option with points=0 (the disqualifier / "not a fit")
    * 1 option with the max points (the ideal fit)
    * intermediate options with values in between
- Max points per single_choice option should be 10.
- ai_criteria is mandatory and must describe the ideal lead concretely.
- auto_admit_threshold between 55 and 80. Set higher (70-80) when any
  question includes a 0-point disqualifier.
- Optional: add disqualify_on keywords on any long_answer where specific
  words indicate a bad fit (e.g. "just browsing, student, curious").
- Optional: add ideal_answer on a long_answer where tone/detail matters.

STYLE:
- Questions are specific, not generic. Prefer "What's your team size?" with
  ranges over "Tell us about yourself".
- Keep help_text empty (null) unless the question really needs a hint.
- Never ask for SSN, card numbers, passwords, or protected attributes.
- unqualified_message should be warm and brief (<160 chars).`

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt || prompt.length < 6) {
        return NextResponse.json(
            { error: 'Describe your business and ideal lead in a sentence or two.' },
            { status: 400 }
        )
    }

    try {
        const raw = await chatCompletion(
            [
                { role: 'system', content: SYSTEM },
                {
                    role: 'user',
                    content: `Business & ideal customer:\n${prompt}\n\nReturn the JSON now.`,
                },
            ],
            { temperature: 0.4, maxTokens: 1400 }
        )

        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) {
            return NextResponse.json({ error: 'AI returned invalid response.' }, { status: 502 })
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(match[0])
        } catch {
            return NextResponse.json({ error: 'AI response was not valid JSON.' }, { status: 502 })
        }

        const normalized = normalizeForm(parsed)
        if (!normalized.questions.length) {
            return NextResponse.json({ error: 'AI produced no questions.' }, { status: 502 })
        }

        const enforced = enforceQualificationSignal(normalized, prompt)
        return NextResponse.json(enforced)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'AI generation failed.'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

type AnyObj = Record<string, unknown>

function asStr(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback
}
function asNum(v: unknown, fallback = 0): number {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : fallback
}
function asBool(v: unknown, fallback = true): boolean {
    return typeof v === 'boolean' ? v : fallback
}

const ALLOWED_TYPES = new Set([
    'short_answer',
    'long_answer',
    'email',
    'phone',
    'single_choice',
    'multi_choice',
    'date',
])

type NormalizedForm = ReturnType<typeof normalizeForm>

function enforceQualificationSignal(
    form: NormalizedForm,
    userPrompt: string
): NormalizedForm & { qualification_summary: string[] } {
    // Ensure ai_criteria is always populated (fallback signal)
    if (!form.ai_criteria || form.ai_criteria.length < 10) {
        form.ai_criteria = `Qualified leads match this profile: ${userPrompt.slice(0, 600)}.`
    }

    // Make sure at least one scoring signal exists across the form.
    const hasChoiceScoring = form.questions.some(
        (q) =>
            (q.type === 'single_choice' || q.type === 'multi_choice') &&
            (q.options || []).some((o) => (Number(o.points) || 0) > 0)
    )
    const hasTextScoring = form.questions.some(
        (q) =>
            (q.scoring_rules || []).some((r) => (Number(r.points) || 0) > 0) ||
            (q.ideal_answer && q.ideal_answer.length > 0)
    )

    // If nothing has scoring, attach an ideal_answer to the first long/short
    // answer question so the AI rubric kicks in at submit.
    if (!hasChoiceScoring && !hasTextScoring) {
        const target = form.questions.find(
            (q) => q.type === 'long_answer' || q.type === 'short_answer'
        )
        if (target) {
            target.ideal_answer = form.ai_criteria
        }
    }

    // For single_choice questions that look like qualification gates but
    // have all options = 0 pts, spread a gradient so scoring actually works.
    for (const q of form.questions) {
        if (q.type !== 'single_choice') continue
        if (!q.options || q.options.length < 2) continue
        const maxPts = Math.max(...q.options.map((o) => Number(o.points) || 0))
        if (maxPts > 0) continue
        const n = q.options.length
        q.options = q.options.map((o, i) => ({
            ...o,
            points: i === 0 ? 0 : Math.round((10 * i) / Math.max(1, n - 1)),
        }))
    }

    // Keep threshold sensible
    if (form.auto_admit_threshold < 30) form.auto_admit_threshold = 60
    if (form.auto_admit_threshold > 95) form.auto_admit_threshold = 80

    // Human-readable summary explaining how this form will qualify leads.
    const summary: string[] = []
    summary.push(
        `Auto-admit when score reaches ${form.auto_admit_threshold}/100 based on the scoring below.`
    )
    for (const q of form.questions) {
        if (q.type === 'single_choice' || q.type === 'multi_choice') {
            const scored = (q.options || []).filter((o) => (Number(o.points) || 0) > 0)
            const zero = (q.options || []).filter((o) => (Number(o.points) || 0) === 0)
            if (scored.length || zero.length) {
                const parts: string[] = []
                if (scored.length)
                    parts.push(
                        `${scored.length} ideal (max ${Math.max(
                            ...scored.map((o) => Number(o.points) || 0)
                        )} pts)`
                    )
                if (zero.length) parts.push(`${zero.length} disqualifier`)
                summary.push(`“${q.question_text}” — ${parts.join(', ')}`)
            }
        } else if ((q.scoring_rules || []).length) {
            const total = (q.scoring_rules || []).reduce(
                (s, r) => s + (Number(r.points) || 0),
                0
            )
            summary.push(`“${q.question_text}” — keyword scoring up to ${total} pts`)
        } else if (q.ideal_answer) {
            summary.push(`“${q.question_text}” — AI compares to ideal answer (up to 10 pts)`)
        }
        if (q.disqualify_on) {
            summary.push(`“${q.question_text}” — hard disqualify keywords: ${q.disqualify_on}`)
        }
    }
    summary.push(`Fallback profile: ${form.ai_criteria}`)

    return { ...form, qualification_summary: summary }
}

function normalizeForm(raw: unknown) {
    const r = (raw ?? {}) as AnyObj
    const rawQuestions = Array.isArray(r.questions) ? (r.questions as AnyObj[]) : []

    const questions = rawQuestions.slice(0, 8).map((q, idx) => {
        const type = ALLOWED_TYPES.has(asStr(q.type)) ? asStr(q.type) : 'short_answer'
        const rawOptions = Array.isArray(q.options) ? (q.options as AnyObj[]) : []
        const options = (type === 'single_choice' || type === 'multi_choice'
            ? rawOptions.slice(0, 6)
            : []
        ).map((o, oi) => {
            const id = `ai_${idx}_${oi}_${Math.random().toString(36).slice(2, 8)}`
            const label = asStr(o.label, `Option ${oi + 1}`).slice(0, 120)
            return { id, label, value: id, points: asNum(o.points, 0) }
        })

        const rawRules = Array.isArray(q.scoring_rules) ? (q.scoring_rules as AnyObj[]) : []
        const scoring_rules = rawRules.slice(0, 6).map((rule, ri) => ({
            id: `ai_rule_${idx}_${ri}_${Math.random().toString(36).slice(2, 6)}`,
            keywords: asStr(rule.keywords).slice(0, 200),
            points: asNum(rule.points, 0),
        }))

        return {
            question_text: asStr(q.question_text).slice(0, 240) || `Question ${idx + 1}`,
            help_text: q.help_text == null ? null : asStr(q.help_text).slice(0, 240),
            type,
            options,
            required: asBool(q.required, true),
            ai_weight: 1,
            scoring_rules,
            ideal_answer: q.ideal_answer == null ? null : asStr(q.ideal_answer).slice(0, 500),
            disqualify_on: q.disqualify_on == null ? null : asStr(q.disqualify_on).slice(0, 240),
        }
    })

    const threshold = Math.max(0, Math.min(100, asNum(r.auto_admit_threshold, 70)))

    return {
        title: asStr(r.title, 'Lead Qualification Form').slice(0, 120),
        description: asStr(r.description).slice(0, 400),
        ai_criteria: asStr(r.ai_criteria).slice(0, 1200),
        unqualified_message:
            asStr(r.unqualified_message, "Thanks for your response. We'll be in touch.").slice(
                0,
                400
            ),
        auto_admit_threshold: threshold,
        questions,
    }
}
