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

    // Attach the MediaStream to the <video> element whenever it changes
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
        }
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

export default function VideoChat({ roomId, displayName, onLeave, isHost = false }: VideoChatProps) {
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
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        sendChatMessage,
        sendPresentation,
        leaveRoom,
    } = useWebRTC(roomId, displayName)

    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)

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
