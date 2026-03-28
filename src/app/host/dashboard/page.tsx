'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Meeting, WaitingGuest, Content, Team, TeamMember } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Calendar from '@/components/Calendar'
import WaitingRoomTable from '@/components/WaitingRoomTable'
import ContentPreview from '@/components/ContentPreview'
import ReelPlayer from '@/components/ReelPlayer'
import AvailabilitySettings from '@/components/AvailabilitySettings'
import CalendarDayModal from '@/components/CalendarDayModal'
import AISetupPanel from '@/components/AISetupPanel'
import PresentationManager from '@/components/PresentationManager'
import styles from './page.module.css'
import {
    FaPlus, FaSignOutAlt, FaSignInAlt, FaLink, FaCopy, FaCheck,
    FaUserCheck, FaVideo, FaUpload, FaUsers, FaEye, FaTimes, FaUser,
    FaChartLine, FaUsers as FaUsersIcon, FaCalendarAlt, FaMicrophone, FaTrash, FaPlay, FaStop,
    FaBrain
} from 'react-icons/fa'

type AssignmentSource = 'system' | 'manual' | 'preassigned' | 'none'

interface MeetingWithGuests extends Meeting {
    assignment_source?: AssignmentSource | null
    waiting_guests: WaitingGuest[]
}

interface WaitingGuestWithMeeting extends WaitingGuest {
    meeting_title?: string
}

const openRoomInNewTab = (roomPath: string, existingTab?: Window | null) => {
    const meetingTab = existingTab ?? window.open(roomPath, '_blank')
    if (!meetingTab) {
        return false
    }

    if (existingTab) {
        meetingTab.location.href = roomPath
    }

    try {
        meetingTab.opener = null
    } catch {
        // Ignore browsers that block setting opener
    }

    meetingTab.focus()
    return true
}

export default function Dashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [meetings, setMeetings] = useState<MeetingWithGuests[]>([])
    const [content, setContent] = useState<Content[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [copiedUniversal, setCopiedUniversal] = useState(false)
    const [aiSetupOpen, setAiSetupOpen] = useState(false)
    const [presManagerOpen, setPresManagerOpen] = useState(false)
    const [username, setUsername] = useState<string | null>(null)
    const [newMeetingTitle, setNewMeetingTitle] = useState('')
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [showPreview, setShowPreview] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedDateMeetings, setSelectedDateMeetings] = useState<Meeting[]>([])
    const [welcomeAudioUrl, setWelcomeAudioUrl] = useState<string | null>(null)
    const [uploadingAudio, setUploadingAudio] = useState(false)
    const [playingPreview, setPlayingPreview] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordingChunksRef = useRef<Blob[]>([])
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [team, setTeam] = useState<Team | null>(null)
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [newMemberName, setNewMemberName] = useState('')
    const [newMemberEmail, setNewMemberEmail] = useState('')
    const [copiedClockLink, setCopiedClockLink] = useState(false)
    const supabase = createClient()

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const meetingsPerPage = 9

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

                // Fetch username for universal link
                const profileRes = await fetch('/api/profile/settings')
                if (profileRes.ok) {
                    const profileData = await profileRes.json()
                    if (profileData.username) {
                        setUsername(profileData.username)
                    }
                    if (profileData.welcome_audio_url) {
                        setWelcomeAudioUrl(profileData.welcome_audio_url)
                    }
                }

                // Fetch team data
                const teamRes = await fetch('/api/team')
                if (teamRes.ok) {
                    const teamData = await teamRes.json()
                    if (teamData.team) {
                        setTeam(teamData.team)
                        setTeamMembers(teamData.members || [])
                    }
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
                (payload: any) => {
                    // Refresh meetings when guests change
                    fetch('/api/meetings')
                        .then(res => res.json())
                        .then(data => {
                            setMeetings(data)

                            // Check if a guest has JUST been admitted for an active/pending meeting
                            if (payload.eventType === 'UPDATE' && payload.new.status === 'admitted' && payload.old.status !== 'admitted') {
                                const guest = payload.new
                                const meeting = data.find((m: any) => m.id === guest.meeting_id)

                                if (meeting && meeting.status !== 'completed') {
                                    // Use storage to prevent repeated redirects for the same admission
                                    const redirectKey = `redirected:${guest.id}`
                                    if (!localStorage.getItem(redirectKey)) {
                                        localStorage.setItem(redirectKey, 'true')
                                        // Open room in a new tab and keep dashboard open
                                        const roomPath = `/room/${guest.meeting_id}`
                                        if (!openRoomInNewTab(roomPath)) {
                                            router.push(roomPath)
                                        }
                                    }
                                }
                            }
                        })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [session, supabase, router])

    // Get all waiting guests with meeting titles (excluding left/admitted)
    const allWaitingGuests: WaitingGuestWithMeeting[] = meetings.flatMap(meeting =>
        (meeting.waiting_guests || [])
            .filter(guest => guest.status === 'waiting')
            .map(guest => ({
                ...guest,
                meeting_title: meeting.title,
                meeting_id: guest.meeting_id || meeting.id
            }))
    )

    const getAssignedMemberName = (assignedMemberId?: string | null) => {
        if (!assignedMemberId) return null
        const assignedMember = teamMembers.find(member => member.id === assignedMemberId)
        return assignedMember?.name || 'Team member'
    }

    const getAssignmentTag = (source?: AssignmentSource | null) => {
        if (!source || source === 'none') {
            return null
        }

        if (source === 'system') {
            return { label: 'Auto (System)', className: styles.assignmentTagSystem }
        }

        if (source === 'manual') {
            return { label: 'Manual', className: styles.assignmentTagManual }
        }

        if (source === 'preassigned') {
            return { label: 'Pre-assigned', className: styles.assignmentTagPreassigned }
        }

        return null
    }

    const busyMemberIds = new Set(
        meetings
            .filter(meeting => meeting.status !== 'completed')
            .map(meeting => meeting.assigned_member_id)
            .filter((memberId): memberId is string => Boolean(memberId))
    )

    const teamMembersWithAvailability = teamMembers.map(member => ({
        ...member,
        is_busy: busyMemberIds.has(member.id),
    }))

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

    const admitGuest = async (meetingId: string, guestId: string, selectedMemberId?: string) => {
        const roomPath = `/room/${meetingId}`
        const redirectKey = `redirected:${guestId}`
        const meetingTab = window.open('', '_blank')

        localStorage.setItem(redirectKey, 'pending')

        try {
            // If a specific member was selected, assign them first
            if (selectedMemberId) {
                await fetch('/api/team/assign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ meeting_id: meetingId, member_id: selectedMemberId })
                })
            }

            const response = await fetch(`/api/meetings/${meetingId}/admit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to admit guest')
                localStorage.removeItem(redirectKey)
                if (meetingTab) {
                    meetingTab.close()
                }
                return
            }

            const result = await response.json()
            const resolvedAssignedMemberId = result.assigned_member?.id || selectedMemberId
            const resolvedAssignedName = result.assigned_member?.name
                || teamMembers.find(member => member.id === resolvedAssignedMemberId)?.name
            const apiAssignmentSource = result.assignment_source as AssignmentSource | undefined
            const resolvedAssignmentSource: AssignmentSource = selectedMemberId
                ? 'manual'
                : apiAssignmentSource || (resolvedAssignedMemberId ? 'system' : 'none')

            setMeetings(prev => prev.map(meeting => {
                if (meeting.id !== meetingId) return meeting
                return {
                    ...meeting,
                    google_meet_link: result.meet_link || meeting.google_meet_link,
                    status: meeting.status === 'pending' ? 'active' : meeting.status,
                    assigned_member_id: resolvedAssignedMemberId || meeting.assigned_member_id,
                    assignment_source: resolvedAssignedMemberId ? resolvedAssignmentSource : (meeting.assignment_source || 'none'),
                    waiting_guests: (meeting.waiting_guests || []).map(guest =>
                        guest.id === guestId
                            ? { ...guest, status: 'admitted', admitted_at: result.guest?.admitted_at || guest.admitted_at }
                            : guest
                    )
                }
            }))

            localStorage.setItem(redirectKey, 'true')
            if (!openRoomInNewTab(roomPath, meetingTab)) {
                router.push(roomPath)
            }

            if (resolvedAssignedName) {
                if (resolvedAssignmentSource === 'system') {
                    alert(`Auto-assigned by system to ${resolvedAssignedName}`)
                } else if (resolvedAssignmentSource === 'manual') {
                    alert(`Manually assigned to ${resolvedAssignedName}`)
                } else {
                    alert(`Assigned to ${resolvedAssignedName}`)
                }
            }
        } catch (error) {
            console.error('Error admitting guest:', error)
            localStorage.removeItem(redirectKey)
            if (meetingTab) {
                meetingTab.close()
            }
        }
    }

    // Start meeting and open the room in a new tab
    const startMeeting = async (meetingId: string) => {
        const roomPath = `/room/${meetingId}`
        const meetingTab = window.open('', '_blank')

        try {
            const response = await fetch(`/api/meetings/${meetingId}/start`, {
                method: 'POST',
            })

            if (!response.ok) {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to start meeting')
                if (meetingTab) {
                    meetingTab.close()
                }
                return
            }

            const updated = await response.json()
            setMeetings(prev => prev.map(meeting =>
                meeting.id === meetingId
                    ? { ...meeting, ...updated }
                    : meeting
            ))

            // Open meeting in a new tab; fallback to same tab if blocked
            if (!openRoomInNewTab(roomPath, meetingTab)) {
                router.push(roomPath)
            }
        } catch (error) {
            console.error('Error starting meeting:', error)
            if (meetingTab) {
                meetingTab.close()
            }
        }
    }

    const endMeeting = async (meetingId: string) => {
        if (!confirm('End this meeting for everyone?')) return

        try {
            const response = await fetch(`/api/meetings/${meetingId}/end`, {
                method: 'POST',
            })

            if (!response.ok) {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to end meeting')
                return
            }

            // Immediately broadcast 'end-meeting' to all peers in the room
            try {
                const channel = supabase.channel(`room:${meetingId}`)
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        channel.send({
                            type: 'broadcast',
                            event: 'end-meeting',
                            payload: { sender: 'host' }
                        }).then(() => supabase.removeChannel(channel))
                    }
                })
            } catch (broadcastErr) {
                console.error('Failed to broadcast end meeting:', broadcastErr)
            }

            const updated = await response.json()
            setMeetings(prev => prev.map(meeting =>
                meeting.id === meetingId
                    ? { ...meeting, ...updated }
                    : meeting
            ))
        } catch (error) {
            console.error('Error ending meeting:', error)
        }
    }

    const requestReschedule = async (meetingId: string) => {
        try {
            const response = await fetch(`/api/meetings/${meetingId}/request-reschedule`, {
                method: 'POST',
            })

            if (!response.ok) {
                const errorData = await response.json()
                alert(errorData.error || 'Failed to request reschedule')
                return
            }

            const updated = await response.json()
            setMeetings(prev => prev.map(meeting =>
                meeting.id === updated.id ? { ...meeting, ...updated } : meeting
            ))
        } catch (error) {
            console.error('Error requesting reschedule:', error)
        }
    }


    const copyWaitingLink = (meetingId: string) => {
        const link = `${window.location.origin}/waiting/${meetingId}`
        navigator.clipboard.writeText(link)
        setCopiedId(meetingId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleWelcomeAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingAudio(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/profile/welcome-audio', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                const data = await response.json()
                setWelcomeAudioUrl(data.welcome_audio_url)
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to upload audio')
            }
        } catch {
            alert('Failed to upload audio')
        } finally {
            setUploadingAudio(false)
            e.target.value = ''
        }
    }

    const handleDeleteWelcomeAudio = async () => {
        if (!confirm('Remove your welcome voice message?')) return

        try {
            const response = await fetch('/api/profile/welcome-audio', {
                method: 'DELETE'
            })

            if (response.ok) {
                setWelcomeAudioUrl(null)
            }
        } catch {
            alert('Failed to remove audio')
        }
    }

    const uploadAudioBlob = async (blob: Blob) => {
        setUploadingAudio(true)
        try {
            const formData = new FormData()
            formData.append('file', blob, 'welcome-recording.webm')

            const response = await fetch('/api/profile/welcome-audio', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                const data = await response.json()
                setWelcomeAudioUrl(data.welcome_audio_url)
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to upload recording')
            }
        } catch {
            alert('Failed to upload recording')
        } finally {
            setUploadingAudio(false)
        }
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
            mediaRecorderRef.current = mediaRecorder
            recordingChunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordingChunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop())
                const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' })
                uploadAudioBlob(blob)
            }

            mediaRecorder.start()
            setIsRecording(true)
            setRecordingTime(0)

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        } catch {
            alert('Microphone access denied. Please allow mic access and try again.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }
        setIsRecording(false)
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current)
            recordingTimerRef.current = null
        }
    }

    const formatRecordingTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
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
                        onClick={() => router.push('/host/metrics')}
                        className="button-secondary"
                    >
                        <FaChartLine />
                        Analytics
                    </button>
                    <button
                        onClick={() => router.push('/host/leads')}
                        className="button-secondary"
                    >
                        <FaUsersIcon />
                        Leads
                    </button>
                    <button
                        onClick={() => setShowPreview(true)}
                        className="button-secondary"
                        disabled={content.length === 0}
                    >
                        <FaEye />
                        Preview
                    </button>
                    <button
                        onClick={() => router.push('/host/profile')}
                        className="button-secondary"
                    >
                        <FaUser />
                        Profile
                    </button>
                    <button
                        onClick={() => router.push('/host/upload')}
                        className="button-secondary"
                    >
                        <FaUpload />
                        Upload
                    </button>
                    {(session?.user as { role?: string })?.role === 'organizer' && (
                        <button
                            onClick={() => router.push('/admin')}
                            className="button-secondary"
                        >
                            <FaUsers />
                            Admin
                        </button>
                    )}
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className={styles.logoutBtn}
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </header>

            {/* Availability Settings */}
            <AvailabilitySettings />

            {/* Universal Link */}
            {username && (
                <section className={styles.universalLinkSection}>
                    <div className={styles.universalLinkCard}>
                        <div className={styles.universalLinkInfo}>
                            <FaLink />
                            <div>
                                <h3>Your Universal Link</h3>
                                <code>{typeof window !== 'undefined' ? window.location.origin : ''}/join/{username}</code>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/join/${username}`)
                                setCopiedUniversal(true)
                                setTimeout(() => setCopiedUniversal(false), 2000)
                            }}
                            className={`button-secondary ${copiedUniversal ? styles.copied : ''}`}
                        >
                            {copiedUniversal ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                        </button>
                    </div>
                </section>
            )}

            {/* Welcome Voice Message */}
            <section className={styles.createSection}>
                <div className={styles.createCard}>
                    <h2><FaMicrophone style={{ marginRight: 8, color: '#ff4757' }} /> Welcome Voice Message</h2>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Record a greeting that plays when guests enter your waiting room — buys you time to prepare!
                    </p>
                    {isRecording ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                    width: 12, height: 12, borderRadius: '50%', background: '#ff4757',
                                    animation: 'pulse 1s ease-in-out infinite', display: 'inline-block'
                                }} />
                                <span style={{ color: '#ff4757', fontWeight: 600, fontFamily: 'monospace', fontSize: '1.1rem' }}>
                                    {formatRecordingTime(recordingTime)}
                                </span>
                                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Recording...</span>
                            </div>
                            <button
                                onClick={stopRecording}
                                className="button-primary"
                                style={{ background: '#ff4757' }}
                            >
                                <FaStop /> Stop & Save
                            </button>
                        </div>
                    ) : uploadingAudio ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className={styles.spinner} style={{ width: 20, height: 20 }}></div>
                            <span style={{ color: '#aaa' }}>Uploading...</span>
                        </div>
                    ) : welcomeAudioUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <audio
                                src={welcomeAudioUrl}
                                controls
                                style={{ flex: 1, minWidth: 200, maxWidth: 400, height: 36, borderRadius: 8 }}
                            />
                            <button
                                onClick={handleDeleteWelcomeAudio}
                                className="button-secondary"
                                style={{ color: '#ff4757' }}
                            >
                                <FaTrash /> Remove
                            </button>
                            <button
                                onClick={startRecording}
                                className="button-secondary"
                            >
                                <FaMicrophone /> Re-record
                            </button>
                            <label className="button-secondary" style={{ cursor: 'pointer' }}>
                                <FaUpload /> Replace File
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleWelcomeAudioUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={startRecording}
                                className="button-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            >
                                <FaMicrophone /> Record
                            </button>
                            <label className="button-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <FaUpload /> Attach File
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleWelcomeAudioUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
                            <span style={{ color: '#666', fontSize: '0.8rem' }}>MP3, M4A, WAV — max 10 MB</span>
                        </div>
                    )}
                </div>
            </section>

            {/* AI Assistant Setup */}
            <section className={styles.createSection}>
                <div className={styles.createCard}>
                    <h2><FaBrain style={{ marginRight: 8, color: '#7c3aed' }} /> AI Meeting Assistant</h2>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Configure your AI assistant that helps you during calls — set objectives, conversation flows, and upload knowledge base documents. Applies to all your meetings.
                    </p>
                    <button
                        className="button-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}
                        onClick={() => setAiSetupOpen(true)}
                    >
                        <FaBrain /> Configure AI Assistant
                    </button>
                </div>
            </section>

            {/* Presentations */}
            <section className={styles.createSection}>
                <div className={styles.createCard}>
                    <h2>📊 Presentations</h2>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Upload photos and videos, arrange them into a slideshow, and present during any call — no screen sharing needed.
                    </p>
                    <button
                        className="button-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)' }}
                        onClick={() => setPresManagerOpen(true)}
                    >
                        📊 Manage Presentations
                    </button>
                </div>
            </section>

            {/* Team Management */}
            <section className={styles.createSection}>
                <div className={styles.createCard}>
                    <h2><FaUsers style={{ marginRight: 8, color: '#3742fa' }} /> Team</h2>
                    {!team ? (
                        <div>
                            <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                Create a team to add members who can clock in and handle meetings via round-robin.
                            </p>
                            <button
                                className="button-primary"
                                onClick={async () => {
                                    const res = await fetch('/api/team', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name: 'My Team' })
                                    })
                                    if (res.ok) {
                                        const data = await res.json()
                                        setTeam(data.team)
                                        setTeamMembers([])
                                    }
                                }}
                            >
                                <FaPlus /> Create Team
                            </button>
                        </div>
                    ) : (
                        <div>
                            {/* Clock-in Link */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <code style={{ fontSize: '0.8rem', background: '#1a1a2e', padding: '4px 8px', borderRadius: 4 }}>
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/team/clock?team={team.id}
                                </code>
                                <button
                                    className="button-secondary"
                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/team/clock?team=${team.id}`)
                                        setCopiedClockLink(true)
                                        setTimeout(() => setCopiedClockLink(false), 2000)
                                    }}
                                >
                                    {copiedClockLink ? <><FaCheck /> Copied</> : <><FaCopy /> Copy Clock-In Link</>}
                                </button>
                            </div>

                            {/* Add Member Form */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    value={newMemberName}
                                    onChange={e => setNewMemberName(e.target.value)}
                                    placeholder="Member name"
                                    className="input"
                                    style={{ flex: 1, minWidth: 120 }}
                                />
                                <input
                                    type="email"
                                    value={newMemberEmail}
                                    onChange={e => setNewMemberEmail(e.target.value)}
                                    placeholder="Email (optional)"
                                    className="input"
                                    style={{ flex: 1, minWidth: 120 }}
                                />
                                <button
                                    className="button-primary"
                                    disabled={!newMemberName.trim()}
                                    onClick={async () => {
                                        const res = await fetch('/api/team/members', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ name: newMemberName.trim(), email: newMemberEmail.trim() || null })
                                        })
                                        if (res.ok) {
                                            const member = await res.json()
                                            setTeamMembers(prev => [...prev, { ...member, is_clocked_in: false }])
                                            setNewMemberName('')
                                            setNewMemberEmail('')
                                        }
                                    }}
                                >
                                    <FaPlus /> Add
                                </button>
                            </div>

                            {/* Member List */}
                            {teamMembers.length === 0 ? (
                                <p style={{ color: '#666', fontSize: '0.85rem' }}>No team members yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {teamMembers.map(member => (
                                        <div key={member.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.5rem 0.75rem', background: '#1a1a2e', borderRadius: 8,
                                            flexWrap: 'wrap'
                                        }}>
                                            {/* Clock status dot */}
                                            <span style={{
                                                width: 10, height: 10, borderRadius: '50%',
                                                background: member.is_clocked_in ? '#2ed573' : '#666',
                                                boxShadow: member.is_clocked_in ? '0 0 6px #2ed573' : 'none',
                                                flexShrink: 0
                                            }} />
                                            <span style={{ fontWeight: 500, flex: 1, minWidth: 80 }}>{member.name}</span>
                                            {member.email && <span style={{ color: '#888', fontSize: '0.8rem' }}>{member.email}</span>}
                                            {member.welcome_audio_url ? (
                                                <span style={{ color: '#2ed573', fontSize: '0.75rem' }}>✓ Audio</span>
                                            ) : (
                                                <label className="button-secondary" style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '2px 8px' }}>
                                                    <FaMicrophone /> Audio
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        style={{ display: 'none' }}
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0]
                                                            if (!file) return
                                                            const fd = new FormData()
                                                            fd.append('file', file)
                                                            fd.append('member_id', member.id)
                                                            const res = await fetch('/api/team/members/welcome-audio', { method: 'POST', body: fd })
                                                            if (res.ok) {
                                                                const data = await res.json()
                                                                setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, welcome_audio_url: data.welcome_audio_url } : m))
                                                            }
                                                            e.target.value = ''
                                                        }}
                                                    />
                                                </label>
                                            )}
                                            {/* Clock In/Out Button */}
                                            <button
                                                className="button-secondary"
                                                style={{
                                                    fontSize: '0.75rem', padding: '2px 10px',
                                                    color: member.is_clocked_in ? '#ff4757' : '#2ed573',
                                                    borderColor: member.is_clocked_in ? '#ff4757' : '#2ed573',
                                                }}
                                                onClick={async () => {
                                                    const method = member.is_clocked_in ? 'PATCH' : 'POST'
                                                    const res = await fetch('/api/team/clock', {
                                                        method,
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ member_id: member.id })
                                                    })
                                                    if (res.ok) {
                                                        setTeamMembers(prev => prev.map(m =>
                                                            m.id === member.id
                                                                ? { ...m, is_clocked_in: !m.is_clocked_in, clocked_in_at: m.is_clocked_in ? null : new Date().toISOString() }
                                                                : m
                                                        ))
                                                    }
                                                }}
                                            >
                                                {member.is_clocked_in ? <><FaSignOutAlt /> Out</> : <><FaSignInAlt /> In</>}
                                            </button>
                                            <button
                                                className="button-secondary"
                                                style={{ color: '#ff4757', fontSize: '0.75rem', padding: '2px 8px' }}
                                                onClick={async () => {
                                                    if (!confirm(`Remove ${member.name}?`)) return
                                                    const res = await fetch('/api/team/members', {
                                                        method: 'DELETE',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ id: member.id })
                                                    })
                                                    if (res.ok) {
                                                        setTeamMembers(prev => prev.filter(m => m.id !== member.id))
                                                    }
                                                }}
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

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
                        onDateClick={(date, dateMeetings) => {
                            setSelectedDate(date)
                            setSelectedDateMeetings(dateMeetings)
                        }}
                    />
                </div>
                <div className={styles.tableWrapper}>
                    <WaitingRoomTable
                        guests={allWaitingGuests}
                        onAdmit={admitGuest}
                        teamMembers={teamMembersWithAvailability}
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
            {(() => {
                // Pagination calculations
                const indexOfLastMeeting = currentPage * meetingsPerPage
                const indexOfFirstMeeting = indexOfLastMeeting - meetingsPerPage
                const currentMeetings = meetings.slice(indexOfFirstMeeting, indexOfLastMeeting)

                return (
                    <section className={styles.meetingsSection}>
                        <div className={styles.meetingsHeader}>
                            <h2>Your Meetings</h2>
                            <span className={styles.meetingsCount}>{meetings.length} total</span>
                        </div>

                        {meetings.length === 0 ? (
                            <div className={styles.emptyState}>
                                <FaVideo className={styles.emptyIcon} />
                                <p>No meetings yet</p>
                                <span>Create your first meeting to get started!</span>
                            </div>
                        ) : (
                            <>
                                <div className={styles.meetingsGrid}>
                                    {currentMeetings.map((meeting) => {
                                        const waitingGuests = meeting.waiting_guests?.filter(
                                            g => g.status === 'waiting'
                                        ) || []
                                        const assignedMemberName = getAssignedMemberName(meeting.assigned_member_id)
                                        const assignmentTag = getAssignmentTag(meeting.assignment_source)

                                        return (
                                            <div key={meeting.id} className={`${styles.meetingCard} ${meeting.status === 'active' ? styles.active : ''} ${waitingGuests.length > 0 ? styles.hasWaiting : ''}`}>
                                                <div className={styles.meetingHeader}>
                                                    <h3>{meeting.title}</h3>
                                                    <span className={`${styles.status} ${styles[meeting.status]}`}>
                                                        {meeting.status}
                                                    </span>
                                                </div>

                                                {assignedMemberName && (
                                                    <div className={styles.assignedTo}>
                                                        <FaUser />
                                                        <span>Assigned to {assignedMemberName}</span>
                                                        {assignmentTag && (
                                                            <span className={`${styles.assignmentTag} ${assignmentTag.className}`}>
                                                                {assignmentTag.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                <div className={styles.meetingActions}>
                                                    <button
                                                        onClick={() => copyWaitingLink(meeting.id)}
                                                        className={styles.actionBtn}
                                                        title="Copy waiting room link"
                                                    >
                                                        {copiedId === meeting.id ? <FaCheck /> : <FaCopy />}
                                                        <span>Waiting Link</span>
                                                    </button>

                                                    {meeting.status !== 'completed' && (
                                                        <button
                                                            className={styles.actionBtn}
                                                            onClick={() => startMeeting(meeting.id)}
                                                        >
                                                            <FaVideo />
                                                            <span>Join Room</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => endMeeting(meeting.id)}
                                                        disabled={meeting.status === 'completed'}
                                                    >
                                                        <FaTimes />
                                                        <span>End Meeting All</span>
                                                    </button>
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => requestReschedule(meeting.id)}
                                                        disabled={meeting.status === 'completed'}
                                                    >
                                                        <FaCalendarAlt />
                                                        <span>Request Reschedule</span>
                                                    </button>
                                                </div>

                                                {/* Waiting Guests - 1 guest per room */}
                                                {waitingGuests.length > 0 && (
                                                    <div className={styles.waitingGuests}>
                                                        <div className={styles.guestsHeader}>
                                                            <FaUsers />
                                                            <span>1 waiting</span>
                                                        </div>

                                                        <div className={styles.guestsList}>
                                                            {waitingGuests.map((guest) => (
                                                                <div key={guest.id} className={styles.guestItem}>
                                                                    <span className={styles.guestName}>{guest.guest_name}</span>
                                                                    <button
                                                                        onClick={() => admitGuest(meeting.id, guest.id)}
                                                                        className={styles.admitBtn}
                                                                        disabled={meeting.status === 'completed'}
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

                                {/* Pagination */}
                                {(() => {
                                    const totalPages = Math.ceil(meetings.length / meetingsPerPage)
                                    if (totalPages <= 1) return null

                                    return (
                                        <div className={styles.pagination}>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className={styles.pageBtn}
                                            >
                                                Previous
                                            </button>

                                            <div className={styles.pageNumbers}>
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`${styles.pageNumber} ${currentPage === page ? styles.active : ''}`}
                                                    >
                                                        {page}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className={styles.pageBtn}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )
                                })()}
                            </>
                        )}
                    </section>
                )
            })()}

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

            {/* Calendar Day Modal */}
            {selectedDate && (
                <CalendarDayModal
                    date={selectedDate}
                    meetings={selectedDateMeetings}
                    teamMembers={teamMembers}
                    onClose={() => {
                        setSelectedDate(null)
                        setSelectedDateMeetings([])
                    }}
                    onPrevDay={() => {
                        const prevDate = new Date(selectedDate)
                        prevDate.setDate(prevDate.getDate() - 1)
                        setSelectedDate(prevDate)
                        const prevMeetings = meetings.filter(meeting => {
                            const meetingDate = new Date(meeting.scheduled_at || meeting.created_at)
                            return (
                                meetingDate.getFullYear() === prevDate.getFullYear() &&
                                meetingDate.getMonth() === prevDate.getMonth() &&
                                meetingDate.getDate() === prevDate.getDate()
                            )
                        })
                        setSelectedDateMeetings(prevMeetings)
                    }}
                    onNextDay={() => {
                        const nextDate = new Date(selectedDate)
                        nextDate.setDate(nextDate.getDate() + 1)
                        setSelectedDate(nextDate)
                        const nextMeetings = meetings.filter(meeting => {
                            const meetingDate = new Date(meeting.scheduled_at || meeting.created_at)
                            return (
                                meetingDate.getFullYear() === nextDate.getFullYear() &&
                                meetingDate.getMonth() === nextDate.getMonth() &&
                                meetingDate.getDate() === nextDate.getDate()
                            )
                        })
                        setSelectedDateMeetings(nextMeetings)
                    }}
                />
            )}

            {/* AI Setup Modal */}
            <AISetupPanel
                isOpen={aiSetupOpen}
                onClose={() => setAiSetupOpen(false)}
                meetingId="default"
            />

            {/* Presentation Manager Modal */}
            <PresentationManager
                isOpen={presManagerOpen}
                onClose={() => setPresManagerOpen(false)}
            />
        </div>
    )
}
