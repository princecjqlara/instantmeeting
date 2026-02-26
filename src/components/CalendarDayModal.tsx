'use client'

import { useState } from 'react'
import { Meeting } from '@/lib/types'
import styles from './CalendarDayModal.module.css'
import {
    FaTimes, FaCalendarAlt, FaClock, FaUser, FaVideo,
    FaCheckCircle, FaHourglassHalf, FaUsers, FaLink,
    FaChevronLeft, FaChevronRight
} from 'react-icons/fa'

interface CalendarDayModalProps {
    date: Date
    meetings: Meeting[]
    onClose: () => void
    onPrevDay: () => void
    onNextDay: () => void
}

export default function CalendarDayModal({ date, meetings, onClose, onPrevDay, onNextDay }: CalendarDayModalProps) {
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getMeetingDate = (meeting: Meeting) => new Date(meeting.scheduled_at || meeting.created_at)


    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <FaCheckCircle className={styles.statusActive} />
            case 'pending': return <FaHourglassHalf className={styles.statusPending} />
            case 'completed': return <FaCheckCircle className={styles.statusCompleted} />
            default: return <FaHourglassHalf />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return 'Active'
            case 'pending': return 'Pending'
            case 'completed': return 'Completed'
            default: return status
        }
    }

    const waitingGuests = meetings.reduce((acc, meeting) =>
        acc + (meeting.waiting_guests?.length || 0), 0
    )

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <button className={styles.navBtn} onClick={onPrevDay}>
                        <FaChevronLeft />
                    </button>

                    <div className={styles.dateHeader}>
                        <FaCalendarAlt />
                        <div>
                            <h2>{date.toLocaleDateString('en-US', { weekday: 'long' })}</h2>
                            <span>{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>

                    <button className={styles.navBtn} onClick={onNextDay}>
                        <FaChevronRight />
                    </button>

                    <button className={styles.closeBtn} onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                {/* Day Stats */}
                <div className={styles.dayStats}>
                    <div className={styles.statItem}>
                        <FaVideo />
                        <span className={styles.statValue}>{meetings.length}</span>
                        <span className={styles.statLabel}>Meetings</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <FaUsers />
                        <span className={styles.statValue}>{waitingGuests}</span>
                        <span className={styles.statLabel}>Guests</span>
                    </div>
                </div>

                {/* Meetings Timeline */}
                <div className={styles.timeline}>
                    <h3 className={styles.timelineTitle}>Schedule</h3>

                    {meetings.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FaCalendarAlt className={styles.emptyIcon} />
                            <p>No meetings scheduled</p>
                            <span>This day is free</span>
                        </div>
                    ) : (
                        <div className={styles.meetingsList}>
                            {meetings
                                .sort((a, b) => getMeetingDate(a).getTime() - getMeetingDate(b).getTime())
                                .map((meeting, index) => (
                                    <div
                                        key={meeting.id}
                                        className={styles.meetingItem}
                                        onClick={() => setSelectedMeeting(meeting)}
                                    >
                                        <div className={styles.timelineLine}>
                                            <div className={styles.timelineDot} />
                                            {index < meetings.length - 1 && <div className={styles.timelineConnector} />}
                                        </div>

                                        <div className={styles.meetingCard}>
                                            <div className={styles.meetingTime}>
                                                <FaClock />
                                                <span>{formatTime(getMeetingDate(meeting).toISOString())}</span>
                                            </div>

                                            <h4 className={styles.meetingTitle}>{meeting.title}</h4>

                                            <div className={styles.meetingMeta}>
                                                <span className={`${styles.statusBadge} ${styles[meeting.status]}`}>
                                                    {getStatusIcon(meeting.status)}
                                                    {getStatusLabel(meeting.status)}
                                                </span>

                                                {meeting.waiting_guests && meeting.waiting_guests.length > 0 && (
                                                    <span className={styles.guestCount}>
                                                        <FaUsers />
                                                        {meeting.waiting_guests.length} waiting
                                                    </span>
                                                )}
                                            </div>

                                            {meeting.google_meet_link && (
                                                <a
                                                    href={meeting.google_meet_link}
                                                    className={styles.meetLink}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <FaLink />
                                                    Join Room
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Meeting Detail Sidebar */}
                {selectedMeeting && (
                    <div className={styles.detailPanel}>
                        <div className={styles.detailHeader}>
                            <h3>{selectedMeeting.title}</h3>
                            <button className={styles.closeDetailBtn} onClick={() => setSelectedMeeting(null)}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className={styles.detailContent}>
                            <div className={styles.detailRow}>
                                <FaClock />
                                <div>
                                    <label>Time</label>
                                    <span>{formatTime(getMeetingDate(selectedMeeting).toISOString())}</span>
                                </div>
                            </div>

                            <div className={styles.detailRow}>
                                <FaVideo />
                                <div>
                                    <label>Status</label>
                                    <span className={`${styles.statusBadge} ${styles[selectedMeeting.status]}`}>
                                        {getStatusIcon(selectedMeeting.status)}
                                        {getStatusLabel(selectedMeeting.status)}
                                    </span>
                                </div>
                            </div>

                            {selectedMeeting.waiting_guests && selectedMeeting.waiting_guests.length > 0 && (
                                <div className={styles.guestsSection}>
                                    <h4>Waiting Guests ({selectedMeeting.waiting_guests.length})</h4>
                                    <div className={styles.guestsList}>
                                        {selectedMeeting.waiting_guests.map((guest: any) => (
                                            <div key={guest.id} className={styles.guestItem}>
                                                <div className={styles.guestAvatar}>
                                                    {guest.guest_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={styles.guestName}>{guest.guest_name}</span>
                                                <span className={`${styles.guestStatus} ${styles[guest.status]}`}>
                                                    {guest.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedMeeting.google_meet_link && (
                                <a
                                    href={selectedMeeting.google_meet_link}
                                    className={styles.joinButton}
                                >
                                    <FaLink />
                                    Join Room
                                </a>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
