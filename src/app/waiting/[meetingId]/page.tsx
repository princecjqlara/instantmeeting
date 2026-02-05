'use client'

import { useState, useEffect, use, useRef } from 'react'
import { Content } from '@/lib/types'
import ReelPlayer from '@/components/ReelPlayer'
import styles from './page.module.css'
import { FaUser, FaArrowRight, FaCalendarAlt } from 'react-icons/fa'

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
    const [data, setData] = useState<WaitingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const joinSectionRef = useRef<HTMLDivElement>(null)

    // Fetch waiting room data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`/api/waiting?meetingId=${meetingId}`)
                const result = await response.json()

                if (!response.ok) {
                    setError(result.error || 'Meeting not found')
                    return
                }

                setData(result)
            } catch {
                setError('Failed to load waiting room')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [meetingId])

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

    // Waiting room with reels
    return (
        <div className={styles.container}>
            {/* Reel Player */}
            <div className={styles.reelSection}>
                <ReelPlayer
                    reels={data?.content || []}
                    hostName={data?.host?.name || undefined}
                    hostUsername={data?.host?.username || undefined}
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

            {/* Schedule Section - Below the fold */}
            <div ref={joinSectionRef} className={styles.joinSection}>
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
            </div>
        </div>
    )
}
