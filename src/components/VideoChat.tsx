/**
 * VideoChat Component
 * 
 * Renders a fullscreen video chat interface with:
 * - Local video (mirrored, self-muted)
 * - Remote participant video tiles (auto-grid for 1-3 peers)
 * - Control bar: mute/unmute mic, toggle camera, leave room
 * - Visual indicators for muted mic / camera off states
 * - AI Assistant panel (host-only) with RAG-powered chat
 */

'use client'

import { useRef, useEffect, useState } from 'react'
import { useWebRTC, RemoteStream } from '@/hooks/useWebRTC'
import AIAssistantPanel from './AIAssistantPanel'
import PresentationOverlay from './PresentationOverlay'
import {
    FaMicrophone,
    FaMicrophoneSlash,
    FaVideo,
    FaVideoSlash,
    FaPhoneSlash,
    FaComments,
    FaPaperPlane,
    FaSpinner,
    FaExclamationTriangle,
    FaBrain,
    FaDesktop,
    FaDoorOpen,
    FaVolumeMute,
} from 'react-icons/fa'
import styles from './VideoChat.module.css'

interface VideoChatProps {
    /** Room ID for the video call (typically the meeting ID) */
    roomId: string
    /** Display name shown to other participants */
    displayName: string
    /** Callback when user leaves the room */
    onLeave: () => void
    /** Whether this user is the host (authenticated). AI panel only shown for hosts. */
    isHost?: boolean
    /** Called when the host sends a stop-welcome-audio signal (guest side) */
    onStopWelcomeAudio?: () => void
}

/**
 * VideoTile — renders a single video stream with a name label.
 * Used for both local (mirrored) and remote participants.
 */
function VideoTile({
    stream,
    name,
    muted,
    mirrored,
    isCameraOff,
    isMicMuted,
}: {
    stream: MediaStream | null
    name: string
    muted: boolean
    mirrored?: boolean
    isCameraOff?: boolean
    isMicMuted?: boolean
}) {
    const videoRef = useRef<HTMLVideoElement>(null)

    // Attach the MediaStream to the <video> element whenever it changes.
    // Also listen for track additions/removals so new audio/video tracks are picked up
    // even when the MediaStream object reference stays the same.
    useEffect(() => {
        if (!videoRef.current || !stream) return
        videoRef.current.srcObject = stream

        const refreshVideo = () => {
            if (videoRef.current) {
                videoRef.current.srcObject = null
                videoRef.current.srcObject = stream
            }
        }
        stream.addEventListener('addtrack', refreshVideo)
        stream.addEventListener('removetrack', refreshVideo)
        return () => {
            stream.removeEventListener('addtrack', refreshVideo)
            stream.removeEventListener('removetrack', refreshVideo)
        }
    }, [stream])

    // Force re-attach when stream has tracks but video element lost them
    useEffect(() => {
        if (!videoRef.current || !stream) return
        const interval = setInterval(() => {
            if (videoRef.current && stream.getTracks().length > 0 && !videoRef.current.srcObject) {
                videoRef.current.srcObject = stream
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [stream])

    return (
        <div className={styles.videoTile}>
            {isCameraOff ? (
                // Show avatar placeholder when camera is off
                <div className={styles.cameraOff}>
                    <div className={styles.avatarCircle}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.cameraOffLabel}>Camera off</span>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={muted}
                    className={`${styles.video} ${mirrored ? styles.mirrored : ''}`}
                />
            )}

            {/* Participant name label */}
            <div className={styles.nameLabel}>
                <span>{name}</span>
                {isMicMuted && <FaMicrophoneSlash className={styles.mutedIcon} />}
            </div>
        </div>
    )
}

export default function VideoChat({ roomId, displayName, onLeave, isHost = false, onStopWelcomeAudio }: VideoChatProps) {
    const {
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
    } = useWebRTC(roomId, displayName, isHost)

    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)

    // Guest: stop welcome audio when host sends the signal
    useEffect(() => {
        if (shouldStopWelcomeAudio && onStopWelcomeAudio) {
            onStopWelcomeAudio()
        }
    }, [shouldStopWelcomeAudio, onStopWelcomeAudio])

    const [isChatOpen, setIsChatOpen] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const chatScrollRef = useRef<HTMLDivElement>(null)
    const unreadCount = isChatOpen
        ? 0
        : chatMessages.reduce(
            (count, message) => (message.isLocal ? count : count + 1),
            0
        )

    // Handle leave: clean up WebRTC, then call parent callback
    const handleLeave = () => {
        leaveRoom()
        onLeave()
    }

    // Handle end meeting for all (host only)
    const handleEndMeeting = async () => {
        if (!confirm('End this meeting for everyone?')) return

        try {
            // Call the API to mark meeting as completed
            await fetch(`/api/meetings/${roomId}/end`, {
                method: 'POST',
            })
        } catch (err) {
            console.error('Error ending meeting via API:', err)
        }

        // Broadcast end-meeting signal to all peers
        endMeetingForAll()
    }

    // Auto-leave when meeting is ended by host (for non-host participants)
    useEffect(() => {
        if (!meetingEnded) return

        const timer = setTimeout(() => {
            leaveRoom()
            onLeave()
        }, 3000)

        return () => clearTimeout(timer)
    }, [meetingEnded, leaveRoom, onLeave])

    // Auto-end meeting for host when no guests are present
    const hadRemotePeersRef = useRef(false)
    useEffect(() => {
        if (!isHost || meetingEnded) return

        // Track that we once had remote peers
        if (remoteStreams.length > 0) {
            hadRemotePeersRef.current = true
            return
        }

        // No guests present — auto-end after a grace period
        // 10s if guests already left, 2 minutes if nobody ever joined
        const delay = hadRemotePeersRef.current ? 10000 : 120000

        const timer = setTimeout(async () => {
            try {
                await fetch(`/api/meetings/${roomId}/end`, { method: 'POST' })
            } catch {}
            endMeetingForAll()
        }, delay)

        return () => clearTimeout(timer)
    }, [isHost, remoteStreams.length, meetingEnded, roomId, endMeetingForAll])

    const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const sent = sendChatMessage(chatInput)
        if (sent) {
            setChatInput('')
        }
    }

    const formatMessageTime = (timestamp: string) => {
        const parsed = new Date(timestamp)
        if (Number.isNaN(parsed.getTime())) {
            return ''
        }

        return parsed.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    useEffect(() => {
        if (!isChatOpen || !chatScrollRef.current) {
            return
        }

        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }, [chatMessages, isChatOpen])

    // ─── Error State ────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className={styles.errorContainer}>
                <FaExclamationTriangle className={styles.errorIcon} />
                <h2>Something went wrong</h2>
                <p>{error}</p>
                <button onClick={onLeave} className={styles.leaveBtn}>
                    Go Back
                </button>
            </div>
        )
    }

    // ─── Loading State ──────────────────────────────────────────────────────
    if (isConnecting) {
        return (
            <div className={styles.loadingContainer}>
                <FaSpinner className={styles.spinner} />
                <p>Connecting to room...</p>
            </div>
        )
    }

    // Determine grid layout class based on participant count
    const totalParticipants = 1 + remoteStreams.length // local + remotes
    const gridClass =
        totalParticipants === 1
            ? styles.gridSolo
            : totalParticipants === 2
                ? styles.gridDuo
                : styles.gridTrio

    // ─── Meeting Ended Overlay ──────────────────────────────────────────────
    if (meetingEnded) {
        return (
            <div className={styles.errorContainer}>
                <FaDoorOpen className={styles.errorIcon} style={{ color: '#ff6b6b' }} />
                <h2>Meeting Ended</h2>
                <p>{isHost ? 'You ended the meeting for everyone.' : 'The host has ended this meeting.'}</p>
                <button onClick={onLeave} className={styles.leaveBtn}>
                    {isHost ? 'Back to Dashboard' : 'Leave'}
                </button>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* ─── Video Grid ─────────────────────────────────────────────────── */}
            <div className={`${styles.videoGrid} ${gridClass}`}>
                {/* Local video tile — mirrored for camera, not mirrored for screen share */}
                <VideoTile
                    stream={localStream}
                    name={`${displayName} (You)${isScreenSharing ? ' — Screen' : ''}`}
                    muted={true}
                    mirrored={!isScreenSharing}
                    isCameraOff={isCameraOff && !isScreenSharing}
                    isMicMuted={isMuted}
                />

                {/* Remote participant tiles */}
                {remoteStreams.map((remote: RemoteStream) => (
                    <VideoTile
                        key={remote.peerId}
                        stream={remote.stream}
                        name={remote.name}
                        muted={false}
                    />
                ))}
            </div>

            {/* ─── Waiting Indicator ──────────────────────────────────────────── */}
            {remoteStreams.length === 0 && (
                <div className={styles.waitingOverlay}>
                    <div className={styles.waitingPulse} />
                    <p>Waiting for others to join...</p>
                </div>
            )}

            {/* ─── AI Assistant Panel (Host Only) ─────────────────────────── */}
            {isHost && (
                <AIAssistantPanel
                    isOpen={isAIPanelOpen}
                    onClose={() => setIsAIPanelOpen(false)}
                    roomId={roomId}
                    chatMessages={chatMessages.map((m) => ({
                        name: m.isLocal ? displayName : m.name,
                        text: m.text,
                        timestamp: m.timestamp,
                    }))}
                    guestTranscript={guestTranscript}
                    liveTranscript={liveTranscript}
                    recognitionError={recognitionError}
                    startGuestRecognition={startGuestRecognition}
                    stopGuestRecognition={stopGuestRecognition}
                    clearGuestTranscript={clearGuestTranscript}
                />
            )}

            {/* ─── Presentation Overlay ────────────────────────────────────── */}
            {!isHost && activePresentation && (
                <PresentationOverlay
                    isHost={false}
                    activeSlide={activePresentation}
                />
            )}

            {/* ─── Chat Panel ─────────────────────────────────────────────────── */}
            <aside className={`${styles.chatPanel} ${isChatOpen ? styles.chatPanelOpen : ''}`}>
                <div className={styles.chatHeader}>
                    <h3>In-call Chat</h3>
                    <button
                        type="button"
                        className={styles.chatCloseBtn}
                        onClick={() => setIsChatOpen(false)}
                    >
                        Close
                    </button>
                </div>

                <div ref={chatScrollRef} className={styles.chatMessages}>
                    {chatMessages.length === 0 ? (
                        <p className={styles.chatEmpty}>No messages yet. Say hi.</p>
                    ) : (
                        chatMessages.map((message) => (
                            <div
                                key={message.id}
                                className={`${styles.chatMessage} ${message.isLocal ? styles.chatMessageLocal : ''}`}
                            >
                                <div className={styles.chatMeta}>
                                    <strong>{message.isLocal ? 'You' : message.name}</strong>
                                    <span>{formatMessageTime(message.timestamp)}</span>
                                </div>
                                <p>{message.text}</p>
                            </div>
                        ))
                    )}
                </div>

                <form className={styles.chatComposer} onSubmit={handleChatSubmit}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Type a message"
                        maxLength={400}
                    />
                    <button type="submit" disabled={!chatInput.trim()}>
                        <FaPaperPlane />
                    </button>
                </form>
            </aside>

            {/* ─── Media Permission Error Banner ──────────────────────────── */}
            {mediaPermissionError && (
                <div className={styles.mediaPermissionBanner}>
                    <FaExclamationTriangle className={styles.mediaPermissionIcon} />
                    {mediaPermissionError === 'IN_APP_BROWSER' ? (
                        <>
                            <span>This browser doesn&apos;t support camera/mic. Open in your default browser.</span>
                            <button
                                className={styles.mediaPermissionOpenBtn}
                                onClick={() => {
                                    // Try to force open in system browser
                                    const url = window.location.href
                                    window.open(url, '_system')
                                    // Fallback: copy to clipboard
                                    navigator.clipboard?.writeText(url).catch(() => {})
                                }}
                            >
                                Open in Browser
                            </button>
                        </>
                    ) : (
                        <>
                            <span>{mediaPermissionError}</span>
                            <button
                                className={styles.mediaPermissionDismiss}
                                onClick={clearMediaPermissionError}
                            >
                                Dismiss
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ─── Unmute Tip (Guest only, shown while muted) ──────────────── */}
            {!isHost && isMuted && !mediaPermissionError && (
                <div className={styles.unmuteTip}>
                    <FaMicrophoneSlash className={styles.unmuteTipIcon} />
                    <span>Your mic is muted — click <FaMicrophone style={{ verticalAlign: 'middle' }} /> to speak</span>
                </div>
            )}

            {/* ─── Control Bar ────────────────────────────────────────────────── */}
            <div className={styles.controlBar}>
                <button
                    onClick={toggleMute}
                    className={`${styles.controlBtn} ${isMuted ? styles.controlBtnDanger : ''}`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                    {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`${styles.controlBtn} ${isCameraOff ? styles.controlBtnDanger : ''}`}
                    title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                >
                    {isCameraOff ? <FaVideoSlash /> : <FaVideo />}
                </button>

                <button
                    onClick={toggleScreenShare}
                    className={`${styles.controlBtn} ${isScreenSharing ? styles.controlBtnScreen : ''}`}
                    title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
                >
                    <FaDesktop />
                </button>

                {/* Presentation — Host Only */}
                {isHost && (
                    <div style={{ position: 'relative' }}>
                        <PresentationOverlay
                            isHost={true}
                            activeSlide={activePresentation}
                            onSlideChange={sendPresentation}
                        />
                    </div>
                )}

                <button
                    onClick={() => setIsChatOpen(prev => !prev)}
                    className={`${styles.controlBtn} ${isChatOpen ? styles.controlBtnActive : ''}`}
                    title={isChatOpen ? 'Hide chat' : 'Show chat'}
                >
                    <FaComments />
                    {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>

                {/* AI Assistant — Host Only */}
                {isHost && (
                    <button
                        onClick={() => setIsAIPanelOpen((prev) => !prev)}
                        className={`${styles.controlBtn} ${isAIPanelOpen ? styles.controlBtnAI : ''}`}
                        title={isAIPanelOpen ? 'Hide AI assistant' : 'Show AI assistant'}
                    >
                        <FaBrain />
                        <span className={styles.aiBadge}>AI</span>
                    </button>
                )}

                {/* Stop Welcome Audio — Host Only */}
                {isHost && (
                    <button
                        onClick={sendStopWelcomeAudio}
                        className={`${styles.controlBtn} ${styles.stopAudioBtn}`}
                        title="Stop guest welcome audio"
                    >
                        <FaVolumeMute />
                    </button>
                )}

                {/* End Meeting — Host Only */}
                {isHost && (
                    <button
                        onClick={handleEndMeeting}
                        className={`${styles.controlBtn} ${styles.endMeetingBtn}`}
                        title="End meeting for all"
                    >
                        <FaDoorOpen />
                    </button>
                )}

                <button
                    onClick={handleLeave}
                    className={`${styles.controlBtn} ${styles.leaveBtn}`}
                    title="Leave room"
                >
                    <FaPhoneSlash />
                </button>
            </div>
        </div>
    )
}
