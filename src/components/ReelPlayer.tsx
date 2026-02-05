'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Content } from '@/lib/types'
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaChevronUp, FaChevronDown, FaEye, FaHeart, FaComment, FaEdit, FaTrash } from 'react-icons/fa'
import styles from './ReelPlayer.module.css'

interface ReelPlayerProps {
    reels: Content[]
    hostName?: string
    isHost?: boolean
    onEdit?: (reel: Content) => void
    onDelete?: (reelId: string) => void
}

export default function ReelPlayer({ reels, hostName, isHost, onEdit, onDelete }: ReelPlayerProps) {
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
            {/* Progress bar */}
            <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>

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

            {/* Host info overlay */}
            {hostName && (
                <div className={styles.hostInfo}>
                    <span className={styles.hostName}>@{hostName}</span>
                </div>
            )}

            {/* Content info */}
            <div className={styles.contentInfo}>
                {currentReel.title && <h3 className={styles.title}>{currentReel.title}</h3>}
                {currentReel.caption && (
                    <p className={styles.caption}>{currentReel.caption}</p>
                )}
                {currentReel.description && (
                    <p className={styles.description}>{currentReel.description}</p>
                )}
            </div>

            {/* Engagement Stats Sidebar */}
            <div className={styles.engagementSidebar}>
                <div className={styles.engagementItem}>
                    <button
                        className={`${styles.engagementButton} ${likedReels.has(currentReel.id) ? styles.liked : ''}`}
                        onClick={() => toggleLike(currentReel.id)}
                        aria-label="Like"
                    >
                        <FaHeart />
                    </button>
                    <span>{formatNumber(getEngagement(currentReel).likes)}</span>
                </div>
                <div className={styles.engagementItem}>
                    <button className={styles.engagementButton} aria-label="Comment">
                        <FaComment />
                    </button>
                    <span>{formatNumber(getEngagement(currentReel).comments)}</span>
                </div>
                <div className={styles.engagementItem}>
                    <button className={styles.engagementButton} aria-label="Views">
                        <FaEye />
                    </button>
                    <span>{formatNumber(getEngagement(currentReel).views)}</span>
                </div>

                {/* Host Actions */}
                {isHost && (
                    <>
                        <div className={styles.engagementItem}>
                            <button
                                className={`${styles.engagementButton} ${styles.editButton}`}
                                onClick={() => onEdit?.(currentReel)}
                                aria-label="Edit"
                            >
                                <FaEdit />
                            </button>
                        </div>
                        <div className={styles.engagementItem}>
                            <button
                                className={`${styles.engagementButton} ${styles.deleteButton}`}
                                onClick={() => onDelete?.(currentReel.id)}
                                aria-label="Delete"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                <button
                    className={styles.controlButton}
                    onClick={() => setIsPlaying(prev => !prev)}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>

                <button
                    className={styles.controlButton}
                    onClick={() => setIsMuted(prev => !prev)}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
            </div>

            {/* Navigation */}
            <div className={styles.navigation}>
                <button
                    className={`${styles.navButton} ${currentIndex === 0 ? styles.disabled : ''}`}
                    onClick={goToPrev}
                    disabled={currentIndex === 0}
                    aria-label="Previous"
                >
                    <FaChevronUp />
                </button>

                <div className={styles.counter}>
                    {currentIndex + 1} / {reels.length}
                </div>

                <button
                    className={`${styles.navButton} ${currentIndex === reels.length - 1 ? styles.disabled : ''}`}
                    onClick={goToNext}
                    disabled={currentIndex === reels.length - 1}
                    aria-label="Next"
                >
                    <FaChevronDown />
                </button>
            </div>
        </div>
    )
}
