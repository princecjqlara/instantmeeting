'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Content } from '@/lib/types'
import { FaHeart, FaCommentDots, FaShare, FaVolumeUp, FaVolumeMute, FaArrowLeft, FaEdit, FaTrash, FaPlay } from 'react-icons/fa'
import BookingModal from './BookingModal'
import styles from './ReelPlayer.module.css'

interface ReelPlayerProps {
    reels: Content[]
    hostName?: string
    hostAvatar?: string | null
    isHost?: boolean
    onEdit?: (reel: Content) => void
    onDelete?: (reelId: string) => void
}

export default function ReelPlayer({ reels, hostName, hostAvatar, isHost, onEdit, onDelete }: ReelPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(true)
    const [isMuted, setIsMuted] = useState(true)
    const [progress, setProgress] = useState(0)
    const [likedReels, setLikedReels] = useState<Set<string>>(new Set())
    const [localEngagement, setLocalEngagement] = useState<Record<string, { likes: number; comments: number }>>({})
    const [localAvatar, setLocalAvatar] = useState<string | null>(hostAvatar || null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Update local avatar when prop changes
    useEffect(() => {
        if (hostAvatar) setLocalAvatar(hostAvatar)
    }, [hostAvatar])

    const currentReel = reels[currentIndex]

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
        return num.toString()
    }

    const updateEngagement = async (type: 'view' | 'like' | 'comment') => {
        try {
            await fetch('/api/content/engagement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentReel.id, type })
            })
        } catch (error) {
            console.error(`Error updating ${type}:`, error)
        }
    }

    const toggleLike = (reelId: string) => {
        setLikedReels(prev => {
            const newSet = new Set(prev)
            if (newSet.has(reelId)) {
                newSet.delete(reelId)
                setLocalEngagement(eng => ({
                    ...eng,
                    [reelId]: { ...eng[reelId], likes: (eng[reelId]?.likes || 0) - 1 }
                }))
                // Note: We don't decrement on backend for anonymous likes to prevent abuse
            } else {
                newSet.add(reelId)
                setLocalEngagement(eng => ({
                    ...eng,
                    [reelId]: { ...eng[reelId], likes: (eng[reelId]?.likes || 0) + 1 }
                }))
                updateEngagement('like')
            }
            return newSet
        })
    }

    const [isCommenting, setIsCommenting] = useState(false)
    const [commentText, setCommentText] = useState('')
    const [showBookingModal, setShowBookingModal] = useState(false)
    const [scrollCount, setScrollCount] = useState(0)
    const [hostSettings, setHostSettings] = useState<any>(null)

    // ... useEffects ...

    const goToNext = useCallback(() => {
        if (currentIndex < reels.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setScrollCount(prev => {
                const newCount = prev + 1
                if (hostSettings && hostSettings.scroll_threshold && newCount >= hostSettings.scroll_threshold) {
                    if (hostSettings.availability_mode !== 'always') {
                        setShowBookingModal(true)
                        return 0
                    }
                }
                return newCount
            })
        }
    }, [currentIndex, reels.length, hostSettings])

    const handleCommentSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (commentText.trim()) {
            setLocalEngagement(eng => ({
                ...eng,
                [currentReel.id]: { ...eng[currentReel.id], comments: (eng[currentReel.id]?.comments || 0) + 1 }
            }))
            updateEngagement('comment')
            setCommentText('')
            setIsCommenting(false)
        }
    }

    const getEngagement = (reel: Content) => ({
        likes: (reel.likes || 0) + (localEngagement[reel.id]?.likes || 0),
        comments: (reel.comments || 0) + (localEngagement[reel.id]?.comments || 0),
        views: reel.views || 0
    })

    useEffect(() => {
        if (reels.length > 0) {
            const hostId = reels[0].user_id
            fetch(`/api/users/${hostId}/public`)
                .then(res => res.json())
                .then(data => setHostSettings(data))
                .catch(err => console.error("Failed to fetch host settings", err))
        }
    }, [reels])

    useEffect(() => {
        // Fetch latest host profile data to ensure avatar is up to date
        const fetchProfile = async () => {
            if (hostName) {
                try {
                    // Try to fetch by username if available, or just rely on passed props for now
                    // If we are the host, we can fetch our own settings
                    if (isHost) {
                        const res = await fetch('/api/profile/settings')
                        if (res.ok) {
                            const data = await res.json()
                            if (data.avatar_url) {
                                setLocalAvatar(data.avatar_url)
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching profile:', e)
                }
            }
        }
        fetchProfile()
    }, [hostName, isHost])

    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(() => { })
            } else {
                videoRef.current.pause()
            }
        }
    }, [isPlaying, currentIndex])

    // Track views
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isPlaying) {
                updateEngagement('view')
            }
        }, 5000) // Count view after 5 seconds
        return () => clearTimeout(timer)
    }, [currentReel.id])

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted
        }
    }, [isMuted])

    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) {
            const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100
            setProgress(percent)
        }
    }, [])

    const handleVideoEnd = useCallback(() => {
        if (currentIndex < reels.length - 1) {
            setCurrentIndex(prev => prev + 1)
        } else {
            setCurrentIndex(0)
        }
    }, [currentIndex, reels.length])

    const goToPrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
        }
    }, [currentIndex])

    // Handle swipe/scroll
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let startY = 0
        let isDragging = false
        let lastScrollTime = 0
        const scrollDebounce = 300 // ms between scroll events

        const handleTouchStart = (e: TouchEvent) => {
            startY = e.touches[0].clientY
            isDragging = true
        }

        const handleTouchEnd = (e: TouchEvent) => {
            if (!isDragging) return
            const endY = e.changedTouches[0].clientY
            const diff = startY - endY

            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    goToNext()
                } else {
                    goToPrev()
                }
            }
            isDragging = false
        }

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault()
            const now = Date.now()
            if (now - lastScrollTime < scrollDebounce) return
            lastScrollTime = now

            if (e.deltaY > 0) {
                goToNext()
            } else {
                goToPrev()
            }
        }

        container.addEventListener('touchstart', handleTouchStart)
        container.addEventListener('touchend', handleTouchEnd)
        container.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchend', handleTouchEnd)
            container.removeEventListener('wheel', handleWheel)
        }
    }, [goToNext, goToPrev])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                goToPrev()
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                goToNext()
            } else if (e.key === ' ') {
                e.preventDefault()
                setIsPlaying(prev => !prev)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goToNext, goToPrev])

    if (reels.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🎬</div>
                <p>No content available yet</p>
                <span>Check back later!</span>
            </div>
        )
    }

    return (
        <div ref={containerRef} className={styles.container}>
            {/* Video */}
            <video
                ref={videoRef}
                key={currentReel.id}
                src={currentReel.cloudinary_url}
                className={`${styles.video} ${styles.slideAnimation}`}
                playsInline
                loop={false}
                autoPlay
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnd}
                onClick={() => setIsPlaying(prev => !prev)}
            />

            {/* Play/Pause Indicator */}
            {!isPlaying && (
                <div className={styles.playIndicator}>
                    <FaPlay />
                </div>
            )}

            {/* Progress bar */}
            <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>

            {/* Bottom Left - User Info */}
            <div className={styles.bottomLeft}>
                <div className={styles.userInfo}>
                    <span className={styles.username}>@{hostName || 'user'}</span>
                    {currentReel.caption && (
                        <p className={styles.caption}>{currentReel.caption}</p>
                    )}
                    {currentReel.description && (
                        <p className={styles.description}>{currentReel.description}</p>
                    )}
                </div>
                {/* Music ticker */}
                <div className={styles.musicTicker}>
                    <FaMusic className={styles.musicIcon} />
                    <span className={styles.musicText}>Original Sound - {hostName || 'user'}</span>
                </div>
            </div>

            {/* Right Sidebar - TikTok Style */}
            <div className={styles.sidebar}>
                {/* Profile Avatar */}
                <div className={styles.profileSection}>
                    <div className={styles.avatarWrapper}>
                        {localAvatar ? (
                            <img src={localAvatar} alt={hostName} className={styles.avatar} />
                        ) : (
                            <div className={styles.avatarPlaceholder}>
                                {hostName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className={styles.followBadge}>+</div>
                    </div>
                </div>

                {/* Like Button */}
                <div className={styles.actionItem}>
                    <button
                        className={`${styles.actionButton} ${likedReels.has(currentReel.id) ? styles.liked : ''}`}
                        onClick={() => toggleLike(currentReel.id)}
                    >
                        <FaHeart />
                    </button>
                    <span className={styles.actionCount}>{formatNumber(getEngagement(currentReel).likes)}</span>
                </div>

                {/* Comment Button */}
                <div className={styles.actionItem}>
                    <button
                        className={styles.actionButton}
                        onClick={() => setIsCommenting(true)}
                    >
                        <FaCommentDots />
                    </button>
                    <span className={styles.actionCount}>{formatNumber(getEngagement(currentReel).comments)}</span>
                </div>

                {/* Share Button */}
                <div className={styles.actionItem}>
                    <button className={styles.actionButton}>
                        <FaShare />
                    </button>
                    <span className={styles.actionCount}>{formatNumber(getEngagement(currentReel).views)}</span>
                </div>

                {/* Host Actions */}
                {isHost && (
                    <>
                        <div className={styles.actionItem}>
                            <button
                                className={`${styles.actionButton} ${styles.editButton}`}
                                onClick={() => onEdit?.(currentReel)}
                            >
                                <FaEdit />
                            </button>
                        </div>
                        <div className={styles.actionItem}>
                            <button
                                className={`${styles.actionButton} ${styles.deleteButton}`}
                                onClick={() => onDelete?.(currentReel.id)}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </>
                )}

                {/* Spinning Record */}
                <div className={styles.spinningRecord}>
                    {localAvatar ? (
                        <img src={localAvatar} alt="" className={styles.recordImage} />
                    ) : (
                        <div className={styles.recordPlaceholder} />
                    )}
                </div>
            </div>

            {/* Comment Overlay */}
            {isCommenting && (
                <div className={styles.commentOverlay}>
                    <div className={styles.commentHeader}>
                        <span>Add Comment</span>
                        <button
                            className={styles.closeCommentBtn}
                            onClick={() => setIsCommenting(false)}
                        >
                            ✕
                        </button>
                    </div>
                    <form onSubmit={handleCommentSubmit} className={styles.commentInputWrapper}>
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Say something nice..."
                            className={styles.commentInput}
                            autoFocus
                        />
                        <button
                            type="submit"
                            className={styles.sendButton}
                            disabled={!commentText.trim()}
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}

            {/* Volume Control */}
            <button
                className={styles.volumeButton}
                onClick={() => setIsMuted(prev => !prev)}
            >
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>

            {/* Reel Counter */}
            {reels.length > 1 && (
                <div className={styles.reelCounter}>
                    {currentIndex + 1}/{reels.length}
                </div>
            )}

            {showBookingModal && hostSettings && (
                <BookingModal
                    host={hostSettings}
                    onClose={() => setShowBookingModal(false)}
                />
            )}
        </div>
    )
}

