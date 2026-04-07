'use client'

import { useEffect, useState } from 'react'

interface Config {
    widgetKey: string
    domains: string[]
    enabled: boolean
    formFields: Array<{ id: string; label: string; type: string; required?: boolean }>
    mirrorEnabled: boolean
}

export default function WidgetConfigPage() {
    const [cfg, setCfg] = useState<Config | null>(null)
    const [newDomain, setNewDomain] = useState('')
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        fetch('/api/host/widget/config').then((r) => r.json()).then(setCfg)
    }, [])

    if (!cfg) return <div style={{ padding: 40, color: '#aaa' }}>Loading…</div>

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const embed = `<script src="${origin}/widget/im.js" data-key="${cfg.widgetKey}" async></script>`

    async function save(patch: Partial<Config>) {
        setSaving(true)
        await fetch('/api/host/widget/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
        setCfg((c) => (c ? { ...c, ...patch } : c))
        setSaving(false)
    }

    function addDomain() {
        const d = newDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
        if (!d || cfg!.domains.includes(d)) return
        save({ domains: [...cfg!.domains, d] })
        setNewDomain('')
    }

    function removeDomain(d: string) {
        save({ domains: cfg!.domains.filter((x) => x !== d) })
    }

    async function regenerate() {
        if (!confirm('Regenerate widget key? Existing embeds will stop working.')) return
        const r = await fetch('/api/host/widget/regenerate', { method: 'POST' })
        const j = await r.json()
        setCfg((c) => (c ? { ...c, widgetKey: j.widgetKey } : c))
    }

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px', color: '#e8e8ee', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 28 }}>🌐 Website Widget</h1>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
                    {cfg.enabled ? 'Enabled' : 'Disabled'}
                </label>
            </div>

            <Section title="Step 1 — Whitelist your website domains">
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                        placeholder="joes-plumbing.com"
                        style={inputStyle}
                    />
                    <button onClick={addDomain} style={btn}>Add</button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
                    {cfg.domains.map((d) => (
                        <li key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#1a1a25', borderRadius: 8, marginBottom: 6 }}>
                            <span>✓ {d}</span>
                            <button onClick={() => removeDomain(d)} style={{ ...btn, background: 'transparent', color: '#e57373' }}>Remove</button>
                        </li>
                    ))}
                    {cfg.domains.length === 0 && <li style={{ color: '#777', fontSize: 13 }}>No domains yet — add one above.</li>}
                </ul>
            </Section>

            <Section title="Step 2 — Copy embed code">
                <pre style={{ background: '#0f0f17', padding: 16, borderRadius: 10, overflowX: 'auto', fontSize: 12, color: '#9bd' }}>{embed}</pre>
                <button
                    onClick={() => {
                        navigator.clipboard?.writeText(embed)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                    }}
                    style={btn}
                >
                    {copied ? '✓ Copied' : '📋 Copy'}
                </button>
                <div style={{ marginTop: 12, fontSize: 12, color: '#777' }}>
                    Widget key: <code>{cfg.widgetKey}</code>{' '}
                    <button onClick={regenerate} style={{ ...btn, padding: '4px 10px', fontSize: 11, marginLeft: 8 }}>Regenerate</button>
                </div>
            </Section>

            <Section title="Step 3 — Privacy options">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={cfg.mirrorEnabled} onChange={(e) => save({ mirrorEnabled: e.target.checked })} />
                    Enable stealth screen view (DOM mirror)
                </label>
                <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                    You must disclose this in your website&apos;s privacy policy. Sensitive inputs are masked automatically.
                </p>
            </Section>

            <div style={{ marginTop: 20, fontSize: 12, color: '#666' }}>
                {saving ? 'Saving…' : 'All changes saved.'}{' '}
                · <a href="/host/widget/live" style={{ color: '#7aa2ff' }}>Open Live Engage →</a>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginBottom: 28, padding: 20, background: '#14141f', border: '1px solid #222', borderRadius: 12 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>{title}</h2>
            {children}
        </section>
    )
}

const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    background: '#0f0f17',
    border: '1px solid #2a2a3a',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
}

const btn: React.CSSProperties = {
    padding: '10px 16px',
    background: '#5b6cff',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
}
