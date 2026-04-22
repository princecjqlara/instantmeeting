export function getPeerDisconnectCleanupDelayMs(connectionState: RTCPeerConnectionState): number | null {
    if (connectionState === 'closed') {
        return 0
    }

    if (connectionState === 'disconnected') {
        return 10_000
    }

    return null
}
