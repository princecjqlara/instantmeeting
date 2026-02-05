'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Content } from '@/lib/types'
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaHeart, FaCommentDots, FaShare, FaMusic, FaEdit, FaTrash } from 'react-icons/fa'
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
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const currentReel = reels[currentIndex]

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
        return num.toString()
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
            } else {
                newSet.add(reelId)
                setLocalEngagement(eng => ({
                    ...eng,
                    [reelId]: { ...eng[reelId], likes: (eng[reelId]?.likes || 0) + 1 }
                }))
            }
            return newSet
        })
    }

    const getEngagement = (reel: Content) => ({
        likes: (reel.likes || 0) + (localEngagement[reel.id]?.likes || 0),
        comments: (reel.comments || 0) + (localEngagement[reel.id]?.comments || 0),
        views: reel.views || 0
    })

    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(() => { })
            } else {
                videoRef.current.pause()
            }
        }
    }, [isPlaying, currentIndex])

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

    const goToNext = useCallback(() => {
        if (currentIndex < reels.length - 1) {
            setCurrentIndex(prev => prev + 1)
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
                className={styles.video}
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
                        {hostAvatar ? (
                            <img src={hostAvatar} alt={hostName} className={styles.avatar} />
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
                    <button className={styles.actionButton}>
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
                    {hostAvatar ? (
                        <img src={hostAvatar} alt="" className={styles.recordImage} />
                    ) : (
                        <div className={styles.recordPlaceholder} />
                    )}
                </div>
            </div>

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
        </div>
    )
}

