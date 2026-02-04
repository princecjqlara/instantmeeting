'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Content } from '@/lib/types'
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaChevronUp, FaChevronDown } from 'react-icons/fa'
import styles from './ReelPlayer.module.css'

interface ReelPlayerProps {
    reels: Content[]
    hostName?: string
}

export default function ReelPlayer({ reels, hostName }: ReelPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(true)
    const [isMuted, setIsMuted] = useState(true)
    const [progress, setProgress] = useState(0)
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const currentReel = reels[currentIndex]

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
                {currentReel.description && (
                    <p className={styles.description}>{currentReel.description}</p>
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
