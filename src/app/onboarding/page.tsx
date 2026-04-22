'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { buildOnboardingLeadFormPayload } from '@/lib/onboarding-lead-form'
import {
    FaArrowRight,
    FaArrowLeft,
    FaCheck,
    FaMagic,
    FaUser,
    FaLink,
    FaRocket,
    FaSpinner,
} from 'react-icons/fa'

type Question = {
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
    required: boolean
    options?: Array<{ id: string; label: string; value: string; points?: number }>
    scoring_rules?: Array<{ id: string; keywords: string; points: number }>
    ideal_answer?: string | null
    disqualify_on?: string | null
    ai_weight?: number
}

type AiDraft = {
    title: string
    description: string
    ai_criteria: string
    unqualified_message: string
    auto_admit_threshold: number
    questions: Question[]
    qualification_summary?: string[]
}

export default function OnboardingPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [step, setStep] = useState(0)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [bio, setBio] = useState('')

    const [leadPrompt, setLeadPrompt] = useState('')
    const [leadBuilding, setLeadBuilding] = useState(false)
    const [leadDraft, setLeadDraft] = useState<AiDraft | null>(null)
    const [leadSaved, setLeadSaved] = useState(false)
    const [leadSkipped, setLeadSkipped] = useState(false)

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/')
    }, [status, router])

    useEffect(() => {
        if (!session) return
        ;(async () => {
            try {
                const res = await fetch('/api/profile/settings')
                if (res.ok) {
                    const data = await res.json()
                    if (data.onboarding_completed && data.username) {
                        router.replace('/host/dashboard')
                        return
                    }
                    setName(data.name || session.user?.name || '')
                    setUsername(data.username || '')
                    setBio(data.bio || '')
                }
            } finally {
                setLoadingProfile(false)
            }
        })()
    }, [session, router])

    const suggestUsername = useMemo(() => {
        if (username) return null
        const base = (name || session?.user?.name || session?.user?.email?.split('@')[0] || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 20)
        return base || null
    }, [name, session, username])

    const step1Valid =
        name.trim().length >= 2 &&
        /^[a-z0-9_]{3,20}$/.test(username.trim())

    const usernameErr =
        username && !/^[a-z0-9_]{3,20}$/.test(username)
            ? '3–20 chars: lowercase letters, numbers, underscores.'
            : null

    const saveProfileStep = async () => {
        setSaving(true)
        setError(null)
        try {
            const res = await fetch('/api/profile/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), username: username.trim(), bio: bio.trim() }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Could not save your profile.')
                return false
            }
            return true
        } catch {
            setError('Network error. Try again.')
            return false
        } finally {
            setSaving(false)
        }
    }

    const generateLeadForm = async () => {
        const prompt = leadPrompt.trim()
        if (prompt.length < 6) {
            setError('Tell the AI a sentence or two about your business.')
            return
        }
        setLeadBuilding(true)
        setError(null)
        try {
            const res = await fetch('/api/host/lead-forms/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'onboarding', messages: [{ role: 'user', content: prompt }] }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'AI form generation failed.')
                return
            }
            if (!data.draft) {
                setError(data.reply || 'The AI needs more detail. Try adding your ideal client profile.')
                return
            }
            setLeadDraft(data.draft as AiDraft)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Network error.')
        } finally {
            setLeadBuilding(false)
        }
    }

    const saveLeadForm = async () => {
        if (!leadDraft) return false
        const res = await fetch('/api/host/lead-forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildOnboardingLeadFormPayload(leadDraft)),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => null)
            setError(err?.error || 'Saving your form failed.')
            return false
        }
        setLeadSaved(true)
        return true
    }

    const completeOnboarding = async () => {
        setSaving(true)
        setError(null)
        try {
            await fetch('/api/profile/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ onboarding_completed: true }),
            })
            router.replace('/host/dashboard')
        } finally {
            setSaving(false)
        }
    }

    if (status === 'loading' || loadingProfile) {
        return (
            <div style={pageWrap}>
                <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
            </div>
        )
    }

    const steps = [
        { icon: <FaUser />, label: 'Your basics' },
        { icon: <FaLink />, label: 'Your profile' },
        { icon: <FaMagic />, label: 'Instant Leads' },
        { icon: <FaRocket />, label: 'All set' },
    ]

    return (
        <div style={pageWrap}>
            <div style={card}>
                <div style={progressBar}>
                    {steps.map((s, i) => {
                        const done = i < step
                        const active = i === step
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                <div
                                    style={{
                                        ...stepDot,
                                        background: active
                                            ? 'linear-gradient(135deg,#6366f1,#a855f7)'
                                            : done
                                              ? 'linear-gradient(135deg,#22c55e,#10b981)'
                                              : 'rgba(255,255,255,0.08)',
                                        color: active || done ? '#fff' : '#94a3b8',
                                        boxShadow: active ? '0 8px 22px -10px #6366f1' : 'none',
                                    }}
                                >
                                    {done ? <FaCheck /> : s.icon}
                                </div>
                                <div style={{ flex: 1, display: i === steps.length - 1 ? 'none' : 'block' }}>
                                    <div
                                        style={{
                                            height: 2,
                                            background: done
                                                ? 'linear-gradient(90deg,#22c55e,#10b981)'
                                                : 'rgba(255,255,255,0.08)',
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
                    Step {step + 1} of {steps.length} · {steps[step].label}
                </div>

                {step === 0 && (
                    <>
                        <h1 style={title}>Welcome 👋</h1>
                        <p style={subtitle}>
                            Two quick details and you&apos;re in. This is what your guests will see
                            when they land on your page.
                        </p>

                        <label style={label}>Full name</label>
                        <input
                            style={input}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Jane Doe"
                            autoFocus
                        />

                        <label style={label}>
                            Username
                            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.55, fontWeight: 500 }}>
                                (your link: /join/{username || 'yourname'})
                            </span>
                        </label>
                        <input
                            style={input}
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder={suggestUsername || 'yourname'}
                            maxLength={20}
                        />
                        {suggestUsername && !username && (
                            <button
                                type="button"
                                onClick={() => setUsername(suggestUsername)}
                                style={linkBtn}
                            >
                                Use &ldquo;{suggestUsername}&rdquo;
                            </button>
                        )}
                        {usernameErr && <div style={errorBox}>{usernameErr}</div>}
                    </>
                )}

                {step === 1 && (
                    <>
                        <h1 style={title}>Tell guests about you</h1>
                        <p style={subtitle}>
                            A short bio helps visitors know they&apos;re in the right place. Keep it
                            short — a sentence or two.
                        </p>

                        <label style={label}>Short bio</label>
                        <textarea
                            style={{ ...input, minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="e.g. I help SaaS founders turn their landing page into booked demos."
                            maxLength={300}
                        />
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                            {bio.length}/300 · Leave blank to skip.
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h1 style={title}>Build your first Instant Leads form</h1>
                        <p style={subtitle}>
                            Describe your business and who a &ldquo;qualified&rdquo; lead looks like.
                            The AI will draft the whole form — questions, scoring, and
                            auto-admit rules — for you to tweak later.
                        </p>

                        {!leadDraft ? (
                            <>
                                <label style={label}>Describe your ideal lead</label>
                                <textarea
                                    style={{ ...input, minHeight: 130, resize: 'vertical', fontFamily: 'inherit' }}
                                    value={leadPrompt}
                                    onChange={(e) => setLeadPrompt(e.target.value)}
                                    placeholder="e.g. I sell a B2B payroll product to HR leaders at 50-500 person companies. Qualified leads are decision-makers actively evaluating a switch this quarter."
                                    disabled={leadBuilding}
                                />
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                                    <button
                                        type="button"
                                        onClick={generateLeadForm}
                                        disabled={leadBuilding || leadPrompt.trim().length < 6}
                                        style={{
                                            ...primaryBtn,
                                            opacity: leadBuilding || leadPrompt.trim().length < 6 ? 0.6 : 1,
                                        }}
                                    >
                                        {leadBuilding ? (
                                            <>
                                                <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Building…
                                            </>
                                        ) : (
                                            <>
                                                <FaMagic /> Build with AI
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLeadSkipped(true)
                                            setStep(3)
                                        }}
                                        style={ghostBtn}
                                    >
                                        Skip for now
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={previewBox}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                                        {leadDraft.title}
                                    </div>
                                    {leadDraft.description && (
                                        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
                                            {leadDraft.description}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11.5, opacity: 0.6, marginBottom: 8 }}>
                                        Auto-admit ≥ {leadDraft.auto_admit_threshold}/100 ·{' '}
                                        {leadDraft.questions.length} questions
                                    </div>
                                    <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {leadDraft.questions.map((q, i) => (
                                            <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                                                <strong>{q.question_text}</strong>{' '}
                                                <span style={{ opacity: 0.5 }}>({q.type})</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLeadDraft(null)
                                            setError(null)
                                        }}
                                        style={ghostBtn}
                                    >
                                        Try a different description
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}

                {step === 3 && (
                    <>
                        <h1 style={title}>You&apos;re all set 🚀</h1>
                        <p style={subtitle}>
                            Your universal link is ready at{' '}
                            <code style={{ color: '#a5b4fc' }}>/join/{username}</code>.
                            {leadSaved
                                ? ' Your first lead form is live — send traffic to your form link and qualified leads will be auto-admitted.'
                                : leadSkipped
                                  ? ' You can build a lead form any time from Instant Leads.'
                                  : ''}
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <li style={checklistItem}>
                                <FaCheck style={{ color: '#22c55e' }} /> Profile saved
                            </li>
                            <li style={checklistItem}>
                                {leadSaved ? <FaCheck style={{ color: '#22c55e' }} /> : <span style={{ width: 14, textAlign: 'center' }}>•</span>}
                                {leadSaved ? 'First Instant Leads form created' : 'Instant Leads — set up later from the dashboard'}
                            </li>
                            <li style={checklistItem}>
                                <FaCheck style={{ color: '#22c55e' }} /> Share your link to start talking to guests
                            </li>
                        </ul>
                    </>
                )}

                {error && <div style={errorBox}>{error}</div>}

                <div style={nav}>
                    <button
                        type="button"
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                        disabled={step === 0 || saving || leadBuilding}
                        style={{ ...ghostBtn, visibility: step === 0 ? 'hidden' : 'visible' }}
                    >
                        <FaArrowLeft /> Back
                    </button>

                    {step < 3 ? (
                        <button
                            type="button"
                            onClick={async () => {
                                setError(null)
                                if (step === 0) {
                                    if (!step1Valid) {
                                        setError('Add your name and a valid username to continue.')
                                        return
                                    }
                                    const ok = await saveProfileStep()
                                    if (ok) setStep(1)
                                    return
                                }
                                if (step === 1) {
                                    const ok = await saveProfileStep()
                                    if (ok) setStep(2)
                                    return
                                }
                                if (step === 2) {
                                    if (leadDraft && !leadSaved) {
                                        const ok = await saveLeadForm()
                                        if (ok) setStep(3)
                                        return
                                    }
                                    setStep(3)
                                }
                            }}
                            disabled={saving || leadBuilding || (step === 0 && !step1Valid)}
                            style={{
                                ...primaryBtn,
                                opacity:
                                    saving || leadBuilding || (step === 0 && !step1Valid) ? 0.6 : 1,
                            }}
                        >
                            {saving ? (
                                <>
                                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Saving…
                                </>
                            ) : step === 2 && leadDraft ? (
                                <>
                                    Looks good <FaArrowRight />
                                </>
                            ) : step === 2 && !leadDraft ? (
                                <>
                                    Continue <FaArrowRight />
                                </>
                            ) : (
                                <>
                                    Continue <FaArrowRight />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={completeOnboarding}
                            disabled={saving}
                            style={primaryBtn}
                        >
                            {saving ? (
                                <>
                                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Finishing…
                                </>
                            ) : (
                                <>
                                    Go to dashboard <FaArrowRight />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    )
}

const pageWrap: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background:
        'radial-gradient(900px 600px at 10% 0%, rgba(99,102,241,0.18), transparent 60%),' +
        'radial-gradient(900px 600px at 90% 100%, rgba(236,72,153,0.14), transparent 65%),' +
        '#05070f',
}

const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 560,
    background: 'rgba(15, 18, 32, 0.92)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 28,
    color: '#f5f5f7',
    boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)',
}

const progressBar: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginBottom: 18,
}

const stepDot: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    flexShrink: 0,
}

const title: React.CSSProperties = {
    margin: '0 0 6px',
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.02em',
}

const subtitle: React.CSSProperties = {
    margin: '0 0 18px',
    fontSize: 13.5,
    color: '#cbd5e1',
    lineHeight: 1.55,
}

const label: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#cbd5e1',
    marginTop: 12,
    marginBottom: 6,
}

const input: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
}

const primaryBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg,#6366f1,#a855f7)',
    border: 'none',
    color: '#fff',
    padding: '11px 18px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13.5,
}

const ghostBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#e5e7eb',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
}

const linkBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#a5b4fc',
    cursor: 'pointer',
    fontSize: 12.5,
    padding: '6px 0',
    textAlign: 'left',
}

const nav: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
}

const errorBox: React.CSSProperties = {
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fecaca',
    fontSize: 12.5,
}

const previewBox: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
}

const checklistItem: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13.5,
    color: '#e2e8f0',
}
