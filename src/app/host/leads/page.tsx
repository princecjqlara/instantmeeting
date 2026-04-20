'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import { buildGuestJoinInsights } from '@/lib/guest-join-insights'
import { buildLeadSummaryRows } from '@/lib/lead-summary'
import { buildPaginationItems, paginateItems } from '@/lib/pagination'
import {
    DEFAULT_LEADS_PIPELINE_STAGES,
    canManuallyMoveLeadToStage,
    deriveLeadPipelineStage,
    normalizeLeadsPipelineStages,
} from '@/lib/lead-pipeline'
import {
    FaArrowLeft, FaUsers, FaCalendarAlt, FaClock,
    FaEnvelope, FaCheckCircle, FaHourglassHalf,
    FaTimesCircle, FaSearch, FaDownload, FaTrash,
    FaTag, FaPlus, FaTimes, FaCheckSquare, FaSquare, FaSave
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
    status: 'waiting' | 'admitted' | 'left' | 'draft'
    joined_at: string
    admitted_at?: string
    note?: string
    custom_fields?: Array<{ id: string; label: string; value: string }>
    lead_form_id?: string | null
    qualification_score?: number | null
    qualification_verdict?: 'qualified' | 'unqualified' | 'review' | null
    qualification_reasoning?: string | null
    lead_answers?: LeadAnswer[] | null
    tags?: string[] | null
    pipeline_stage?: string | null
    is_draft?: boolean
    meetings: {
        id: string
        title: string
        scheduled_at?: string
        status: string
    }
}

function resolveLeadStage(lead: Pick<Lead, 'pipeline_stage' | 'status' | 'joined_at' | 'qualification_verdict' | 'is_draft'>): string {
    return (
        lead.pipeline_stage ||
        deriveLeadPipelineStage({
            submittedAt: lead.status === 'draft' ? null : lead.joined_at,
            qualificationVerdict: lead.qualification_verdict || null,
            currentStage: lead.pipeline_stage,
            isDraft: lead.is_draft,
        })
    )
}

const pillBtn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.12)'}`,
    color: active ? '#c7d2fe' : '#e5e7eb',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
})

export default function LeadsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [leads, setLeads] = useState<Lead[]>([])
    const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'admitted' | 'left'>('all')
    const [dataFilter, setDataFilter] = useState<'all' | 'with_data' | 'no_data'>('all')
    const [tagFilter, setTagFilter] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [tagInput, setTagInput] = useState('')
    const [bulkTagInput, setBulkTagInput] = useState('')
    const [bulkBusy, setBulkBusy] = useState(false)
    const [pipelineStages, setPipelineStages] = useState<string[]>([...DEFAULT_LEADS_PIPELINE_STAGES])
    const [pipelineStagesInput, setPipelineStagesInput] = useState(DEFAULT_LEADS_PIPELINE_STAGES.join(', '))
    const [metaCapiAccessToken, setMetaCapiAccessToken] = useState('')
    const [metaCapiDatasetId, setMetaCapiDatasetId] = useState('')
    const [savingSettings, setSavingSettings] = useState(false)
    const [savingLead, setSavingLead] = useState(false)
    const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [summaryPage, setSummaryPage] = useState(1)
    const leadsPerPage = 12
    const summaryRowsPerPage = 10

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const [leadsRes, settingsRes] = await Promise.all([
                    fetch('/api/leads'),
                    fetch('/api/profile/settings'),
                ])
                if (leadsRes.ok) {
                    const data = await leadsRes.json()
                    setLeads(data)
                    setFilteredLeads(data)
                }
                if (settingsRes.ok) {
                    const settings = await settingsRes.json()
                    const nextStages = normalizeLeadsPipelineStages(settings.leads_pipeline_stages)
                    setPipelineStages(nextStages)
                    setPipelineStagesInput(nextStages.join(', '))
                    setMetaCapiAccessToken(settings.meta_capi_access_token || '')
                    setMetaCapiDatasetId(settings.meta_capi_dataset_id || '')
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

    const hasData = (lead: Lead): boolean => {
        const hasAnswers = Array.isArray(lead.lead_answers) && lead.lead_answers.length > 0
        const hasCustom = Array.isArray(lead.custom_fields) && lead.custom_fields.length > 0
        const hasContact = Boolean(lead.guest_email || lead.guest_phone || lead.note)
        return hasAnswers || hasCustom || hasContact
    }

    useEffect(() => {
        let filtered = leads

        if (statusFilter !== 'all') {
            filtered = filtered.filter(lead => lead.status === statusFilter)
        }

        if (dataFilter === 'with_data') {
            filtered = filtered.filter(hasData)
        } else if (dataFilter === 'no_data') {
            filtered = filtered.filter((l) => !hasData(l))
        }

        if (tagFilter) {
            filtered = filtered.filter((l) => Array.isArray(l.tags) && l.tags.includes(tagFilter))
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter((lead) => {
                if (lead.guest_name?.toLowerCase().includes(q)) return true
                if (lead.meetings?.title?.toLowerCase().includes(q)) return true
                if (lead.guest_email?.toLowerCase().includes(q)) return true
                if (lead.guest_phone?.toLowerCase().includes(q)) return true
                if (lead.note?.toLowerCase().includes(q)) return true
                if ((lead.tags || []).some((t) => t.toLowerCase().includes(q))) return true
                if (
                    (lead.lead_answers || []).some((a) => {
                        const v = Array.isArray(a.answer) ? a.answer.join(' ') : String(a.answer || '')
                        return (
                            v.toLowerCase().includes(q) ||
                            (a.question_text || '').toLowerCase().includes(q)
                        )
                    })
                )
                    return true
                if (
                    (lead.custom_fields || []).some(
                        (f) =>
                            (f.label || '').toLowerCase().includes(q) ||
                            (f.value || '').toLowerCase().includes(q)
                    )
                )
                    return true
                return false
            })
        }

        setFilteredLeads(filtered)
        setCurrentPage(1) // Reset to first page when filters change
        setSummaryPage(1)
    }, [statusFilter, dataFilter, tagFilter, searchQuery, leads])

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
            case 'draft': return <FaHourglassHalf className={styles.statusWaiting} />
            default: return <FaHourglassHalf />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'admitted': return 'Admitted'
            case 'waiting': return 'Waiting'
            case 'left': return 'Left'
            case 'draft': return 'Draft'
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

    const summaryPagination = useMemo(
        () => paginateItems(summaryRows, summaryPage, summaryRowsPerPage),
        [summaryPage, summaryRows]
    )

    const leadCardsPagination = useMemo(
        () => paginateItems(filteredLeads, currentPage, leadsPerPage),
        [currentPage, filteredLeads]
    )

    const formSubmissions = useMemo(
        () =>
            filteredLeads.filter(
                (l) =>
                    (Array.isArray(l.custom_fields) && l.custom_fields.length > 0) ||
                    (Array.isArray(l.lead_answers) && l.lead_answers.length > 0)
            ),
        [filteredLeads]
    )

    const answerToText = (a: LeadAnswer): string => {
        if (Array.isArray(a.answer)) return a.answer.filter(Boolean).join(', ')
        return String(a.answer ?? '')
    }

    const verdictStyles = (v?: string | null) => {
        if (v === 'qualified') return { bg: 'rgba(34,197,94,0.15)', fg: '#86efac' }
        if (v === 'review') return { bg: 'rgba(251,191,36,0.15)', fg: '#fcd34d' }
        if (v === 'unqualified') return { bg: 'rgba(239,68,68,0.15)', fg: '#fca5a5' }
        return { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.7)' }
    }

    const busiestWeekday = useMemo(() => {
        return joinInsights.weekdays.reduce((best, current) => {
            if (!best || current.count > best.count) {
                return current
            }

            return best
        }, joinInsights.weekdays[0])
    }, [joinInsights.weekdays])

    const allTags = useMemo(() => {
        const s = new Set<string>()
        for (const l of leads) {
            for (const t of l.tags || []) if (t) s.add(t)
        }
        return Array.from(s).sort((a, b) => a.localeCompare(b))
    }, [leads])

    const summaryPages = buildPaginationItems(summaryPagination.currentPage, summaryPagination.totalPages)
    const leadPages = buildPaginationItems(leadCardsPagination.currentPage, leadCardsPagination.totalPages)

    const groupedPipelineLeads = useMemo(() => {
        return pipelineStages.map((stage) => ({
            stage,
            leads: filteredLeads.filter((lead) => resolveLeadStage(lead) === stage),
        }))
    }, [filteredLeads, pipelineStages])

    const updateLeadLocally = (leadId: string, updater: (lead: Lead) => Lead) => {
        setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updater(lead) : lead)))
        setFilteredLeads((prev) => prev.map((lead) => (lead.id === leadId ? updater(lead) : lead)))
        setSelectedLead((prev) => (prev?.id === leadId ? updater(prev) : prev))
    }

    const saveLeadPatch = async (leadId: string, patch: Record<string, unknown>) => {
        const response = await fetch('/api/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: leadId, ...patch }),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => null)
            throw new Error(error?.error || 'Failed to update lead')
        }
    }

    const savePipelineSettings = async () => {
        setSavingSettings(true)
        try {
            const normalizedStages = normalizeLeadsPipelineStages(
                pipelineStagesInput.split(',').map((stage) => stage.trim())
            )
            const res = await fetch('/api/profile/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leads_pipeline_stages: normalizedStages,
                    meta_capi_access_token: metaCapiAccessToken,
                    meta_capi_dataset_id: metaCapiDatasetId,
                }),
            })

            if (!res.ok) {
                const error = await res.json().catch(() => null)
                alert(error?.error || 'Failed to save lead settings')
                return
            }

            const data = await res.json()
            const nextStages = normalizeLeadsPipelineStages(data.leads_pipeline_stages)
            setPipelineStages(nextStages)
            setPipelineStagesInput(nextStages.join(', '))
            setMetaCapiAccessToken(data.meta_capi_access_token || '')
            setMetaCapiDatasetId(data.meta_capi_dataset_id || '')
        } finally {
            setSavingSettings(false)
        }
    }

    const moveLeadToStage = async (lead: Lead, nextStage: string) => {
        if (!canManuallyMoveLeadToStage({ from: lead.pipeline_stage, to: nextStage })) {
            alert('Only qualified leads can be moved to sold.')
            return
        }

        const previousStage = lead.pipeline_stage || 'prospect'
        updateLeadLocally(lead.id, (item) => ({ ...item, pipeline_stage: nextStage }))
        try {
            await saveLeadPatch(lead.id, { pipeline_stage: nextStage })
        } catch (error) {
            updateLeadLocally(lead.id, (item) => ({ ...item, pipeline_stage: previousStage }))
            alert(error instanceof Error ? error.message : 'Failed to move lead')
        }
    }

    const saveSelectedLead = async () => {
        if (!selectedLead) return
        setSavingLead(true)
        try {
            const payload: Record<string, unknown> = {
                guest_name: selectedLead.guest_name,
                guest_email: selectedLead.guest_email || '',
                guest_phone: selectedLead.guest_phone || '',
                pipeline_stage: selectedLead.pipeline_stage || 'prospect',
            }

            if (!selectedLead.is_draft) {
                payload.note = selectedLead.note || ''
                payload.custom_fields = selectedLead.custom_fields || []
            }

            await saveLeadPatch(selectedLead.id, payload)
            updateLeadLocally(selectedLead.id, () => ({ ...selectedLead }))
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to save lead')
        } finally {
            setSavingLead(false)
        }
    }

    const addCustomFieldToSelectedLead = () => {
        if (!selectedLead || selectedLead.is_draft) return
        setSelectedLead({
            ...selectedLead,
            custom_fields: [
                ...(selectedLead.custom_fields || []),
                { id: `field-${Date.now()}`, label: '', value: '' },
            ],
        })
    }

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAllVisible = () => {
        setSelectedIds((prev) => {
            const visible = filteredLeads.map((l) => l.id)
            const allSelected = visible.every((id) => prev.has(id))
            if (allSelected) {
                const next = new Set(prev)
                visible.forEach((id) => next.delete(id))
                return next
            }
            const next = new Set(prev)
            visible.forEach((id) => next.add(id))
            return next
        })
    }

    const clearSelection = () => setSelectedIds(new Set())

    const bulkDelete = async () => {
        if (selectedIds.size === 0) return
        const confirmed = window.confirm(
            `Delete ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`
        )
        if (!confirmed) return
        setBulkBusy(true)
        try {
            const ids = Array.from(selectedIds)
            const res = await fetch(`/api/leads?ids=${encodeURIComponent(ids.join(','))}`, {
                method: 'DELETE',
            })
            if (!res.ok) {
                const err = await res.json().catch(() => null)
                alert(err?.error || 'Bulk delete failed')
                return
            }
            setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)))
            setSelectedLead((prev) => (prev && selectedIds.has(prev.id) ? null : prev))
            clearSelection()
        } finally {
            setBulkBusy(false)
        }
    }

    const applyTagsToLeads = async (
        ids: string[],
        tags: string[],
        mode: 'set' | 'add' | 'remove'
    ) => {
        if (ids.length === 0 || tags.length === 0) return
        const res = await fetch('/api/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, tags, mode }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => null)
            alert(err?.error || 'Tag update failed')
            return
        }
        setLeads((prev) =>
            prev.map((l) => {
                if (!ids.includes(l.id)) return l
                const current = Array.isArray(l.tags) ? l.tags : []
                let next: string[]
                if (mode === 'set') next = Array.from(new Set(tags))
                else if (mode === 'add') next = Array.from(new Set([...current, ...tags]))
                else next = current.filter((t) => !tags.includes(t))
                return { ...l, tags: next }
            })
        )
        setSelectedLead((prev) => {
            if (!prev || !ids.includes(prev.id)) return prev
            const current = Array.isArray(prev.tags) ? prev.tags : []
            let next: string[]
            if (mode === 'set') next = Array.from(new Set(tags))
            else if (mode === 'add') next = Array.from(new Set([...current, ...tags]))
            else next = current.filter((t) => !tags.includes(t))
            return { ...prev, tags: next }
        })
    }

    const bulkAddTags = async () => {
        const parsed = bulkTagInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        if (parsed.length === 0 || selectedIds.size === 0) return
        setBulkBusy(true)
        try {
            await applyTagsToLeads(Array.from(selectedIds), parsed, 'add')
            setBulkTagInput('')
        } finally {
            setBulkBusy(false)
        }
    }

    const addTagToLead = async (lead: Lead, tag: string) => {
        const t = tag.trim()
        if (!t) return
        await applyTagsToLeads([lead.id], [t], 'add')
    }

    const removeTagFromLead = async (lead: Lead, tag: string) => {
        await applyTagsToLeads([lead.id], [tag], 'remove')
    }

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

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: 12, opacity: 0.6 }}>Show:</span>
                    {(
                        [
                            { v: 'all' as const, label: 'All' },
                            { v: 'with_data' as const, label: 'With data' },
                            { v: 'no_data' as const, label: 'No data' },
                        ]
                    ).map((opt) => (
                        <button
                            key={opt.v}
                            type="button"
                            onClick={() => setDataFilter(opt.v)}
                            style={pillBtn(dataFilter === opt.v)}
                        >
                            {opt.label}
                        </button>
                    ))}
                    {allTags.length > 0 && (
                        <>
                            <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 8 }}>Tag:</span>
                            <button
                                type="button"
                                onClick={() => setTagFilter(null)}
                                style={pillBtn(tagFilter === null)}
                            >
                                Any
                            </button>
                            {allTags.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTagFilter(tagFilter === t ? null : t)}
                                    style={pillBtn(tagFilter === t)}
                                >
                                    <FaTag style={{ fontSize: 10, marginRight: 4, verticalAlign: 'middle' }} />
                                    {t}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </section>

            {selectedIds.size > 0 && (
                <section
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                        margin: '0 0 16px',
                        padding: '12px 16px',
                        background: 'rgba(15, 18, 32, 0.95)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(99,102,241,0.45)',
                        borderRadius: 12,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        color: '#fff',
                    }}
                >
                    <strong style={{ fontSize: 13 }}>
                        {selectedIds.size} selected
                    </strong>
                    <button
                        type="button"
                        onClick={selectAllVisible}
                        style={pillBtn(false)}
                        disabled={bulkBusy}
                    >
                        {filteredLeads.every((l) => selectedIds.has(l.id)) && filteredLeads.length > 0
                            ? 'Deselect visible'
                            : 'Select all visible'}
                    </button>
                    <button type="button" onClick={clearSelection} style={pillBtn(false)} disabled={bulkBusy}>
                        Clear
                    </button>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Tag(s), comma-separated"
                            value={bulkTagInput}
                            onChange={(e) => setBulkTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    bulkAddTags()
                                }
                            }}
                            style={{
                                background: 'rgba(0,0,0,0.35)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                color: '#fff',
                                padding: '6px 10px',
                                borderRadius: 8,
                                fontSize: 12.5,
                                minWidth: 200,
                            }}
                            disabled={bulkBusy}
                        />
                        <button
                            type="button"
                            onClick={bulkAddTags}
                            disabled={bulkBusy || !bulkTagInput.trim()}
                            style={{
                                ...pillBtn(true),
                                background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                                border: 'none',
                            }}
                        >
                            <FaTag style={{ fontSize: 10, marginRight: 4 }} /> Add tags
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={bulkDelete}
                        disabled={bulkBusy}
                        style={{
                            ...pillBtn(false),
                            border: '1px solid rgba(239,68,68,0.45)',
                            color: '#fca5a5',
                            background: 'rgba(239,68,68,0.12)',
                        }}
                    >
                        <FaTrash style={{ fontSize: 11, marginRight: 4 }} /> Delete selected
                    </button>
                </section>
            )}

            <section className={styles.pipelineSection}>
                <div className={styles.pipelineSettingsCard}>
                    <div className={styles.pipelineCardHeader}>
                        <div>
                            <h2 className={styles.pipelineTitle}>Lead pipeline</h2>
                            <p className={styles.pipelineDescription}>
                                New unfinished and review leads go to prospect, unqualified leads go to unqualified, qualified leads go to qualified, and qualified leads can be dragged to sold.
                            </p>
                        </div>
                        <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={savePipelineSettings}
                            disabled={savingSettings}
                        >
                            <FaSave />
                            {savingSettings ? 'Saving…' : 'Save settings'}
                        </button>
                    </div>

                    <div className={styles.pipelineSettingsGrid}>
                        <label className={styles.fieldGroup}>
                            <span>Pipeline stages</span>
                            <input
                                className={styles.settingsInput}
                                value={pipelineStagesInput}
                                onChange={(e) => setPipelineStagesInput(e.target.value)}
                                placeholder="prospect, qualified, unqualified, sold"
                            />
                        </label>
                        <label className={styles.fieldGroup}>
                            <span>Meta CAPI access token</span>
                            <input
                                className={styles.settingsInput}
                                type="password"
                                value={metaCapiAccessToken}
                                onChange={(e) => setMetaCapiAccessToken(e.target.value)}
                                placeholder="Paste your access token"
                            />
                        </label>
                        <label className={styles.fieldGroup}>
                            <span>Meta dataset id</span>
                            <input
                                className={styles.settingsInput}
                                value={metaCapiDatasetId}
                                onChange={(e) => setMetaCapiDatasetId(e.target.value)}
                                placeholder="Enter dataset id"
                            />
                        </label>
                    </div>
                </div>

                <div className={styles.pipelineBoardShell}>
                    <div className={styles.pipelineBoardHeader}>
                        <div>
                            <h3 className={styles.pipelineBoardTitle}>Pipeline board</h3>
                            <p className={styles.pipelineBoardDescription}>
                                Review every active stage like a kanban board, then use the summary table below for the full timeline.
                            </p>
                        </div>
                        <div className={styles.summaryHeaderBadges}>
                            <span className={styles.summaryBadge}>{filteredLeads.length} visible leads</span>
                            <span className={styles.pipelineMetaBadge}>{pipelineStages.length} stages</span>
                        </div>
                    </div>

                    <div className={styles.pipelineBoard}>
                        {groupedPipelineLeads.map(({ stage, leads: stageLeads }) => (
                            <div
                                key={stage}
                                className={styles.pipelineColumn}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    const leadId = e.dataTransfer.getData('text/plain')
                                    const lead = leads.find((item) => item.id === leadId)
                                    if (lead) moveLeadToStage(lead, stage)
                                    setDraggingLeadId(null)
                                }}
                            >
                                <div className={styles.pipelineColumnHeader}>
                                    <strong>{stage}</strong>
                                    <span className={styles.pipelineColumnCount}>{stageLeads.length}</span>
                                </div>

                                <div className={styles.pipelineColumnBody}>
                                    {stageLeads.map((lead) => (
                                        <button
                                            key={lead.id}
                                            type="button"
                                            draggable={!lead.is_draft}
                                            onDragStart={(e) => {
                                                setDraggingLeadId(lead.id)
                                                e.dataTransfer.setData('text/plain', lead.id)
                                            }}
                                            onDragEnd={() => setDraggingLeadId(null)}
                                            onClick={() =>
                                                setSelectedLead({
                                                    ...lead,
                                                    custom_fields: [...(lead.custom_fields || [])],
                                                })
                                            }
                                            className={`${styles.pipelineLeadCard} ${draggingLeadId === lead.id ? styles.pipelineLeadCardDragging : ''}`}
                                        >
                                            <div className={styles.pipelineLeadTop}>
                                                <strong>{lead.guest_name}</strong>
                                                <span className={styles.pipelineLeadStatus}>{lead.is_draft ? 'draft' : lead.status}</span>
                                            </div>
                                            <span className={styles.pipelineLeadMeta}>{lead.guest_email || lead.guest_phone || 'No contact yet'}</span>
                                            <span className={styles.pipelineLeadMeta}>{lead.meetings?.title || 'Lead form'}</span>
                                            {lead.qualification_verdict && (
                                                <span className={styles.pipelineVerdict}>{lead.qualification_verdict}</span>
                                            )}
                                        </button>
                                    ))}
                                    {stageLeads.length === 0 && (
                                        <div className={styles.pipelineEmpty}>No leads in this stage</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`${styles.summarySection} ${styles.pipelineSummarySection}`}>
                    <div className={styles.summaryHeader}>
                        <div>
                            <h2 className={styles.summaryTitle}>Lead Summary Table</h2>
                            <p className={styles.summaryDescription}>
                                Review every visible lead, their submitted form details, and the full meeting timeline in {browserTimeZone}.
                            </p>
                        </div>
                        <div className={styles.summaryHeaderBadges}>
                            <span className={styles.summaryBadge}>{summaryRows.length} visible leads</span>
                            {summaryPagination.totalPages > 1 && (
                                <span className={styles.pipelineMetaBadge}>
                                    Page {summaryPagination.currentPage} of {summaryPagination.totalPages}
                                </span>
                            )}
                        </div>
                    </div>

                    {summaryRows.length === 0 ? (
                        <div className={styles.summaryEmpty}>
                            <p>No lead rows to show yet.</p>
                            <span>New form submissions will appear here automatically.</span>
                        </div>
                    ) : (
                        <>
                            <div className={styles.paginationInfo}>
                                <span>
                                    Showing {summaryPagination.start}-{summaryPagination.end} of {summaryRows.length} leads
                                </span>
                            </div>
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
                                        {summaryPagination.items.map((row) => (
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

                            {summaryPagination.totalPages > 1 && (
                                <div className={`${styles.pagination} ${styles.pipelineSummaryPagination}`}>
                                    <button
                                        type="button"
                                        onClick={() => setSummaryPage((page) => Math.max(1, page - 1))}
                                        disabled={summaryPagination.currentPage === 1}
                                        className={styles.pageBtn}
                                        aria-label="Previous summary page"
                                    >
                                        ← Prev
                                    </button>

                                    <div className={styles.pageNumbers}>
                                        {summaryPages.map((page, index) =>
                                            page === 'ellipsis' ? (
                                                <span key={`summary-ellipsis-${index}`} className={styles.pageEllipsis}>
                                                    …
                                                </span>
                                            ) : (
                                                <button
                                                    key={`summary-page-${page}`}
                                                    type="button"
                                                    onClick={() => setSummaryPage(page)}
                                                    className={`${styles.pageNumber} ${summaryPagination.currentPage === page ? styles.activePage : ''}`}
                                                    aria-current={summaryPagination.currentPage === page ? 'page' : undefined}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSummaryPage((page) => Math.min(summaryPagination.totalPages, page + 1))
                                        }
                                        disabled={summaryPagination.currentPage === summaryPagination.totalPages}
                                        className={styles.pageBtn}
                                        aria-label="Next summary page"
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            <section className={styles.summarySection}>
                <div className={styles.summaryHeader}>
                    <div>
                        <h2 className={styles.summaryTitle}>Lead Form Submissions</h2>
                        <p className={styles.summaryDescription}>
                            Guests who completed a lead form — with their answers and qualification.
                        </p>
                    </div>
                    <span className={styles.summaryBadge}>{formSubmissions.length} submissions</span>
                </div>

                {formSubmissions.length === 0 ? (
                    <div className={styles.summaryEmpty}>
                        <p>No form submissions yet.</p>
                        <span>Guests who fill out your lead form will appear here.</span>
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
                                    <th>Verdict</th>
                                    <th>Score</th>
                                    <th>Submitted</th>
                                    <th>Answers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formSubmissions.map((lead) => {
                                    const v = verdictStyles(lead.qualification_verdict)
                                    const answers: Array<{ q: string; a: string }> = []
                                    ;(lead.lead_answers || []).forEach((ans) => {
                                        answers.push({
                                            q: ans.question_text || 'Question',
                                            a: answerToText(ans) || '—',
                                        })
                                    })
                                    ;(lead.custom_fields || []).forEach((f) => {
                                        answers.push({ q: f.label, a: f.value || '—' })
                                    })
                                    return (
                                        <tr key={lead.id}>
                                            <td className={styles.summaryLeadCell}>
                                                {lead.guest_name}
                                            </td>
                                            <td>{lead.guest_email || '—'}</td>
                                            <td>{lead.guest_phone || '—'}</td>
                                            <td>{lead.meetings?.title || '—'}</td>
                                            <td>
                                                {lead.qualification_verdict ? (
                                                    <span
                                                        className={styles.verdictPill}
                                                        style={{ background: v.bg, color: v.fg }}
                                                    >
                                                        {lead.qualification_verdict}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className={styles.summaryScoreCell}>
                                                {typeof lead.qualification_score === 'number'
                                                    ? `${lead.qualification_score}/100`
                                                    : '—'}
                                            </td>
                                            <td className={styles.summaryTimeCell}>
                                                {formatDate(lead.joined_at)} {formatTime(lead.joined_at)}
                                            </td>
                                            <td className={styles.summaryAnswersCell}>
                                                {answers.length === 0 ? (
                                                    '—'
                                                ) : (
                                                    <ul className={styles.answersList}>
                                                        {answers.map((row, idx) => (
                                                            <li key={idx}>
                                                                <span className={styles.answerLabel}>
                                                                    {row.q}
                                                                </span>
                                                                <span className={styles.answerValue}>
                                                                    {row.a}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
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
                    <>
                    {/* Pagination Info */}
                    <div className={styles.paginationInfo}>
                        <span>
                            Showing {leadCardsPagination.start}-{leadCardsPagination.end} of {filteredLeads.length} leads
                        </span>
                    </div>
                    <div className={styles.leadsGrid}>
                        {leadCardsPagination.items.map((lead) => {
                            const isSelected = selectedIds.has(lead.id)
                            return (
                            <div
                                key={lead.id}
                                className={styles.leadCard}
                                onClick={() => setSelectedLead({ ...lead, custom_fields: [...(lead.custom_fields || [])] })}
                                style={
                                    isSelected
                                        ? { boxShadow: '0 0 0 2px rgba(99,102,241,0.7) inset' }
                                        : undefined
                                }
                            >
                                <div className={styles.leadHeader}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleSelected(lead.id)
                                        }}
                                        title={isSelected ? 'Deselect' : 'Select'}
                                        aria-label={isSelected ? 'Deselect' : 'Select'}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                                            cursor: 'pointer',
                                            padding: 4,
                                            marginRight: 4,
                                        }}
                                    >
                                        {isSelected ? <FaCheckSquare /> : <FaSquare />}
                                    </button>
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
                                    <div className={styles.stageBadgeRow}>
                                        <span className={styles.stageBadge}>{resolveLeadStage(lead) || '—'}</span>
                                        {lead.is_draft && <span className={styles.draftBadge}>unfinished</span>}
                                    </div>
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

                                {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 4,
                                            marginTop: 8,
                                        }}
                                    >
                                        {lead.tags.map((t) => (
                                            <span
                                                key={t}
                                                style={{
                                                    fontSize: 10.5,
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    background: 'rgba(99,102,241,0.15)',
                                                    color: '#c7d2fe',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                <FaTag style={{ fontSize: 8 }} />
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            )
                        })}
                    </div>
                    
                    {/* Pagination Controls */}
                    {leadCardsPagination.totalPages > 1 && (
                        <div className={styles.pagination}>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                disabled={leadCardsPagination.currentPage === 1}
                                className={styles.pageBtn}
                                aria-label="Previous page"
                            >
                                ← Prev
                            </button>
                            
                            <div className={styles.pageNumbers}>
                                {leadPages.map((page, index) =>
                                    page === 'ellipsis' ? (
                                        <span key={`lead-ellipsis-${index}`} className={styles.pageEllipsis}>
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={`lead-page-${page}`}
                                            type="button"
                                            onClick={() => setCurrentPage(page)}
                                            className={`${styles.pageNumber} ${leadCardsPagination.currentPage === page ? styles.activePage : ''}`}
                                            aria-current={leadCardsPagination.currentPage === page ? 'page' : undefined}
                                        >
                                            {page}
                                        </button>
                                    )
                                )}
                            </div>
                            
                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((page) => Math.min(leadCardsPagination.totalPages, page + 1))
                                }
                                disabled={leadCardsPagination.currentPage === leadCardsPagination.totalPages}
                                className={styles.pageBtn}
                                aria-label="Next page"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                    </>
                )}
            </section>

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
                                <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    onClick={saveSelectedLead}
                                    disabled={savingLead}
                                >
                                    <FaSave />
                                    {savingLead ? 'Saving…' : 'Save lead'}
                                </button>
                            </div>

                            <div className={styles.detailSection}>
                                <h4>Pipeline Stage</h4>
                                <select
                                    className={styles.settingsInput}
                                    value={selectedLead.pipeline_stage || 'prospect'}
                                    onChange={(e) =>
                                        setSelectedLead({ ...selectedLead, pipeline_stage: e.target.value })
                                    }
                                >
                                    {pipelineStages.map((stage) => (
                                        <option key={stage} value={stage}>
                                            {stage}
                                        </option>
                                    ))}
                                </select>
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
                                <div className={styles.editGrid}>
                                    <label className={styles.fieldGroup}>
                                        <span>Name</span>
                                        <input
                                            className={styles.settingsInput}
                                            value={selectedLead.guest_name}
                                            onChange={(e) =>
                                                setSelectedLead({ ...selectedLead, guest_name: e.target.value })
                                            }
                                        />
                                    </label>
                                    <label className={styles.fieldGroup}>
                                        <span>Email</span>
                                        <input
                                            className={styles.settingsInput}
                                            value={selectedLead.guest_email || ''}
                                            onChange={(e) =>
                                                setSelectedLead({ ...selectedLead, guest_email: e.target.value })
                                            }
                                        />
                                    </label>
                                    <label className={styles.fieldGroup}>
                                        <span>Phone</span>
                                        <input
                                            className={styles.settingsInput}
                                            value={selectedLead.guest_phone || ''}
                                            onChange={(e) =>
                                                setSelectedLead({ ...selectedLead, guest_phone: e.target.value })
                                            }
                                        />
                                    </label>
                                </div>
                            </div>

                            {!selectedLead.is_draft && (
                                <div className={styles.detailSection}>
                                    <h4>Internal Note</h4>
                                    <textarea
                                        className={styles.settingsTextarea}
                                        value={selectedLead.note || ''}
                                        onChange={(e) =>
                                            setSelectedLead({ ...selectedLead, note: e.target.value })
                                        }
                                        placeholder="Add internal notes, next steps, or context"
                                    />
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

                            <div className={styles.detailSection}>
                                <h4>Tags</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                    {(selectedLead.tags || []).length === 0 && (
                                        <span style={{ fontSize: 12, opacity: 0.6 }}>No tags yet.</span>
                                    )}
                                    {(selectedLead.tags || []).map((t) => (
                                        <span
                                            key={t}
                                            style={{
                                                fontSize: 12,
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                                background: 'rgba(99,102,241,0.15)',
                                                color: '#c7d2fe',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            <FaTag style={{ fontSize: 10 }} />
                                            {t}
                                            <button
                                                type="button"
                                                onClick={() => removeTagFromLead(selectedLead, t)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'inherit',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    display: 'inline-flex',
                                                }}
                                                title="Remove tag"
                                                aria-label={`Remove tag ${t}`}
                                            >
                                                <FaTimes style={{ fontSize: 10 }} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        const t = tagInput.trim()
                                        if (!t) return
                                        addTagToLead(selectedLead, t)
                                        setTagInput('')
                                    }}
                                    style={{ display: 'flex', gap: 6 }}
                                >
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        placeholder="Add a tag and press Enter"
                                        style={{
                                            flex: 1,
                                            background: 'rgba(0,0,0,0.35)',
                                            border: '1px solid rgba(255,255,255,0.14)',
                                            color: '#fff',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            fontSize: 13,
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        style={{
                                            background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '8px 14px',
                                            borderRadius: 8,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                        disabled={!tagInput.trim()}
                                    >
                                        <FaPlus style={{ fontSize: 10 }} /> Add
                                    </button>
                                </form>
                            </div>

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

                            {!selectedLead.is_draft && (
                                <div className={styles.detailSection}>
                                    <div className={styles.inlineSectionHeader}>
                                        <h4>Additional Lead Info</h4>
                                        <button type="button" className={styles.secondaryBtn} onClick={addCustomFieldToSelectedLead}>
                                            <FaPlus /> Add field
                                        </button>
                                    </div>
                                    <div className={styles.customFieldList}>
                                        {(selectedLead.custom_fields || []).map((field, index) => (
                                            <div key={field.id} className={styles.customFieldRow}>
                                                <input
                                                    className={styles.settingsInput}
                                                    value={field.label}
                                                    onChange={(e) => {
                                                        const next = [...(selectedLead.custom_fields || [])]
                                                        next[index] = { ...field, label: e.target.value }
                                                        setSelectedLead({ ...selectedLead, custom_fields: next })
                                                    }}
                                                    placeholder="Field label"
                                                />
                                                <input
                                                    className={styles.settingsInput}
                                                    value={field.value}
                                                    onChange={(e) => {
                                                        const next = [...(selectedLead.custom_fields || [])]
                                                        next[index] = { ...field, value: e.target.value }
                                                        setSelectedLead({ ...selectedLead, custom_fields: next })
                                                    }}
                                                    placeholder="Field value"
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.deleteLeadBtn}
                                                    onClick={() => {
                                                        const next = (selectedLead.custom_fields || []).filter((_, i) => i !== index)
                                                        setSelectedLead({ ...selectedLead, custom_fields: next })
                                                    }}
                                                >
                                                    <FaTimes />
                                                </button>
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
