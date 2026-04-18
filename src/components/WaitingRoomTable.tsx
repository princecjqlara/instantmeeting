'use client'

import { WaitingGuest } from '@/lib/types'
import styles from './WaitingRoomTable.module.css'
import { FaUserCheck, FaClock, FaUsers } from 'react-icons/fa'
import { useMemo, useState } from 'react'

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
    pageSize?: number
}

export default function WaitingRoomTable({
    guests,
    onAdmit,
    teamMembers = [],
    pageSize = 6,
}: WaitingRoomTableProps) {
    const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})
    const [page, setPage] = useState(1)

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

    const waitingGuests = useMemo(() => guests.filter((g) => g.status === 'waiting'), [guests])

    const totalPages = Math.max(1, Math.ceil(waitingGuests.length / pageSize))
    const currentPage = Math.min(page, totalPages)
    const start = (currentPage - 1) * pageSize
    const visible = waitingGuests.slice(start, start + pageSize)

    const buildPages = (cur: number, total: number): Array<number | 'ellipsis'> => {
        if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
        const pages: Array<number | 'ellipsis'> = [1]
        const left = Math.max(2, cur - 1)
        const right = Math.min(total - 1, cur + 1)
        if (left > 2) pages.push('ellipsis')
        for (let p = left; p <= right; p++) pages.push(p)
        if (right < total - 1) pages.push('ellipsis')
        pages.push(total)
        return pages
    }

    if (waitingGuests.length === 0) {
        return (
            <div className={styles.emptyState}>
                <FaUsers className={styles.emptyIcon} />
                <p>No guests waiting</p>
                <span>Share your waiting room link to invite guests</span>
            </div>
        )
    }

    const pages = buildPages(currentPage, totalPages)

    return (
        <div className={styles.tableContainer}>
            <div className={styles.header}>
                <FaUsers />
                <span>{waitingGuests.length} waiting</span>
                {totalPages > 1 && (
                    <span className={styles.pageMeta}>
                        Page {currentPage} of {totalPages}
                    </span>
                )}
            </div>

            <div className={styles.tableScroll}>
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
                        {visible.map((guest) => (
                            <tr key={guest.id}>
                                <td className={styles.guestName}>{guest.guest_name}</td>
                                <td className={styles.meetingTitle} title={guest.meeting_title || 'Meeting'}>
                                    {guest.meeting_title || 'Meeting'}
                                </td>
                                <td className={styles.waitTime}>
                                    <FaClock />
                                    {formatWaitTime(guest.joined_at)}
                                </td>
                                {teamMembers.length > 0 && (
                                    <td>
                                        <select
                                            value={assignSelections[guest.id] || 'auto'}
                                            onChange={(e) =>
                                                setAssignSelections((prev) => ({
                                                    ...prev,
                                                    [guest.id]: e.target.value,
                                                }))
                                            }
                                            className={styles.assignSelect}
                                        >
                                            <option value="auto">🔄 Auto (Online + Free)</option>
                                            {teamMembers.map((m) => (
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
                                                selectedMember && selectedMember !== 'auto'
                                                    ? selectedMember
                                                    : undefined
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

            {totalPages > 1 && (
                <div className={styles.pagination}>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={styles.pageBtn}
                        aria-label="Previous page"
                    >
                        ← Prev
                    </button>
                    <div className={styles.pageNumbers}>
                        {pages.map((p, i) =>
                            p === 'ellipsis' ? (
                                <span key={`e-${i}`} className={styles.pageEllipsis}>
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPage(p)}
                                    className={`${styles.pageNumber} ${currentPage === p ? styles.pageActive : ''}`}
                                    aria-current={currentPage === p ? 'page' : undefined}
                                >
                                    {p}
                                </button>
                            )
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={styles.pageBtn}
                        aria-label="Next page"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}
