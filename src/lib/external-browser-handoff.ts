export const EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY = 'instantmeeting:external-browser-handoff'
const EXTERNAL_BROWSER_HANDOFF_TTL_MS = 15_000
const IN_APP_BROWSER_REGEX = /FBAN|FBAV|Messenger|Instagram|musical_ly|BytedanceWebview|MicroMessenger|Line\/|Twitter|Snapchat|WhatsApp|Viber|Pinterest|LinkedIn/i

export interface InAppBrowserOpenStrategy {
    autoAttemptExternal: boolean
    showExternalOption: boolean
    showCurrentBrowserOption: boolean
}

export function isLikelyInAppBrowserUserAgent(userAgent: string | null | undefined): boolean {
    return IN_APP_BROWSER_REGEX.test(userAgent || '')
}

export function getInAppBrowserOpenStrategy(userAgent: string | null | undefined): InAppBrowserOpenStrategy {
    const normalized = userAgent || ''
    const isInApp = isLikelyInAppBrowserUserAgent(normalized)
    const isAndroid = /android/i.test(normalized)

    if (!isInApp) {
        return {
            autoAttemptExternal: false,
            showExternalOption: false,
            showCurrentBrowserOption: false,
        }
    }

    return {
        autoAttemptExternal: isAndroid,
        showExternalOption: true,
        showCurrentBrowserOption: true,
    }
}

export function openUrlInExternalBrowser(
    url: string,
    pathname: string,
    storage: StorageLike | null | undefined,
    userAgent?: string | null
) {
    const normalizedUserAgent = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')

    try {
        markExternalBrowserHandoff(pathname, storage)
    } catch {
        // Ignore storage errors
    }

    if (/android/i.test(normalizedUserAgent) && typeof window !== 'undefined') {
        const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
        window.location.href = intentUrl
    } else if (typeof window !== 'undefined') {
        const externalTab = window.open(url, '_blank', 'noopener,noreferrer')
        if (!externalTab) {
            window.location.href = url
        }
    }

    if (typeof navigator !== 'undefined') {
        navigator.clipboard?.writeText(url).catch(() => {})
    }
}

export function normalizeGuestName(value: string | null | undefined): string | null {
    if (!value) return null

    const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 80)
    return normalized || null
}

export function buildGuestRoomPath(
    meetingId: string,
    guestId?: string | null,
    guestName?: string | null,
    extraParams?: Record<string, string | null | undefined>
): string {
    const params = new URLSearchParams()
    const normalizedName = normalizeGuestName(guestName)

    if (guestId?.trim()) {
        params.set('guestId', guestId.trim())
    }

    if (normalizedName) {
        params.set('guestName', normalizedName)
    }

    for (const [key, value] of Object.entries(extraParams || {})) {
        if (value?.trim()) {
            params.set(key, value.trim())
        }
    }

    const query = params.toString()
    return query ? `/room/${meetingId}?${query}` : `/room/${meetingId}`
}

export function buildGuestWaitingPath(
    meetingId: string,
    guestId?: string | null,
    guestName?: string | null
): string {
    const params = new URLSearchParams()
    const normalizedName = normalizeGuestName(guestName)

    if (guestId?.trim()) {
        params.set('guestId', guestId.trim())
    }

    if (normalizedName) {
        params.set('guestName', normalizedName)
    }

    const query = params.toString()
    return query ? `/waiting/${meetingId}?${query}` : `/waiting/${meetingId}`
}

export function getGuestNameFromSearch(search: string | URLSearchParams | null | undefined): string | null {
    if (!search) return null

    const params = typeof search === 'string'
        ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
        : search

    return normalizeGuestName(params.get('guestName'))
}

interface StorageLike {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

function createExternalBrowserHandoffValue(pathname: string, timestamp: number) {
    return JSON.stringify({ pathname, timestamp })
}

function readExternalBrowserHandoffValue(
    storage: StorageLike | null | undefined
): { pathname: string; timestamp: number } | null {
    if (!storage) return null

    const raw = storage.getItem(EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY)
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as { pathname?: unknown; timestamp?: unknown }
        if (typeof parsed.pathname !== 'string' || typeof parsed.timestamp !== 'number') {
            storage.removeItem(EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY)
            return null
        }

        return { pathname: parsed.pathname, timestamp: parsed.timestamp }
    } catch {
        storage.removeItem(EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY)
        return null
    }
}

export function markExternalBrowserHandoff(
    pathname: string,
    storage: StorageLike | null | undefined,
    now = Date.now()
) {
    if (!storage) return

    storage.setItem(
        EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY,
        createExternalBrowserHandoffValue(pathname, now)
    )
}

export function consumeExternalBrowserHandoff(
    pathname: string,
    storage: StorageLike | null | undefined,
    now = Date.now()
) {
    if (!storage) {
        return false
    }

    const handoff = readExternalBrowserHandoffValue(storage)
    if (!handoff) {
        return false
    }

    storage.removeItem(EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY)

    return (
        handoff.pathname === pathname &&
        now - handoff.timestamp >= 0 &&
        now - handoff.timestamp <= EXTERNAL_BROWSER_HANDOFF_TTL_MS
    )
}
