'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import { FaArrowRight, FaArrowLeft, FaCheckCircle, FaSpinner } from 'react-icons/fa'

interface PublicQuestion {
    id: string
    order_index: number
    question_text: string
    help_text?: string | null
    type:
        | 'short_answer'
        | 'long_answer'
        | 'email'
        | 'phone'
        | 'single_choice'
        | 'multi_choice'
        | 'date'
    options: Array<{ id: string; label: string; value: string }>
    required: boolean
}

interface FormBundle {
    form: {
        id: string
        slug: string
        title: string
        description?: string | null
        unqualified_message?: string | null
    }
    host: { id: string; name: string; username: string; avatar_url?: string | null; bio?: string | null } | null
    questions: PublicQuestion[]
}

type StoredAnswer = { question_id: string; question_text: string; type: string; answer: string | string[] }

interface Props {
    params: Promise<{ slug: string }>
}

export default function LeadFormPage({ params }: Props) {
    const router = useRouter()
    const [slug, setSlug] = useState<string | null>(null)
    const [bundle, setBundle] = useState<FormBundle | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
    const [submitting, setSubmitting] = useState(false)
    const [hasDraft, setHasDraft] = useState(false)
    const [result, setResult] = useState<{
        verdict: 'qualified' | 'unqualified' | 'review'
        message?: string
        join_url?: string
        waiting_url?: string
    } | null>(null)
    const sessionRef = useRef<string | null>(null)
    const honeypotRef = useRef<string>('')
    const prefillAppliedRef = useRef(false)
    const answersRef = useRef<Record<string, string | string[]>>({})
    answersRef.current = answers
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
        }
    }, [])

    useEffect(() => {
        params.then((p) => setSlug(p.slug))
    }, [params])

    useEffect(() => {
        if (!slug) return
        ;(async () => {
            try {
                const res = await fetch(`/api/leads/form/${slug}`)
                if (!res.ok) {
                    setLoadError('This form is unavailable.')
                    return
                }
                const data = (await res.json()) as FormBundle
                // Normalize options so each has a unique id+value, even on legacy rows
                data.questions = (data.questions || []).map((q) => {
                    const seenIds = new Set<string>()
                    const seenVals = new Set<string>()
                    const opts = (q.options || []).map((raw, idx) => {
                        let id = raw.id && !seenIds.has(raw.id) ? raw.id : `${q.id}__opt_${idx}`
                        while (seenIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`
                        seenIds.add(id)
                        let value = raw.value || raw.label || id
                        while (seenVals.has(value)) value = `${value}_${idx}`
                        seenVals.add(value)
                        return { id, label: raw.label || `Option ${idx + 1}`, value }
                    })
                    return { ...q, options: opts }
                })
                setBundle(data)
            } catch {
                setLoadError('Could not load form.')
            }
        })()
    }, [slug])

    useEffect(() => {
        if (typeof window === 'undefined' || !slug) return
        const key = `lead-session-${slug}`
        const existing = localStorage.getItem(key)
        if (existing) sessionRef.current = existing
        const draftKey = `lead-draft-${slug}`
        const draft = localStorage.getItem(draftKey)
        if (draft) {
            try {
                const parsed = JSON.parse(draft)
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    setAnswers(parsed)
                    setHasDraft(true)
                }
            } catch {
                /* ignore */
            }
        }
    }, [slug])

    // Prefill from URL params (?name=&email=&phone=) + localStorage across forms
    useEffect(() => {
        if (!bundle || prefillAppliedRef.current) return
        if (typeof window === 'undefined') return
        prefillAppliedRef.current = true

        const params = new URLSearchParams(window.location.search)
        const pickParam = (...keys: string[]) => {
            for (const k of keys) {
                const v = params.get(k)
                if (v && v.trim()) return v.trim()
            }
            return null
        }
        const profileRaw = localStorage.getItem('lead-profile')
        let profile: { name?: string; email?: string; phone?: string } = {}
        try {
            if (profileRaw) profile = JSON.parse(profileRaw)
        } catch {
            /* ignore */
        }

        const candidates = {
            email: pickParam('email', 'e') || profile.email || null,
            phone: pickParam('phone', 'tel', 'p') || profile.phone || null,
            name: pickParam('name', 'n') || profile.name || null,
        }

        setAnswers((prev) => {
            const next = { ...prev }
            let changed = false
            const used = { email: false, phone: false, name: false }
            for (const q of bundle.questions) {
                if (next[q.id]) continue
                if (q.type === 'email' && candidates.email && !used.email) {
                    next[q.id] = candidates.email
                    used.email = true
                    changed = true
                } else if (q.type === 'phone' && candidates.phone && !used.phone) {
                    next[q.id] = candidates.phone
                    used.phone = true
                    changed = true
                } else if (
                    q.type === 'short_answer' &&
                    candidates.name &&
                    !used.name &&
                    /\bname\b/i.test(q.question_text)
                ) {
                    next[q.id] = candidates.name
                    used.name = true
                    changed = true
                }
            }
            if (changed && slug) {
                localStorage.setItem(`lead-draft-${slug}`, JSON.stringify(next))
            }
            return next
        })
    }, [bundle, slug])

    const questions = bundle?.questions || []
    const total = questions.length
    const current = questions[step]
    const isLast = step === total - 1
    const progress = total === 0 ? 0 : Math.round(((step + (isLast ? 1 : 0)) / total) * 100)

    const answerFor = (q: PublicQuestion) => answers[q.id]

    const currentIsValid = useMemo(() => {
        if (!current) return false
        if (!current.required) return true
        const v = answerFor(current)
        if (current.type === 'multi_choice') return Array.isArray(v) && v.length > 0
        return typeof v === 'string' && v.trim().length > 0
    }, [current, answers])

    const updateAnswer = (q: PublicQuestion, v: string | string[]) => {
        setAnswers((prev) => {
            const next = { ...prev, [q.id]: v }
            if (typeof window !== 'undefined' && slug) {
                localStorage.setItem(`lead-draft-${slug}`, JSON.stringify(next))
            }
            return next
        })
    }

    const autosave = async () => {
        if (!bundle) return
        const latest = answersRef.current
        const payload = {
            sessionToken: sessionRef.current,
            formSlug: bundle.form.slug,
            answers: questions
                .filter((q) => latest[q.id] !== undefined)
                .map((q) => ({
                    question_id: q.id,
                    question_text: q.question_text,
                    type: q.type,
                    answer: latest[q.id],
                })),
        }
        try {
            const res = await fetch('/api/leads/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (res.ok) {
                const data = await res.json()
                if (data.sessionToken) {
                    sessionRef.current = data.sessionToken
                    if (typeof window !== 'undefined' && slug) {
                        localStorage.setItem(`lead-session-${slug}`, data.sessionToken)
                    }
                }
            }
        } catch {
            /* best-effort */
        }
    }

    const goNext = async () => {
        if (!currentIsValid) return
        await autosave()
        if (step < total - 1) setStep(step + 1)
    }

    const goBack = () => {
        if (step > 0) setStep(step - 1)
    }

    const handleSingleChoicePick = (q: PublicQuestion, value: string) => {
        updateAnswer(q, value)
        // Auto-advance for single-choice. Guard against rapid double-clicks
        // by cancelling any previously scheduled advance.
        if (advanceTimerRef.current) {
            clearTimeout(advanceTimerRef.current)
        }
        const isLastStep = step === total - 1
        if (!isLastStep) {
            advanceTimerRef.current = setTimeout(() => {
                advanceTimerRef.current = null
                autosave()
                setStep((s) => (s < total - 1 ? s + 1 : s))
            }, 220)
        }
    }

    const resetForm = () => {
        setAnswers({})
        setStep(0)
        setHasDraft(false)
        if (typeof window !== 'undefined' && slug) {
            localStorage.removeItem(`lead-draft-${slug}`)
            localStorage.removeItem(`lead-session-${slug}`)
        }
        sessionRef.current = null
    }

    const submit = async () => {
        if (!bundle || submitting) return
        setSubmitting(true)

        // Persist identity fields for future forms (best effort)
        if (typeof window !== 'undefined') {
            const profile: { name?: string; email?: string; phone?: string } = {}
            for (const q of questions) {
                const v = answers[q.id]
                if (typeof v !== 'string' || !v.trim()) continue
                if (q.type === 'email' && !profile.email) profile.email = v.trim()
                else if (q.type === 'phone' && !profile.phone) profile.phone = v.trim()
                else if (
                    q.type === 'short_answer' &&
                    /name/i.test(q.question_text) &&
                    !profile.name
                ) {
                    profile.name = v.trim()
                }
            }
            if (Object.keys(profile).length) {
                try {
                    localStorage.setItem('lead-profile', JSON.stringify(profile))
                } catch {
                    /* ignore */
                }
            }
        }

        const payload = {
            formSlug: bundle.form.slug,
            sessionToken: sessionRef.current,
            hp: honeypotRef.current, // honeypot: must be empty
            answers: questions.map((q) => ({
                question_id: q.id,
                question_text: q.question_text,
                type: q.type,
                answer: answers[q.id] ?? (q.type === 'multi_choice' ? [] : ''),
            })),
        }
        try {
            const res = await fetch('/api/leads/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) {
                setLoadError(data.error || 'Submission failed.')
                setSubmitting(false)
                return
            }

            if (typeof window !== 'undefined' && slug) {
                localStorage.removeItem(`lead-draft-${slug}`)
                localStorage.removeItem(`lead-session-${slug}`)
            }

            if (data.verdict === 'qualified' && data.join_url) {
                window.location.href = data.join_url
                return
            }
            if (data.waiting_url) {
                router.push(data.waiting_url.replace(window.location.origin, ''))
                return
            }
            setResult({
                verdict: data.verdict,
                message: data.message || bundle.form.unqualified_message || 'Thanks for your response.',
            })
        } catch {
            setLoadError('Network error. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loadError) {
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <h1>Unavailable</h1>
                    <p>{loadError}</p>
                </div>
            </div>
        )
    }

    if (!bundle) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <FaSpinner className={styles.spin} /> Loading...
                </div>
            </div>
        )
    }

    if (result) {
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <FaCheckCircle className={styles.done} />
                    <h1>Thank you</h1>
                    <p>{result.message}</p>
                </div>
            </div>
        )
    }

    if (total === 0) {
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <h1>{bundle.form.title}</h1>
                    <p>This form has no questions yet.</p>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            {/* Honeypot: real users won't see or fill this */}
            <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className={styles.honeypot}
                onChange={(e) => {
                    honeypotRef.current = e.target.value
                }}
            />
            {hasDraft && step === 0 && (
                <div className={styles.resumeBanner}>
                    <span>Welcome back — we saved your progress.</span>
                    <button type="button" onClick={resetForm} className={styles.resumeReset}>
                        Start over
                    </button>
                </div>
            )}
            <div className={styles.header}>
                <div className={styles.hostInfo}>
                    {bundle.host?.avatar_url && (
                        <img src={bundle.host.avatar_url} alt="" className={styles.avatar} />
                    )}
                    <div>
                        <div className={styles.formTitle}>{bundle.form.title}</div>
                        {bundle.host?.name && <div className={styles.hostName}>with {bundle.host.name}</div>}
                    </div>
                </div>
                <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
                <div className={styles.progressText}>
                    Question {step + 1} of {total}
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.questionText}>{current.question_text}</div>
                {current.help_text && <div className={styles.helpText}>{current.help_text}</div>}

                <div className={styles.inputWrap}>
                    {current.type === 'long_answer' ? (
                        <textarea
                            className={styles.textarea}
                            value={(answerFor(current) as string) || ''}
                            onChange={(e) => updateAnswer(current, e.target.value)}
                            placeholder="Type your answer..."
                            rows={5}
                            autoFocus
                        />
                    ) : current.type === 'single_choice' ? (
                        <div className={styles.options} role="radiogroup">
                            {current.options.map((opt) => {
                                const selected = answerFor(current) === opt.value
                                return (
                                    <button
                                        type="button"
                                        key={opt.id}
                                        className={`${styles.option} ${selected ? styles.optionActive : ''}`}
                                        onClick={() => handleSingleChoicePick(current, opt.value)}
                                        role="radio"
                                        aria-checked={selected}
                                    >
                                        <span className={styles.radio} aria-hidden>
                                            {selected && <span className={styles.radioDot} />}
                                        </span>
                                        <span>{opt.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    ) : current.type === 'multi_choice' ? (
                        <div className={styles.options}>
                            {current.options.map((opt) => {
                                const raw = answerFor(current)
                                const arr = Array.isArray(raw) ? raw : []
                                const checked = arr.includes(opt.value)
                                return (
                                    <button
                                        type="button"
                                        key={opt.id}
                                        className={`${styles.option} ${checked ? styles.optionActive : ''}`}
                                        onClick={() => {
                                            const next = checked
                                                ? arr.filter((v) => v !== opt.value)
                                                : [...arr, opt.value]
                                            updateAnswer(current, next)
                                        }}
                                        role="checkbox"
                                        aria-checked={checked}
                                    >
                                        <span className={styles.checkbox} aria-hidden>
                                            {checked && <span className={styles.checkmark}>✓</span>}
                                        </span>
                                        <span>{opt.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    ) : current.type === 'date' ? (
                        <input
                            className={styles.input}
                            type="date"
                            value={(answerFor(current) as string) || ''}
                            onChange={(e) => updateAnswer(current, e.target.value)}
                            autoFocus
                        />
                    ) : (
                        <input
                            className={styles.input}
                            type={
                                current.type === 'email'
                                    ? 'email'
                                    : current.type === 'phone'
                                      ? 'tel'
                                      : 'text'
                            }
                            value={(answerFor(current) as string) || ''}
                            onChange={(e) => updateAnswer(current, e.target.value)}
                            placeholder="Type your answer..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && currentIsValid) {
                                    e.preventDefault()
                                    if (isLast) submit()
                                    else goNext()
                                }
                            }}
                            autoFocus
                        />
                    )}
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.backBtn}
                        onClick={goBack}
                        disabled={step === 0 || submitting}
                    >
                        <FaArrowLeft /> Back
                    </button>
                    {isLast ? (
                        <button
                            type="button"
                            className={styles.nextBtn}
                            onClick={submit}
                            disabled={!currentIsValid || submitting}
                        >
                            {submitting ? (
                                <>
                                    <FaSpinner className={styles.spin} /> Submitting
                                </>
                            ) : (
                                <>
                                    Submit <FaArrowRight />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={styles.nextBtn}
                            onClick={goNext}
                            disabled={!currentIsValid}
                        >
                            Next <FaArrowRight />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
