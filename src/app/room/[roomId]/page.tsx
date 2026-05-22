/**
 * Video Room Page — /room/[roomId]
 * 
 * This is where the actual video call happens.
 * Users arrive here after being admitted from the waiting room.
 * 
 * Flow:
 * 1. If user is authenticated (host), use their name automatically
 * 2. If guest, check localStorage for their guest name
 * 3. Otherwise, prompt for a display name
 * 4. Render the VideoChat component which handles all WebRTC logic
 */

'use client'

import { useState, use, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import VideoChat from '@/components/VideoChat'
import GuestInfoPanel from '@/components/GuestInfoPanel'
import { FaVideo, FaArrowRight, FaDoorOpen } from 'react-icons/fa'
import GuestExternalBrowserAssist from '@/components/GuestExternalBrowserAssist'
import { consumeExternalBrowserHandoff, getGuestNameFromSearch } from '@/lib/external-browser-handoff'
import { shouldHostAutoEndMeetingWhenEmpty } from '@/lib/meeting-presence'
import styles from './page.module.css'

type QualifiedGuestMediaMode = 'audio_video' | 'audio_only' | 'video_only' | 'none' | 'muted_audio_video'

interface RoomPageProps {
    params: Promise<{ roomId: string }>
}

function normalizeGuestMediaMode(value: string | null): QualifiedGuestMediaMode {
    if (!value) return 'muted_audio_video'

    return (
        value === 'audio_video' ||
        value === 'audio_only' ||
        value === 'video_only' ||
        value === 'none'
    )
        ? value
        : 'muted_audio_video'
}

export default function RoomPage({ params }: RoomPageProps) {
    const { roomId } = use(params)
    const { data: session } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const hasMarkedHostJoinedRef = useRef(false)
    const guestNameFromQuery = getGuestNameFromSearch(searchParams)
    const guestIdFromQuery = searchParams.get('guestId')?.trim() || null
    const guestMediaMode = normalizeGuestMediaMode(searchParams.get('media'))
    const hostAutoEndRequestedRef = useRef(false)

    // Determine the user's display name
    const [displayName, setDisplayName] = useState<string>('')
    const [nameInput, setNameInput] = useState('')
    const [hasJoined, setHasJoined] = useState(false)
    const [meetingEndedExternally, setMeetingEndedExternally] = useState(false)

    const getStoredGuestId = useCallback(() => {
        if (guestIdFromQuery) {
            return guestIdFromQuery
        }

        try {
            const storedGuestId = localStorage.getItem(`waitingGuest:${roomId}`)?.trim()
            return storedGuestId || null
        } catch {
            return null
        }
    }, [guestIdFromQuery, roomId])

    const markGuestLeft = useCallback((reason: 'manual' | 'pagehide' = 'manual') => {
        if (session?.user || typeof window === 'undefined') {
            return
        }

        if (reason === 'pagehide' && consumeExternalBrowserHandoff(window.location.pathname, window.sessionStorage)) {
            return
        }

        const guestId = getStoredGuestId()
        if (!guestId) {
            return
        }

        fetch('/api/waiting', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestId, status: 'left' }),
            keepalive: reason === 'pagehide',
        }).catch(() => {})
    }, [getStoredGuestId, session?.user])

    useEffect(() => {
        if (!session?.user?.email || hasMarkedHostJoinedRef.current) {
            return
        }

        hasMarkedHostJoinedRef.current = true

        fetch(`/api/meetings/${roomId}/start`, {
            method: 'POST',
        }).catch(() => {
            hasMarkedHostJoinedRef.current = false
        })
    }, [session?.user?.email, roomId])

    useEffect(() => {
        try {
            if (guestIdFromQuery) {
                localStorage.setItem(`waitingGuest:${roomId}`, guestIdFromQuery)
            }

            if (guestNameFromQuery) {
                localStorage.setItem(`guestName:${roomId}`, guestNameFromQuery)
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [guestIdFromQuery, guestNameFromQuery, roomId])

    // Auto-set name for authenticated users or returning guests
    useEffect(() => {
        // Authenticated user (host) — use their name
        if (session?.user?.name) {
            setDisplayName(session.user.name)
            setHasJoined(true)
            return
        }

        if (guestNameFromQuery) {
            try {
                localStorage.setItem(`guestName:${roomId}`, guestNameFromQuery)
            } catch {
                // Ignore localStorage errors
            }

            setDisplayName(guestNameFromQuery)
            setHasJoined(true)
            return
        }

        // Check if they were a guest in this meeting's waiting room
        try {
            const guestName = localStorage.getItem(`guestName:${roomId}`)
            if (guestName) {
                setDisplayName(guestName)
                setHasJoined(true)
            }
        } catch {
            // localStorage not available
        }
    }, [guestNameFromQuery, session, roomId])

    // Handle leaving the room — go back to home or dashboard
    const handleLeave = useCallback(() => {
        if (!session?.user) {
            markGuestLeft('manual')
        }

        if (session) {
            router.push('/host/dashboard')
        } else {
            router.push('/')
        }
    }, [markGuestLeft, session, router])

    useEffect(() => {
        if (session?.user) {
            return
        }

        const handlePageHide = () => markGuestLeft('pagehide')
        window.addEventListener('pagehide', handlePageHide)

        return () => {
            window.removeEventListener('pagehide', handlePageHide)
        }
    }, [markGuestLeft, session?.user])

    // Poll meeting status to detect if host ended from dashboard
    useEffect(() => {
        if (!hasJoined) return

        const checkMeetingStatus = async () => {
            try {
                const guestId = getStoredGuestId()
                const guestQuery = guestId ? `&guestId=${guestId}` : ''
                const res = await fetch(`/api/waiting?meetingId=${roomId}${guestQuery}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.meeting?.status === 'completed') {
                        setMeetingEndedExternally(true)
                        return
                    }

                    if (
                        shouldHostAutoEndMeetingWhenEmpty({
                            isHost: Boolean(session?.user),
                            meetingStatus: data.meeting?.status,
                            waitingGuestCount: Number(data.waitingGuestCount || 0),
                            activeGuestCount: Number(data.activeGuestCount || 0),
                        }) &&
                        !hostAutoEndRequestedRef.current
                    ) {
                        hostAutoEndRequestedRef.current = true

                        const endRes = await fetch(`/api/meetings/${roomId}/end`, {
                            method: 'POST',
                        })

                        if (!endRes.ok) {
                            hostAutoEndRequestedRef.current = false
                        }
                    }
                }
            } catch {
                // Ignore polling errors
            }
        }

        const interval = setInterval(checkMeetingStatus, 5000)
        return () => clearInterval(interval)
    }, [getStoredGuestId, hasJoined, roomId, session?.user])

    // Auto-redirect when meeting ended externally
    useEffect(() => {
        if (!meetingEndedExternally) return
        const timer = setTimeout(handleLeave, 4000)
        return () => clearTimeout(timer)
    }, [meetingEndedExternally, handleLeave])

    // Welcome audio for guests — fetch and play in one effect after guest joins
    const welcomeAudioRef = useRef<HTMLAudioElement | null>(null)
    const hasPlayedWelcomeRef = useRef(false)

    useEffect(() => {
        if (!hasJoined || session?.user || hasPlayedWelcomeRef.current) return
        hasPlayedWelcomeRef.current = true

        let audio: HTMLAudioElement | null = null

        const fetchAndPlay = async () => {
            try {
                const res = await fetch(`/api/waiting?meetingId=${roomId}`)
                if (!res.ok) return
                const data = await res.json()
                const audioUrl = data.assignedMember?.welcome_audio_url || data.host?.welcome_audio_url
                if (!audioUrl) return

                audio = new Audio(audioUrl)
                audio.volume = 0.85
                welcomeAudioRef.current = audio
                await audio.play()
            } catch (e) {
                console.warn('Welcome audio failed:', e)
            }
        }

        fetchAndPlay()

        return () => {
            if (audio) {
                audio.pause()
                audio.src = ''
            }
        }
    }, [hasJoined, session, roomId])

    const handleStopWelcomeAudio = useCallback(() => {
        if (welcomeAudioRef.current) {
            welcomeAudioRef.current.pause()
            welcomeAudioRef.current.src = ''
            welcomeAudioRef.current = null
        }
    }, [])

    // Meeting ended externally (host ended from dashboard)
    if (meetingEndedExternally) {
        return (
            <>
                {!session?.user && <GuestExternalBrowserAssist />}
                <div className={styles.container}>
                    <div className={styles.joinCard}>
                        <div className={styles.iconWrapper} style={{ color: '#ff6b6b' }}>
                            <FaDoorOpen />
                        </div>
                        <h1>Meeting Ended</h1>
                        <p>The host has ended this meeting. You will be redirected shortly.</p>
                        <button onClick={handleLeave} className={styles.joinBtn}>
                            Leave Now
                        </button>
                    </div>
                </div>
            </>
        )
    }

    // If we have a name and have joined, show the video chat
    if (hasJoined && displayName) {
        return (
            <>
                {!session?.user && <GuestExternalBrowserAssist />}
                <VideoChat
                    roomId={roomId}
                    displayName={displayName}
                    onLeave={handleLeave}
                    isHost={!!session?.user}
                    onStopWelcomeAudio={handleStopWelcomeAudio}
                    guestMediaMode={guestMediaMode}
                />
                {session?.user && <GuestInfoPanel roomId={roomId} />}
            </>
        )
    }

    // Otherwise, show a name prompt (for unauthenticated users without stored name)
    return (
        <>
            <GuestExternalBrowserAssist />
            <div className={styles.container}>
                <div className={styles.joinCard}>
                    <div className={styles.iconWrapper}>
                        <FaVideo />
                    </div>
                    <h1>Join Video Room</h1>
                    <p>Enter your name to join the meeting</p>

                    <form
                        className={styles.nameForm}
                        onSubmit={(e) => {
                            e.preventDefault()
                            const name = nameInput.trim()
                            if (name) {
                                // Store name for potential reconnection
                                try {
                                    localStorage.setItem(`guestName:${roomId}`, name)
                                } catch {
                                    // Ignore localStorage errors
                                }
                                setDisplayName(name)
                                setHasJoined(true)
                            }
                        }}
                    >
                        <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="Your name..."
                            className={styles.nameInput}
                            autoFocus
                            maxLength={50}
                            required
                        />
                        <button
                            type="submit"
                            className={styles.joinBtn}
                            disabled={!nameInput.trim()}
                        >
                            Join
                            <FaArrowRight />
                        </button>
                    </form>
                </div>
            </div>
        </>
    )
}
