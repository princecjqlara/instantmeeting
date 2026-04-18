'use client'

import { useEffect, useState } from 'react'

interface AdmittedGuestData {
    id: string
    guest_name: string
    guest_email?: string | null
    guest_phone?: string | null
    note?: string | null
    tags?: string[] | null
    lead_answers?: Array<{
        question_id: string
        question_text: string
        type: string
        answer: string | string[]
    }> | null
    custom_fields?: Array<{ id: string; label: string; value: string }> | null
    qualification_verdict?: 'qualified' | 'unqualified' | 'review' | null
    qualification_score?: number | null
    qualification_reasoning?: string | null
    submitted_at?: string | null
}

export default function GuestInfoPanel({ roomId }: { roomId: string }) {
    const [open, setOpen] = useState(false)
    const [guest, setGuest] = useState<AdmittedGuestData | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/waiting?meetingId=${roomId}`)
                if (!res.ok) return
                const data = await res.json()
                if (!cancelled) setGuest((data.admittedGuest as AdmittedGuestData) || null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        const interval = setInterval(load, 30000)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [roomId])

    const answerText = (a: { answer: string | string[] }): string =>
        Array.isArray(a.answer) ? a.answer.filter(Boolean).join(', ') : String(a.answer || '')

    const verdictColor = (v?: string | null) => {
        if (v === 'qualified') return { bg: 'rgba(34,197,94,0.18)', fg: '#86efac' }
        if (v === 'review') return { bg: 'rgba(251,191,36,0.18)', fg: '#fcd34d' }
        if (v === 'unqualified') return { bg: 'rgba(239,68,68,0.18)', fg: '#fca5a5' }
        return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.75)' }
    }

    if (!guest) return null

    const hasBody =
        (guest.lead_answers || []).length > 0 ||
        (guest.custom_fields || []).length > 0 ||
        Boolean(guest.qualification_verdict) ||
        Boolean(guest.note)
    const v = verdictColor(guest.qualification_verdict)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Toggle guest info"
                style={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    zIndex: 1200,
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 10px 24px -10px rgba(99,102,241,0.8)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: v.fg,
                        boxShadow: `0 0 8px ${v.fg}`,
                    }}
                />
                {open ? 'Hide guest info' : guest.guest_name || 'Guest info'}
            </button>

            {open && (
                <aside
                    style={{
                        position: 'fixed',
                        top: 64,
                        right: 16,
                        bottom: 16,
                        width: 'min(380px, calc(100vw - 32px))',
                        zIndex: 1150,
                        background: 'rgba(15, 18, 32, 0.96)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#f5f5f7',
                        overflow: 'auto',
                        padding: 18,
                        boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 10,
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 11,
                                    opacity: 0.55,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                }}
                            >
                                Guest
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                                {guest.guest_name}
                            </div>
                            {(guest.guest_email || guest.guest_phone) && (
                                <div
                                    style={{
                                        fontSize: 12,
                                        opacity: 0.8,
                                        marginTop: 4,
                                        wordBreak: 'break-all',
                                    }}
                                >
                                    {guest.guest_email || ''}
                                    {guest.guest_email && guest.guest_phone ? ' · ' : ''}
                                    {guest.guest_phone || ''}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#cbd5e1',
                                fontSize: 20,
                                cursor: 'pointer',
                                lineHeight: 1,
                            }}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    {guest.qualification_verdict && (
                        <div
                            style={{
                                marginTop: 12,
                                padding: '8px 12px',
                                borderRadius: 10,
                                background: v.bg,
                                color: v.fg,
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            {guest.qualification_verdict.toUpperCase()}
                            {typeof guest.qualification_score === 'number' && (
                                <span style={{ opacity: 0.85, fontWeight: 600 }}>
                                    · {guest.qualification_score}/100
                                </span>
                            )}
                        </div>
                    )}

                    {Array.isArray(guest.tags) && guest.tags.length > 0 && (
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 4,
                                marginTop: 10,
                            }}
                        >
                            {guest.tags.map((t) => (
                                <span
                                    key={t}
                                    style={{
                                        fontSize: 10.5,
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        background: 'rgba(99,102,241,0.18)',
                                        color: '#c7d2fe',
                                    }}
                                >
                                    #{t}
                                </span>
                            ))}
                        </div>
                    )}

                    {guest.qualification_reasoning && (
                        <p
                            style={{
                                marginTop: 12,
                                padding: 10,
                                fontSize: 12.5,
                                color: '#cbd5e1',
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: 10,
                                lineHeight: 1.5,
                                fontStyle: 'italic',
                            }}
                        >
                            {guest.qualification_reasoning}
                        </p>
                    )}

                    {(guest.lead_answers || []).length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    opacity: 0.6,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                    marginBottom: 8,
                                }}
                            >
                                Form answers
                            </div>
                            <ul
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                }}
                            >
                                {(guest.lead_answers || []).map((a, i) => (
                                    <li key={a.question_id || i}>
                                        <div style={{ fontSize: 11, opacity: 0.65 }}>
                                            {a.question_text}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13.5,
                                                marginTop: 2,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {answerText(a) || '—'}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {(guest.custom_fields || []).length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    opacity: 0.6,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                    marginBottom: 8,
                                }}
                            >
                                Extra info
                            </div>
                            <ul
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                }}
                            >
                                {(guest.custom_fields || []).map((f) => (
                                    <li key={f.id}>
                                        <div style={{ fontSize: 11, opacity: 0.65 }}>{f.label}</div>
                                        <div
                                            style={{
                                                fontSize: 13.5,
                                                marginTop: 2,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {f.value || '—'}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {guest.note && (
                        <div style={{ marginTop: 16 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    opacity: 0.6,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                    marginBottom: 6,
                                }}
                            >
                                Note
                            </div>
                            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{guest.note}</div>
                        </div>
                    )}

                    {!hasBody && !loading && (
                        <div style={{ marginTop: 16, fontSize: 12.5, opacity: 0.65 }}>
                            No form data submitted.
                        </div>
                    )}
                </aside>
            )}
        </>
    )
}
