'use client'

import { useEffect, useMemo, useState } from 'react'
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

function AiGenerateModal({
    prompt,
    setPrompt,
    loading,
    error,
    draft,
    onRun,
    onApply,
    onClose,
    onDiscard,
}: {
    prompt: string
    setPrompt: (v: string) => void
    loading: boolean
    error: string | null
    draft: null | {
        title: string
        description: string
        ai_criteria: string
        unqualified_message: string
        auto_admit_threshold: number
        questions: Question[]
        qualification_summary?: string[]
    }
    onRun: () => void
    onApply: () => void
    onClose: () => void
    onDiscard: () => void
}) {
    const samples = [
        'I sell SEO services to dentists in the US and want enterprise-size clinics (3+ locations).',
        'I run a solo real estate agency and want qualified buyers for homes $500k+ in Austin.',
        'I offer executive coaching to VPs of Engineering at Series B+ startups hiring fast.',
    ]

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
                    maxWidth: 720,
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    padding: 24,
                    color: '#f5f5f7',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <FaMagic style={{ color: '#a855f7' }} />
                    <h2 style={{ margin: 0, fontSize: 20 }}>AI Form Builder</h2>
                </div>

                {!draft ? (
                    <>
                        <p style={{ opacity: 0.7, marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
                            Describe your business and who you want to qualify. The AI will draft
                            the full form — questions, choices, scoring, and qualification criteria
                            — for your review before saving.
                        </p>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={5}
                            placeholder="e.g. I sell a B2B payroll product to HR leaders at 50-500 person companies. Qualified leads are decision-makers actively evaluating a switch this quarter."
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#fff',
                                borderRadius: 10,
                                padding: '12px 14px',
                                fontSize: 14,
                                lineHeight: 1.5,
                                fontFamily: 'inherit',
                                outline: 'none',
                                resize: 'vertical',
                            }}
                            disabled={loading}
                        />

                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 6 }}>
                                Try an example:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {samples.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setPrompt(s)}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#e5e7eb',
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            fontSize: 12,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {s.length > 64 ? s.slice(0, 61) + '…' : s}
                                    </button>
                                ))}
                            </div>
                        </div>

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

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onRun}
                                disabled={loading || prompt.trim().length < 6}
                                style={{
                                    background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                                    border: 'none',
                                    color: '#fff',
                                    padding: '10px 18px',
                                    borderRadius: 10,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                    opacity: loading || prompt.trim().length < 6 ? 0.6 : 1,
                                }}
                            >
                                {loading ? 'Thinking…' : 'Generate draft'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p style={{ opacity: 0.7, marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
                            Review the AI&apos;s proposal below. Apply to load it into the editor
                            (you can still tweak anything before saving), or discard and try again.
                        </p>
                        <div
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 12,
                            }}
                        >
                            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                                {draft.title}
                            </div>
                            {draft.description && (
                                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
                                    {draft.description}
                                </div>
                            )}
                            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                                Auto-admit threshold: <strong>{draft.auto_admit_threshold}</strong> ·{' '}
                                {draft.questions.length} questions
                            </div>
                            {draft.ai_criteria && (
                                <div
                                    style={{
                                        fontSize: 12,
                                        opacity: 0.7,
                                        marginTop: 6,
                                        fontStyle: 'italic',
                                    }}
                                >
                                    Qualified lead: {draft.ai_criteria}
                                </div>
                            )}
                        </div>

                        {draft.qualification_summary && draft.qualification_summary.length > 0 && (
                            <div
                                style={{
                                    background: 'rgba(34,197,94,0.08)',
                                    border: '1px solid rgba(34,197,94,0.25)',
                                    borderRadius: 12,
                                    padding: 14,
                                    marginBottom: 14,
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#86efac', marginBottom: 8 }}>
                                    How this form decides qualified vs. unqualified
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, lineHeight: 1.55, color: '#d1fae5' }}>
                                    {draft.qualification_summary.map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {draft.questions.map((q, i) => (
                                <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {q.question_text}{' '}
                                        <span style={{ opacity: 0.5, fontWeight: 400 }}>
                                            ({q.type}
                                            {q.required ? ', required' : ''})
                                        </span>
                                    </div>
                                    {q.help_text && (
                                        <div style={{ opacity: 0.65 }}>{q.help_text}</div>
                                    )}
                                    {q.options && q.options.length > 0 && (
                                        <ul style={{ margin: '4px 0 0 16px', opacity: 0.85 }}>
                                            {q.options.map((o) => (
                                                <li key={o.id}>
                                                    {o.label}{' '}
                                                    <span style={{ opacity: 0.5 }}>
                                                        ({o.points ?? 0} pts)
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ol>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 10,
                                marginTop: 16,
                            }}
                        >
                            <button
                                type="button"
                                onClick={onDiscard}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Discard &amp; try again
                            </button>
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
                    </>
                )}
            </div>
        </div>
    )
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
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [aiDraft, setAiDraft] = useState<null | {
        title: string
        description: string
        ai_criteria: string
        unqualified_message: string
        auto_admit_threshold: number
        questions: Question[]
        qualification_summary?: string[]
    }>(null)

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

    const runAiGenerate = async () => {
        const prompt = aiPrompt.trim()
        if (prompt.length < 6) {
            setAiError('Tell the AI a sentence or two about your business and ideal lead.')
            return
        }
        setAiLoading(true)
        setAiError(null)
        try {
            const res = await fetch('/api/host/lead-forms/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            })
            const data = await res.json()
            if (!res.ok) {
                setAiError(data.error || 'AI generation failed.')
                return
            }
            setAiDraft({
                title: data.title || 'Lead Qualification Form',
                description: data.description || '',
                ai_criteria: data.ai_criteria || '',
                unqualified_message:
                    data.unqualified_message || "Thanks for your response. We'll be in touch.",
                auto_admit_threshold:
                    typeof data.auto_admit_threshold === 'number'
                        ? data.auto_admit_threshold
                        : 70,
                questions: Array.isArray(data.questions) ? data.questions : [],
                qualification_summary: Array.isArray(data.qualification_summary)
                    ? data.qualification_summary
                    : undefined,
            })
        } catch (err) {
            setAiError(err instanceof Error ? err.message : 'AI request failed.')
        } finally {
            setAiLoading(false)
        }
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
        setAiDraft(null)
        setAiOpen(false)
        setAiPrompt('')
    }

    const closeAiModal = () => {
        setAiOpen(false)
        setAiDraft(null)
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
                        prompt={aiPrompt}
                        setPrompt={setAiPrompt}
                        loading={aiLoading}
                        error={aiError}
                        draft={aiDraft}
                        onRun={runAiGenerate}
                        onApply={applyAiDraft}
                        onClose={closeAiModal}
                        onDiscard={() => setAiDraft(null)}
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
