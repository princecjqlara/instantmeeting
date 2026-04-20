export const EXTERNAL_BROWSER_HANDOFF_STORAGE_KEY = 'instantmeeting:external-browser-handoff'
const EXTERNAL_BROWSER_HANDOFF_TTL_MS = 15_000

export function normalizeGuestName(value: string | null | undefined): string | null {
    if (!value) return null

    const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 80)
    return normalized || null
}

export function buildGuestRoomPath(meetingId: string, guestName?: string | null): string {
    const params = new URLSearchParams()
    const normalizedName = normalizeGuestName(guestName)

    if (normalizedName) {
        params.set('guestName', normalizedName)
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
