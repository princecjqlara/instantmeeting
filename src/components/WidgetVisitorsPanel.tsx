'use client'

import { useEffect, useMemo, useState } from 'react'

interface Visitor {
    id: string
    session_id: string
    visitor_name: string | null
    visitor_email: string | null
    current_page_url: string | null
    current_page_title: string | null
    scroll_depth: number
    status: string
    mirror_active?: boolean | null
    last_heartbeat_at: string
    metadata?: {
        source?: string
        funnelSlug?: string
        tenantSlug?: string
        propertyAddress?: string
        propertyPrice?: string
    } | null
}

interface WidgetVisitorsPanelProps {
    title?: string
    subtitle?: string
    variant?: 'dashboard' | 'overlay' | 'page'
    showInvite?: boolean
    startOpen?: boolean
}

function formatRelativeTime(value: string) {
    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) {
        return 'Live now'
    }

    const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
    if (diffSeconds < 10) return 'Live now'
    if (diffSeconds < 60) return `${diffSeconds}s ago`
    return `${Math.round(diffSeconds / 60)}m ago`
}

export default function WidgetVisitorsPanel({
    title = 'Visitor Screens',
    subtitle = 'Active visitors update automatically every 5 seconds.',
    variant = 'dashboard',
    showInvite = true,
    startOpen = true,
}: WidgetVisitorsPanelProps) {
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)
    const [open, setOpen] = useState(startOpen)

    useEffect(() => {
        let cancelled = false

        async function refresh() {
            try {
                const response = await fetch('/api/host/widget/visitors')
                if (!response.ok) {
                    throw new Error('Could not load visitors')
                }

                const data = await response.json()
                if (!cancelled) {
                    setVisitors(data.visitors || [])
                }
            } catch {
                if (!cancelled) {
                    setVisitors([])
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        refresh()
        const intervalId = window.setInterval(refresh, 5000)
        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [])

    const panelStyle = useMemo(() => {
        if (variant === 'overlay') {
            return {
                position: 'fixed' as const,
                top: 12,
                left: 12,
                width: 'min(340px, calc(100vw - 24px))',
                maxHeight: 'calc(100vh - 116px)',
                zIndex: 12,
                background: 'rgba(16, 16, 24, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }
        }

        if (variant === 'page') {
            return {
                width: '100%',
                background: '#14141f',
                border: '1px solid #222',
            }
        }

        return {
            width: '100%',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.22)',
        }
    }, [variant])

    async function invite(sessionId: string) {
        setBusy(sessionId)
        try {
            const response = await fetch('/api/host/widget/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            })

            if (!response.ok) {
                throw new Error('Invite failed')
            }

            window.alert('Invite sent. The visitor should see the popup within a few seconds.')
        } catch {
            window.alert('Could not send invite right now.')
        } finally {
            setBusy(null)
        }
    }

    if (variant === 'overlay' && !open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                style={{
                    position: 'fixed',
                    top: 12,
                    left: 12,
                    zIndex: 12,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(16, 16, 24, 0.92)',
                    color: '#fff',
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                }}
            >
                Visitor Screens ({visitors.length})
            </button>
        )
    }

    return (
        <section style={{ ...panelStyle, borderRadius: 16, overflow: 'hidden', color: '#f5f7ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>{subtitle}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#a7f3d0' }}>{visitors.length} live</span>
                    {variant === 'overlay' && (
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: variant === 'overlay' ? 'calc(100vh - 200px)' : 'none', overflowY: 'auto' }}>
                {loading && <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading visitors...</div>}

                {!loading && visitors.length === 0 && (
                    <div style={{ borderRadius: 12, border: '1px dashed rgba(255, 255, 255, 0.12)', padding: 20, color: '#9ca3af', fontSize: 13 }}>
                        No active visitors yet.
                    </div>
                )}

                {visitors.map((visitor) => (
                    <article key={visitor.id} style={{ borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255,255,255,0.04)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{visitor.visitor_name || 'Anonymous visitor'}</div>
                                <div style={{ fontSize: 12, color: '#d1d5db', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {visitor.current_page_title || visitor.current_page_url || 'Current page unavailable'}
                                </div>
                            </div>
                            <span style={{ flexShrink: 0, borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 700, background: visitor.mirror_active ? 'rgba(52, 211, 153, 0.16)' : 'rgba(251, 191, 36, 0.14)', color: visitor.mirror_active ? '#6ee7b7' : '#fcd34d' }}>
                                {visitor.mirror_active ? 'Auto mirror on' : 'Mirror off'}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, fontSize: 12 }}>
                            <div style={{ color: '#9ca3af' }}>Status: <span style={{ color: '#fff' }}>{visitor.status}</span></div>
                            <div style={{ color: '#9ca3af' }}>Scroll: <span style={{ color: '#fff' }}>{visitor.scroll_depth}%</span></div>
                            <div style={{ color: '#9ca3af' }}>Seen: <span style={{ color: '#fff' }}>{formatRelativeTime(visitor.last_heartbeat_at)}</span></div>
                        </div>

                        {visitor.visitor_email && <div style={{ fontSize: 12, color: '#9ca3af' }}>{visitor.visitor_email}</div>}

                        {/* IH Funnel Source Label */}
                        {visitor.metadata?.source === 'instanthomes' && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px',
                                borderRadius: 10,
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.15)',
                                fontSize: 12,
                            }}>
                                <span>🏠</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>from InstantHomes funnel</span>
                                {visitor.metadata.propertyAddress && (
                                    <span style={{ color: '#9ca3af' }}>— {visitor.metadata.propertyAddress}</span>
                                )}
                                {visitor.metadata.propertyPrice && (
                                    <span style={{ color: '#fcd34d', fontWeight: 600 }}>{visitor.metadata.propertyPrice}</span>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => window.open(`/host/widget/viewer/${encodeURIComponent(visitor.session_id)}`, '_blank', 'noopener')}
                                style={{ border: 'none', borderRadius: 10, padding: '10px 12px', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                            >
                                Open screen
                            </button>
                            {showInvite && (
                                <button
                                    type="button"
                                    onClick={() => invite(visitor.session_id)}
                                    disabled={busy === visitor.session_id}
                                    style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', background: 'transparent', color: '#fff', cursor: busy === visitor.session_id ? 'default' : 'pointer', fontWeight: 700, fontSize: 12, opacity: busy === visitor.session_id ? 0.65 : 1 }}
                                >
                                    {busy === visitor.session_id ? 'Sending...' : 'Invite to meeting'}
                                </button>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}
