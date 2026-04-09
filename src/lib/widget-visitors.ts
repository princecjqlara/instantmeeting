export interface BuildWidgetVisitorPresenceRecordOptions {
    hostId: string
    sessionId: string
    page?: string | null
    title?: string | null
    scrollDepth?: number | null
    now: string
    mirrorEnabled?: boolean
}

function normalizeOptionalText(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function normalizeScrollDepth(value?: number | null) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 0
    }

    return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildWidgetVisitorPresenceRecord(opts: BuildWidgetVisitorPresenceRecordOptions) {
    return {
        host_id: opts.hostId,
        session_id: opts.sessionId,
        current_page_url: normalizeOptionalText(opts.page),
        current_page_title: normalizeOptionalText(opts.title),
        scroll_depth: normalizeScrollDepth(opts.scrollDepth),
        last_heartbeat_at: opts.now,
        mirror_active: opts.mirrorEnabled ?? true,
    }
}

export function buildWidgetVisitorLeavePatch(now: string) {
    return {
        status: 'left',
        last_heartbeat_at: now,
        mirror_active: false,
    }
}
