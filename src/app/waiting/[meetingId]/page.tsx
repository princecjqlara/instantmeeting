'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import { Content } from '@/lib/types'
import ReelPlayer from '@/components/ReelPlayer'
import WaitingStatus from '@/components/WaitingStatus'
import styles from './page.module.css'
import { FaUser, FaArrowRight, FaVideo, FaCalendarAlt, FaPlay } from 'react-icons/fa'

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
        username: string | null
        avatar_url: string | null
        bio: string | null
    } | null
    content: Content[]
    guest: {
        id: string
        status: string
    } | null
    meetLink: string | null
    hostAvailable?: boolean
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
    const [browsingAnonymously, setBrowsingAnonymously] = useState(false)
    const [showNameModal, setShowNameModal] = useState(false)
    const joinSectionRef = useRef<HTMLDivElement>(null)

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

    // Join waiting room with name
    const handleJoin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
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
            setShowNameModal(false)
        } catch {
            setError('Failed to join waiting room')
        }
    }

    // Browse anonymously
    const handleBrowseAnonymously = () => {
        setBrowsingAnonymously(true)
    }

    const handleAdmitted = useCallback((link: string) => {
        setMeetLink(link)
        setAdmitted(true)
        setTimeout(() => {
            joinSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 500)
    }, [])

    const scrollToJoinSection = useCallback(() => {
        joinSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
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

    // Name entry screen - only if not browsing anonymously and not joined
    if (!guestId && !browsingAnonymously) {
        return (
            <div className={styles.nameEntry}>
                <div className={styles.card}>
                    <div className={styles.meetingInfo}>
                        <h1>{data?.meeting.title}</h1>
                        {data?.host?.name && (
                            <p>Hosted by <strong>{data.host.name}</strong></p>
                        )}
                    </div>

                    <div className={styles.options}>
                        <button 
                            onClick={handleBrowseAnonymously}
                            className={styles.browseBtn}
                        >
                            <FaPlay />
                            Browse Anonymously
                            <span>Watch content without joining</span>
                        </button>

                        <div className={styles.divider}>
                            <span>or</span>
                        </div>

                        <form onSubmit={handleJoin} className={styles.form}>
                            <div className={styles.inputGroup}>
                                <FaUser className={styles.inputIcon} />
                                <input
                                    type="text"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                    placeholder="Enter your name to join"
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
                    hostAvatar={data?.host?.avatar_url}
                />
            </div>

            {/* Host Profile Overlay */}
            {data?.host && (
                <div className={styles.hostProfile}>
                    <div className={styles.hostAvatar}>
                        {data.host.avatar_url ? (
                            <img src={data.host.avatar_url} alt={data.host.name} />
                        ) : (
                            <FaUser />
                        )}
                    </div>
                    <div className={styles.hostInfo}>
                        <span className={styles.hostName}>{data.host.name}</span>
                        {data.host.username && (
                            <span className={styles.hostUsername}>@{data.host.username}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Status Overlay */}
            <div className={styles.statusOverlay}>
                {browsingAnonymously ? (
                    <div className={styles.anonymousBanner}>
                        <span>Browsing anonymously</span>
                        <button onClick={() => setShowNameModal(true)} className={styles.joinBtnSmall}>
                            Join Meeting
                        </button>
                    </div>
                ) : (
                    <WaitingStatus
                        meetingId={meetingId}
                        guestId={guestId!}
                        onAdmitted={handleAdmitted}
                        hostAvailable={data?.hostAvailable !== false}
                        onScrollToSchedule={scrollToJoinSection}
                    />
                )}
            </div>

            {/* Join/Schedule Section - Below the fold */}
            <div ref={joinSectionRef} className={styles.joinSection}>
                {admitted && meetLink ? (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaVideo />
                        </div>
                        <h2>Ready to Join!</h2>
                        <p>The host has admitted you to the meeting.</p>
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
                ) : browsingAnonymously ? (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaVideo />
                        </div>
                        <h2>Want to Join?</h2>
                        <p>Enter your name to join the meeting queue.</p>
                        <button 
                            onClick={() => setShowNameModal(true)}
                            className="button-primary"
                        >
                            Enter Name to Join
                            <FaArrowRight />
                        </button>
                    </div>
                ) : (
                    <div className={styles.scheduleCard}>
                        <div className={styles.scheduleIcon}>
                            <FaCalendarAlt />
                        </div>
                        <h2>Schedule a Meeting</h2>
                        <p>Can't wait? Schedule a meeting for later.</p>
                        <form className={styles.scheduleForm} onSubmit={(e) => e.preventDefault()}>
                            <div className={styles.formRow}>
                                <input
                                    type="date"
                                    className={styles.formInput}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <input
                                    type="time"
                                    className={styles.formInput}
                                    defaultValue="10:00"
                                />
                            </div>
                            <textarea
                                className={styles.formTextarea}
                                placeholder="What would you like to discuss? (optional)"
                                rows={3}
                            />
                            <button type="submit" className="button-primary">
                                Request Meeting
                                <FaArrowRight />
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Name Modal for anonymous browsers */}
            {showNameModal && (
                <div className={styles.modal} onClick={() => setShowNameModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>Enter your name to join</h3>
                        <div className={styles.inputGroup}>
                            <FaUser className={styles.inputIcon} />
                            <input
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Your name"
                                className={styles.input}
                                autoFocus
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowNameModal(false)} className="button-secondary">
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleJoin()} 
                                className="button-primary"
                                disabled={!guestName.trim()}
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
