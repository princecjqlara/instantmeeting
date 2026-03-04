export interface WaitingRoomJoinState {
    meetingStatus?: string | null
    guestStatus?: 'waiting' | 'admitted' | 'left' | null
    hostJoinedAt?: string | null
    rescheduleRequested?: boolean | null
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
