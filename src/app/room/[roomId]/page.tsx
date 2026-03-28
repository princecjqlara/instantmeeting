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

import { useState, use, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import VideoChat from '@/components/VideoChat'
import { FaVideo, FaArrowRight } from 'react-icons/fa'
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
    const handleLeave = () => {
        if (session) {
            router.push('/host/dashboard')
        } else {
            router.push('/')
        }
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
