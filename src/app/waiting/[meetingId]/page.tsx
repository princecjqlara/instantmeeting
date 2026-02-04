'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { Content } from '@/lib/types'
import ReelPlayer from '@/components/ReelPlayer'
import WaitingStatus from '@/components/WaitingStatus'
import styles from './page.module.css'
import { FaUser, FaArrowRight } from 'react-icons/fa'

interface WaitingPageProps {
    params: Promise<{ meetingId: string }>
}

interface WaitingData {
    meeting: {
        id: string
        title: string
        status: string
    }
    host: {
        name: string
        avatar_url: string | null
    } | null
    content: Content[]
    guest: {
        id: string
        status: string
    } | null
    meetLink: string | null
}

export default function WaitingRoom({ params }: WaitingPageProps) {
    const { meetingId } = use(params)
    const [guestName, setGuestName] = useState('')
    const [guestId, setGuestId] = useState<string | null>(null)
    const [data, setData] = useState<WaitingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [admitted, setAdmitted] = useState(false)
    const [meetLink, setMeetLink] = useState<string | null>(null)

    // Fetch waiting room data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`/api/waiting?meetingId=${meetingId}${guestId ? `&guestId=${guestId}` : ''}`)
                const result = await response.json()

                if (!response.ok) {
                    setError(result.error || 'Meeting not found')
                    return
                }

                setData(result)

                if (result.meetLink) {
                    setMeetLink(result.meetLink)
                    setAdmitted(true)
                }
            } catch {
                setError('Failed to load waiting room')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [meetingId, guestId])

    // Join waiting room
    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!guestName.trim()) return

        try {
            const response = await fetch('/api/waiting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId,
                    guestName: guestName.trim(),
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                setError(result.error)
                return
            }

            setGuestId(result.id)
        } catch {
            setError('Failed to join waiting room')
        }
    }

    const handleAdmitted = useCallback((link: string) => {
        setMeetLink(link)
        setAdmitted(true)
    }, [])

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading waiting room...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className={styles.error}>
                <h2>Oops!</h2>
                <p>{error}</p>
                <a href="/" className="button-secondary">Go Home</a>
            </div>
        )
    }

    // Name entry screen
    if (!guestId) {
        return (
            <div className={styles.nameEntry}>
                <div className={styles.card}>
                    <div className={styles.meetingInfo}>
                        <h1>{data?.meeting.title}</h1>
                        {data?.host?.name && (
                            <p>Hosted by <strong>{data.host.name}</strong></p>
                        )}
                    </div>

                    <form onSubmit={handleJoin} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <FaUser className={styles.inputIcon} />
                            <input
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Enter your name"
                                className={styles.input}
                                autoFocus
                            />
                        </div>

                        <button type="submit" className="button-primary" disabled={!guestName.trim()}>
                            Join Waiting Room
                            <FaArrowRight />
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // Waiting room with reels
    return (
        <div className={styles.container}>
            {/* Reel Player */}
            <div className={styles.reelSection}>
                <ReelPlayer
                    reels={data?.content || []}
                    hostName={data?.host?.name || undefined}
                />
            </div>

            {/* Status Overlay */}
            <div className={styles.statusOverlay}>
                <WaitingStatus
                    meetingId={meetingId}
                    guestId={guestId}
                    onAdmitted={handleAdmitted}
                />
            </div>

            {/* Admitted Modal */}
            {admitted && meetLink && (
                <div className={styles.admittedModal}>
                    <div className={styles.modalContent}>
                        <div className={styles.successIcon}>🎉</div>
                        <h2>You&apos;re In!</h2>
                        <p>The host has admitted you. Click below to join the meeting.</p>
                        <a
                            href={meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="button-primary"
                        >
                            Join Google Meet
                            <FaArrowRight />
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}
