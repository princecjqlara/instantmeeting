'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import {
    FaArrowLeft, FaUsers, FaFilter, FaCalendarAlt, FaClock,
    FaUser, FaEnvelope, FaCheckCircle, FaHourglassHalf,
    FaTimesCircle, FaSearch, FaDownload, FaPhone
} from 'react-icons/fa'

interface Lead {
    id: string
    guest_name: string
    guest_email?: string
    guest_phone?: string
    status: 'waiting' | 'admitted' | 'left'
    joined_at: string
    admitted_at?: string
    note?: string
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

            {/* Leads List */}
            <section className={styles.leadsSection}>
                {filteredLeads.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaUsers className={styles.emptyIcon} />
                        <p>No leads found</p>
                        <span>{searchQuery ? 'Try adjusting your search' : 'Leads will appear here when guests join your meetings'}</span>
                    </div>
                ) : (
                    <div className={styles.leadsGrid}>
                        {filteredLeads.map((lead) => (
                            <div 
                                key={lead.id} 
                                className={styles.leadCard}
                                onClick={() => setSelectedLead(lead)}
                            >
                                <div className={styles.leadHeader}>
                                    <div className={styles.leadAvatar}>
                                        {lead.guest_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.leadStatus}>
                                        {getStatusIcon(lead.status)}
                                        <span>{getStatusLabel(lead.status)}</span>
                                    </div>
                                </div>

                                <div className={styles.leadInfo}>
                                    <h3 className={styles.leadName}>{lead.guest_name}</h3>
                                    <p className={styles.leadMeeting}>
                                        <FaCalendarAlt />
                                        {lead.meetings?.title || 'Meeting'}
                                    </p>
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
                )}
            </section>

            {/* Lead Detail Modal */}
            {selectedLead && (
                <div className={styles.modal} onClick={() => setSelectedLead(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Lead Details</h2>
                            <button className={styles.closeBtn} onClick={() => setSelectedLead(null)}>
                                ×
                            </button>
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
