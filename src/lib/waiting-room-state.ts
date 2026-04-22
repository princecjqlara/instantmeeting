export interface WaitingRoomJoinState {
    meetingStatus?: string | null
    guestStatus?: 'waiting' | 'admitted' | 'left' | null
    hostJoinedAt?: string | null
    rescheduleRequested?: boolean | null
}

export interface HostAvailabilityState {
    availabilityMode?: 'always' | 'never' | 'scheduled' | null
    availableFrom?: string | null
    availableTo?: string | null
    timezone?: string | null
}

export interface WaitingRoomBookingState extends HostAvailabilityState {
    meetingStatus?: string | null
    guestStatus?: 'waiting' | 'admitted' | 'left' | null
    autoScheduleRequired?: boolean | null
}

export function isHostCurrentlyAvailable(state: HostAvailabilityState, now = new Date()): boolean {
    const mode = state.availabilityMode || 'always'
    if (mode === 'always') return true
    if (mode === 'never') return false
    if (mode !== 'scheduled') return true

    const from = state.availableFrom
    const to = state.availableTo
    if (!from || !to) return false

    try {
        const tz = state.timezone || 'UTC'
        const fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        })
        const [h, m] = fmt.format(now).split(':').map(Number)
        const currentMinutes = h * 60 + m
        const toMinutes = (value: string) => {
            const [hours, minutes] = value.split(':').map(Number)
            return (hours || 0) * 60 + (minutes || 0)
        }
        const startMinutes = toMinutes(from)
        const endMinutes = toMinutes(to)
        if (startMinutes === endMinutes) return false
        return startMinutes < endMinutes
            ? currentMinutes >= startMinutes && currentMinutes < endMinutes
            : currentMinutes >= startMinutes || currentMinutes < endMinutes
    } catch {
        return false
    }
}

export function shouldAutoOpenBookingModal(state: WaitingRoomBookingState, now = new Date()): boolean {
    return (
        state.guestStatus === 'waiting' &&
        state.meetingStatus !== 'completed' &&
        (Boolean(state.autoScheduleRequired) || !isHostCurrentlyAvailable(state, now))
    )
}

export function shouldShowBookingCallToAction(state: WaitingRoomBookingState, now = new Date()): boolean {
    return Boolean(state.autoScheduleRequired) || !isHostCurrentlyAvailable(state, now)
}

export function canGuestJoinRoom(state: WaitingRoomJoinState): boolean {
    return (
        state.guestStatus === 'admitted' &&
        state.meetingStatus !== 'completed' &&
        !state.rescheduleRequested
    )
}

export function shouldStopWaitingRoomPolling(state: WaitingRoomJoinState): boolean {
    if (state.meetingStatus === 'completed') {
        return true
    }

    return canGuestJoinRoom(state)
}
