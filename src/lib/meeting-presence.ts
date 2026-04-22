export interface MeetingPresenceSnapshot {
    isHost: boolean
    meetingStatus?: string | null
    waitingGuestCount: number
    activeGuestCount: number
}

export function shouldAutoCompleteMeetingFromGuestStatuses(
    meetingStatus: string | null | undefined,
    guestStatuses: Array<string | null | undefined>
) {
    if (meetingStatus !== 'active') {
        return false
    }

    return !guestStatuses.some(
        (status) => status === 'waiting' || status === 'admitted' || status === 'in_meeting'
    )
}

export function shouldHostAutoEndMeetingWhenEmpty(snapshot: MeetingPresenceSnapshot) {
    if (!snapshot.isHost) {
        return false
    }

    if (snapshot.meetingStatus === 'completed') {
        return false
    }

    return snapshot.waitingGuestCount <= 0 && snapshot.activeGuestCount <= 0
}
