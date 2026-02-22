'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Content } from '@/lib/types'
import ReelPlayer from '@/components/ReelPlayer'
import BookingModal from '@/components/BookingModal'
import styles from './page.module.css'
import { FaUser, FaArrowRight, FaCalendarAlt, FaArrowDown, FaArrowUp } from 'react-icons/fa'

interface WaitingPageProps {
    params: Promise<{ meetingId: string }>
}

interface WaitingData {
    meeting: {
        id: string
        title: string
        status: string
        host_joined_at?: string | null
        ended_at?: string | null
        reschedule_requested?: boolean
        reschedule_requested_at?: string | null
    }
    host: {
        id: string
        name: string
        username: string | null
        avatar_url: string | null
        bio: string | null
        availability_mode: 'always' | 'never' | 'scheduled'
        available_from: string | null
        available_to: string | null
        meeting_duration: number | null
        booking_title?: string | null
        booking_description?: string | null
        booking_note_placeholder?: string | null
        booking_form_fields?: Array<{
            id: string
            label: string
            type: 'short_text' | 'long_text' | 'multiple_choice'
            required: boolean
            options?: string[]
        }> | null
    } | null
    content: Content[]
    guest: {
        id: string
        status: 'waiting' | 'admitted' | 'left'
    } | null
    admittedGuest: {
        id: string
        guest_name: string
    } | null
    meetLink: string | null
    hostAvailable?: boolean
}

export default function WaitingRoom({ params }: WaitingPageProps) {
    const { meetingId } = use(params)
    const router = useRouter()
    const [data, setData] = useState<WaitingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showScrollIndicator, setShowScrollIndicator] = useState(false)
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [showAdmitPopup, setShowAdmitPopup] = useState(false)
    const [showSchedulePopup, setShowSchedulePopup] = useState(false)
    const hasAutoJoinedRef = useRef(false)
    const lastGuestStatusRef = useRef<string | null>(null)
    const joinSectionRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isCreatingGuestRef = useRef(false)



    // Fetch waiting room data
    useEffect(() => {
        console.log('Fetching waiting room data for meeting:', meetingId)

        let isMounted = true
        let intervalId: ReturnType<typeof setInterval> | null = null
        const guestStorageKey = `waitingGuest:${meetingId}`

        const getStoredGuestId = () => {
            try {
                const stored = localStorage.getItem(guestStorageKey)
                return stored
            } catch (error) {
                return null
            }
        }

        const createGuest = async () => {
            if (isCreatingGuestRef.current) return

            isCreatingGuestRef.current = true
            try {
                const createRes = await fetch('/api/waiting', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        meetingId,
                        guestName: 'Guest'
                    })
                })

                if (createRes.ok) {
                    const created = await createRes.json()

                    try {
                        localStorage.setItem(guestStorageKey, created.id)
                    } catch (error) {
                        // Silently fail on localStorage errors
                    }
                    if (isMounted) {
                        setData(prev => prev ? {
                            ...prev,
                            guest: { id: created.id, status: created.status }
                        } : prev)
                    }
                } else {
                    const errorData = await createRes.json()
                    if (isMounted) {
                        setError(errorData.message || 'Unable to join waiting room')
                    }
                }
            } catch {
                if (isMounted) {
                    setError('Failed to join waiting room')
                }
            } finally {
                isCreatingGuestRef.current = false
            }
        }

        const fetchData = async (guestIdParam?: string | null, isInitial = false) => {
            try {
                const guestQuery = guestIdParam ? `&guestId=${guestIdParam}` : ''
                const url = `/api/waiting?meetingId=${meetingId}${guestQuery}`
                console.log('Fetching waiting data from:', url)
                const response = await fetch(url)
                const result = await response.json()

                if (!response.ok) {
                    console.error('API error:', result.error)
                    setError(result.error || 'Meeting not found')
                    return
                }

                console.log('Waiting data received:', result)
                if (isMounted) {
                    setData(result)
                    setLoading(false)
                }

                // Create guest if needed in parallel, don't block UI
                if (!guestIdParam && !result.guest && result.meeting?.status !== 'completed') {
                    createGuest()
                }

                // Stop polling if guest is admitted or meeting ended
                if (result.guest?.status === 'admitted' || result.meeting?.status === 'completed') {
                    if (intervalId) {
                        clearInterval(intervalId)
                        intervalId = null
                    }
                }
            } catch (error) {
                console.error('Error fetching waiting room data:', error)
                if (isMounted) {
                    setError('Failed to load waiting room')
                    setLoading(false)
                }
            }
        }

        const storedGuestId = getStoredGuestId()
        fetchData(storedGuestId, true)

        // Only poll if guest is waiting or we don't have guest data yet
        const startPolling = () => {
            if (intervalId) return

            intervalId = setInterval(() => {
                const currentGuestId = getStoredGuestId()
                fetchData(currentGuestId, false)
            }, 15000)
        }

        // Start polling after initial load
        setTimeout(startPolling, 1000)

        return () => {
            isMounted = false
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [meetingId])

    useEffect(() => {
        if (data?.meeting?.reschedule_requested) {
            setShowBookingModal(true)
        }
    }, [data?.meeting?.reschedule_requested])

    useEffect(() => {
        const currentStatus = data?.guest?.status || null
        const previousStatus = lastGuestStatusRef.current
        if (currentStatus === 'admitted' && previousStatus !== 'admitted') {
            setShowAdmitPopup(true)
        }
        lastGuestStatusRef.current = currentStatus
    }, [data?.guest?.status])

    useEffect(() => {
        const canAutoJoin = Boolean(
            data?.guest?.status === 'admitted' &&
            data?.meetLink &&
            data?.meeting?.host_joined_at &&
            data?.meeting?.status !== 'completed'
        )

        if (canAutoJoin && data?.meetLink && !hasAutoJoinedRef.current) {
            hasAutoJoinedRef.current = true
            window.location.assign(data.meetLink)
        }

        const handleScroll = () => {
            if (!containerRef.current) return
            const scrollTop = containerRef.current.scrollTop
            const windowHeight = window.innerHeight
            setShowScrollIndicator(scrollTop < windowHeight / 2)
        }

        const container = containerRef.current
        if (container) {
            container.addEventListener('scroll', handleScroll)
            handleScroll()
        }

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll)
            }
        }
    }, [data])

    // Show schedule popup when host is unavailable and user hasn't seen it yet
    useEffect(() => {
        const isHostFree = data?.host?.availability_mode === 'always'
        const isAdmitted = data?.guest?.status === 'admitted'
        if (data && !isHostFree && !isAdmitted && !showSchedulePopup) {
            const timer = setTimeout(() => {
                setShowSchedulePopup(true)
            }, 1000) // Show after 1 second
            return () => clearTimeout(timer)
        }
    }, [data, showSchedulePopup])

    // Mark guest as 'left' when they navigate away
    useEffect(() => {
        const guestStorageKey = `waitingGuest:${meetingId}`

        const markAsLeft = () => {
            try {
                const guestId = localStorage.getItem(guestStorageKey)
                if (!guestId) return
                // Use fetch with keepalive for reliability during page unload
                fetch('/api/waiting', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guestId, status: 'left' }),
                    keepalive: true
                }).catch(() => { })
            } catch { }
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                markAsLeft()
            }
        }

        window.addEventListener('pagehide', markAsLeft)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.removeEventListener('pagehide', markAsLeft)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [meetingId])

    if (loading && !data) {
        return (
            <div className={styles.container}>
                {/* Skeleton loading UI */}
                <div className={styles.reelSection}>
                    <div className={styles.skeletonReel}></div>
                    <div className={styles.skeletonBanner}></div>
                </div>
                <div className={styles.skeletonHostProfile}>
                    <div className={styles.skeletonAvatar}></div>
                    <div className={styles.skeletonHostInfo}>
                        <div className={styles.skeletonText}></div>
                        <div className={styles.skeletonTextSmall}></div>
                    </div>
                </div>
                <div className={styles.joinSection}>
                    <div className={styles.skeletonCard}>
                        <div className={styles.skeletonIcon}></div>
                        <div className={styles.skeletonTitle}></div>
                        <div className={styles.skeletonDescription}></div>
                        <div className={styles.skeletonButton}></div>
                    </div>
                </div>
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

    const scrollToSchedule = () => {
        if (joinSectionRef.current) {
            joinSectionRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }

    const scrollToReels = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const meetLink = data?.meetLink || null
    const isAdmitted = data?.guest?.status === 'admitted'
    const isWaiting = data?.guest?.status === 'waiting'
    const rescheduleRequested = Boolean(data?.meeting?.reschedule_requested)
    const canJoin = Boolean(
        isAdmitted &&
        meetLink &&
        data?.meeting?.host_joined_at &&
        data?.meeting?.status !== 'completed' &&
        !rescheduleRequested
    )
    const isHostFree = data?.host?.availability_mode === 'always'
    const meetingEnded = data?.meeting?.status === 'completed'
    const hostDisplayName = data?.host?.name || 'the host'

    // Waiting room with reels
    return (
        <div ref={containerRef} className={styles.container}>
            {/* Reel Player */}
            <div className={styles.reelSection}>
                <ReelPlayer
                    reels={data?.content || []}
                    hostName={data?.host?.name || undefined}
                    hostUsername={data?.host?.username || undefined}
                    hostAvatar={data?.host?.avatar_url}
                    hostSettings={data?.host || undefined}
                    guestStatus={data?.guest?.status}
                    onEndReached={() => {
                        if (canJoin && meetLink && !hasAutoJoinedRef.current) {
                            hasAutoJoinedRef.current = true
                            window.location.assign(meetLink)
                        }
                    }}
                />
                {!meetingEnded && isWaiting && !canJoin && !rescheduleRequested && (
                    <div className={styles.waitBanner}>
                        <span>Waiting for {hostDisplayName} to admit you</span>
                    </div>
                )}
                {!meetingEnded && isWaiting && !canJoin && !rescheduleRequested && (
                    <div className={styles.waitBanner}>
                        <span>Waiting for {hostDisplayName} to admit you</span>
                    </div>
                )}
                {rescheduleRequested && (
                    <div className={styles.waitBanner}>
                        <span>{hostDisplayName} requested a new time</span>
                    </div>
                )}
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
                {meetingEnded ? (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaUser />
                        </div>
                        <h2>Meeting ended</h2>
                        <p>This meeting has ended. Please contact the host.</p>
                    </div>
                ) : canJoin ? (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaArrowDown />
                        </div>
                        <h2>Scroll down to join</h2>
                        <p>Keep scrolling to open the meeting, or tap Join.</p>
                        <button
                            type="button"
                            className="button-primary"
                            onClick={() => {
                                if (meetLink) window.open(meetLink, '_blank')
                            }}
                        >
                            Join Meeting
                        </button>
                    </div>
                ) : isAdmitted ? (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaUser />
                        </div>
                        <h2>Waiting for host</h2>
                        <p>The host hasn't joined yet. You'll be able to join once they do.</p>
                    </div>
                ) : isHostFree ? (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaUser />
                        </div>
                        <h2>Host is available</h2>
                        <p>Please wait for {hostDisplayName} to admit you.</p>
                    </div>
                ) : (
                    <div className={styles.scheduleCard}>
                        <div className={styles.scheduleIcon}>
                            <FaCalendarAlt />
                        </div>
                        <h2>{data?.host?.booking_title || 'Schedule a Meeting'}</h2>
                        <p>{data?.host?.booking_description || "Can't wait? Request a time that works for you."}</p>
                        <button
                            type="button"
                            className="button-primary"
                            onClick={() => setShowBookingModal(true)}
                        >
                            Request Meeting
                            <FaArrowRight />
                        </button>
                    </div>
                )}
            </div>

            {/* Removed scroll indicators per request */}

            {showBookingModal && data?.host && (
                <BookingModal
                    host={data.host}
                    onClose={() => setShowBookingModal(false)}
                    meetingId={data?.meeting?.id}
                    guestId={data?.guest?.id}
                    mode={rescheduleRequested ? 'reschedule' : 'new'}
                    onSuccess={() => {
                        // Mark the guest as 'left' after booking form is submitted
                        const guestStorageKey = `waitingGuest:${meetingId}`
                        const storedGuestId = localStorage.getItem(guestStorageKey)
                        if (storedGuestId) {
                            fetch('/api/waiting', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ guestId: storedGuestId, status: 'left' })
                            }).catch(() => { })
                        }
                        setShowBookingModal(false)
                    }}
                />
            )}

            {showAdmitPopup && (
                <div className={styles.admitOverlay}>
                    <div className={styles.admitModal}>
                        <h2>You're admitted</h2>
                        {canJoin ? (
                            <p>Scroll down to join the meeting now.</p>
                        ) : meetingEnded ? (
                            <p>This meeting has ended.</p>
                        ) : (
                            <p>The host will start the meeting soon.</p>
                        )}
                        <div className={styles.admitActions}>
                            {canJoin && meetLink ? (
                                <button
                                    type="button"
                                    className={styles.admitPrimary}
                                    onClick={() => window.location.assign(meetLink)}
                                >
                                    Join now
                                </button>
                            ) : (
                                <div className={styles.admitWaiting}>
                                    <div className={styles.admitSpinner} />
                                    <span>Waiting for {hostDisplayName} to join...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Popup - shown when host is unavailable */}
            {showSchedulePopup && !isHostFree && !isAdmitted && (
                <div className={styles.admitOverlay}>
                    <div className={styles.admitModal}>
                        <h2>Host is Busy</h2>
                        <p>{hostDisplayName} isn't available right now. Would you like to schedule a meeting for later?</p>
                        <div className={styles.admitActions}>
                            <button
                                type="button"
                                className={styles.admitPrimary}
                                onClick={() => {
                                    setShowSchedulePopup(false)
                                    setShowBookingModal(true)
                                }}
                            >
                                Schedule Meeting
                            </button>
                            <button
                                type="button"
                                className={styles.admitSecondary}
                                onClick={() => setShowSchedulePopup(false)}
                            >
                                Continue Waiting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
