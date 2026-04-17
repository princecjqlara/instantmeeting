'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import { buildGuestJoinInsights } from '@/lib/guest-join-insights'
import { buildLeadSummaryRows } from '@/lib/lead-summary'
import {
    FaArrowLeft, FaUsers, FaCalendarAlt, FaClock,
    FaUser, FaEnvelope, FaCheckCircle, FaHourglassHalf,
    FaTimesCircle, FaSearch, FaDownload, FaPhone, FaTrash
} from 'react-icons/fa'

interface LeadAnswer {
    question_id: string
    question_text: string
    type: string
    answer: string | string[]
}

interface Lead {
    id: string
    guest_name: string
    guest_email?: string
    guest_phone?: string
    status: 'waiting' | 'admitted' | 'left'
    joined_at: string
    admitted_at?: string
    note?: string
    custom_fields?: Array<{ id: string; label: string; value: string }>
    lead_form_id?: string | null
    qualification_score?: number | null
    qualification_verdict?: 'qualified' | 'unqualified' | 'review' | null
    qualification_reasoning?: string | null
    lead_answers?: LeadAnswer[] | null
    meetings: {
        id: string
        title: string
        scheduled_at?: string
        status: string
    }
}

export default function LeadsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [leads, setLeads] = useState<Lead[]>([])
    const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'admitted' | 'left'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const leadsPerPage = 12

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const res = await fetch('/api/leads')
                if (res.ok) {
                    const data = await res.json()
                    setLeads(data)
                    setFilteredLeads(data)
                }
            } catch (error) {
                console.error('Error fetching leads:', error)
            } finally {
                setLoading(false)
            }
        }

        if (session) {
            fetchLeads()
        }
    }, [session])

    useEffect(() => {
        let filtered = leads

        if (statusFilter !== 'all') {
            filtered = filtered.filter(lead => lead.status === statusFilter)
        }

        if (searchQuery) {
            filtered = filtered.filter(lead =>
                lead.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.meetings?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.guest_email?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        setFilteredLeads(filtered)
        setCurrentPage(1) // Reset to first page when filters change
    }, [statusFilter, searchQuery, leads])

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'admitted': return <FaCheckCircle className={styles.statusAdmitted} />
            case 'waiting': return <FaHourglassHalf className={styles.statusWaiting} />
            case 'left': return <FaTimesCircle className={styles.statusLeft} />
            default: return <FaHourglassHalf />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'admitted': return 'Admitted'
            case 'waiting': return 'Waiting'
            case 'left': return 'Left'
            default: return status
        }
    }

    const stats = {
        total: leads.length,
        waiting: leads.filter(l => l.status === 'waiting').length,
        admitted: leads.filter(l => l.status === 'admitted').length,
        left: leads.filter(l => l.status === 'left').length
    }

    const joinInsights = useMemo(
        () => buildGuestJoinInsights(leads, browserTimeZone),
        [browserTimeZone, leads]
    )

    const summaryRows = useMemo(
        () => buildLeadSummaryRows(filteredLeads, browserTimeZone),
        [browserTimeZone, filteredLeads]
    )

    const formSubmissions = useMemo(
        () => filteredLeads.filter(l => Array.isArray(l.custom_fields) && l.custom_fields.length > 0),
        [filteredLeads]
    )

    const formFieldLabels = useMemo(() => {
        const labels: string[] = []
        const seen = new Set<string>()
        formSubmissions.forEach(lead => {
            lead.custom_fields?.forEach(f => {
                if (!seen.has(f.label)) {
                    seen.add(f.label)
                    labels.push(f.label)
                }
            })
        })
        return labels
    }, [formSubmissions])

    const busiestWeekday = useMemo(() => {
        return joinInsights.weekdays.reduce((best, current) => {
            if (!best || current.count > best.count) {
                return current
            }

            return best
        }, joinInsights.weekdays[0])
    }, [joinInsights.weekdays])

    const deleteLead = async (lead: Lead) => {
        const confirmed = window.confirm(`Delete lead "${lead.guest_name}"? This cannot be undone.`)
        if (!confirmed) return

        setDeletingLeadId(lead.id)

        try {
            const response = await fetch(`/api/leads?id=${encodeURIComponent(lead.id)}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => null)
                alert(errorData?.error || 'Failed to delete lead')
                return
            }

            setLeads(prev => prev.filter(item => item.id !== lead.id))
            setSelectedLead(prev => (prev?.id === lead.id ? null : prev))
        } catch (error) {
            console.error('Error deleting lead:', error)
            alert('Failed to delete lead')
        } finally {
            setDeletingLeadId(null)
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button onClick={() => router.back()} className={styles.iconBtn}>
                    <FaArrowLeft />
                </button>
                <div className={styles.headerTitle}>
                    <FaUsers />
                    <span>Lead Management</span>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.exportBtn}>
                        <FaDownload />
                        Export
                    </button>
                </div>
            </header>

            {/* Stats Overview */}
            <section className={styles.statsSection}>
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                            <FaUsers />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>{stats.total}</span>
                            <span className={styles.statLabel}>Total Leads</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
                            <FaHourglassHalf />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>{stats.waiting}</span>
                            <span className={styles.statLabel}>Waiting</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                            <FaCheckCircle />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>{stats.admitted}</span>
                            <span className={styles.statLabel}>Admitted</span>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #f87171, #ef4444)' }}>
                            <FaTimesCircle />
                        </div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>{stats.left}</span>
                            <span className={styles.statLabel}>Left</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.insightsSection}>
                <div className={styles.insightsHeader}>
                    <div>
                        <h2 className={styles.insightsTitle}>
                            <FaClock />
                            Guest Join Patterns
                        </h2>
                        <p className={styles.insightsDescription}>
                            Average guest join times by weekday in {browserTimeZone}.
                        </p>
                    </div>
                    <span className={styles.timezoneBadge}>{joinInsights.totalJoins} joins tracked</span>
                </div>

                {joinInsights.totalJoins === 0 ? (
                    <div className={styles.insightsEmpty}>
                        <FaUsers />
                        <p>No join patterns yet</p>
                        <span>Insights will appear after guests start joining meetings.</span>
                    </div>
                ) : (
                    <>
                        <div className={styles.insightsHighlights}>
                            <div className={styles.highlightCard}>
                                <span className={styles.highlightLabel}>Overall average join time</span>
                                <strong>{joinInsights.overallAverage?.label}</strong>
                                <p>Across all guest joins on your account.</p>
                            </div>
                            <div className={styles.highlightCard}>
                                <span className={styles.highlightLabel}>Busiest weekday</span>
                                <strong>{busiestWeekday?.weekday || 'N/A'}</strong>
                                <p>
                                    {busiestWeekday
                                        ? `${busiestWeekday.count} joins, averaging ${busiestWeekday.averageTime.label}`
                                        : 'Not enough data yet.'}
                                </p>
                            </div>
                        </div>

                        <div className={styles.weekdayGrid}>
                            {joinInsights.weekdays.map((day) => (
                                <article key={day.weekday} className={styles.weekdayCard}>
                                    <div className={styles.weekdayHeader}>
                                        <span>{day.weekday}</span>
                                        <span className={styles.weekdayCount}>{day.count}</span>
                                    </div>
                                    <strong className={styles.weekdayTime}>{day.averageTime.label}</strong>
                                    <p className={styles.weekdayCaption}>Average guest join time</p>
                                </article>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {/* Filters */}
            <section className={styles.filtersSection}>
                <div className={styles.searchBox}>
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.filterButtons}>
                    {(['all', 'waiting', 'admitted', 'left'] as const).map((filter) => (
                        <button
                            key={filter}
                            className={`${styles.filterBtn} ${statusFilter === filter ? styles.activeFilter : ''}`}
                            onClick={() => setStatusFilter(filter)}
                        >
                            {getStatusIcon(filter === 'all' ? 'waiting' : filter)}
                            <span>{filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
                            <span className={styles.filterCount}>
                                {filter === 'all' ? stats.total : stats[filter]}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <section className={styles.summarySection}>
                <div className={styles.summaryHeader}>
                    <div>
                        <h2 className={styles.summaryTitle}>Lead Summary Table</h2>
                        <p className={styles.summaryDescription}>
                            Review every visible lead, their submitted form details, and the full meeting timeline in {browserTimeZone}.
                        </p>
                    </div>
                    <span className={styles.summaryBadge}>{summaryRows.length} visible leads</span>
                </div>

                {summaryRows.length === 0 ? (
                    <div className={styles.summaryEmpty}>
                        <p>No lead rows to show yet.</p>
                        <span>New form submissions will appear here automatically.</span>
                    </div>
                ) : (
                    <div className={styles.summaryTableWrap}>
                        <table className={styles.summaryTable}>
                            <thead>
                                <tr>
                                    <th>Lead</th>
                                    <th>Meeting</th>
                                    <th>Status</th>
                                    <th>Scheduled Start</th>
                                    <th>Joined</th>
                                    <th>Admitted</th>
                                    <th>Wait Time</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Form Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryRows.map((row) => (
                                    <tr key={row.id}>
                                        <td className={styles.summaryLeadCell}>{row.name}</td>
                                        <td>{row.meetingTitle}</td>
                                        <td>
                                            <span className={styles.summaryStatus}>{row.status}</span>
                                        </td>
                                        <td className={styles.summaryTimeCell}>{row.scheduledAt}</td>
                                        <td className={styles.summaryTimeCell}>{row.joinedAt}</td>
                                        <td className={styles.summaryTimeCell}>{row.admittedAt}</td>
                                        <td>{row.waitDuration}</td>
                                        <td>{row.email}</td>
                                        <td>{row.phone}</td>
                                        <td className={styles.summaryDetailsCell}>{row.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className={styles.summarySection}>
                <div className={styles.summaryHeader}>
                    <div>
                        <h2 className={styles.summaryTitle}>Form Submissions</h2>
                        <p className={styles.summaryDescription}>
                            All leads who filled out the booking form, with their submitted answers.
                        </p>
                    </div>
                    <span className={styles.summaryBadge}>{formSubmissions.length} submissions</span>
                </div>

                {formSubmissions.length === 0 ? (
                    <div className={styles.summaryEmpty}>
                        <p>No form submissions yet.</p>
                        <span>Leads who complete the booking form will be listed here.</span>
                    </div>
                ) : (
                    <div className={styles.summaryTableWrap}>
                        <table className={styles.summaryTable}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Meeting</th>
                                    <th>Submitted</th>
                                    {formFieldLabels.map(label => (
                                        <th key={label}>{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {formSubmissions.map(lead => {
                                    const fieldMap = new Map(
                                        (lead.custom_fields || []).map(f => [f.label, f.value])
                                    )
                                    return (
                                        <tr key={lead.id}>
                                            <td className={styles.summaryLeadCell}>{lead.guest_name}</td>
                                            <td>{lead.guest_email || '—'}</td>
                                            <td>{lead.guest_phone || '—'}</td>
                                            <td>{lead.meetings?.title || '—'}</td>
                                            <td className={styles.summaryTimeCell}>
                                                {formatDate(lead.joined_at)} {formatTime(lead.joined_at)}
                                            </td>
                                            {formFieldLabels.map(label => (
                                                <td key={label} className={styles.summaryDetailsCell}>
                                                    {fieldMap.get(label) || '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Leads List */}
            {(() => {
                // Pagination calculations
                const indexOfLastLead = currentPage * leadsPerPage
                const indexOfFirstLead = indexOfLastLead - leadsPerPage
                const currentLeads = filteredLeads.slice(indexOfFirstLead, indexOfLastLead)
                const totalPages = Math.ceil(filteredLeads.length / leadsPerPage)
                
                return (
            <section className={styles.leadsSection}>
                {filteredLeads.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaUsers className={styles.emptyIcon} />
                        <p>No leads found</p>
                        <span>{searchQuery ? 'Try adjusting your search' : 'Leads will appear here when guests join your meetings'}</span>
                    </div>
                ) : (
                    <>
                    {/* Pagination Info */}
                    <div className={styles.paginationInfo}>
                        <span>Showing {Math.min((currentPage - 1) * leadsPerPage + 1, filteredLeads.length)}-{Math.min(currentPage * leadsPerPage, filteredLeads.length)} of {filteredLeads.length} leads</span>
                    </div>
                    <div className={styles.leadsGrid}>
                        {currentLeads.map((lead) => (
                            <div 
                                key={lead.id} 
                                className={styles.leadCard}
                                onClick={() => setSelectedLead(lead)}
                            >
                                <div className={styles.leadHeader}>
                                    <div className={styles.leadAvatar}>
                                        {lead.guest_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.leadHeaderRight}>
                                        <div className={styles.leadStatus}>
                                            {getStatusIcon(lead.status)}
                                            <span>{getStatusLabel(lead.status)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.deleteLeadBtn}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteLead(lead)
                                            }}
                                            disabled={deletingLeadId === lead.id}
                                            title="Delete lead"
                                            aria-label="Delete lead"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.leadInfo}>
                                    <h3 className={styles.leadName}>{lead.guest_name}</h3>
                                    <p className={styles.leadMeeting}>
                                        <FaCalendarAlt />
                                        {lead.meetings?.title || 'Meeting'}
                                    </p>
                                    {lead.qualification_verdict && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 11 }}>
                                            <span
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    fontWeight: 600,
                                                    background:
                                                        lead.qualification_verdict === 'qualified'
                                                            ? 'rgba(34,197,94,0.15)'
                                                            : lead.qualification_verdict === 'review'
                                                              ? 'rgba(251,191,36,0.15)'
                                                              : 'rgba(239,68,68,0.15)',
                                                    color:
                                                        lead.qualification_verdict === 'qualified'
                                                            ? '#86efac'
                                                            : lead.qualification_verdict === 'review'
                                                              ? '#fcd34d'
                                                              : '#fca5a5',
                                                }}
                                            >
                                                {lead.qualification_verdict}
                                                {typeof lead.qualification_score === 'number'
                                                    ? ` · ${lead.qualification_score}`
                                                    : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.leadMeta}>
                                    <div className={styles.metaItem}>
                                        <FaClock />
                                        <span>Joined {formatTime(lead.joined_at)}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <FaCalendarAlt />
                                        <span>{formatDate(lead.joined_at)}</span>
                                    </div>
                                </div>

                                {lead.guest_email && (
                                    <div className={styles.contactInfo}>
                                        <FaEnvelope />
                                        <span>{lead.guest_email}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
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
                                        className={`${styles.pageNumber} ${currentPage === page ? styles.activePage : ''}`}
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
                    )}
                    </>
                )}
            </section>
                )
            })()}

            {/* Lead Detail Modal */}
            {selectedLead && (
                <div className={styles.modal} onClick={() => setSelectedLead(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Lead Details</h2>
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={`${styles.deleteLeadBtn} ${styles.deleteLeadBtnDanger}`}
                                    onClick={() => deleteLead(selectedLead)}
                                    disabled={deletingLeadId === selectedLead.id}
                                >
                                    <FaTrash />
                                    {deletingLeadId === selectedLead.id ? 'Deleting...' : 'Delete'}
                                </button>
                                <button className={styles.closeBtn} onClick={() => setSelectedLead(null)}>
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.detailHeader}>
                                <div className={styles.detailAvatar}>
                                    {selectedLead.guest_name.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.detailTitle}>
                                    <h3>{selectedLead.guest_name}</h3>
                                    <span className={styles.detailStatus}>
                                        {getStatusIcon(selectedLead.status)}
                                        {getStatusLabel(selectedLead.status)}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h4>Meeting Information</h4>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <FaCalendarAlt />
                                        <div>
                                            <label>Meeting</label>
                                            <span>{selectedLead.meetings?.title || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <FaClock />
                                        <div>
                                            <label>Joined At</label>
                                            <span>{formatTime(selectedLead.joined_at)} on {formatDate(selectedLead.joined_at)}</span>
                                        </div>
                                    </div>
                                    {selectedLead.admitted_at && (
                                        <div className={styles.detailItem}>
                                            <FaCheckCircle />
                                            <div>
                                                <label>Admitted At</label>
                                                <span>{formatTime(selectedLead.admitted_at)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h4>Contact Information</h4>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <FaUser />
                                        <div>
                                            <label>Name</label>
                                            <span>{selectedLead.guest_name}</span>
                                        </div>
                                    </div>
                                    {selectedLead.guest_email && (
                                        <div className={styles.detailItem}>
                                            <FaEnvelope />
                                            <div>
                                                <label>Email</label>
                                                <span>{selectedLead.guest_email}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedLead.guest_phone && (
                                        <div className={styles.detailItem}>
                                            <FaPhone />
                                            <div>
                                                <label>Phone</label>
                                                <span>{selectedLead.guest_phone}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedLead.note && (
                                <div className={styles.detailSection}>
                                    <h4>Note</h4>
                                    <p className={styles.noteText}>{selectedLead.note}</p>
                                </div>
                            )}

                            {selectedLead.qualification_verdict && (
                                <div className={styles.detailSection}>
                                    <h4>AI Qualification</h4>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                                        <span
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background:
                                                    selectedLead.qualification_verdict === 'qualified'
                                                        ? 'rgba(34,197,94,0.15)'
                                                        : selectedLead.qualification_verdict === 'review'
                                                          ? 'rgba(251,191,36,0.15)'
                                                          : 'rgba(239,68,68,0.15)',
                                                color:
                                                    selectedLead.qualification_verdict === 'qualified'
                                                        ? '#86efac'
                                                        : selectedLead.qualification_verdict === 'review'
                                                          ? '#fcd34d'
                                                          : '#fca5a5',
                                            }}
                                        >
                                            {selectedLead.qualification_verdict.toUpperCase()}
                                        </span>
                                        {typeof selectedLead.qualification_score === 'number' && (
                                            <span style={{ fontSize: 14, opacity: 0.85 }}>
                                                Score: <strong>{selectedLead.qualification_score}</strong>/100
                                            </span>
                                        )}
                                    </div>
                                    {selectedLead.qualification_reasoning && (
                                        <p className={styles.noteText}>{selectedLead.qualification_reasoning}</p>
                                    )}
                                </div>
                            )}

                            {selectedLead.lead_answers && selectedLead.lead_answers.length > 0 && (
                                <div className={styles.detailSection}>
                                    <h4>Form Answers</h4>
                                    <div className={styles.detailGrid}>
                                        {selectedLead.lead_answers.map((a) => (
                                            <div key={a.question_id} className={styles.detailItem}>
                                                <div>
                                                    <label>{a.question_text}</label>
                                                    <span>
                                                        {Array.isArray(a.answer) ? a.answer.join(', ') : a.answer}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedLead.custom_fields && selectedLead.custom_fields.length > 0 && (
                                <div className={styles.detailSection}>
                                    <h4>Custom Responses</h4>
                                    <div className={styles.detailGrid}>
                                        {selectedLead.custom_fields.map((field) => (
                                            <div key={field.id} className={styles.detailItem}>
                                                <div>
                                                    <label>{field.label}</label>
                                                    <span>{field.value}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
