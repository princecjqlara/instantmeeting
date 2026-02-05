'use client'

import { WaitingGuest, Meeting } from '@/lib/types'
import styles from './WaitingRoomTable.module.css'
import { FaUserCheck, FaClock, FaUsers } from 'react-icons/fa'

interface WaitingGuestWithMeeting extends WaitingGuest {
    meeting_title?: string
}

interface WaitingRoomTableProps {
    guests: WaitingGuestWithMeeting[]
    onAdmit: (meetingId: string, guestId: string) => void
}

export default function WaitingRoomTable({ guests, onAdmit }: WaitingRoomTableProps) {
    const formatWaitTime = (joinedAt: string) => {
        const joined = new Date(joinedAt)
        const now = new Date()
        const diffMs = now.getTime() - joined.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        const hours = Math.floor(diffMins / 60)
        return `${hours}h ${diffMins % 60}m ago`
    }

    const waitingGuests = guests.filter(g => g.status === 'waiting')

    if (waitingGuests.length === 0) {
        return (
            <div className={styles.emptyState}>
                <FaUsers className={styles.emptyIcon} />
                <p>No guests waiting</p>
                <span>Share your waiting room link to invite guests</span>
            </div>
        )
    }

    return (
        <div className={styles.tableContainer}>
            <div className={styles.header}>
                <FaUsers />
                <span>{waitingGuests.length} waiting</span>
            </div>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Guest</th>
                        <th>Meeting</th>
                        <th>Waiting</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {waitingGuests.map(guest => (
                        <tr key={guest.id}>
                            <td className={styles.guestName}>{guest.guest_name}</td>
                            <td className={styles.meetingTitle}>{guest.meeting_title || 'Meeting'}</td>
                            <td className={styles.waitTime}>
                                <FaClock />
                                {formatWaitTime(guest.joined_at)}
                            </td>
                            <td>
                                <button
                                    className={styles.admitBtn}
                                    onClick={() => onAdmit(guest.meeting_id, guest.id)}
                                >
                                    <FaUserCheck />
                                    Admit
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
