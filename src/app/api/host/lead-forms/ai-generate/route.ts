import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { chatCompletion } from '@/lib/nvidia-ai'

export const dynamic = 'force-dynamic'

const SYSTEM = `You design lead qualification forms for busy professionals.
Given a one-line description of a business and its ideal customer, produce a
concise, high-converting intake form that qualifies leads before they book
a live meeting.

Return ONLY valid JSON, no prose. Schema:
{
  "title": string,                  // short form title
  "description": string,            // <= 180 chars, friendly
  "auto_admit_threshold": number,   // 50-85 typical
  "ai_criteria": string,            // 1-3 sentences describing a qualified lead
  "unqualified_message": string,    // <= 180 chars, friendly thanks
  "questions": [
    {
      "question_text": string,
      "help_text": string | null,
      "type": "short_answer" | "long_answer" | "email" | "phone" | "single_choice" | "multi_choice" | "date",
      "required": boolean,
      "options": [                  // required for single_choice / multi_choice
        { "label": string, "points": number }
      ],
      "scoring_rules": [            // for text-like questions; omit for choice
        { "keywords": string, "points": number }
      ] | null,
      "ideal_answer": string | null,
      "disqualify_on": string | null
    }
  ]
}

Rules:
- 4 to 7 questions total. Keep it short — friction kills conversion.
- First question should capture the lead's name. Always include email.
- Use single_choice with 3-5 options for qualification gates (budget, timeline,
  company size, role). Assign 0 points to "wrong fit" answers and higher
  points to ideal answers. The 0-point options will hard-disqualify.
- Use scoring_rules on open-ended questions for keywords that indicate high
  intent (e.g. "enterprise, urgent, replace, migrate": 8 points).
- Keep help_text to one short hint when useful; otherwise null.
- Prefer concrete, specific questions over generic ones.
- Never ask for sensitive info (SSN, card numbers).`

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

        return NextResponse.json(normalized)
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
