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
