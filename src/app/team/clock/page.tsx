'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaClock, FaSignInAlt, FaSignOutAlt, FaUsers } from 'react-icons/fa'

interface MemberStatus {
    id: string
    name: string
    avatar_url: string | null
    is_active: boolean
    is_clocked_in: boolean
    clocked_in_at: string | null
}

export default function TeamClockPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a1a', color: '#fff' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #333', borderTopColor: '#6c5ce7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <TeamClockInner />
        </Suspense>
    )
}

function TeamClockInner() {
    const searchParams = useSearchParams()
    const teamId = searchParams.get('team')
    const [members, setMembers] = useState<MemberStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMember, setSelectedMember] = useState<string | null>(null)
    const [acting, setActing] = useState(false)

    const fetchMembers = useCallback(async () => {
        if (!teamId) return
        try {
            const res = await fetch(`/api/team/clock?team_id=${teamId}`)
            if (res.ok) {
                const data = await res.json()
                setMembers(data)
            }
        } catch (err) {
            console.error('Error fetching members:', err)
        } finally {
            setLoading(false)
        }
    }, [teamId])

    useEffect(() => {
        fetchMembers()
        // Refresh every 30 seconds
        const interval = setInterval(fetchMembers, 30000)
        return () => clearInterval(interval)
    }, [fetchMembers])

    const handleClockIn = async (memberId: string) => {
        setActing(true)
        try {
            const res = await fetch('/api/team/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_id: memberId })
            })
            if (res.ok) {
                setSelectedMember(memberId)
                await fetchMembers()
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to clock in')
            }
        } catch {
            alert('Failed to clock in')
        } finally {
            setActing(false)
        }
    }

    const handleClockOut = async (memberId: string) => {
        setActing(true)
        try {
            const res = await fetch('/api/team/clock', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_id: memberId })
            })
            if (res.ok) {
                setSelectedMember(null)
                await fetchMembers()
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to clock out')
            }
        } catch {
            alert('Failed to clock out')
        } finally {
            setActing(false)
        }
    }

    const formatElapsed = (clockedInAt: string) => {
        const diff = Date.now() - new Date(clockedInAt).getTime()
        const hours = Math.floor(diff / 3600000)
        const mins = Math.floor((diff % 3600000) / 60000)
        return `${hours}h ${mins}m`
    }

    if (!teamId) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a1a', color: '#fff' }}>
                <p>No team specified. Ask your host for the clock-in link.</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a1a', color: '#fff' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #333', borderTopColor: '#6c5ce7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a1a, #1a1a2e)',
            color: '#fff', padding: '2rem', fontFamily: 'Inter, sans-serif'
        }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ maxWidth: 500, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <FaClock style={{ fontSize: '2rem', color: '#6c5ce7', marginBottom: '0.5rem' }} />
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Team Clock-In</h1>
                    <p style={{ color: '#888', fontSize: '0.85rem' }}>Select your name to clock in or out</p>
                </div>

                {/* Online count */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                    marginBottom: '1.5rem', color: '#2ed573', fontSize: '0.9rem'
                }}>
                    <FaUsers />
                    <span>{members.filter(m => m.is_clocked_in).length} / {members.length} online</span>
                </div>

                {/* Member list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {members.map(member => (
                        <div key={member.id} style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '1rem', background: 'rgba(255,255,255,0.05)',
                            borderRadius: 12,
                            border: member.is_clocked_in ? '1px solid #2ed573' : '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.2s'
                        }}>
                            {/* Status dot */}
                            <span style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: member.is_clocked_in ? '#2ed573' : '#666',
                                flexShrink: 0,
                                boxShadow: member.is_clocked_in ? '0 0 8px #2ed573' : 'none'
                            }} />

                            {/* Name and time */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{member.name}</div>
                                {member.is_clocked_in && member.clocked_in_at && (
                                    <div style={{ color: '#2ed573', fontSize: '0.8rem' }}>
                                        Clocked in {formatElapsed(member.clocked_in_at)}
                                    </div>
                                )}
                            </div>

                            {/* Clock in/out button */}
                            {member.is_clocked_in ? (
                                <button
                                    onClick={() => handleClockOut(member.id)}
                                    disabled={acting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', borderRadius: 8,
                                        background: '#ff4757', color: '#fff', border: 'none',
                                        cursor: acting ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.85rem'
                                    }}
                                >
                                    <FaSignOutAlt /> Clock Out
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleClockIn(member.id)}
                                    disabled={acting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', borderRadius: 8,
                                        background: '#2ed573', color: '#000', border: 'none',
                                        cursor: acting ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.85rem'
                                    }}
                                >
                                    <FaSignInAlt /> Clock In
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {members.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
                        No team members found. Ask your host to add you.
                    </p>
                )}
            </div>
        </div>
    )
}
