'use client'

import { use, useEffect, useState } from 'react'

interface Props {
    params: Promise<{ sessionId: string }>
}

/**
 * DOM Mirror Viewer (Phase 6 scaffold).
 *
 * To finish wiring:
 *   1. npm i rrweb rrweb-player
 *   2. In public/widget/im.js, add a `mirror` module that calls `rrweb.record({ emit: send })`
 *      and POSTs events to /api/widget/mirror/events when `widget_visitors.mirror_active = true`.
 *   3. Replace the placeholder iframe below with rrweb-player Replayer fed by realtime events.
 */
export default function MirrorViewerPage({ params }: Props) {
    const { sessionId } = use(params)
    const [active, setActive] = useState(false)

    useEffect(() => {
        fetch('/api/host/widget/mirror/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        }).then((r) => setActive(r.ok))
        return () => {
            fetch('/api/host/widget/mirror/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            })
        }
    }, [sessionId])

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e8ee', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: 22 }}>👁 Stealth Screen View</h1>
                <span style={{ fontSize: 12, color: active ? '#0f9d58' : '#888' }}>
                    Session: <code>{sessionId}</code> · {active ? '● Live' : 'Connecting…'}
                </span>
            </div>
            <div style={{ background: '#000', borderRadius: 12, height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                rrweb player goes here — install <code style={{ color: '#9bd' }}>rrweb</code> + <code style={{ color: '#9bd' }}>rrweb-player</code> to enable.
            </div>
        </div>
    )
}
