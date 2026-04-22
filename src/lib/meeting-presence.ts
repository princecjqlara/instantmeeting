export interface MeetingPresenceSnapshot {
    isHost: boolean
    meetingStatus?: string | null
    waitingGuestCount: number
    activeGuestCount: number
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
