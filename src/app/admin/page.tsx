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

    useEffect(() => {
        if (status === 'authenticated') {
            fetchTenants()
        }
    }, [status])

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
