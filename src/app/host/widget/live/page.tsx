'use client'

import { useEffect, useState } from 'react'

interface Visitor {
    id: string
    session_id: string
    visitor_name: string | null
    visitor_email: string | null
    current_page_url: string | null
    current_page_title: string | null
    scroll_depth: number
    status: string
    first_seen_at: string
    last_heartbeat_at: string
}

export default function LiveEngagePage() {
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)

    async function refresh() {
        const r = await fetch('/api/host/widget/visitors')
        const j = await r.json()
        setVisitors(j.visitors || [])
        setLoading(false)
    }

    useEffect(() => {
        refresh()
        const id = setInterval(refresh, 5000)
        return () => clearInterval(id)
    }, [])

    async function invite(v: Visitor) {
        setBusy(v.session_id)
        await fetch('/api/host/widget/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: v.session_id }),
        })
        setBusy(null)
        alert('Invite sent — visitor will see a popup within ~5s.')
    }

    return (
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px', color: '#e8e8ee', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>👁 Live Visitors</h1>
            <p style={{ color: '#888', fontSize: 13, marginTop: 0 }}>
                Visitors active on your website right now (refreshes every 5s).
            </p>

            {loading && <div style={{ color: '#777' }}>Loading…</div>}
            {!loading && visitors.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: '#666', background: '#14141f', borderRadius: 12 }}>
                    No active visitors. Make sure your widget is installed and someone is on your site.
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visitors.map((v) => (
                    <div key={v.id} style={{ display: 'flex', gap: 14, padding: 16, background: '#14141f', borderRadius: 12, border: '1px solid #222', alignItems: 'center' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0f9d58', boxShadow: '0 0 0 4px rgba(15,157,88,0.2)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{v.visitor_name || 'Anonymous visitor'}</div>
                            <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {v.current_page_title || v.current_page_url || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                                {v.visitor_email || ''} · scroll {v.scroll_depth}% · status {v.status}
                            </div>
                        </div>
                        <button
                            onClick={() => invite(v)}
                            disabled={busy === v.session_id}
                            style={{ padding: '10px 16px', background: '#5b6cff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                        >
                            {busy === v.session_id ? 'Sending…' : 'Invite to meeting'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
