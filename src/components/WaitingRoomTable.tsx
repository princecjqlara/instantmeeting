'use client'

import { WaitingGuest } from '@/lib/types'
import styles from './WaitingRoomTable.module.css'
import { FaUserCheck, FaClock, FaUsers } from 'react-icons/fa'
import { useState } from 'react'

interface TeamMemberOption {
    id: string
    name: string
    is_clocked_in?: boolean
    is_busy?: boolean
}

interface WaitingGuestWithMeeting extends WaitingGuest {
    meeting_title?: string
}

interface WaitingRoomTableProps {
    guests: WaitingGuestWithMeeting[]
    onAdmit: (meetingId: string, guestId: string, assignedMemberId?: string) => void
    teamMembers?: TeamMemberOption[]
}

export default function WaitingRoomTable({ guests, onAdmit, teamMembers = [] }: WaitingRoomTableProps) {
    const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})

    const getMemberStatusLabel = (member: TeamMemberOption) => {
        if (!member.is_clocked_in) return 'Offline'
        if (member.is_busy) return 'Busy'
        return 'Available'
    }

    const getMemberStatusIcon = (member: TeamMemberOption) => {
        if (!member.is_clocked_in) return '⚫'
        if (member.is_busy) return '🟡'
        return '🟢'
    }

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
                        {teamMembers.length > 0 && <th>Assign To</th>}
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
                            {teamMembers.length > 0 && (
                                <td>
                                    <select
                                        value={assignSelections[guest.id] || 'auto'}
                                        onChange={e => setAssignSelections(prev => ({ ...prev, [guest.id]: e.target.value }))}
                                        style={{
                                            background: '#1a1a2e', color: '#fff', border: '1px solid #333',
                                            borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem', minWidth: 120
                                        }}
                                    >
                                        <option value="auto">🔄 Auto (Online + Free)</option>
                                        {teamMembers.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {getMemberStatusIcon(m)} {m.name} ({getMemberStatusLabel(m)})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            )}
                            <td>
                                <button
                                    className={styles.admitBtn}
                                    onClick={() => {
                                        const selectedMember = assignSelections[guest.id]
                                        onAdmit(
                                            guest.meeting_id,
                                            guest.id,
                                            selectedMember && selectedMember !== 'auto' ? selectedMember : undefined
                                        )
                                    }}
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
