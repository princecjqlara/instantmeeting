'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Content } from '@/lib/types'
import {
    canGuestJoinRoom,
    isHostCurrentlyAvailable,
    shouldAutoOpenBookingModal,
    shouldShowBookingCallToAction,
    shouldStopWaitingRoomPolling,
} from '@/lib/waiting-room-state'
import ReelPlayer from '@/components/ReelPlayer'
import BookingModal from '@/components/BookingModal'
import styles from './page.module.css'
import { FaUser, FaArrowRight, FaCalendarAlt, FaArrowDown, FaMicrophone } from 'react-icons/fa'
import InAppBrowserGate from '@/components/InAppBrowserGate'
import {
    buildGuestWaitingPath,
    buildGuestRoomPath,
    consumeExternalBrowserHandoff,
    getGuestNameFromSearch,
    markExternalBrowserHandoff,
} from '@/lib/external-browser-handoff'

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
        assigned_member_id?: string | null
    }
    host: {
        id: string
        name: string
        username: string | null
        avatar_url: string | null
        bio: string | null
        availability_mode: 'always' | 'never' | 'scheduled'
        auto_admit?: boolean
        available_from: string | null
        available_to: string | null
        timezone?: string | null
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
        welcome_audio_url?: string | null
    } | null
    autoScheduleRequired?: boolean
    autoScheduleReason?: 'no_online_members' | 'all_members_busy' | null
    content: Content[]
    guest: {
        id: string
        status: 'waiting' | 'admitted' | 'left'
    } | null
    admittedGuest: {
        id: string
        guest_name: string
    } | null
    meetLink: string | null  // Now stores in-app room link (/room/{meetingId})
    hostAvailable?: boolean
    assignedMember?: {
        id: string
        name: string
        avatar_url: string | null
        welcome_audio_url: string | null
    } | null
}

const openRoomInNewTab = (roomPath: string, existingTab?: Window | null) => {
    const meetingTab = existingTab && !existingTab.closed
        ? existingTab
        : window.open('', '_blank')
    if (!meetingTab) {
        return false
    }

    try {
        meetingTab.opener = null
    } catch {
        // Ignore browsers that block setting opener
    }

    meetingTab.location.href = roomPath
    meetingTab.focus()
    return true
}

const prepareMeetingTab = () => {
    const meetingTab = window.open('', '_blank')
    if (!meetingTab) {
        return null
    }

    try {
        meetingTab.opener = null
    } catch {
        // Ignore browsers that block setting opener
    }

    meetingTab.document.write(`<!doctype html><html><head><title>Meeting Ready</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;"><div><h1 style="margin:0 0 12px;font-size:28px;">Meeting Ready</h1><p style="margin:0;font-size:16px;line-height:1.5;max-width:320px;">Stay on the waiting room tab. Your meeting will open here as soon as you are admitted.</p></div></body></html>`)
    meetingTab.document.close()
    return meetingTab
}

export default function WaitingRoom({ params }: WaitingPageProps) {
    const { meetingId } = use(params)
    const router = useRouter()
    const searchParams = useSearchParams()
    const [data, setData] = useState<WaitingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [showAdmitPopup, setShowAdmitPopup] = useState(false)
    const hasAutoJoinedRef = useRef(false)
    const hasAutoOpenedBookingRef = useRef(false)
    const lastGuestStatusRef = useRef<string | null>(null)
    const joinSectionRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isCreatingGuestRef = useRef(false)
    const welcomeAudioRef = useRef<HTMLAudioElement | null>(null)
    const [welcomeAudioPlaying, setWelcomeAudioPlaying] = useState(false)
    const hasPlayedWelcomeRef = useRef(false)
    const preparedMeetingTabRef = useRef<Window | null>(null)
    const guestIdFromQuery = searchParams.get('guestId')?.trim() || null
    const guestNameFromQuery = getGuestNameFromSearch(searchParams)
    const guestNameForRoom = guestNameFromQuery || 'Guest'



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
                        guestName: guestNameFromQuery || 'Guest'
                    })
                })

                if (createRes.ok) {
                    const created = await createRes.json()
                    const waitingPath = buildGuestWaitingPath(meetingId, created.id, guestNameFromQuery || 'Guest')

                    try {
                        localStorage.setItem(guestStorageKey, created.id)
                    } catch (error) {
                        // Silently fail on localStorage errors
                    }

                    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== waitingPath) {
                        window.history.replaceState(null, '', waitingPath)
                    }

                    if (isMounted) {
                        setData(prev => prev ? {
                            ...prev,
                            guest: { id: created.id, status: created.status },
                            meetLink: created.join_token
                                ? `${window.location.origin}/api/join/${created.join_token}`
                                : prev.meetLink,
                            assignedMember: created.assigned_member || prev.assignedMember,
                            autoScheduleRequired: Boolean(created.autoScheduleRequired),
                            autoScheduleReason: created.autoScheduleReason || null,
                        } : prev)

                        if (created.autoScheduleRequired && !hasAutoOpenedBookingRef.current) {
                            hasAutoOpenedBookingRef.current = true
                            setShowBookingModal(true)
                        }
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
                    if (isMounted) {
                        setError(result.error || 'Meeting not found')
                        setLoading(false)
                    }
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

                if (
                    shouldStopWaitingRoomPolling({
                        meetingStatus: result.meeting?.status,
                        guestStatus: result.guest?.status,
                        hostJoinedAt: result.meeting?.host_joined_at,
                        rescheduleRequested: result.meeting?.reschedule_requested,
                    })
                ) {
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

        const storedGuestId = guestIdFromQuery || getStoredGuestId()
        fetchData(storedGuestId, true)

        // Only poll if guest is waiting or we don't have guest data yet
        const startPolling = () => {
            if (intervalId) return

            intervalId = setInterval(() => {
                const currentGuestId = guestIdFromQuery || getStoredGuestId()
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
    }, [guestIdFromQuery, guestNameFromQuery, meetingId])

    useEffect(() => {
        const guestStorageKey = `waitingGuest:${meetingId}`

        try {
            if (guestIdFromQuery) {
                localStorage.setItem(guestStorageKey, guestIdFromQuery)
            }

            if (guestNameFromQuery) {
                localStorage.setItem(`guestName:${meetingId}`, guestNameFromQuery)
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [guestIdFromQuery, guestNameFromQuery, meetingId])

    useEffect(() => {
        if (typeof window === 'undefined' || !data?.guest?.id) {
            return
        }

        const waitingPath = buildGuestWaitingPath(meetingId, data.guest.id, guestNameForRoom)
        const currentPath = `${window.location.pathname}${window.location.search}`

        if (currentPath !== waitingPath) {
            window.history.replaceState(null, '', waitingPath)
        }
    }, [data?.guest?.id, guestNameForRoom, meetingId])

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
        const canAutoJoin = canGuestJoinRoom({
            guestStatus: data?.guest?.status,
            hostJoinedAt: data?.meeting?.host_joined_at,
            meetingStatus: data?.meeting?.status,
            rescheduleRequested: data?.meeting?.reschedule_requested,
        })

        // Auto-join: navigate to in-app video room instead of external Google Meet
        if (canAutoJoin && !hasAutoJoinedRef.current) {
            hasAutoJoinedRef.current = true
            // Store guest name for the video room page to use
            try { localStorage.setItem(`guestName:${meetingId}`, guestNameForRoom) } catch { }
            const roomPath = buildGuestRoomPath(meetingId, guestNameForRoom)
            const preparedMeetingTab = preparedMeetingTabRef.current
            preparedMeetingTabRef.current = null
            if (!openRoomInNewTab(roomPath, preparedMeetingTab)) {
                router.push(roomPath)
            }
        }
    }, [data, guestNameForRoom, meetingId, router])

    useEffect(() => {
        if (
            canGuestJoinRoom({
                guestStatus: data?.guest?.status,
                hostJoinedAt: data?.meeting?.host_joined_at,
                meetingStatus: data?.meeting?.status,
                rescheduleRequested: data?.meeting?.reschedule_requested,
            }) ||
            data?.meeting?.status === 'completed' ||
            data?.meeting?.reschedule_requested
        ) {
            return
        }

        const primeMeetingTab = () => {
            if (preparedMeetingTabRef.current && !preparedMeetingTabRef.current.closed) {
                return
            }

            preparedMeetingTabRef.current = prepareMeetingTab()
        }

        window.addEventListener('pointerdown', primeMeetingTab, { once: true })
        window.addEventListener('keydown', primeMeetingTab, { once: true })

        return () => {
            window.removeEventListener('pointerdown', primeMeetingTab)
            window.removeEventListener('keydown', primeMeetingTab)
        }
    }, [
        data?.guest?.status,
        data?.meeting?.host_joined_at,
        data?.meeting?.status,
        data?.meeting?.reschedule_requested,
    ])

    useEffect(() => {
        const shouldAutoOpenBooking = shouldAutoOpenBookingModal({
            guestStatus: data?.guest?.status,
            meetingStatus: data?.meeting?.status,
            autoScheduleRequired: data?.autoScheduleRequired,
            availabilityMode: data?.host?.availability_mode,
            availableFrom: data?.host?.available_from,
            availableTo: data?.host?.available_to,
            timezone: data?.host?.timezone,
        })

        if (shouldAutoOpenBooking && !hasAutoOpenedBookingRef.current) {
            hasAutoOpenedBookingRef.current = true
            setShowBookingModal(true)
        }
    }, [
        data?.guest?.status,
        data?.meeting?.status,
        data?.autoScheduleRequired,
        data?.host?.availability_mode,
        data?.host?.available_from,
        data?.host?.available_to,
        data?.host?.timezone,
    ])

    // Auto-play welcome audio when guest enters
    // Prefer assigned member's audio, fallback to host's
    useEffect(() => {
        const audioUrl = data?.assignedMember?.welcome_audio_url || data?.host?.welcome_audio_url
        if (!audioUrl || hasPlayedWelcomeRef.current) return

        hasPlayedWelcomeRef.current = true
        const audio = new Audio(audioUrl)
        welcomeAudioRef.current = audio

        audio.addEventListener('playing', () => setWelcomeAudioPlaying(true))
        audio.addEventListener('ended', () => setWelcomeAudioPlaying(false))
        audio.addEventListener('pause', () => setWelcomeAudioPlaying(false))
        audio.addEventListener('error', () => setWelcomeAudioPlaying(false))

        // Try autoplay; if blocked, user interaction will be needed
        audio.play().catch(() => {
            // Autoplay blocked — try playing on first user interaction
            const playOnInteraction = () => {
                audio.play().catch(() => { })
                document.removeEventListener('click', playOnInteraction)
                document.removeEventListener('touchstart', playOnInteraction)
            }
            document.addEventListener('click', playOnInteraction, { once: true })
            document.addEventListener('touchstart', playOnInteraction, { once: true })
        })

        return () => {
            audio.pause()
            audio.src = ''
            welcomeAudioRef.current = null
        }
    }, [data?.assignedMember?.welcome_audio_url, data?.host?.welcome_audio_url])

    // Mark guest as 'left' when they navigate away
    useEffect(() => {
        const guestStorageKey = `waitingGuest:${meetingId}`

        const markAsLeft = () => {
            try {
                const guestId = localStorage.getItem(guestStorageKey)
                if (!guestId) return
                if (consumeExternalBrowserHandoff(window.location.pathname, window.sessionStorage)) {
                    return
                }
                // Use fetch with keepalive for reliability during page unload
                fetch('/api/waiting', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guestId, status: 'left' }),
                    keepalive: true
                }).catch(() => { })
            } catch { }
        }

        // Only mark guest as 'left' on actual navigation away (pagehide).
        // Do NOT use visibilitychange — that fires when the user simply switches
        // tabs, which would remove the guest from the host's dashboard.
        window.addEventListener('pagehide', markAsLeft)

        return () => {
            window.removeEventListener('pagehide', markAsLeft)
        }
    }, [meetingId])

    if (loading && !data) {
        return (
            <InAppBrowserGate>
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
            </InAppBrowserGate>
        )
    }

    if (error) {
        return (
            <InAppBrowserGate>
            <div className={styles.error}>
                <h2>Oops!</h2>
                <p>{error}</p>
                <a href="/" className="button-secondary">Go Home</a>
            </div>
            </InAppBrowserGate>
        )
    }

    const roomLink = data?.meetLink || buildGuestRoomPath(meetingId, guestNameForRoom)
    const isAdmitted = data?.guest?.status === 'admitted'
    const isWaiting = data?.guest?.status === 'waiting'
    const rescheduleRequested = Boolean(data?.meeting?.reschedule_requested)
    const canJoin = Boolean(
        canGuestJoinRoom({
            guestStatus: data?.guest?.status,
            hostJoinedAt: data?.meeting?.host_joined_at,
            meetingStatus: data?.meeting?.status,
            rescheduleRequested: data?.meeting?.reschedule_requested,
        })
    )
    const isHostFree = isHostCurrentlyAvailable({
        availabilityMode: data?.host?.availability_mode,
        availableFrom: data?.host?.available_from,
        availableTo: data?.host?.available_to,
        timezone: data?.host?.timezone,
    })
    const meetingEnded = data?.meeting?.status === 'completed'
    const hostDisplayName = data?.host?.name || 'the host'
    const shouldAutoSchedule = shouldShowBookingCallToAction({
        autoScheduleRequired: data?.autoScheduleRequired,
        availabilityMode: data?.host?.availability_mode,
        availableFrom: data?.host?.available_from,
        availableTo: data?.host?.available_to,
        timezone: data?.host?.timezone,
    })
    const autoScheduleMessage = data?.autoScheduleReason === 'all_members_busy'
        ? 'All team members are currently in active meetings. Please request a time and we will follow up shortly.'
        : 'No team member is online right now. Please request a time and we will follow up shortly.'
    const showAssignmentBanner = Boolean(
        data?.host?.auto_admit &&
        data?.assignedMember &&
        (isWaiting || isAdmitted)
    )

    // Waiting room with reels
    return (
        <InAppBrowserGate>
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
                    disableBookingTriggerOnScroll
                    onEndReached={() => {
                        if (canJoin && !hasAutoJoinedRef.current) {
                            hasAutoJoinedRef.current = true
                            try { localStorage.setItem(`guestName:${meetingId}`, guestNameForRoom) } catch { }
                            try { markExternalBrowserHandoff(window.location.pathname, window.sessionStorage) } catch { }
                            const preparedMeetingTab = preparedMeetingTabRef.current
                            preparedMeetingTabRef.current = null
                            if (!openRoomInNewTab(roomLink, preparedMeetingTab)) {
                                router.push(roomLink)
                            }
                        }
                    }}
                />
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
                {showAssignmentBanner && (
                    <div className={styles.assignmentBanner}>
                        <span>Auto-assigned to {data?.assignedMember?.name}</span>
                    </div>
                )}
                {welcomeAudioPlaying && (
                    <div className={styles.waitBanner} style={{ background: 'linear-gradient(135deg, rgba(255,71,87,0.9), rgba(255,107,129,0.9))' }}>
                        <FaMicrophone style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                        <span>{data?.assignedMember?.name || hostDisplayName} is speaking...</span>
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
                                hasAutoJoinedRef.current = true
                                try { localStorage.setItem(`guestName:${meetingId}`, guestNameForRoom) } catch { }
                                try { markExternalBrowserHandoff(window.location.pathname, window.sessionStorage) } catch { }
                                const preparedMeetingTab = preparedMeetingTabRef.current
                                preparedMeetingTabRef.current = null
                                if (!openRoomInNewTab(roomLink, preparedMeetingTab)) {
                                    router.push(roomLink)
                                }
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
                ) : shouldAutoSchedule || !isHostFree ? (
                    <div className={styles.scheduleCard}>
                        <div className={styles.scheduleIcon}>
                            <FaCalendarAlt />
                        </div>
                        <h2>{data?.host?.booking_title || 'Schedule a Meeting'}</h2>
                        <p>
                            {shouldAutoSchedule
                                ? autoScheduleMessage
                                : (data?.host?.booking_description || "Can't wait? Request a time that works for you.")}
                        </p>
                        <button
                            type="button"
                            className="button-primary"
                            onClick={() => setShowBookingModal(true)}
                        >
                            {shouldAutoSchedule ? 'Open Booking Form' : 'Request Meeting'}
                            <FaArrowRight />
                        </button>
                    </div>
                ) : (
                    <div className={styles.joinCard}>
                        <div className={styles.joinIcon}>
                            <FaUser />
                        </div>
                        <h2>Host is available</h2>
                        <p>Please wait for {hostDisplayName} to admit you.</p>
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
                        ) : data?.assignedMember?.name ? (
                            <p>You were matched with {data.assignedMember.name}. Waiting for them to start.</p>
                        ) : (
                            <p>The host will start the meeting soon.</p>
                        )}
                        <div className={styles.admitActions}>
                            {canJoin ? (
                                <button
                                    type="button"
                                    className={styles.admitPrimary}
                                    onClick={() => {
                                        hasAutoJoinedRef.current = true
                                        try { localStorage.setItem(`guestName:${meetingId}`, guestNameForRoom) } catch { }
                                        try { markExternalBrowserHandoff(window.location.pathname, window.sessionStorage) } catch { }
                                        const preparedMeetingTab = preparedMeetingTabRef.current
                                        preparedMeetingTabRef.current = null
                                        if (!openRoomInNewTab(roomLink, preparedMeetingTab)) {
                                            router.push(roomLink)
                                        }
                                    }}
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

        </div>
        </InAppBrowserGate>
    )
}
