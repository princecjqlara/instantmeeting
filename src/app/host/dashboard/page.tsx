'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Meeting, WaitingGuest, Content } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Calendar from '@/components/Calendar'
import WaitingRoomTable from '@/components/WaitingRoomTable'
import ContentPreview from '@/components/ContentPreview'
import ReelPlayer from '@/components/ReelPlayer'
import styles from './page.module.css'
import {
    FaPlus, FaSignOutAlt, FaLink, FaCopy, FaCheck,
    FaUserCheck, FaVideo, FaUpload, FaUsers, FaEye, FaTimes
} from 'react-icons/fa'

interface MeetingWithGuests extends Meeting {
    waiting_guests: WaitingGuest[]
}

interface WaitingGuestWithMeeting extends WaitingGuest {
    meeting_title?: string
}

export default function Dashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [meetings, setMeetings] = useState<MeetingWithGuests[]>([])
    const [content, setContent] = useState<Content[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [newMeetingTitle, setNewMeetingTitle] = useState('')
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [showPreview, setShowPreview] = useState(false)
    const supabase = createClient()

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    // Fetch meetings and content
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [meetingsRes, contentRes] = await Promise.all([
                    fetch('/api/meetings'),
                    fetch('/api/content')
                ])

                if (meetingsRes.ok) {
                    const meetingsData = await meetingsRes.json()
                    setMeetings(meetingsData)
                }

                if (contentRes.ok) {
                    const contentData = await contentRes.json()
                    setContent(contentData)
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setLoading(false)
            }
        }

        if (session) {
            fetchData()
        }
    }, [session])

    // Subscribe to real-time guest updates
    useEffect(() => {
        if (!session) return

        const channel = supabase
            .channel('waiting-guests')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'waiting_guests',
                },
                () => {
                    // Refresh meetings when guests change
                    fetch('/api/meetings')
                        .then(res => res.json())
                        .then(data => setMeetings(data))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [session, supabase])

    // Get all waiting guests with meeting titles
    const allWaitingGuests: WaitingGuestWithMeeting[] = meetings.flatMap(meeting =>
        (meeting.waiting_guests || []).map(guest => ({
            ...guest,
            meeting_title: meeting.title
        }))
    )

    const createMeeting = async () => {
        if (creating) return
        setCreating(true)

        try {
            const response = await fetch('/api/meetings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newMeetingTitle || 'Instant Meeting' }),
            })

            if (response.ok) {
                const meeting = await response.json()
                setMeetings(prev => [{ ...meeting, waiting_guests: [] }, ...prev])
                setNewMeetingTitle('')
            }
        } catch (error) {
            console.error('Error creating meeting:', error)
        } finally {
            setCreating(false)
        }
    }

    const admitGuest = async (meetingId: string, guestId: string) => {
        try {
            await fetch(`/api/meetings/${meetingId}/admit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId }),
            })
        } catch (error) {
            console.error('Error admitting guest:', error)
        }
    }

    const copyWaitingLink = (meetingId: string) => {
        const link = `${window.location.origin}/waiting/${meetingId}`
        navigator.clipboard.writeText(link)
        setCopiedId(meetingId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    if (status === 'loading' || loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        )
    }

    return (
        <div className={styles.dashboard}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>Dashboard</h1>
                    <span className={styles.userName}>
                        Welcome, {session?.user?.name || 'Host'}
                    </span>
                </div>

                <div className={styles.headerRight}>
                    <button
                        onClick={() => setShowPreview(true)}
                        className="button-secondary"
                        disabled={content.length === 0}
                    >
                        <FaEye />
                        Preview
                    </button>
                    <button
                        onClick={() => router.push('/host/upload')}
                        className="button-secondary"
                    >
                        <FaUpload />
                        Upload Content
                    </button>
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className={styles.logoutBtn}
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </header>

            {/* Create Meeting */}
            <section className={styles.createSection}>
                <div className={styles.createCard}>
                    <h2>Create New Meeting</h2>
                    <div className={styles.createForm}>
                        <input
                            type="text"
                            value={newMeetingTitle}
                            onChange={(e) => setNewMeetingTitle(e.target.value)}
                            placeholder="Meeting title (optional)"
                            className="input"
                        />
                        <button
                            onClick={createMeeting}
                            disabled={creating}
                            className="button-primary"
                        >
                            {creating ? 'Creating...' : (
                                <>
                                    <FaPlus />
                                    Create Meeting
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </section>

            {/* Calendar and Waiting Room Grid */}
            <section className={styles.gridSection}>
                <div className={styles.calendarWrapper}>
                    <Calendar
                        meetings={meetings}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                    />
                </div>
                <div className={styles.tableWrapper}>
                    <WaitingRoomTable
                        guests={allWaitingGuests}
                        onAdmit={admitGuest}
                    />
                </div>
            </section>

            {/* Content Preview */}
            <section className={styles.contentSection}>
                <ContentPreview
                    content={content}
                    onUploadClick={() => router.push('/host/upload')}
                />
            </section>

            {/* Meetings List */}
            <section className={styles.meetingsSection}>
                <h2>Your Meetings</h2>

                {meetings.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaVideo className={styles.emptyIcon} />
                        <p>No meetings yet</p>
                        <span>Create your first meeting to get started!</span>
                    </div>
                ) : (
                    <div className={styles.meetingsGrid}>
                        {meetings.map((meeting) => {
                            const waitingGuests = meeting.waiting_guests?.filter(
                                g => g.status === 'waiting'
                            ) || []

                            return (
                                <div key={meeting.id} className={styles.meetingCard}>
                                    <div className={styles.meetingHeader}>
                                        <h3>{meeting.title}</h3>
                                        <span className={`${styles.status} ${styles[meeting.status]}`}>
                                            {meeting.status}
                                        </span>
                                    </div>

                                    <div className={styles.meetingActions}>
                                        <button
                                            onClick={() => copyWaitingLink(meeting.id)}
                                            className={styles.actionBtn}
                                            title="Copy waiting room link"
                                        >
                                            {copiedId === meeting.id ? <FaCheck /> : <FaCopy />}
                                            <span>Waiting Link</span>
                                        </button>

                                        {meeting.google_meet_link && (
                                            <a
                                                href={meeting.google_meet_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.actionBtn}
                                            >
                                                <FaLink />
                                                <span>Join Meet</span>
                                            </a>
                                        )}
                                    </div>

                                    {/* Waiting Guests */}
                                    {waitingGuests.length > 0 && (
                                        <div className={styles.waitingGuests}>
                                            <div className={styles.guestsHeader}>
                                                <FaUsers />
                                                <span>{waitingGuests.length} waiting</span>
                                            </div>

                                            <div className={styles.guestsList}>
                                                {waitingGuests.map((guest) => (
                                                    <div key={guest.id} className={styles.guestItem}>
                                                        <span className={styles.guestName}>{guest.guest_name}</span>
                                                        <button
                                                            onClick={() => admitGuest(meeting.id, guest.id)}
                                                            className={styles.admitBtn}
                                                        >
                                                            <FaUserCheck />
                                                            Admit
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Preview Modal */}
            {showPreview && (
                <div className={styles.previewModal}>
                    <div className={styles.previewHeader}>
                        <h2>Guest Preview</h2>
                        <span>This is what guests see while waiting</span>
                        <button
                            className={styles.closePreview}
                            onClick={() => setShowPreview(false)}
                        >
                            <FaTimes />
                        </button>
                    </div>
                    <div className={styles.previewContainer}>
                        <div className={styles.phoneFrame}>
                            <ReelPlayer
                                reels={content}
                                hostName={session?.user?.name || 'Host'}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
