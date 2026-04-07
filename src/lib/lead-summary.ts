type LeadSummaryField = {
    id: string
    label: string
    value: string
}

type LeadSummarySource = {
    id: string
    guest_name: string
    guest_email?: string | null
    guest_phone?: string | null
    status: 'waiting' | 'admitted' | 'left' | string
    joined_at: string
    admitted_at?: string | null
    note?: string | null
    custom_fields?: LeadSummaryField[] | null
    meetings?: {
        title?: string | null
        scheduled_at?: string | null
    } | null
}

export type LeadSummaryRow = {
    id: string
    name: string
    meetingTitle: string
    email: string
    phone: string
    status: string
    scheduledAt: string
    joinedAt: string
    admittedAt: string
    waitDuration: string
    details: string
}

const EMPTY_VALUE = '-'

function formatStatusLabel(status: LeadSummarySource['status']) {
    switch (status) {
        case 'admitted':
            return 'Admitted'
        case 'waiting':
            return 'Waiting'
        case 'left':
            return 'Left'
        default:
            return status
    }
}

function formatDateTime(dateString: string | null | undefined, timeZone: string) {
    if (!dateString) {
        return EMPTY_VALUE
    }

    const parsed = new Date(dateString)

    if (Number.isNaN(parsed.getTime())) {
        return EMPTY_VALUE
    }

    return new Intl.DateTimeFormat('en-US', {
        timeZone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed)
}

function formatWaitDuration(joinedAt: string, admittedAt: string | null | undefined) {
    if (!admittedAt) {
        return EMPTY_VALUE
    }

    const joinedAtDate = new Date(joinedAt)
    const admittedAtDate = new Date(admittedAt)

    if (Number.isNaN(joinedAtDate.getTime()) || Number.isNaN(admittedAtDate.getTime())) {
        return EMPTY_VALUE
    }

    const totalMinutes = Math.max(0, Math.round((admittedAtDate.getTime() - joinedAtDate.getTime()) / 60000))

    if (totalMinutes < 60) {
        return `${totalMinutes} min`
    }

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (minutes === 0) {
        return `${hours} hr`
    }

    return `${hours} hr ${minutes} min`
}

function formatDetails(lead: LeadSummarySource) {
    const details: string[] = []

    for (const field of lead.custom_fields ?? []) {
        const label = field.label?.trim()
        const value = field.value?.trim()

        if (label && value) {
            details.push(`${label}: ${value}`)
        }
    }

    const note = lead.note?.trim()
    if (note) {
        details.push(`Note: ${note}`)
    }

    return details.length > 0 ? details.join(' | ') : EMPTY_VALUE
}

export function buildLeadSummaryRows(leads: LeadSummarySource[], timeZone = 'UTC'): LeadSummaryRow[] {
    return leads.map((lead) => ({
        id: lead.id,
        name: lead.guest_name,
        meetingTitle: lead.meetings?.title?.trim() || 'Meeting',
        email: lead.guest_email?.trim() || EMPTY_VALUE,
        phone: lead.guest_phone?.trim() || EMPTY_VALUE,
        status: formatStatusLabel(lead.status),
        scheduledAt: formatDateTime(lead.meetings?.scheduled_at, timeZone),
        joinedAt: formatDateTime(lead.joined_at, timeZone),
        admittedAt: formatDateTime(lead.admitted_at, timeZone),
        waitDuration: formatWaitDuration(lead.joined_at, lead.admitted_at),
        details: formatDetails(lead),
    }))
}
