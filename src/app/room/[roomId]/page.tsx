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
import { useRouter } from 'next/navigation'
import VideoChat from '@/components/VideoChat'
import { FaVideo, FaArrowRight, FaDoorOpen } from 'react-icons/fa'
import styles from './page.module.css'

interface RoomPageProps {
    params: Promise<{ roomId: string }>
}

export default function RoomPage({ params }: RoomPageProps) {
    const { roomId } = use(params)
    const { data: session } = useSession()
    const router = useRouter()
    const hasMarkedHostJoinedRef = useRef(false)

    // Determine the user's display name
    const [displayName, setDisplayName] = useState<string>('')
    const [nameInput, setNameInput] = useState('')
    const [hasJoined, setHasJoined] = useState(false)
    const [meetingEndedExternally, setMeetingEndedExternally] = useState(false)

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

    // Auto-set name for authenticated users or returning guests
    useEffect(() => {
        // Authenticated user (host) — use their name
        if (session?.user?.name) {
            setDisplayName(session.user.name)
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
    }, [session, roomId])

    // Handle leaving the room — go back to home or dashboard
    const handleLeave = useCallback(() => {
        if (session) {
            router.push('/host/dashboard')
        } else {
            router.push('/')
        }
    }, [session, router])

    // Poll meeting status to detect if host ended from dashboard
    useEffect(() => {
        if (!hasJoined) return

        const checkMeetingStatus = async () => {
            try {
                const res = await fetch(`/api/waiting?meetingId=${roomId}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.meeting?.status === 'completed') {
                        setMeetingEndedExternally(true)
                    }
                }
            } catch {
                // Ignore polling errors
            }
        }

        const interval = setInterval(checkMeetingStatus, 15000)
        return () => clearInterval(interval)
    }, [hasJoined, roomId])

    // Auto-redirect when meeting ended externally
    useEffect(() => {
        if (!meetingEndedExternally) return
        const timer = setTimeout(handleLeave, 4000)
        return () => clearTimeout(timer)
    }, [meetingEndedExternally, handleLeave])

    // Welcome audio for guests — pre-fetch the URL, then play on user gesture (join click)
    const welcomeAudioRef = useRef<HTMLAudioElement | null>(null)
    const hasPlayedWelcomeRef = useRef(false)

    // Pre-fetch the welcome audio URL so it's ready when the guest joins
    useEffect(() => {
        if (session?.user) return // host doesn't need welcome audio

        const prefetchAudio = async () => {
            try {
                const res = await fetch(`/api/waiting?meetingId=${roomId}`)
                if (res.ok) {
                    const data = await res.json()
                    const audioUrl = data.assignedMember?.welcome_audio_url || data.host?.welcome_audio_url
                    if (audioUrl) {
                        const audio = new Audio(audioUrl)
                        audio.volume = 0.85
                        audio.preload = 'auto'
                        welcomeAudioRef.current = audio
                    }
                }
            } catch {
                // Ignore fetch errors
            }
        }

        prefetchAudio()

        return () => {
            if (welcomeAudioRef.current) {
                welcomeAudioRef.current.pause()
                welcomeAudioRef.current.src = ''
                welcomeAudioRef.current = null
            }
        }
    }, [session, roomId])

    // Play welcome audio when guest has joined (triggered by user gesture)
    useEffect(() => {
        if (!hasJoined || session?.user || hasPlayedWelcomeRef.current) return
        hasPlayedWelcomeRef.current = true

        const playAudio = () => {
            if (welcomeAudioRef.current) {
                welcomeAudioRef.current.play().catch(e => console.warn('Welcome audio play failed:', e))
            }
        }

        // Small delay to ensure the video chat has initialized
        const timer = setTimeout(playAudio, 500)
        return () => clearTimeout(timer)
    }, [hasJoined, session])

    // Meeting ended externally (host ended from dashboard)
    if (meetingEndedExternally) {
        return (
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
        )
    }

    // If we have a name and have joined, show the video chat
    if (hasJoined && displayName) {
        return (
            <VideoChat
                roomId={roomId}
                displayName={displayName}
                onLeave={handleLeave}
                isHost={!!session?.user}
            />
        )
    }

    // Otherwise, show a name prompt (for unauthenticated users without stored name)
    return (
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
    )
}
