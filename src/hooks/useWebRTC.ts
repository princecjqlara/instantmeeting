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

    // ─── Toggle Mute ────────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsMuted(!audioTrack.enabled)
            }
        }
    }, [])

    // ─── Toggle Camera ──────────────────────────────────────────────────────
    const toggleCamera = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsCameraOff(!videoTrack.enabled)
            }
        }
    }, [])

    // ─── Toggle Screen Share ─────────────────────────────────────────────
    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
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
    }, [isScreenSharing])

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
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    // Remove remote stream when peer disconnects
                    setRemoteStreams(prev => prev.filter(s => s.peerId !== remotePeerId))
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

            return pc
        }

        /**
         * Create an offer and send it to a remote peer via Supabase Broadcast.
         */
        const createOffer = async (remotePeerId: string, remoteName: string) => {
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
        }

        /**
         * Handle an incoming offer from a remote peer — create an answer.
         */
        const handleOffer = async (remotePeerId: string, remoteName: string, offerData: RTCSessionDescriptionInit) => {
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
        }

        /**
         * Handle an incoming answer to our offer.
         */
        const handleAnswer = async (remotePeerId: string, answerData: RTCSessionDescriptionInit) => {
            const peer = peersRef.current.get(remotePeerId)
            if (peer && !peer.connection.currentRemoteDescription) {
                await peer.connection.setRemoteDescription(new RTCSessionDescription(answerData))
                await flushPendingCandidates(remotePeerId)
            }
        }

        /**
         * Handle an incoming ICE candidate from a remote peer.
         * Queues candidates that arrive before remote description is set.
         */
        const handleCandidate = async (remotePeerId: string, candidateData: RTCIceCandidateInit) => {
            const peer = peersRef.current.get(remotePeerId)
            if (!peer) return

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
            const peer = peersRef.current.get(remotePeerId)
            if (peer) {
                peer.connection.close()
                peersRef.current.delete(remotePeerId)
                setRemoteStreams(prev => prev.filter(s => s.peerId !== remotePeerId))
            }
        }

        /**
         * Main initialization: get media, join channel, announce presence.
         */
        const init = async () => {
            try {
                // Step 1: Get local media stream (camera + microphone)
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('MEDIA_DEVICES_UNAVAILABLE')
                }

                let mediaTimeoutId: ReturnType<typeof setTimeout> | null = null
                const stream = await (async () => {
                    try {
                        return await Promise.race([
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
                    } finally {
                        if (mediaTimeoutId) {
                            clearTimeout(mediaTimeoutId)
                            mediaTimeoutId = null
                        }
                    }
                })()

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
                            }
                            break

                        case 'leave':
                            handlePeerLeave(message.peerId)
                            break

                        case 'offer':
                            // Someone sent us an offer
                            if (message.to === peerId && !peersRef.current.has(message.from)) {
                                handleOffer(message.from, message.name, message.sdp)
                            }
                            break

                        case 'answer':
                            // Someone answered our offer
                            if (message.to === peerId) {
                                handleAnswer(message.from, message.sdp)
                            }
                            break

                        case 'candidate':
                            // ICE candidate from a peer
                            if (message.to === peerId) {
                                handleCandidate(message.from, message.candidate)
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
                                recognition.lang = 'fil-PH'
                                recognition.interimResults = true
                                recognition.continuous = true

                                // Accumulate transcript locally and send throttled live updates
                                let accumulated = ''
                                let lastInterimSent = 0
                                let pendingInterimId: ReturnType<typeof setTimeout> | null = null

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
                                    accumulated = finalText.trim()
                                    const liveText = (finalText + interimText).trim()
                                    if (!liveText) return

                                    // Throttle interim signals to max once per 500ms
                                    const now = Date.now()
                                    if (pendingInterimId) clearTimeout(pendingInterimId)

                                    if (now - lastInterimSent >= 500) {
                                        lastInterimSent = now
                                        sendSignal({
                                            type: 'recognition-interim',
                                            from: peerId,
                                            text: liveText,
                                        })
                                    } else {
                                        pendingInterimId = setTimeout(() => {
                                            lastInterimSent = Date.now()
                                            sendSignal({
                                                type: 'recognition-interim',
                                                from: peerId,
                                                text: liveText,
                                            })
                                        }, 500 - (now - lastInterimSent))
                                    }
                                }

                                // Send final transcript when recognition ends
                                recognition.onend = () => {
                                    if (pendingInterimId) clearTimeout(pendingInterimId)
                                    if (accumulated.trim()) {
                                        sendSignal({
                                            type: 'recognition-result',
                                            from: peerId,
                                            text: accumulated.trim()
                                        })
                                    }
                                    recognitionRef.current = null
                                }

                                recognition.onerror = (event: any) => {
                                    console.error('Speech recognition error:', event.error)
                                    if (pendingInterimId) clearTimeout(pendingInterimId)
                                    // Send error back to host
                                    sendSignal({
                                        type: 'recognition-error',
                                        from: peerId,
                                        error: event.error === 'not-allowed'
                                            ? 'Microphone permission denied on guest browser'
                                            : event.error === 'no-speech'
                                            ? 'No speech detected from guest'
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

                        case 'recognition-result':
                            if (message.from !== peerId) {
                                setGuestTranscript(message.text)
                                setLiveTranscript(null)
                            }
                            break

                        case 'recognition-interim':
                            if (message.from !== peerId) {
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
                if (err instanceof Error && err.message === 'MEDIA_PERMISSION_TIMEOUT') {
                    setError('Camera/microphone permission is still pending. Please allow access and try again.')
                } else if (err instanceof Error && err.message === 'MEDIA_DEVICES_UNAVAILABLE') {
                    setError('Camera/microphone is unavailable in this browser context. Use HTTPS (or localhost) and try again.')
                } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    setError('Camera/microphone access denied. Please allow access and try again.')
                } else if (err instanceof DOMException && err.name === 'NotFoundError') {
                    setError('No camera or microphone found. Please connect a device and try again.')
                } else {
                    setError('Failed to initialize video chat. Please try again.')
                }
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
        if (!peerIdRef.current || !sendSignal) return
        setGuestTranscript(null)
        setLiveTranscript(null)
        setRecognitionError(null)
        sendSignal({ type: 'start-recognition', from: peerIdRef.current })
    }, [])

    const stopGuestRecognition = useCallback(() => {
        const sendSignal = sendSignalRef.current
        if (!peerIdRef.current || !sendSignal) return
        sendSignal({ type: 'stop-recognition', from: peerIdRef.current })
    }, [])

    const clearGuestTranscript = useCallback(() => setGuestTranscript(null), [])

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
        startGuestRecognition,
        stopGuestRecognition,
        clearGuestTranscript,
        sendStopWelcomeAudio,
    }
}
