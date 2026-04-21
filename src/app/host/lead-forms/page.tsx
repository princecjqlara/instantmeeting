'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import {
    FaArrowLeft,
    FaPlus,
    FaTrash,
    FaSave,
    FaCopy,
    FaLink,
    FaGripVertical,
    FaArrowUp,
    FaArrowDown,
    FaMagic,
} from 'react-icons/fa'

type QType =
    | 'short_answer'
    | 'long_answer'
    | 'email'
    | 'phone'
    | 'single_choice'
    | 'multi_choice'
    | 'date'

interface ScoringRule {
    id: string
    keywords: string
    points: number
}

interface Question {
    id?: string
    question_text: string
    help_text?: string | null
    type: QType
    options: Array<{ id: string; label: string; value: string; points?: number }>
    required: boolean
    ai_weight: number
    disqualify_on?: string | null
    scoring_rules?: ScoringRule[]
    ideal_answer?: string | null
}

interface FormSummary {
    id: string
    slug: string
    title: string
    is_active: boolean
    auto_admit_threshold: number
    created_at: string
}

interface FullForm extends FormSummary {
    description?: string | null
    ai_criteria?: string | null
    unqualified_message?: string | null
    fallback_to_waiting: boolean
    meta_capi_access_token?: string | null
    meta_capi_dataset_id?: string | null
    meta_capi_test_event_code?: string | null
    facebook_purchase_value?: number | null
    send_qualified_to_facebook?: boolean
    send_purchase_to_facebook?: boolean
    questions: Question[]
}

function newQuestion(): Question {
    return {
        question_text: '',
        type: 'short_answer',
        options: [],
        required: true,
        ai_weight: 1,
    }
}

function newOption() {
    const id = crypto.randomUUID()
    return { id, label: '', value: id, points: 0 }
}

function normalizeOption(opt: { id?: string; label?: string; value?: string; points?: number }) {
    const id = opt.id || crypto.randomUUID()
    return {
        id,
        label: opt.label ?? '',
        value: opt.value || id,
        points: opt.points ?? 0,
    }
}

function newRule(): ScoringRule {
    return { id: crypto.randomUUID(), keywords: '', points: 0 }
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }
type AiDraft = {
    title: string
    description: string
    ai_criteria: string
    unqualified_message: string
    auto_admit_threshold: number
    questions: Question[]
    qualification_summary?: string[]
}

function FormPreview({ draft }: { draft: AiDraft }) {
    const maxPts = draft.questions.reduce((total, q) => {
        if (q.type === 'single_choice' || q.type === 'multi_choice') {
            const opts = q.options || []
            if (!opts.length) return total
            if (q.type === 'single_choice') {
                return total + Math.max(0, ...opts.map((o) => Number(o.points) || 0))
            }
            return total + opts.reduce((s, o) => s + Math.max(0, Number(o.points) || 0), 0)
        }
        const rulePts = (q.scoring_rules || []).reduce(
            (s, r) => s + Math.max(0, Number(r.points) || 0),
            0
        )
        const idealPts = q.ideal_answer ? 10 : 0
        return total + rulePts + idealPts
    }, 0)

    return (
        <div
            style={{
                background: '#0b0f1e',
                borderRadius: 12,
                padding: 20,
                border: '1px solid rgba(255,255,255,0.08)',
            }}
        >
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Lead-facing preview
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                {draft.title || 'Untitled form'}
            </div>
            {draft.description && (
                <div style={{ fontSize: 13, color: '#cbd5e1', opacity: 0.8, marginBottom: 14 }}>
                    {draft.description}
                </div>
            )}
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 14 }}>
                Auto-admit ≥ {draft.auto_admit_threshold}/100 · {draft.questions.length} questions
                {maxPts > 0 ? ` · up to ${maxPts} pts` : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {draft.questions.map((q, i) => (
                    <div key={i} style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: i ? 14 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7', marginBottom: 4 }}>
                            {i + 1}. {q.question_text}
                            {q.required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
                        </div>
                        {q.help_text && (
                            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{q.help_text}</div>
                        )}
                        {q.type === 'short_answer' && (
                            <div style={previewInput}>Short text answer…</div>
                        )}
                        {q.type === 'long_answer' && (
                            <div style={{ ...previewInput, minHeight: 60 }}>Long answer…</div>
                        )}
                        {q.type === 'email' && <div style={previewInput}>name@example.com</div>}
                        {q.type === 'phone' && <div style={previewInput}>+1 555 000 0000</div>}
                        {q.type === 'date' && <div style={previewInput}>YYYY-MM-DD</div>}
                        {(q.type === 'single_choice' || q.type === 'multi_choice') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                                {q.options.map((o) => {
                                    const pts = Number(o.points) || 0
                                    const isDq = pts === 0
                                    return (
                                        <div
                                            key={o.id}
                                            style={{
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: 12.5,
                                                color: '#e2e8f0',
                                            }}
                                        >
                                            <span>
                                                <span style={{ opacity: 0.5, marginRight: 8 }}>
                                                    {q.type === 'multi_choice' ? '☐' : '○'}
                                                </span>
                                                {o.label || '—'}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: isDq ? '#fca5a5' : '#86efac',
                                                    opacity: 0.9,
                                                }}
                                            >
                                                {isDq ? 'disqualify' : `+${pts} pts`}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {(q.scoring_rules || []).length > 0 && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                                Keyword scoring:{' '}
                                {(q.scoring_rules || [])
                                    .map((r) => `"${r.keywords}" → +${r.points}`)
                                    .join(' · ')}
                            </div>
                        )}
                        {q.ideal_answer && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>
                                AI rubric: compares to ideal answer (up to +10 pts)
                            </div>
                        )}
                        {q.disqualify_on && (
                            <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 6 }}>
                                Hard disqualify on: {q.disqualify_on}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {draft.ai_criteria && (
                <div
                    style={{
                        marginTop: 14,
                        padding: 10,
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#c7d2fe',
                    }}
                >
                    <strong style={{ opacity: 0.85 }}>Qualified lead:</strong> {draft.ai_criteria}
                </div>
            )}
            {draft.unqualified_message && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    Unqualified reply: &ldquo;{draft.unqualified_message}&rdquo;
                </div>
            )}
        </div>
    )
}

const previewInput: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: 12.5,
    color: '#64748b',
}

function AiGenerateModal({
    messages,
    input,
    setInput,
    loading,
    error,
    draft,
    onSend,
    onApply,
    onClose,
    onReset,
}: {
    messages: ChatMsg[]
    input: string
    setInput: (v: string) => void
    loading: boolean
    error: string | null
    draft: AiDraft | null
    onSend: (text?: string) => void
    onApply: () => void
    onClose: () => void
    onReset: () => void
}) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages, loading])
    const samples = [
        'I sell SEO services to dentists in the US and want enterprise-size clinics (3+ locations).',
        'I run a solo real estate agency and want qualified buyers for homes $500k+ in Austin.',
        'I offer executive coaching to VPs of Engineering at Series B+ startups hiring fast.',
    ]
    const tweakSamples = [
        'Add a question about timeline to buy.',
        'Raise the auto-admit threshold to 75.',
        'Make the budget question harsher — disqualify under $5k.',
    ]
    const isEmpty = messages.length === 0
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (loading || !input.trim()) return
        onSend()
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5, 7, 15, 0.72)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                padding: 20,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#0f1220',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: draft ? 1100 : 720,
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#f5f5f7',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FaMagic style={{ color: '#a855f7' }} />
                        <h2 style={{ margin: 0, fontSize: 18 }}>AI Form Builder</h2>
                        {draft && (
                            <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 6 }}>
                                · iterate in chat, preview updates on the right
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {messages.length > 0 && (
                            <button
                                type="button"
                                onClick={onReset}
                                disabled={loading}
                                style={ghostBtn}
                            >
                                Start over
                            </button>
                        )}
                        <button type="button" onClick={onClose} style={ghostBtn}>
                            Close
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: draft ? 'minmax(320px, 1fr) minmax(340px, 1.1fr)' : '1fr',
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            borderRight: draft ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        }}
                    >
                        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                            {isEmpty ? (
                                <>
                                    <p style={{ opacity: 0.75, marginTop: 0, fontSize: 14, lineHeight: 1.55 }}>
                                        Describe your business and who you want to qualify. I&apos;ll ask
                                        clarifying questions, suggest ideas, and draft a full form you can
                                        keep refining with me.
                                    </p>
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 6 }}>
                                            Try an example:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {samples.map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => onSend(s)}
                                                    disabled={loading}
                                                    style={chipBtn}
                                                >
                                                    {s.length > 72 ? s.slice(0, 69) + '…' : s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {messages.map((m, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                                maxWidth: '88%',
                                                background:
                                                    m.role === 'user'
                                                        ? 'linear-gradient(135deg,#6366f1,#a855f7)'
                                                        : 'rgba(255,255,255,0.05)',
                                                border:
                                                    m.role === 'user'
                                                        ? 'none'
                                                        : '1px solid rgba(255,255,255,0.08)',
                                                color: '#fff',
                                                padding: '10px 13px',
                                                borderRadius: 12,
                                                fontSize: 13.5,
                                                lineHeight: 1.5,
                                                whiteSpace: 'pre-wrap',
                                            }}
                                        >
                                            {m.content}
                                        </div>
                                    ))}
                                    {loading && (
                                        <div
                                            style={{
                                                alignSelf: 'flex-start',
                                                padding: '10px 13px',
                                                borderRadius: 12,
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                fontSize: 13,
                                                opacity: 0.75,
                                            }}
                                        >
                                            Thinking…
                                        </div>
                                    )}
                                    {draft && !loading && (
                                        <div style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                                            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>
                                                Try a quick tweak:
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {tweakSamples.map((s) => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => onSend(s)}
                                                        disabled={loading}
                                                        style={chipBtn}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: '10px 12px',
                                        background: 'rgba(239,68,68,0.12)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#fecaca',
                                        borderRadius: 10,
                                        fontSize: 13,
                                    }}
                                >
                                    {error}
                                </div>
                            )}
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            style={{
                                padding: 14,
                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-end',
                            }}
                        >
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        if (!loading && input.trim()) onSend()
                                    }
                                }}
                                rows={isEmpty ? 4 : 2}
                                placeholder={
                                    isEmpty
                                        ? 'e.g. I sell a B2B payroll product to HR leaders at 50-500 person companies...'
                                        : draft
                                          ? 'Ask for a tweak — "add a timeline question" or "make the budget gate stricter"…'
                                          : 'Answer the AI or add more detail…'
                                }
                                style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#fff',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    resize: 'none',
                                }}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={loading || input.trim().length < 2}
                                style={{
                                    background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                                    border: 'none',
                                    color: '#fff',
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                    opacity: loading || input.trim().length < 2 ? 0.6 : 1,
                                }}
                            >
                                Send
                            </button>
                        </form>
                    </div>

                    {draft && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0,
                                background: 'rgba(0,0,0,0.25)',
                            }}
                        >
                            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                                <FormPreview draft={draft} />
                                {draft.qualification_summary && draft.qualification_summary.length > 0 && (
                                    <div
                                        style={{
                                            marginTop: 14,
                                            background: 'rgba(34,197,94,0.08)',
                                            border: '1px solid rgba(34,197,94,0.25)',
                                            borderRadius: 12,
                                            padding: 14,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: 0.6,
                                                color: '#86efac',
                                                marginBottom: 8,
                                            }}
                                        >
                                            How this form decides qualified vs. unqualified
                                        </div>
                                        <ul
                                            style={{
                                                margin: 0,
                                                paddingLeft: 18,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 4,
                                                fontSize: 12.5,
                                                lineHeight: 1.55,
                                                color: '#d1fae5',
                                            }}
                                        >
                                            {draft.qualification_summary.map((line, i) => (
                                                <li key={i}>{line}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <div
                                style={{
                                    padding: 14,
                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 10,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={onApply}
                                    style={{
                                        background: 'linear-gradient(135deg,#22c55e,#10b981)',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '10px 18px',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                    }}
                                >
                                    Apply to form
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const ghostBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 600,
}

const chipBtn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e5e7eb',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
}


export default function LeadFormsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [forms, setForms] = useState<FormSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<FullForm | null>(null)
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)
    const [aiOpen, setAiOpen] = useState(false)
    const [aiInput, setAiInput] = useState('')
    const [aiMessages, setAiMessages] = useState<ChatMsg[]>([])
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [aiDraft, setAiDraft] = useState<AiDraft | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/')
    }, [status, router])

    const loadForms = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/host/lead-forms')
            if (res.ok) setForms(await res.json())
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (session) loadForms()
    }, [session])

    const openEditor = async (id?: string) => {
        if (!id) {
            setEditing({
                id: '',
                slug: '',
                title: '',
                is_active: true,
                auto_admit_threshold: 70,
                created_at: '',
                description: '',
                ai_criteria: '',
                unqualified_message: '',
                fallback_to_waiting: true,
                meta_capi_access_token: '',
                meta_capi_dataset_id: '',
                meta_capi_test_event_code: '',
                facebook_purchase_value: 699,
                send_qualified_to_facebook: false,
                send_purchase_to_facebook: false,
                questions: [newQuestion()],
            })
            return
        }
        const res = await fetch(`/api/host/lead-forms?id=${id}`)
        if (res.ok) {
            const data = await res.json()
            const rawQs = (data.questions || []) as Question[]
            const normalized: Question[] = rawQs.map((q) => {
                const seen = new Set<string>()
                const opts = (q.options || []).map((o) => {
                    let n = normalizeOption(o)
                    while (seen.has(n.value)) {
                        n = { ...n, id: crypto.randomUUID(), value: crypto.randomUUID() }
                    }
                    seen.add(n.value)
                    return n
                })
                return { ...q, options: opts }
            })
            setEditing({
                ...data,
                questions: normalized.length ? normalized : [newQuestion()],
            })
        }
    }

    const updateQ = (i: number, patch: Partial<Question>) => {
        if (!editing) return
        const qs = [...editing.questions]
        qs[i] = { ...qs[i], ...patch }
        setEditing({ ...editing, questions: qs })
    }

    const moveQ = (i: number, dir: -1 | 1) => {
        if (!editing) return
        const j = i + dir
        if (j < 0 || j >= editing.questions.length) return
        const qs = [...editing.questions]
        ;[qs[i], qs[j]] = [qs[j], qs[i]]
        setEditing({ ...editing, questions: qs })
    }

    const removeQ = (i: number) => {
        if (!editing) return
        const qs = editing.questions.filter((_, idx) => idx !== i)
        setEditing({ ...editing, questions: qs.length ? qs : [newQuestion()] })
    }

    const addQ = () => {
        if (!editing) return
        setEditing({ ...editing, questions: [...editing.questions, newQuestion()] })
    }

    const sendAiMessage = async (override?: string) => {
        const text = (override ?? aiInput).trim()
        if (text.length < 2) {
            setAiError('Type a message for the AI.')
            return
        }
        if (aiMessages.length === 0 && text.length < 6) {
            setAiError('Tell the AI a sentence or two about your business and ideal lead.')
            return
        }
        const nextMessages: ChatMsg[] = [...aiMessages, { role: 'user', content: text }]
        setAiMessages(nextMessages)
        setAiInput('')
        setAiLoading(true)
        setAiError(null)
        try {
            const res = await fetch('/api/host/lead-forms/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: nextMessages }),
            })
            const data = await res.json()
            if (!res.ok) {
                setAiError(data.error || 'AI generation failed.')
                return
            }
            const reply = typeof data.reply === 'string' && data.reply.trim()
                ? data.reply.trim()
                : data.draft
                  ? 'Here is an updated draft — take a look on the right.'
                  : 'Could you share a bit more detail?'
            setAiMessages((prev) => [...prev, { role: 'assistant', content: reply }])
            if (data.draft) {
                const d = data.draft
                setAiDraft({
                    title: d.title || 'Lead Qualification Form',
                    description: d.description || '',
                    ai_criteria: d.ai_criteria || '',
                    unqualified_message:
                        d.unqualified_message || "Thanks for your response. We'll be in touch.",
                    auto_admit_threshold:
                        typeof d.auto_admit_threshold === 'number' ? d.auto_admit_threshold : 70,
                    questions: Array.isArray(d.questions) ? d.questions : [],
                    qualification_summary: Array.isArray(d.qualification_summary)
                        ? d.qualification_summary
                        : undefined,
                })
            }
        } catch (err) {
            setAiError(err instanceof Error ? err.message : 'AI request failed.')
        } finally {
            setAiLoading(false)
        }
    }

    const resetAiChat = () => {
        setAiMessages([])
        setAiDraft(null)
        setAiInput('')
        setAiError(null)
    }

    const applyAiDraft = () => {
        if (!aiDraft) return
        setEditing((prev) => {
            const base: FullForm = prev || {
                id: '',
                slug: '',
                title: '',
                is_active: true,
                auto_admit_threshold: 70,
                created_at: '',
                description: '',
                ai_criteria: '',
                unqualified_message: '',
                fallback_to_waiting: true,
                meta_capi_access_token: '',
                meta_capi_dataset_id: '',
                meta_capi_test_event_code: '',
                facebook_purchase_value: 699,
                send_qualified_to_facebook: false,
                send_purchase_to_facebook: false,
                questions: [],
            }
            return {
                ...base,
                title: aiDraft.title || base.title,
                description: aiDraft.description || base.description,
                ai_criteria: aiDraft.ai_criteria || base.ai_criteria,
                unqualified_message:
                    aiDraft.unqualified_message || base.unqualified_message,
                auto_admit_threshold: aiDraft.auto_admit_threshold,
                questions: aiDraft.questions.length
                    ? aiDraft.questions
                    : base.questions.length
                      ? base.questions
                      : [newQuestion()],
            }
        })
        setAiOpen(false)
        resetAiChat()
    }

    const closeAiModal = () => {
        setAiOpen(false)
        setAiError(null)
    }

    const save = async () => {
        if (!editing) return
        if (!editing.title.trim()) return alert('Title required')
        const validQuestions = editing.questions.filter((q) => q.question_text.trim())
        if (validQuestions.length === 0) return alert('Add at least one question')
        setSaving(true)
        try {
            const body = { ...editing, questions: validQuestions }
            const isNew = !editing.id
            const res = await fetch('/api/host/lead-forms', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const err = await res.json()
                alert(err.error || 'Save failed')
                return
            }
            await loadForms()
            setEditing(null)
        } finally {
            setSaving(false)
        }
    }

    const deleteForm = async (id: string) => {
        if (!confirm('Delete this form?')) return
        await fetch(`/api/host/lead-forms?id=${id}`, { method: 'DELETE' })
        await loadForms()
    }

    const publicUrl = (slug: string) =>
        typeof window !== 'undefined' ? `${window.location.origin}/leads/${slug}` : `/leads/${slug}`

    const copy = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(text)
        setTimeout(() => setCopied(null), 1600)
    }

    if (status === 'loading') return <div className={styles.page}>Loading...</div>

    if (editing) {
        return (
            <div className={styles.page}>
                <div className={styles.header}>
                    <button className={styles.backBtn} onClick={() => setEditing(null)}>
                        <FaArrowLeft /> Back
                    </button>
                    <h1>{editing.id ? 'Edit form' : 'New Instant Leads form'}</h1>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className={styles.secondaryBtn}
                            onClick={() => setAiOpen(true)}
                        >
                            <FaMagic /> Generate with AI
                        </button>
                        <button className={styles.primaryBtn} onClick={save} disabled={saving}>
                            <FaSave /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                <div className={styles.editorGrid}>
                    <section className={styles.card}>
                        <label className={styles.label}>Form title</label>
                        <input
                            className={styles.input}
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            placeholder="e.g. Qualifying call intake"
                        />
                        <label className={styles.label}>Description (optional)</label>
                        <textarea
                            className={styles.textarea}
                            value={editing.description || ''}
                            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                            rows={2}
                        />
                        <label className={styles.label}>
                            <FaMagic /> AI fallback criteria (optional)
                        </label>
                        <textarea
                            className={styles.textarea}
                            value={editing.ai_criteria || ''}
                            onChange={(e) => setEditing({ ...editing, ai_criteria: e.target.value })}
                            rows={4}
                            placeholder="Only used when no per-question points are configured. Describe what a qualified lead looks like."
                        />
                        <div className={styles.row}>
                            <div style={{ flex: 1 }}>
                                <label className={styles.label}>Auto-admit threshold (0–100)</label>
                                <input
                                    className={styles.input}
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editing.auto_admit_threshold}
                                    onChange={(e) =>
                                        setEditing({
                                            ...editing,
                                            auto_admit_threshold: Number(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className={styles.label}>Active</label>
                                <select
                                    className={styles.input}
                                    value={editing.is_active ? '1' : '0'}
                                    onChange={(e) =>
                                        setEditing({ ...editing, is_active: e.target.value === '1' })
                                    }
                                >
                                    <option value="1">Yes, accept submissions</option>
                                    <option value="0">No, pause form</option>
                                </select>
                            </div>
                        </div>
                        <label className={styles.label}>Message for unqualified leads</label>
                        <input
                            className={styles.input}
                            value={editing.unqualified_message || ''}
                            onChange={(e) =>
                                setEditing({ ...editing, unqualified_message: e.target.value })
                            }
                            placeholder="Thanks for your response. We'll be in touch."
                        />
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={editing.fallback_to_waiting}
                                onChange={(e) =>
                                    setEditing({ ...editing, fallback_to_waiting: e.target.checked })
                                }
                            />{' '}
                            Send borderline leads to the normal waiting room for manual review
                        </label>
                        <label className={styles.label}>Meta CAPI access token</label>
                        <input
                            className={styles.input}
                            type="password"
                            value={editing.meta_capi_access_token || ''}
                            onChange={(e) =>
                                setEditing({ ...editing, meta_capi_access_token: e.target.value })
                            }
                            placeholder="Optional per-form access token"
                        />
                        <label className={styles.label}>Meta dataset id</label>
                        <input
                            className={styles.input}
                            value={editing.meta_capi_dataset_id || ''}
                            onChange={(e) =>
                                setEditing({ ...editing, meta_capi_dataset_id: e.target.value })
                            }
                            placeholder="Optional per-form dataset id"
                        />
                        <label className={styles.label}>Meta test event code</label>
                        <input
                            className={styles.input}
                            value={editing.meta_capi_test_event_code || ''}
                            onChange={(e) =>
                                setEditing({ ...editing, meta_capi_test_event_code: e.target.value })
                            }
                            placeholder="Optional per-form test event code"
                        />
                        <label className={styles.label}>Purchase value</label>
                        <input
                            className={styles.input}
                            type="number"
                            min={1}
                            value={editing.facebook_purchase_value ?? 699}
                            onChange={(e) =>
                                setEditing({
                                    ...editing,
                                    facebook_purchase_value: Number(e.target.value) || 699,
                                })
                            }
                            placeholder="Purchase value in PHP"
                        />
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={editing.send_qualified_to_facebook ?? false}
                                onChange={(e) =>
                                    setEditing({
                                        ...editing,
                                        send_qualified_to_facebook: e.target.checked,
                                    })
                                }
                            />{' '}
                            Qualified sending to Facebook
                        </label>
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={editing.send_purchase_to_facebook ?? false}
                                onChange={(e) =>
                                    setEditing({
                                        ...editing,
                                        send_purchase_to_facebook: e.target.checked,
                                    })
                                }
                            />{' '}
                            Purchase sending to Facebook
                        </label>
                    </section>

                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>Questions</h2>
                            <button className={styles.secondaryBtn} onClick={addQ}>
                                <FaPlus /> Add question
                            </button>
                        </div>

                        {editing.questions.map((q, i) => (
                            <div key={i} className={styles.qBlock}>
                                <div className={styles.qHeader}>
                                    <FaGripVertical className={styles.grip} />
                                    <span className={styles.qIndex}>Q{i + 1}</span>
                                    <div className={styles.qActions}>
                                        <button onClick={() => moveQ(i, -1)} disabled={i === 0}>
                                            <FaArrowUp />
                                        </button>
                                        <button
                                            onClick={() => moveQ(i, 1)}
                                            disabled={i === editing.questions.length - 1}
                                        >
                                            <FaArrowDown />
                                        </button>
                                        <button onClick={() => removeQ(i)} className={styles.danger}>
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                                <input
                                    className={styles.input}
                                    placeholder="Question text"
                                    value={q.question_text}
                                    onChange={(e) => updateQ(i, { question_text: e.target.value })}
                                />
                                <input
                                    className={styles.input}
                                    placeholder="Help text (optional)"
                                    value={q.help_text || ''}
                                    onChange={(e) => updateQ(i, { help_text: e.target.value })}
                                />
                                <div className={styles.row}>
                                    <select
                                        className={styles.input}
                                        value={q.type}
                                        onChange={(e) =>
                                            updateQ(i, {
                                                type: e.target.value as QType,
                                                options:
                                                    e.target.value === 'single_choice' ||
                                                    e.target.value === 'multi_choice'
                                                        ? q.options.length
                                                            ? q.options
                                                            : [newOption(), newOption()]
                                                        : [],
                                            })
                                        }
                                    >
                                        <option value="short_answer">Short answer</option>
                                        <option value="long_answer">Long answer</option>
                                        <option value="email">Email</option>
                                        <option value="phone">Phone</option>
                                        <option value="single_choice">Single choice</option>
                                        <option value="multi_choice">Multiple choice</option>
                                        <option value="date">Date</option>
                                    </select>
                                    <label className={styles.checkbox}>
                                        <input
                                            type="checkbox"
                                            checked={q.required}
                                            onChange={(e) => updateQ(i, { required: e.target.checked })}
                                        />{' '}
                                        Required
                                    </label>
                                    <div>
                                        <label className={styles.smallLabel}>AI weight</label>
                                        <input
                                            className={styles.input}
                                            type="number"
                                            step={0.1}
                                            min={0}
                                            max={1}
                                            value={q.ai_weight}
                                            onChange={(e) =>
                                                updateQ(i, { ai_weight: Number(e.target.value) || 0 })
                                            }
                                        />
                                    </div>
                                </div>

                                {(q.type === 'single_choice' || q.type === 'multi_choice') && (
                                    <div className={styles.optionsEditor}>
                                        <div className={styles.smallLabel}>
                                            Options (set points each answer is worth)
                                        </div>
                                        {q.options.map((opt, oi) => (
                                            <div key={opt.id} className={styles.optRow}>
                                                <input
                                                    className={styles.input}
                                                    placeholder="Option label"
                                                    value={opt.label}
                                                    onChange={(e) => {
                                                        const opts = [...q.options]
                                                        opts[oi] = {
                                                            ...opt,
                                                            label: e.target.value,
                                                        }
                                                        updateQ(i, { options: opts })
                                                    }}
                                                />
                                                <input
                                                    className={styles.input}
                                                    type="number"
                                                    placeholder="pts"
                                                    style={{ width: 80 }}
                                                    value={opt.points ?? 0}
                                                    onChange={(e) => {
                                                        const opts = [...q.options]
                                                        opts[oi] = {
                                                            ...opt,
                                                            points: Number(e.target.value) || 0,
                                                        }
                                                        updateQ(i, { options: opts })
                                                    }}
                                                />
                                                <button
                                                    className={styles.danger}
                                                    onClick={() =>
                                                        updateQ(i, {
                                                            options: q.options.filter((_, x) => x !== oi),
                                                        })
                                                    }
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() =>
                                                updateQ(i, { options: [...q.options, newOption()] })
                                            }
                                        >
                                            <FaPlus /> Add option
                                        </button>
                                    </div>
                                )}

                                {(q.type === 'short_answer' ||
                                    q.type === 'long_answer' ||
                                    q.type === 'email' ||
                                    q.type === 'phone' ||
                                    q.type === 'date') && (
                                    <div className={styles.optionsEditor}>
                                        <div className={styles.smallLabel}>
                                            Scoring rules: award points when answer contains any keyword
                                        </div>
                                        {(q.scoring_rules || []).map((rule, ri) => (
                                            <div key={rule.id} className={styles.optRow}>
                                                <input
                                                    className={styles.input}
                                                    placeholder='Keywords (comma-separated, e.g. "enterprise, 50+")'
                                                    value={rule.keywords}
                                                    onChange={(e) => {
                                                        const rules = [...(q.scoring_rules || [])]
                                                        rules[ri] = {
                                                            ...rule,
                                                            keywords: e.target.value,
                                                        }
                                                        updateQ(i, { scoring_rules: rules })
                                                    }}
                                                />
                                                <input
                                                    className={styles.input}
                                                    type="number"
                                                    placeholder="pts"
                                                    style={{ width: 80 }}
                                                    value={rule.points}
                                                    onChange={(e) => {
                                                        const rules = [...(q.scoring_rules || [])]
                                                        rules[ri] = {
                                                            ...rule,
                                                            points: Number(e.target.value) || 0,
                                                        }
                                                        updateQ(i, { scoring_rules: rules })
                                                    }}
                                                />
                                                <button
                                                    className={styles.danger}
                                                    onClick={() =>
                                                        updateQ(i, {
                                                            scoring_rules: (q.scoring_rules || []).filter(
                                                                (_, x) => x !== ri
                                                            ),
                                                        })
                                                    }
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() =>
                                                updateQ(i, {
                                                    scoring_rules: [...(q.scoring_rules || []), newRule()],
                                                })
                                            }
                                        >
                                            <FaPlus /> Add rule
                                        </button>
                                        <label className={styles.smallLabel} style={{ marginTop: 8 }}>
                                            Ideal answer (optional — AI compares up to +10 pts)
                                        </label>
                                        <textarea
                                            className={styles.textarea}
                                            rows={2}
                                            value={q.ideal_answer || ''}
                                            onChange={(e) =>
                                                updateQ(i, { ideal_answer: e.target.value })
                                            }
                                            placeholder="e.g. A team of 10+ using a CRM already, ready to switch this quarter."
                                        />
                                    </div>
                                )}

                                <input
                                    className={styles.input}
                                    placeholder="Disqualify on (comma-separated keywords, or /regex/)"
                                    value={q.disqualify_on || ''}
                                    onChange={(e) => updateQ(i, { disqualify_on: e.target.value })}
                                />
                            </div>
                        ))}
                    </section>
                </div>

                {aiOpen && (
                    <AiGenerateModal
                        messages={aiMessages}
                        input={aiInput}
                        setInput={setAiInput}
                        loading={aiLoading}
                        error={aiError}
                        draft={aiDraft}
                        onSend={sendAiMessage}
                        onApply={applyAiDraft}
                        onClose={closeAiModal}
                        onReset={resetAiChat}
                    />
                )}
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => router.push('/host/dashboard')}>
                    <FaArrowLeft /> Dashboard
                </button>
                <h1>Instant Leads</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                            openEditor()
                            setAiOpen(true)
                        }}
                    >
                        <FaMagic /> Generate with AI
                    </button>
                    <button className={styles.primaryBtn} onClick={() => openEditor()}>
                        <FaPlus /> New form
                    </button>
                </div>
            </div>

            <p className={styles.intro}>
                Create a qualifying form. Visitors answer one question at a time; qualified leads are
                auto-admitted straight into your meeting.
            </p>

            {loading ? (
                <div>Loading...</div>
            ) : forms.length === 0 ? (
                <div className={styles.empty}>
                    No forms yet. Click <strong>New form</strong> to create your first Instant Leads form.
                </div>
            ) : (
                <div className={styles.list}>
                    {forms.map((f) => {
                        const url = publicUrl(f.slug)
                        return (
                            <div key={f.id} className={styles.formCard}>
                                <div className={styles.formMeta}>
                                    <h3>{f.title}</h3>
                                    <div className={styles.metaRow}>
                                        <span
                                            className={`${styles.badge} ${
                                                f.is_active ? styles.badgeActive : styles.badgeOff
                                            }`}
                                        >
                                            {f.is_active ? 'Active' : 'Paused'}
                                        </span>
                                        <span className={styles.threshold}>
                                            Threshold: {f.auto_admit_threshold}
                                        </span>
                                    </div>
                                    <div className={styles.linkRow}>
                                        <FaLink />
                                        <code>{url}</code>
                                        <button className={styles.iconBtn} onClick={() => copy(url)}>
                                            <FaCopy /> {copied === url ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.formActions}>
                                    <button className={styles.secondaryBtn} onClick={() => openEditor(f.id)}>
                                        Edit
                                    </button>
                                    <button
                                        className={styles.dangerBtn}
                                        onClick={() => deleteForm(f.id)}
                                    >
                                        <FaTrash /> Delete
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
