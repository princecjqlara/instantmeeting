'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WaitingGuest } from '@/lib/types'
import styles from './WaitingStatus.module.css'
import { FaClock, FaCheckCircle, FaVideo } from 'react-icons/fa'

interface WaitingStatusProps {
    meetingId: string
    guestId: string
    onAdmitted: (meetLink: string) => void
}

export default function WaitingStatus({ meetingId, guestId, onAdmitted }: WaitingStatusProps) {
    const [status, setStatus] = useState<'waiting' | 'admitted' | 'left'>('waiting')
    const [meetLink, setMeetLink] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => {
        // Subscribe to real-time updates
        const channel = supabase
            .channel(`guest-${guestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'waiting_guests',
                    filter: `id=eq.${guestId}`,
                },
                async (payload) => {
                    const newStatus = (payload.new as WaitingGuest).status
                    setStatus(newStatus)

                    if (newStatus === 'admitted') {
                        // Fetch the meet link
                        const response = await fetch(`/api/waiting?meetingId=${meetingId}&guestId=${guestId}`)
                        const data = await response.json()
                        if (data.meetLink) {
                            setMeetLink(data.meetLink)
                            onAdmitted(data.meetLink)
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [guestId, meetingId, supabase, onAdmitted])

    // Also poll as backup
    useEffect(() => {
        const checkStatus = async () => {
            const response = await fetch(`/api/waiting?meetingId=${meetingId}&guestId=${guestId}`)
            const data = await response.json()
            if (data.guest?.status === 'admitted') {
                setStatus('admitted')
                setMeetLink(data.meetLink)
                onAdmitted(data.meetLink)
            }
        }

        const interval = setInterval(checkStatus, 5000)
        return () => clearInterval(interval)
    }, [guestId, meetingId, onAdmitted])

    return (
        <div className={styles.container}>
            {status === 'waiting' && (
                <>
                    <div className={styles.waitingAnimation}>
                        <FaClock className={styles.icon} />
                        <div className={styles.pulse} />
                    </div>
                    <h3 className={styles.title}>Waiting to be admitted...</h3>
                    <p className={styles.subtitle}>
                        The host will let you in shortly. Enjoy the content while you wait!
                    </p>
                </>
            )}

            {status === 'admitted' && (
                <>
                    <div className={styles.admittedAnimation}>
                        <FaCheckCircle className={styles.iconSuccess} />
                    </div>
                    <h3 className={styles.titleSuccess}>You&apos;re in!</h3>
                    <p className={styles.subtitle}>
                        The host has admitted you to the meeting.
                    </p>
                    {meetLink && (
                        <a
                            href={meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.joinButton}
                        >
                            <FaVideo />
                            Join Meeting Now
                        </a>
                    )}
                </>
            )}
        </div>
    )
}
