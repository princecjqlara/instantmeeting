'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '@/app/host/dashboard/page.module.css'

interface ConnectionData {
    linked: boolean
    tenantName?: string
    tenantSlug?: string
    linkedAt?: string
    funnelDomains?: string[]
}

interface InstantHomesConnectionCardProps {
    userId?: string
}

export default function InstantHomesConnectionCard({ userId }: InstantHomesConnectionCardProps) {
    const [connection, setConnection] = useState<ConnectionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [unlinking, setUnlinking] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        const fetchConnection = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('ih_linked, ih_tenant_name, ih_tenant_slug, ih_linked_at, ih_funnel_domains')
                    .eq('id', userId)
                    .single()

                if (error || !data) {
                    setConnection(null)
                    return
                }

                setConnection({
                    linked: !!data.ih_linked,
                    tenantName: data.ih_tenant_name || undefined,
                    tenantSlug: data.ih_tenant_slug || undefined,
                    linkedAt: data.ih_linked_at || undefined,
                    funnelDomains: data.ih_funnel_domains || [],
                })
            } catch (err) {
                console.error('Failed to load IH connection:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchConnection()
    }, [userId, supabase])

    const handleUnlink = async () => {
        if (!confirm('Disconnect your InstantHomes account? This will remove widget access from all linked funnels.')) {
            return
        }

        setUnlinking(true)

        try {
            await supabase
                .from('users')
                .update({
                    ih_linked: false,
                    ih_tenant_id: null,
                    ih_tenant_slug: null,
                    ih_tenant_name: null,
                    ih_linked_at: null,
                    ih_funnel_domains: [],
                })
                .eq('id', userId)

            setConnection({ linked: false })
        } catch (err) {
            console.error('Failed to unlink:', err)
            alert('Failed to disconnect. Please try again.')
        } finally {
            setUnlinking(false)
        }
    }

    if (loading) {
        return null
    }

    // Don't show the card if not linked
    if (!connection?.linked) {
        return null
    }

    const linkedDate = connection.linkedAt
        ? new Date(connection.linkedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '—'

    const funnelCount = connection.funnelDomains?.length ?? 0

    return (
        <section className={styles.createSection}>
            <div className={styles.createCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            fontSize: '1.2rem',
                        }}>
                            🏠
                        </span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>InstantHomes Connected</h2>
                            <p style={{ margin: '2px 0 0', color: '#aaa', fontSize: '0.8rem' }}>
                                {connection.tenantName || connection.tenantSlug || 'Linked tenant'}
                            </p>
                        </div>
                    </div>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 12px',
                        borderRadius: 9999,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                        Connected
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    padding: '1rem',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '1rem',
                }}>
                    <div>
                        <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tenant</p>
                        <p style={{ marginTop: 4, fontWeight: 600, fontSize: '0.9rem' }}>{connection.tenantName || '—'}</p>
                    </div>
                    <div>
                        <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Funnel Domains</p>
                        <p style={{ marginTop: 4, fontWeight: 600, fontSize: '0.9rem' }}>{funnelCount}</p>
                    </div>
                    <div>
                        <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connected</p>
                        <p style={{ marginTop: 4, fontWeight: 600, fontSize: '0.9rem' }}>{linkedDate}</p>
                    </div>
                </div>

                {funnelCount > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                        <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: 6 }}>Whitelisted domains:</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {connection.funnelDomains?.map((domain) => (
                                <span
                                    key={domain}
                                    style={{
                                        padding: '3px 10px',
                                        borderRadius: 8,
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        fontSize: '0.75rem',
                                        color: '#ccc',
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {domain}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={handleUnlink}
                        disabled={unlinking}
                        className="button-secondary"
                        style={{ color: '#f87171', fontSize: '0.8rem' }}
                    >
                        {unlinking ? 'Disconnecting…' : '❌ Unlink'}
                    </button>
                </div>
            </div>
        </section>
    )
}
