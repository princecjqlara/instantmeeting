'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

interface Tenant {
    id: string
    email: string
    name: string | null
    role: string
    created_at: string
}

interface PendingSignup {
    id: string
    email: string
    name: string | null
    phone: string | null
    receipt_url: string | null
    amount: number | null
    plan: string | null
    status: 'pending' | 'verified' | 'rejected'
    created_at: string
}

export default function AdminPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [pending, setPending] = useState<PendingSignup[]>([])
    const [pendingLoading, setPendingLoading] = useState(false)
    const [reviewingId, setReviewingId] = useState<string | null>(null)

    // Redirect non-organizers
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        } else if (status === 'authenticated') {
            const role = (session?.user as { role?: string })?.role
            if (role !== 'organizer') {
                router.push('/host/dashboard')
            }
        }
    }, [status, session, router])

    // Fetch tenants
    const fetchTenants = async () => {
        try {
            const res = await fetch('/api/admin/tenants')
            if (res.ok) {
                const data = await res.json()
                setTenants(data)
            }
        } catch (err) {
            console.error('Error fetching tenants:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchPending = async () => {
        setPendingLoading(true)
        try {
            const res = await fetch('/api/admin/pending?status=pending')
            if (res.ok) setPending(await res.json())
        } finally {
            setPendingLoading(false)
        }
    }

    useEffect(() => {
        if (status === 'authenticated') {
            fetchTenants()
            fetchPending()
        }
    }, [status])

    const reviewPending = async (id: string, action: 'verify' | 'reject') => {
        if (action === 'reject' && !confirm('Reject this signup? The user will need to pay again.')) {
            return
        }
        setReviewingId(id)
        try {
            const res = await fetch('/api/admin/pending', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action }),
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Review failed')
                return
            }
            await Promise.all([fetchPending(), fetchTenants()])
        } finally {
            setReviewingId(null)
        }
    }

    // Create tenant
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        setSuccessMsg('')
        setErrorMsg('')

        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, password }),
            })

            const data = await res.json()

            if (res.ok) {
                const actionLabel = data.action === 'update' ? 'updated' : 'created'
                setSuccessMsg(`Tenant "${data.email}" ${actionLabel} successfully!`)
                setEmail('')
                setName('')
                setPassword('')
                fetchTenants()
            } else {
                setErrorMsg(data.error || 'Failed to create tenant')
            }
        } catch {
            setErrorMsg('Network error')
        } finally {
            setCreating(false)
        }
    }

    // Delete tenant
    const handleDelete = async (id: string, tenantEmail: string) => {
        if (!confirm(`Delete tenant "${tenantEmail}"? This cannot be undone.`)) return

        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })

            if (res.ok) {
                setTenants(prev => prev.filter(t => t.id !== id))
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to delete tenant')
            }
        } catch {
            alert('Network error')
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Admin — Manage Tenants</h1>
                <a href="/host/dashboard" className={styles.backLink}>← Back to Dashboard</a>
            </div>

            <div className={styles.content}>
                {/* Create Tenant Form */}
                <div className={styles.createCard}>
                    <h2>Create New Tenant</h2>
                    <form onSubmit={handleCreate}>
                        <div className={styles.formGroup}>
                            <label>Email *</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tenant@example.com"
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tenant name"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Password *</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            className={styles.createBtn}
                            disabled={creating}
                        >
                            {creating ? 'Creating...' : 'Create Tenant'}
                        </button>
                        {successMsg && <p className={styles.successMsg}>{successMsg}</p>}
                        {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}
                    </form>
                </div>

                {/* Pending Payments */}
                <div className={styles.listCard}>
                    <h2>
                        Pending Payments{' '}
                        <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginLeft: 6 }}>
                            ({pending.length})
                        </span>
                    </h2>
                    {pendingLoading && pending.length === 0 ? (
                        <p className={styles.emptyMsg}>Loading…</p>
                    ) : pending.length === 0 ? (
                        <p className={styles.emptyMsg}>No pending signups.</p>
                    ) : (
                        <div className={styles.tenantList}>
                            {pending.map((p) => (
                                <div
                                    key={p.id}
                                    className={styles.tenantItem}
                                    style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
                                >
                                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: 220 }}>
                                            <div className={styles.tenantName}>
                                                {p.name || 'Unnamed'}{' '}
                                                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginLeft: 6 }}>
                                                    ₱{p.amount ?? 699}
                                                </span>
                                            </div>
                                            <div className={styles.tenantEmail}>{p.email}</div>
                                            {p.phone && (
                                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                                    📱 {p.phone}
                                                </div>
                                            )}
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                                Submitted {new Date(p.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        {p.receipt_url && (
                                            <a
                                                href={p.receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'block',
                                                    width: 110,
                                                    height: 110,
                                                    borderRadius: 10,
                                                    overflow: 'hidden',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    background: '#000',
                                                }}
                                                title="View full receipt"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={p.receipt_url}
                                                    alt="Receipt"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </a>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => reviewPending(p.id, 'reject')}
                                            disabled={reviewingId === p.id}
                                            className={styles.deleteBtn}
                                        >
                                            Reject
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => reviewPending(p.id, 'verify')}
                                            disabled={reviewingId === p.id}
                                            style={{
                                                background: 'linear-gradient(135deg,#22c55e,#10b981)',
                                                color: '#fff',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: 8,
                                                fontSize: 12.5,
                                                fontWeight: 700,
                                                cursor: reviewingId === p.id ? 'not-allowed' : 'pointer',
                                                opacity: reviewingId === p.id ? 0.6 : 1,
                                            }}
                                        >
                                            {reviewingId === p.id ? 'Verifying…' : '✓ Verify & create account'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tenant List */}
                <div className={styles.listCard}>
                    <h2>Existing Tenants ({tenants.length})</h2>
                    <div className={styles.tenantList}>
                        {tenants.length === 0 ? (
                            <p className={styles.emptyMsg}>No tenants yet. Create one to get started.</p>
                        ) : (
                            tenants.map(tenant => (
                                <div key={tenant.id} className={styles.tenantItem}>
                                    <div className={styles.tenantInfo}>
                                        <div className={styles.tenantName}>{tenant.name || 'Unnamed'}</div>
                                        <div className={styles.tenantEmail}>{tenant.email}</div>
                                    </div>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDelete(tenant.id, tenant.email)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
