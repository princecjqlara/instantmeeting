'use client'

/**
 * useWebRTC Hook — Core WebRTC + Supabase Realtime Signaling
 * 
 * Manages P2P video/audio connections using mesh topology (max 2-3 participants).
 * Uses Supabase Realtime Broadcast channels for signaling (SDP offers/answers + ICE candidates).
 * Uses Google's free STUN servers for NAT traversal.
 * 
 * TURN SERVER NOTE:
 * If users behind restrictive NATs (corporate firewalls, symmetric NAT) cannot connect,
 * add a TURN server to the ICE configuration below. Free/cheap options:
 *   - Twilio Network Traversal (free tier: 500 GB/month)
 *   - Metered TURN (free tier: 50 GB/month)
 *   - Self-hosted coturn server
 * Example:
 *   { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { appendChatMessage, ChatMessage, createChatMessage } from '@/lib/chat-messages'
import { getPeerDisconnectCleanupDelayMs } from '@/lib/webrtc-peer-state'

// ─── ICE Server Configuration ────────────────────────────────────────────────
// Google's free STUN servers for NAT traversal.
// For TURN support, add additional entries here (see comment above).
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // TURN server placeholder — uncomment and configure if needed:
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'your-username',
        //   credential: 'your-credential',
        // },
    ],
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface RemoteStream {
    peerId: string
    name: string
    stream: MediaStream
}

interface PeerData {
    connection: RTCPeerConnection
    name: string
    pendingCandidates: RTCIceCandidateInit[]
}

export interface PresentationSlideData {
    url: string
    type: string
    index: number
    total: number
    title: string
}

interface UseWebRTCReturn {
    localStream: MediaStream | null
    remoteStreams: RemoteStream[]
    chatMessages: ChatMessage[]
    isMuted: boolean
    isCameraOff: boolean
    isScreenSharing: boolean
    isConnecting: boolean
    error: string | null
    activePresentation: PresentationSlideData | null
    meetingEnded: boolean
    guestTranscript: string | null
    liveTranscript: string | null
    recognitionError: string | null
    shouldStopWelcomeAudio: boolean
    mediaPermissionError: string | null
    clearMediaPermissionError: () => void
    toggleMute: () => void
    toggleCamera: () => void
    toggleScreenShare: () => void
    sendChatMessage: (text: string) => boolean
    sendPresentation: (slide: PresentationSlideData | null) => void
    endMeetingForAll: () => void
    leaveRoom: () => void
    startGuestRecognition: () => void
    stopGuestRecognition: () => void
    clearGuestTranscript: () => void
    sendStopWelcomeAudio: () => void
}

const MEDIA_INIT_TIMEOUT_MS = 15000
const REALTIME_SUBSCRIBE_TIMEOUT_MS = 12000

// ─── Signaling message types sent via Supabase Broadcast ─────────────────────
type SignalMessage =
    | { type: 'join'; peerId: string; name: string }
    | { type: 'leave'; peerId: string }
    | { type: 'offer'; from: string; to: string; name: string; sdp: RTCSessionDescriptionInit }
    | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: 'candidate'; from: string; to: string; candidate: RTCIceCandidateInit }
    | { type: 'chat'; from: string; name: string; text: string; timestamp: string; messageId: string }
    | { type: 'presentation'; from: string; slide: PresentationSlideData | null }
    | { type: 'end-meeting'; from: string }
    | { type: 'start-recognition'; from: string }
    | { type: 'stop-recognition'; from: string }
    | { type: 'recognition-started'; from: string }
    | { type: 'recognition-result'; from: string; text: string }
    | { type: 'recognition-interim'; from: string; text: string }
    | { type: 'recognition-error'; from: string; error: string }
    | { type: 'stop-welcome-audio'; from: string }

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useWebRTC(roomId: string, displayName: string, isHost = false): UseWebRTCReturn {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [isConnecting, setIsConnecting] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activePresentation, setActivePresentation] = useState<PresentationSlideData | null>(null)
    const [meetingEnded, setMeetingEnded] = useState(false)
    const [guestTranscript, setGuestTranscript] = useState<string | null>(null)
    const [liveTranscript, setLiveTranscript] = useState<string | null>(null)
    const [recognitionError, setRecognitionError] = useState<string | null>(null)
    const [shouldStopWelcomeAudio, setShouldStopWelcomeAudio] = useState(false)
    const [mediaPermissionError, setMediaPermissionError] = useState<string | null>(null)

    // Refs to persist across renders without causing re-renders
    const peersRef = useRef<Map<string, PeerData>>(new Map())
    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
    const peerIdRef = useRef<string>('')
    const channelRef = useRef<RealtimeChannel | null>(null)
    const recognitionRef = useRef<any>(null)
    const sendSignalRef = useRef<((message: SignalMessage) => void) | null>(null)
    const cleanupRef = useRef<(() => void) | null>(null)

    // ─── Detect in-app browsers that don't support getUserMedia ────────────
    const isInAppBrowser = useCallback(() => {
        const ua = navigator.userAgent || ''
        return /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|WhatsApp|Viber|Pinterest|LinkedIn/i.test(ua)
    }, [])

    // ─── Request media helper ─────────────────────────────────────────────
    const requestMedia = useCallback(async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
        setMediaPermissionError(null)

        // Check if getUserMedia is available at all
        if (!navigator.mediaDevices?.getUserMedia) {
            if (isInAppBrowser()) {
                setMediaPermissionError('IN_APP_BROWSER')
            } else {
                setMediaPermissionError('Camera/microphone not available. Use HTTPS or try a different browser.')
            }
            return null
        }

        try {
            return await navigator.mediaDevices.getUserMedia(constraints)
        } catch (err) {
            if (isInAppBrowser()) {
                setMediaPermissionError('IN_APP_BROWSER')
            } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setMediaPermissionError('Permission denied. Please allow camera/mic access in your browser settings, then try again.')
            } else if (err instanceof DOMException && err.name === 'NotFoundError') {
                setMediaPermissionError('No camera or microphone found. Please connect a device.')
            } else if (err instanceof DOMException && err.name === 'NotSupportedError') {
                setMediaPermissionError('IN_APP_BROWSER')
            } else {
                setMediaPermissionError('Could not access camera/microphone. Please check browser permissions.')
            }
            return null
        }
    }, [isInAppBrowser])

    const addTrackToStream = useCallback((track: MediaStreamTrack) => {
        const existing = localStreamRef.current
        if (existing) {
            existing.addTrack(track)
        } else {
            localStreamRef.current = new MediaStream([track])
        }
        setLocalStream(new MediaStream(localStreamRef.current!.getTracks()))
        peersRef.current.forEach((peer) => {
            const state = peer.connection.connectionState
            if (state === 'closed' || state === 'failed') return
            try {
                peer.connection.addTrack(track, localStreamRef.current!)
            } catch (err) {
                console.warn('[WebRTC] Error adding track to peer:', err)
            }
        })
    }, [])

    // ─── Toggle Mute ────────────────────────────────────────────────────────
    const toggleMute = useCallback(async () => {
        // If no audio track yet, request mic
        const hasAudio = localStreamRef.current?.getAudioTracks().length ?? 0
        if (!hasAudio) {
            const stream = await requestMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
            if (!stream) return
            const audioTrack = stream.getAudioTracks()[0]
            if (!audioTrack) return
            addTrackToStream(audioTrack)
            setIsMuted(false)
            return
        }

        const audioTrack = localStreamRef.current!.getAudioTracks()[0]
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled
            setIsMuted(!audioTrack.enabled)
        }
    }, [requestMedia, addTrackToStream])

    // ─── Toggle Camera ──────────────────────────────────────────────────────
    const toggleCamera = useCallback(async () => {
        // If no video track yet, request camera
        const hasVideo = localStreamRef.current?.getVideoTracks().length ?? 0
        if (!hasVideo) {
            const stream = await requestMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } })
            if (!stream) return
            const videoTrack = stream.getVideoTracks()[0]
            if (!videoTrack) return
            cameraTrackRef.current = videoTrack
            addTrackToStream(videoTrack)
            setIsCameraOff(false)
            return
        }

        const videoTrack = localStreamRef.current!.getVideoTracks()[0]
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled
            setIsCameraOff(!videoTrack.enabled)
        }
    }, [requestMedia, addTrackToStream])

    // ─── Toggle Screen Share ─────────────────────────────────────────────
    const isScreenSharingRef = useRef(false)
    isScreenSharingRef.current = isScreenSharing

    const toggleScreenShare = useCallback(async () => {
        // Use ref to avoid stale closure (especially in screenTrack.onended callback)
        if (isScreenSharingRef.current) {
            // Stop screen sharing — restore camera track
            const screenTrack = screenStreamRef.current?.getVideoTracks()[0]
            if (screenTrack) {
                screenTrack.stop()
            }
            screenStreamRef.current = null

            // Restore camera track to local stream and all peer connections
            const cameraTrack = cameraTrackRef.current
            if (cameraTrack && localStreamRef.current) {
                const oldVideoTrack = localStreamRef.current.getVideoTracks()[0]
                if (oldVideoTrack) {
                    localStreamRef.current.removeTrack(oldVideoTrack)
                }
                localStreamRef.current.addTrack(cameraTrack)

                // Replace track in all peer connections
                peersRef.current.forEach((peer) => {
                    const state = peer.connection.connectionState
                    if (state === 'closed' || state === 'failed') return
                    const sender = peer.connection.getSenders().find(
                        (s) => s.track?.kind === 'video'
                    )
                    if (sender) {
                        sender.replaceTrack(cameraTrack).catch(console.warn)
                    }
                })

                // Force React to re-render with updated stream
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
            }

            setIsScreenSharing(false)
            setIsCameraOff(false)
        } else {
            // Start screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always' } as MediaTrackConstraints,
                    audio: false,
                })

                screenStreamRef.current = screenStream
                const screenTrack = screenStream.getVideoTracks()[0]

                // Save current camera track for later restoration
                if (localStreamRef.current) {
                    const currentCameraTrack = localStreamRef.current.getVideoTracks()[0]
                    if (currentCameraTrack) {
                        cameraTrackRef.current = currentCameraTrack
                    }

                    // Replace video track in local stream
                    const oldTrack = localStreamRef.current.getVideoTracks()[0]
                    if (oldTrack) {
                        localStreamRef.current.removeTrack(oldTrack)
                    }
                    localStreamRef.current.addTrack(screenTrack)

                    // Replace track in all peer connections
                    peersRef.current.forEach((peer) => {
                        const state = peer.connection.connectionState
                        if (state === 'closed' || state === 'failed') return
                        const sender = peer.connection.getSenders().find(
                            (s) => s.track?.kind === 'video'
                        )
                        if (sender) {
                            sender.replaceTrack(screenTrack).catch(console.warn)
                        }
                    })

                    // Force React to re-render
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
                }

                setIsScreenSharing(true)

                // Handle user stopping screen share via browser UI
                screenTrack.onended = () => {
                    toggleScreenShare()
                }
            } catch (err) {
                // User cancelled the screen share picker
                console.log('[WebRTC] Screen share cancelled or failed:', err)
            }
        }
    }, [])

    // ─── Send Chat Message ──────────────────────────────────────────────────
    const sendChatMessage = useCallback((text: string) => {
        const peerId = peerIdRef.current
        const sendSignal = sendSignalRef.current
        if (!peerId || !sendSignal) {
            return false
        }

        const outgoingMessage = createChatMessage({
            peerId,
            name: displayName,
            text,
            isLocal: true,
        })

        if (!outgoingMessage) {
            return false
        }

        setChatMessages(prev => appendChatMessage(prev, outgoingMessage))

        sendSignal({
            type: 'chat',
            from: peerId,
            name: outgoingMessage.name,
            text: outgoingMessage.text,
            timestamp: outgoingMessage.timestamp,
            messageId: outgoingMessage.id,
        })

        return true
    }, [displayName])

    // ─── Leave Room ─────────────────────────────────────────────────────────
    const leaveRoom = useCallback(() => {
        if (cleanupRef.current) {
            cleanupRef.current()
            cleanupRef.current = null
        }
    }, [])

    // ─── Main Effect: Setup WebRTC ──────────────────────────────────────────
    useEffect(() => {
        if (!roomId || !displayName) return

        // Generate a unique peer ID for this session
        const peerId = `peer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        peerIdRef.current = peerId

        // Create Supabase client for Realtime
        const supabase = createClient()
        let subscribeTimeoutId: ReturnType<typeof setTimeout> | null = null
        let isSubscribed = false

        // Send a signaling message to the room via Supabase Broadcast
        const sendSignal = (message: SignalMessage) => {
            channelRef.current?.send({
                type: 'broadcast',
                event: 'signal',
                payload: message,
            })
        }
        sendSignalRef.current = sendSignal

        // Track peers currently in initial negotiation to suppress onnegotiationneeded
        const initialNegotiationPeers = new Set<string>()
        const disconnectedPeerCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()

        // Queue ICE candidates that arrive before the peer connection is created
        const earlyIceCandidates = new Map<string, RTCIceCandidateInit[]>()

        const clearPeerDisconnectCleanup = (remotePeerId: string) => {
            const timer = disconnectedPeerCleanupTimers.get(remotePeerId)
            if (timer) {
                clearTimeout(timer)
                disconnectedPeerCleanupTimers.delete(remotePeerId)
            }
        }

        const removeRemotePeer = (remotePeerId: string) => {
            clearPeerDisconnectCleanup(remotePeerId)

            const peer = peersRef.current.get(remotePeerId)
            if (peer) {
                peer.connection.close()
                peersRef.current.delete(remotePeerId)
            }

            setRemoteStreams(prev => prev.filter(s => s.peerId !== remotePeerId))
        }

        /**
         * Create a new RTCPeerConnection for a remote peer.
         * Sets up ICE candidate handling and track reception.
         */
        const createPeerConnection = (remotePeerId: string, remoteName: string): RTCPeerConnection => {
            const pc = new RTCPeerConnection(ICE_SERVERS)

            // Send ICE candidates to remote peer via Supabase Broadcast
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignal({
                        type: 'candidate',
                        from: peerId,
                        to: remotePeerId,
                        candidate: {
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                        },
                    })
                }
            }

            // Handle incoming tracks from the remote peer
            pc.ontrack = (event) => {
                const remoteStream = event.streams?.[0]

                if (remoteStream) {
                    setRemoteStreams(prev => {
                        const exists = prev.find(s => s.peerId === remotePeerId)
                        if (exists) {
                            // Force new object reference so React detects the update
                            return prev.map(s =>
                                s.peerId === remotePeerId
                                    ? { peerId: s.peerId, name: s.name, stream: remoteStream }
                                    : s
                            )
                        }
                        return [...prev, { peerId: remotePeerId, name: remoteName, stream: remoteStream }]
                    })
                } else if (event.track) {
                    // Fallback: no event.streams — add track to existing stream or create one
                    setRemoteStreams(prev => {
                        const exists = prev.find(s => s.peerId === remotePeerId)
                        if (exists) {
                            // Add the new track to the existing MediaStream
                            if (!exists.stream.getTrackById(event.track.id)) {
                                exists.stream.addTrack(event.track)
                            }
                            // Force new object reference so React re-renders
                            return prev.map(s =>
                                s.peerId === remotePeerId
                                    ? { peerId: s.peerId, name: s.name, stream: exists.stream }
                                    : s
                            )
                        }
                        return [...prev, {
                            peerId: remotePeerId,
                            name: remoteName,
                            stream: new MediaStream([event.track]),
                        }]
                    })
                }
            }

            // Log connection state changes for debugging
            pc.onconnectionstatechange = () => {
                console.log(`[WebRTC] Connection to ${remotePeerId}: ${pc.connectionState}`)
                // Note: Do NOT add empty MediaStream here on 'connected' — it creates
                // ghost/invisible peers. Peers only appear via ontrack when real media arrives.
                const disconnectCleanupDelayMs = getPeerDisconnectCleanupDelayMs(pc.connectionState)

                if (disconnectCleanupDelayMs === 0) {
                    removeRemotePeer(remotePeerId)
                    return
                }

                if (disconnectCleanupDelayMs && disconnectCleanupDelayMs > 0) {
                    if (!disconnectedPeerCleanupTimers.has(remotePeerId)) {
                        const timer = setTimeout(() => {
                            disconnectedPeerCleanupTimers.delete(remotePeerId)

                            const latestState = peersRef.current.get(remotePeerId)?.connection.connectionState
                            if (latestState === 'disconnected') {
                                removeRemotePeer(remotePeerId)
                            }
                        }, disconnectCleanupDelayMs)

                        disconnectedPeerCleanupTimers.set(remotePeerId, timer)
                    }
                    return
                }

                clearPeerDisconnectCleanup(remotePeerId)

                if (pc.connectionState === 'failed') {
                    // Attempt ICE restart before giving up
                    console.log(`[WebRTC] Connection failed to ${remotePeerId}, attempting ICE restart`)
                    pc.restartIce()
                    pc.createOffer({ iceRestart: true }).then(offer => {
                        pc.setLocalDescription(offer).then(() => {
                            sendSignal({
                                type: 'offer',
                                from: peerId,
                                to: remotePeerId,
                                name: displayName,
                                sdp: { sdp: offer.sdp, type: offer.type },
                            })
                        })
                    }).catch(err => {
                        console.warn('[WebRTC] ICE restart failed:', err)
                        removeRemotePeer(remotePeerId)
                    })
                }
            }

            // Handle renegotiation when tracks are added after connection is established
            // Suppressed during initial offer/answer exchange to avoid duplicate offers
            pc.onnegotiationneeded = async () => {
                if (initialNegotiationPeers.has(remotePeerId)) {
                    console.log('[WebRTC] Suppressing onnegotiationneeded during initial negotiation for', remotePeerId)
                    return
                }
                try {
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    sendSignal({
                        type: 'offer',
                        from: peerId,
                        to: remotePeerId,
                        name: displayName,
                        sdp: { sdp: offer.sdp, type: offer.type },
                    })
                } catch (err) {
                    console.warn('[WebRTC] Renegotiation failed:', err)
                }
            }

            // Add local tracks to the connection so the remote peer receives our media
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current!)
                })
            }

            // Store the peer connection
            peersRef.current.set(remotePeerId, { connection: pc, name: remoteName, pendingCandidates: [] })

            // Flush any ICE candidates that arrived before this peer connection was created
            const earlyCandidates = earlyIceCandidates.get(remotePeerId)
            if (earlyCandidates && earlyCandidates.length > 0) {
                const peer = peersRef.current.get(remotePeerId)!
                peer.pendingCandidates.push(...earlyCandidates)
                earlyIceCandidates.delete(remotePeerId)
            }

            return pc
        }

        /**
         * Create an offer and send it to a remote peer via Supabase Broadcast.
         */
        const createOffer = async (remotePeerId: string, remoteName: string) => {
            initialNegotiationPeers.add(remotePeerId)
            const pc = createPeerConnection(remotePeerId, remoteName)

            // Create SDP offer
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            // Send the offer via Broadcast
            sendSignal({
                type: 'offer',
                from: peerId,
                to: remotePeerId,
                name: displayName,
                sdp: { sdp: offer.sdp, type: offer.type },
            })
            // Don't remove from initialNegotiationPeers yet — wait for answer
        }

        /**
         * Handle an incoming offer from a remote peer — create an answer.
         */
        const handleOffer = async (remotePeerId: string, remoteName: string, offerData: RTCSessionDescriptionInit) => {
            initialNegotiationPeers.add(remotePeerId)
            const pc = createPeerConnection(remotePeerId, remoteName)

            // Set the remote offer and create our answer
            await pc.setRemoteDescription(new RTCSessionDescription(offerData))
            await flushPendingCandidates(remotePeerId)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            // Send the answer via Broadcast
            sendSignal({
                type: 'answer',
                from: peerId,
                to: remotePeerId,
                sdp: { sdp: answer.sdp, type: answer.type },
            })
            initialNegotiationPeers.delete(remotePeerId)
        }

        /**
         * Handle an incoming answer to our offer.
         */
        const handleAnswer = async (remotePeerId: string, answerData: RTCSessionDescriptionInit) => {
            const peer = peersRef.current.get(remotePeerId)
            if (!peer) return
            try {
                await peer.connection.setRemoteDescription(new RTCSessionDescription(answerData))
                await flushPendingCandidates(remotePeerId)
            } catch (err) {
                console.warn('[WebRTC] Error setting remote description for answer:', err)
            } finally {
                initialNegotiationPeers.delete(remotePeerId)
            }
        }

        /**
         * Handle renegotiation offer from an existing peer (e.g., new tracks added).
         */
        const handleRenegotiation = async (remotePeerId: string, offerData: RTCSessionDescriptionInit) => {
            const peer = peersRef.current.get(remotePeerId)
            if (!peer) return
            try {
                const pc = peer.connection
                // Handle glare: if we also sent an offer, use polite/impolite pattern
                // The peer with the lower peerId is "polite" and rolls back
                if (pc.signalingState === 'have-local-offer') {
                    const isPolite = peerId < remotePeerId
                    if (!isPolite) {
                        // We're impolite — ignore their offer, they'll accept our answer
                        console.log('[WebRTC] Ignoring renegotiation offer (impolite peer)')
                        return
                    }
                    // We're polite — rollback our offer and accept theirs
                    await pc.setLocalDescription({ type: 'rollback' })
                }
                await pc.setRemoteDescription(new RTCSessionDescription(offerData))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                sendSignal({
                    type: 'answer',
                    from: peerId,
                    to: remotePeerId,
                    sdp: { sdp: answer.sdp, type: answer.type },
                })
            } catch (err) {
                console.warn('[WebRTC] Renegotiation answer failed:', err)
            }
        }

        /**
         * Handle an incoming ICE candidate from a remote peer.
         * Queues candidates that arrive before remote description is set.
         */
        const handleCandidate = async (remotePeerId: string, candidateData: RTCIceCandidateInit) => {
            const peer = peersRef.current.get(remotePeerId)
            if (!peer) {
                // Peer connection not created yet — queue for later
                if (!earlyIceCandidates.has(remotePeerId)) {
                    earlyIceCandidates.set(remotePeerId, [])
                }
                earlyIceCandidates.get(remotePeerId)!.push(candidateData)
                return
            }

            if (peer.connection.remoteDescription) {
                await peer.connection.addIceCandidate(new RTCIceCandidate(candidateData))
                    .catch(err => console.warn('[WebRTC] Error adding ICE candidate:', err))
            } else {
                // Queue for later — will be flushed after remote description is set
                peer.pendingCandidates.push(candidateData)
            }
        }

        /**
         * Flush queued ICE candidates after remote description is set.
         */
        const flushPendingCandidates = async (remotePeerId: string) => {
            const peer = peersRef.current.get(remotePeerId)
            if (!peer) return
            for (const candidate of peer.pendingCandidates) {
                await peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(err => console.warn('[WebRTC] Error adding queued ICE candidate:', err))
            }
            peer.pendingCandidates = []
        }

        /**
         * Handle a remote peer leaving.
         */
        const handlePeerLeave = (remotePeerId: string) => {
            removeRemotePeer(remotePeerId)
        }

        /**
         * Main initialization: get media, join channel, announce presence.
         */
        const init = async () => {
            try {
                // Step 1: Try to get local media stream (camera + microphone)
                // If permission is denied or unavailable, join without media
                let stream: MediaStream | null = null
                if (navigator.mediaDevices?.getUserMedia) {
                    let mediaTimeoutId: ReturnType<typeof setTimeout> | null = null
                    try {
                        stream = await Promise.race([
                            navigator.mediaDevices.getUserMedia({
                                video: {
                                    width: { ideal: 1280 },
                                    height: { ideal: 720 },
                                    facingMode: 'user',
                                },
                                audio: {
                                    echoCancellation: true,
                                    noiseSuppression: true,
                                    autoGainControl: true,
                                },
                            }),
                            new Promise<never>((_, reject) => {
                                mediaTimeoutId = setTimeout(() => {
                                    reject(new Error('MEDIA_PERMISSION_TIMEOUT'))
                                }, MEDIA_INIT_TIMEOUT_MS)
                            }),
                        ])
                    } catch (mediaErr) {
                        console.warn('[WebRTC] Media access failed, joining without camera/mic:', mediaErr)
                        // Continue without media — user can enable later
                    } finally {
                        if (mediaTimeoutId) {
                            clearTimeout(mediaTimeoutId)
                            mediaTimeoutId = null
                        }
                    }
                }

                if (stream) {
                    localStreamRef.current = stream
                    setLocalStream(stream)

                    // Guests join with mic muted by default
                    if (!isHost) {
                        const audioTrack = stream.getAudioTracks()[0]
                        if (audioTrack) {
                            audioTrack.enabled = false
                            setIsMuted(true)
                        }
                    }
                } else {
                    // No media — mark camera and mic as off
                    setIsCameraOff(true)
                    setIsMuted(true)
                }

                // Step 2: Create and subscribe to Supabase Realtime Broadcast channel
                const channel = supabase.channel(`room:${roomId}`, {
                    config: { broadcast: { self: false } },
                })

                channelRef.current = channel

                // Listen for signaling messages
                channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
                    const message = payload as SignalMessage

                    switch (message.type) {
                        case 'join':
                            // New peer joined — if we were here first, send them an offer
                            if (message.peerId !== peerId && !peersRef.current.has(message.peerId)) {
                                createOffer(message.peerId, message.name)
                                    .catch(err => console.error('[WebRTC] createOffer failed:', err))
                            }
                            break

                        case 'leave':
                            handlePeerLeave(message.peerId)
                            break

                        case 'offer':
                            // Someone sent us an offer (new connection or renegotiation)
                            if (message.to === peerId) {
                                const existingPeer = peersRef.current.get(message.from)
                                if (existingPeer) {
                                    // Renegotiation — reuse existing connection
                                    handleRenegotiation(message.from, message.sdp)
                                        .catch(err => console.error('[WebRTC] handleRenegotiation failed:', err))
                                } else {
                                    handleOffer(message.from, message.name, message.sdp)
                                        .catch(err => console.error('[WebRTC] handleOffer failed:', err))
                                }
                            }
                            break

                        case 'answer':
                            // Someone answered our offer
                            if (message.to === peerId) {
                                handleAnswer(message.from, message.sdp)
                                    .catch(err => console.error('[WebRTC] handleAnswer failed:', err))
                            }
                            break

                        case 'candidate':
                            // ICE candidate from a peer
                            if (message.to === peerId) {
                                handleCandidate(message.from, message.candidate)
                                    .catch(err => console.error('[WebRTC] handleCandidate failed:', err))
                            }
                            break

                        case 'chat':
                            if (message.from === peerId) {
                                break
                            }

                            const incomingMessage = createChatMessage({
                                id: message.messageId,
                                peerId: message.from,
                                name: message.name,
                                text: message.text,
                                timestamp: message.timestamp,
                                isLocal: false,
                            })

                            if (incomingMessage) {
                                setChatMessages(prev => appendChatMessage(prev, incomingMessage))
                            }
                            break

                        case 'presentation':
                            if (message.from !== peerId) {
                                setActivePresentation(message.slide)
                            }
                            break

                        case 'end-meeting':
                            // Host has ended the meeting for everyone
                            setMeetingEnded(true)
                            break

                        case 'start-recognition':
                            if (message.from !== peerId) {
                                console.log('[WebRTC] Received start-recognition signal from host')
                                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                                if (!SpeechRecognition) {
                                    // Browser doesn't support Speech Recognition
                                    sendSignal({
                                        type: 'recognition-error',
                                        from: peerId,
                                        error: 'Speech recognition not supported in guest browser',
                                    })
                                    break
                                }

                                if (recognitionRef.current) {
                                    try { recognitionRef.current.stop() } catch (e) {}
                                }
                                const recognition = new SpeechRecognition()
                                // en-PH handles Taglish (Tagalog + English mix) better than fil-PH
                                recognition.lang = 'en-PH'
                                recognition.interimResults = true
                                recognition.continuous = true

                                // Accumulate transcript locally and send throttled live updates
                                let accumulated = ''
                                let lastInterimSent = 0
                                let pendingInterimId: ReturnType<typeof setTimeout> | null = null
                                let restartCount = 0
                                const MAX_RESTARTS = 10

                                // Status events for debugging
                                recognition.onaudiostart = () => {
                                    console.log('[WebRTC] SpeechRecognition: audio capture started')
                                    sendSignal({
                                        type: 'recognition-interim',
                                        from: peerId,
                                        text: '(listening...)',
                                    })
                                }
                                recognition.onspeechstart = () => {
                                    console.log('[WebRTC] SpeechRecognition: speech detected')
                                }

                                recognition.onresult = (event: any) => {
                                    let finalText = ''
                                    let interimText = ''
                                    for (let i = 0; i < event.results.length; i++) {
                                        const result = event.results[i]
                                        if (result.isFinal) {
                                            finalText += result[0].transcript + ' '
                                        } else {
                                            interimText += result[0].transcript
                                        }
                                    }
                                    // In continuous mode, event.results contains ALL results
                                    // so finalText already has every final transcript — just set, don't append
                                    if (finalText.trim()) {
                                        accumulated = finalText.trim()
                                    }
                                    const trimmedLive = (finalText + interimText).trim()
                                    if (!trimmedLive) return

                                    // Throttle interim signals to max once per 500ms
                                    const now = Date.now()
                                    if (pendingInterimId) clearTimeout(pendingInterimId)

                                    if (now - lastInterimSent >= 500) {
                                        lastInterimSent = now
                                        console.log('[WebRTC] Sending recognition-interim:', trimmedLive)
                                        sendSignal({
                                            type: 'recognition-interim',
                                            from: peerId,
                                            text: trimmedLive,
                                        })
                                    } else {
                                        pendingInterimId = setTimeout(() => {
                                            lastInterimSent = Date.now()
                                            sendSignal({
                                                type: 'recognition-interim',
                                                from: peerId,
                                                text: trimmedLive,
                                            })
                                        }, 500 - (now - lastInterimSent))
                                    }
                                }

                                // Track whether we intentionally stopped
                                let intentionallyStopped = false

                                // Send final transcript when recognition ends
                                recognition.onend = () => {
                                    if (pendingInterimId) clearTimeout(pendingInterimId)
                                    if (intentionallyStopped) {
                                        // User/host clicked stop — send final result
                                        if (accumulated.trim()) {
                                            sendSignal({
                                                type: 'recognition-result',
                                                from: peerId,
                                                text: accumulated.trim()
                                            })
                                        }
                                        recognitionRef.current = null
                                    } else if (restartCount < MAX_RESTARTS) {
                                        // Chrome killed recognition (timeout/network) — auto-restart
                                        restartCount++
                                        console.log(`[WebRTC] SpeechRecognition ended unexpectedly, restart ${restartCount}/${MAX_RESTARTS}`)
                                        try {
                                            recognition.start()
                                        } catch (err) {
                                            console.warn('[WebRTC] Failed to restart recognition:', err)
                                            if (accumulated.trim()) {
                                                sendSignal({
                                                    type: 'recognition-result',
                                                    from: peerId,
                                                    text: accumulated.trim()
                                                })
                                            }
                                            recognitionRef.current = null
                                        }
                                    } else {
                                        // Too many restarts — give up
                                        console.warn('[WebRTC] SpeechRecognition max restarts reached')
                                        sendSignal({
                                            type: 'recognition-error',
                                            from: peerId,
                                            error: 'Speech recognition stopped after too many retries',
                                        })
                                        if (accumulated.trim()) {
                                            sendSignal({
                                                type: 'recognition-result',
                                                from: peerId,
                                                text: accumulated.trim()
                                            })
                                        }
                                        recognitionRef.current = null
                                    }
                                }

                                // Patch stop() to set the intentional flag
                                const originalStop = recognition.stop.bind(recognition)
                                recognition.stop = () => {
                                    intentionallyStopped = true
                                    originalStop()
                                }

                                recognition.onerror = (event: any) => {
                                    console.error('Speech recognition error:', event.error)
                                    if (pendingInterimId) clearTimeout(pendingInterimId)

                                    // 'no-speech' is not fatal in continuous mode — let onend auto-restart
                                    if (event.error === 'no-speech') return

                                    // Fatal errors — stop and report
                                    intentionallyStopped = true // prevent auto-restart in onend
                                    sendSignal({
                                        type: 'recognition-error',
                                        from: peerId,
                                        error: event.error === 'not-allowed'
                                            ? 'Microphone permission denied on guest browser'
                                            : `Recognition error: ${event.error}`,
                                    })
                                    if (accumulated.trim()) {
                                        sendSignal({
                                            type: 'recognition-result',
                                            from: peerId,
                                            text: accumulated.trim()
                                        })
                                    }
                                    recognitionRef.current = null
                                }

                                try {
                                    recognition.start()
                                    recognitionRef.current = recognition
                                    console.log('[WebRTC] Speech recognition started successfully')
                                    // Confirm to host that recognition started
                                    sendSignal({
                                        type: 'recognition-started',
                                        from: peerId,
                                    })
                                } catch (err: any) {
                                    console.error('Failed to start recognition:', err)
                                    sendSignal({
                                        type: 'recognition-error',
                                        from: peerId,
                                        error: `Failed to start: ${err?.message || 'unknown error'}`,
                                    })
                                }
                            }
                            break

                        case 'stop-recognition':
                            if (message.from !== peerId && recognitionRef.current) {
                                try {
                                    recognitionRef.current.stop()
                                    // recognitionRef.current is cleared in onend handler
                                } catch (e) {}
                            }
                            break

                        case 'recognition-started':
                            if (message.from !== peerId) {
                                console.log('[WebRTC] Guest confirmed recognition started')
                                setLiveTranscript('Guest mic activated — listening...')
                            }
                            break

                        case 'recognition-result':
                            if (message.from !== peerId) {
                                console.log('[WebRTC] Received recognition-result:', message.text)
                                setGuestTranscript(message.text)
                                setLiveTranscript(null)
                            }
                            break

                        case 'recognition-interim':
                            if (message.from !== peerId) {
                                console.log('[WebRTC] Received recognition-interim:', message.text)
                                setLiveTranscript(message.text)
                                setRecognitionError(null)
                            }
                            break

                        case 'recognition-error':
                            if (message.from !== peerId) {
                                setRecognitionError(message.error)
                            }
                            break

                        case 'stop-welcome-audio':
                            if (message.from !== peerId) {
                                setShouldStopWelcomeAudio(true)
                            }
                            break
                    }
                })

                // Subscribe to the channel, then announce our presence
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        isSubscribed = true
                        if (subscribeTimeoutId) {
                            clearTimeout(subscribeTimeoutId)
                            subscribeTimeoutId = null
                        }

                        sendSignal({
                            type: 'join',
                            peerId,
                            name: displayName,
                        })
                        setIsConnecting(false)
                        return
                    }

                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        if (subscribeTimeoutId) {
                            clearTimeout(subscribeTimeoutId)
                            subscribeTimeoutId = null
                        }

                        setError('Unable to connect to room signaling. Please check your network and refresh.')
                        setIsConnecting(false)
                    }
                })

                subscribeTimeoutId = setTimeout(() => {
                    if (isSubscribed) {
                        return
                    }

                    setError('Connection timed out while joining the room. Please refresh and try again.')
                    setIsConnecting(false)
                }, REALTIME_SUBSCRIBE_TIMEOUT_MS)
            } catch (err) {
                console.error('[WebRTC] Init error:', err)
                setError('Failed to initialize video chat. Please try again.')
                setIsConnecting(false)
            }
        }

        init()

        // ─── Cleanup on unmount ─────────────────────────────────────────────
        const cleanup = () => {
            if (subscribeTimeoutId) {
                clearTimeout(subscribeTimeoutId)
                subscribeTimeoutId = null
            }

            // Announce departure
            sendSignal({ type: 'leave', peerId })

            // Stop all local media tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop())
                localStreamRef.current = null
                setLocalStream(null)
            }

            // Stop screen share stream if active
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop())
                screenStreamRef.current = null
            }
            cameraTrackRef.current = null

            // Close all peer connections
            peersRef.current.forEach(peer => peer.connection.close())
            peersRef.current.clear()
            setRemoteStreams([])

            disconnectedPeerCleanupTimers.forEach(timer => clearTimeout(timer))
            disconnectedPeerCleanupTimers.clear()

            // Unsubscribe from the Supabase Realtime channel
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
            
            if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch (e) {}
                recognitionRef.current = null
            }

            sendSignalRef.current = null
            setChatMessages([])
        }

        cleanupRef.current = cleanup

        return () => {
            cleanup()
        }
    }, [roomId, displayName])

    // ─── Send Presentation Slide ─────────────────────────────────────────────
    const sendPresentation = useCallback((slide: PresentationSlideData | null) => {
        const peerId = peerIdRef.current
        const sendSignal = sendSignalRef.current
        if (!peerId || !sendSignal) return

        setActivePresentation(slide)
        sendSignal({
            type: 'presentation',
            from: peerId,
            slide,
        })
    }, [])

    // ─── End Meeting For All ─────────────────────────────────────────────────
    const endMeetingForAll = useCallback(() => {
        const peerId = peerIdRef.current
        const sendSignal = sendSignalRef.current
        if (!peerId || !sendSignal) return

        // Broadcast end-meeting to all peers
        sendSignal({
            type: 'end-meeting',
            from: peerId,
        })

        // Also mark locally
        setMeetingEnded(true)
    }, [])

    // ─── Guest Speech Recognition ──────────────────────────────────────────────
    const startGuestRecognition = useCallback(() => {
        const sendSignal = sendSignalRef.current
        if (!peerIdRef.current || !sendSignal) {
            console.warn('[WebRTC] Cannot start guest recognition: no peerId or sendSignal')
            return
        }
        setGuestTranscript(null)
        setLiveTranscript('Waiting for guest to speak...')
        setRecognitionError(null)
        console.log('[WebRTC] Sending start-recognition signal')
        sendSignal({ type: 'start-recognition', from: peerIdRef.current })
    }, [])

    const stopGuestRecognition = useCallback(() => {
        const sendSignal = sendSignalRef.current
        if (!peerIdRef.current || !sendSignal) return
        sendSignal({ type: 'stop-recognition', from: peerIdRef.current })
    }, [])

    const clearGuestTranscript = useCallback(() => setGuestTranscript(null), [])
    const clearMediaPermissionError = useCallback(() => setMediaPermissionError(null), [])

    const sendStopWelcomeAudio = useCallback(() => {
        const sendSignal = sendSignalRef.current
        if (!peerIdRef.current || !sendSignal) return
        sendSignal({ type: 'stop-welcome-audio', from: peerIdRef.current })
    }, [])

    return {
        localStream,
        remoteStreams,
        chatMessages,
        isMuted,
        isCameraOff,
        isScreenSharing,
        isConnecting,
        error,
        activePresentation,
        meetingEnded,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        sendChatMessage,
        sendPresentation,
        endMeetingForAll,
        leaveRoom,
        guestTranscript,
        liveTranscript,
        recognitionError,
        shouldStopWelcomeAudio,
        mediaPermissionError,
        clearMediaPermissionError,
        startGuestRecognition,
        stopGuestRecognition,
        clearGuestTranscript,
        sendStopWelcomeAudio,
    }
}
