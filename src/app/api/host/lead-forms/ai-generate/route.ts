import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { chatCompletion, ChatMessage } from '@/lib/nvidia-ai'

export const dynamic = 'force-dynamic'

const SYSTEM = `You are a collaborative AI form builder. You work with the host
in a back-and-forth conversation to design a lead qualification form that
decides if a visitor should be auto-admitted into a live meeting.

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
  set anywhere. Always write it so it appears in the host's UI.

CONVERSATIONAL STYLE:
- If the host's request is vague or missing key info (industry, deal size,
  buying signals, geography, budget, disqualifiers), ASK 1-3 focused
  clarifying questions before producing a draft. Keep questions short.
- Volunteer ideas: suggest qualification angles, disqualifier patterns,
  or scoring gradients the host may not have considered, and ask them to
  confirm.
- Once you have enough signal, return a complete draft. On later turns,
  the host may ask to tweak the draft (add a question, raise a threshold,
  soften wording, etc.) — modify the draft and return the updated version.
- Address the host directly in "reply". Be concise, warm, and concrete.
  No markdown headers, no code fences.

OUTPUT FORMAT (STRICT):
Return ONLY a single valid JSON object, no prose, no code fences.
{
  "reply": string,              // your conversational message to the host
  "draft": null | {             // null while still clarifying; object when you have a full form
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
        "ideal_answer": string | null,
        "disqualify_on": string | null
      }
    ]
  }
}

WHEN YOU RETURN A DRAFT, IT MUST SATISFY:
- Exactly 4-6 questions total. No fluff.
- First question: full name (short_answer, required).
- Include exactly one email question (type=email, required).
- Include AT LEAST 2 qualification gates as single_choice questions.
  Each gate must have 3-5 options with a CLEAR points gradient:
    * 1 option with points=0 (the disqualifier / "not a fit")
    * 1 option with the max points (the ideal fit)
    * intermediate options in between
- Max points per single_choice option should be 10.
- ai_criteria is mandatory and must describe the ideal lead concretely.
- auto_admit_threshold between 55 and 80. Set higher (70-80) when any
  question includes a 0-point disqualifier.

STYLE:
- Questions are specific, not generic. Prefer ranges and concrete options.
- Keep help_text empty (null) unless the question really needs a hint.
- Never ask for SSN, card numbers, passwords, or protected attributes.
- unqualified_message should be warm and brief (<160 chars).`

type ClientMessage = { role: 'user' | 'assistant'; content: string }

function sanitizeHistory(raw: unknown): ClientMessage[] {
    if (!Array.isArray(raw)) return []
    const out: ClientMessage[] = []
    for (const m of raw) {
        if (!m || typeof m !== 'object') continue
        const role = (m as AnyObj).role
        const content = (m as AnyObj).content
        if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
            out.push({ role, content: content.slice(0, 4000) })
        }
    }
    // cap conversation length to keep tokens reasonable
    return out.slice(-20)
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const history = sanitizeHistory(body?.messages)
    // Back-compat: allow a single `prompt` field for the first turn.
    if (history.length === 0 && typeof body?.prompt === 'string' && body.prompt.trim()) {
        history.push({ role: 'user', content: body.prompt.trim() })
    }
    if (history.length === 0 || history[history.length - 1].role !== 'user') {
        return NextResponse.json(
            { error: 'Send a message describing what you want to change or build.' },
            { status: 400 }
        )
    }
    if (history[0].content.length < 4) {
        return NextResponse.json(
            { error: 'Describe your business and ideal lead in a sentence or two.' },
            { status: 400 }
        )
    }

    try {
        const messages: ChatMessage[] = [
            { role: 'system', content: SYSTEM },
            ...history,
        ]

        const raw = await chatCompletion(messages, { temperature: 0.4, maxTokens: 1600 })

        const parsed = extractJson(raw)
        let reply: string
        let rawDraft: unknown
        if (parsed) {
            reply = asStr(parsed.reply).trim()
            rawDraft = parsed.draft && typeof parsed.draft === 'object' ? parsed.draft : null
            if (!reply) {
                reply = rawDraft
                    ? 'Here is an updated draft for your review.'
                    : stripJson(raw) || 'Could you share a bit more detail?'
            }
        } else {
            // Model returned plain prose instead of JSON — treat as a clarifying reply.
            reply = stripJson(raw).trim() || 'Could you share a bit more detail?'
            rawDraft = null
        }

        if (!rawDraft) {
            return NextResponse.json({ reply, draft: null })
        }

        const normalized = normalizeForm(rawDraft)
        if (!normalized.questions.length) {
            // treat as clarifying-only turn
            return NextResponse.json({ reply, draft: null })
        }

        const lastUser = history.filter((m) => m.role === 'user').pop()?.content || ''
        const enforced = enforceQualificationSignal(normalized, lastUser)
        return NextResponse.json({ reply, draft: enforced })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'AI generation failed.'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

type AnyObj = Record<string, unknown>

function extractJson(raw: string): AnyObj | null {
    if (!raw) return null
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    const first = cleaned.indexOf('{')
    if (first < 0) return null
    // Walk with brace balance + string awareness to find a complete object.
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = first; i < cleaned.length; i++) {
        const c = cleaned[i]
        if (inStr) {
            if (esc) esc = false
            else if (c === '\\') esc = true
            else if (c === '"') inStr = false
            continue
        }
        if (c === '"') inStr = true
        else if (c === '{') depth++
        else if (c === '}') {
            depth--
            if (depth === 0) {
                const slice = cleaned.slice(first, i + 1)
                try {
                    const v = JSON.parse(slice)
                    return v && typeof v === 'object' ? (v as AnyObj) : null
                } catch {
                    return null
                }
            }
        }
    }
    return null
}

function stripJson(raw: string): string {
    return raw.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/, '').trim()
}

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
    if (!form.ai_criteria || form.ai_criteria.length < 10) {
        form.ai_criteria = `Qualified leads match this profile: ${userPrompt.slice(0, 600)}.`
    }

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

    if (!hasChoiceScoring && !hasTextScoring) {
        const target = form.questions.find(
            (q) => q.type === 'long_answer' || q.type === 'short_answer'
        )
        if (target) {
            target.ideal_answer = form.ai_criteria
        }
    }

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

    if (form.auto_admit_threshold < 30) form.auto_admit_threshold = 60
    if (form.auto_admit_threshold > 95) form.auto_admit_threshold = 80

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
