'use client'

import { useState, useEffect, useRef } from 'react'
import { Presentation, PresentationSlide } from '@/lib/types'
import {
    FaChevronLeft, FaChevronRight, FaTimes, FaExpand, FaCompress,
    FaPlay, FaPause, FaList
} from 'react-icons/fa'
import styles from './PresentationOverlay.module.css'

interface PresentationOverlayProps {
    /** Host mode: can control slides & pick presentations */
    isHost: boolean
    /** Current presentation slide broadcast by host (for guests) */
    activeSlide?: { url: string; type: string; index: number; total: number; title: string } | null
    /** Callback when host changes slide (broadcasts to peers) */
    onSlideChange?: (slide: { url: string; type: string; index: number; total: number; title: string } | null) => void
}

export default function PresentationOverlay({ isHost, activeSlide, onSlideChange }: PresentationOverlayProps) {
    const [presentations, setPresentations] = useState<Presentation[]>([])
    const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const [isActive, setIsActive] = useState(false)
    const [mediaError, setMediaError] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    // Fetch presentations for host
    useEffect(() => {
        if (isHost) {
            fetch('/api/presentations')
                .then(res => res.json())
                .then(data => setPresentations(data))
                .catch(console.error)
        }
    }, [isHost])

    const slides = selectedPresentation?.slides || []

    const broadcastSlide = (index: number) => {
        if (!onSlideChange || !slides[index]) return
        onSlideChange({
            url: slides[index].media_url,
            type: slides[index].media_type,
            index,
            total: slides.length,
            title: selectedPresentation?.title || '',
        })
    }

    const startPresentation = (presentation: Presentation) => {
        setSelectedPresentation(presentation)
        setCurrentIndex(0)
        setIsActive(true)
        setShowPicker(false)

        if (onSlideChange && presentation.slides && presentation.slides.length > 0) {
            onSlideChange({
                url: presentation.slides[0].media_url,
                type: presentation.slides[0].media_type,
                index: 0,
                total: presentation.slides.length,
                title: presentation.title,
            })
        }
    }

    const stopPresentation = () => {
        setIsActive(false)
        setSelectedPresentation(null)
        setCurrentIndex(0)
        setIsFullscreen(false)
        onSlideChange?.(null)
    }

    const goToSlide = (index: number) => {
        if (index < 0 || index >= slides.length) return
        setCurrentIndex(index)
        setMediaError(null)
        broadcastSlide(index)
    }

    const nextSlide = () => goToSlide(currentIndex + 1)
    const prevSlide = () => goToSlide(currentIndex - 1)

    // Keyboard navigation for host
    useEffect(() => {
        if (!isHost || !isActive) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide() }
            if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide() }
            if (e.key === 'Escape') stopPresentation()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [isHost, isActive, currentIndex, slides.length])

    // Auto-play video slides
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0
            videoRef.current.play().catch(() => {})
        }
    }, [currentIndex, isActive])

    // Clear media error when slide changes
    useEffect(() => {
        setMediaError(null)
    }, [activeSlide?.index, activeSlide?.url])

    // ─── Guest View: Show what host is broadcasting ──────────
    if (!isHost) {
        if (!activeSlide) return null
        return (
            <div className={`${styles.overlay} ${styles.guestOverlay}`}>
                <div className={styles.slideContainer}>
                    <div className={styles.slideInfo}>
                        <span className={styles.slideTitle}>📊 {activeSlide.title}</span>
                        <span className={styles.slideCounter}>{activeSlide.index + 1} / {activeSlide.total}</span>
                    </div>
                    <div className={styles.slideContent}>
                        {mediaError ? (
                            <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '40px 20px', fontSize: 14 }}>
                                <p style={{ margin: 0 }}>Failed to load slide</p>
                                <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 12 }}>{mediaError}</p>
                            </div>
                        ) : activeSlide.type === 'video' ? (
                            <video
                                src={activeSlide.url}
                                autoPlay
                                controls
                                className={styles.slideMedia}
                                onError={() => setMediaError('Video could not be loaded')}
                            />
                        ) : (
                            <img
                                src={activeSlide.url}
                                alt="Presentation"
                                className={styles.slideMedia}
                                onError={() => setMediaError('Image could not be loaded')}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ─── Host View: Picker button (when not presenting) ──────
    if (!isActive) {
        return (
            <>
                <button
                    onClick={() => setShowPicker(prev => !prev)}
                    className={styles.launchBtn}
                    title="Start a presentation"
                >
                    <FaList />
                    <span>Present</span>
                </button>

                {showPicker && (
                    <div className={styles.pickerDropdown}>
                        <div className={styles.pickerHeader}>
                            <span>Select Presentation</span>
                            <button onClick={() => setShowPicker(false)} className={styles.pickerClose}><FaTimes /></button>
                        </div>
                        {presentations.length === 0 ? (
                            <p className={styles.pickerEmpty}>
                                No presentations yet. Create one from the dashboard.
                            </p>
                        ) : (
                            <div className={styles.pickerList}>
                                {presentations.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => startPresentation(p)}
                                        className={styles.pickerItem}
                                        disabled={!p.slides || p.slides.length === 0}
                                    >
                                        <span className={styles.pickerItemTitle}>{p.title}</span>
                                        <span className={styles.pickerItemCount}>
                                            {(p.slides || []).length} slides
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </>
        )
    }

    // ─── Host View: Active Presentation ──────────────────────
    const currentSlide = slides[currentIndex]

    return (
        <div className={`${styles.overlay} ${isFullscreen ? styles.fullscreen : ''}`}>
            <div className={styles.slideContainer}>
                {/* Header */}
                <div className={styles.slideInfo}>
                    <span className={styles.slideTitle}>📊 {selectedPresentation?.title}</span>
                    <span className={styles.slideCounter}>{currentIndex + 1} / {slides.length}</span>
                    <div className={styles.slideControls}>
                        <button
                            onClick={() => setIsFullscreen(prev => !prev)}
                            className={styles.controlIcon}
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <FaCompress /> : <FaExpand />}
                        </button>
                        <button onClick={stopPresentation} className={styles.controlIcon} title="Stop presentation">
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* Slide */}
                <div className={styles.slideContent}>
                    {mediaError ? (
                        <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '40px 20px', fontSize: 14 }}>
                            <p style={{ margin: 0 }}>Failed to load slide</p>
                            <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 12 }}>{mediaError}</p>
                        </div>
                    ) : currentSlide?.media_type === 'video' ? (
                        <video
                            ref={videoRef}
                            key={currentSlide.id}
                            src={currentSlide.media_url}
                            controls
                            autoPlay
                            className={styles.slideMedia}
                            onError={() => setMediaError('Video could not be loaded')}
                        />
                    ) : (
                        <img
                            src={currentSlide?.media_url}
                            alt={`Slide ${currentIndex + 1}`}
                            className={styles.slideMedia}
                            onError={() => setMediaError('Image could not be loaded')}
                        />
                    )}

                    {/* Nav arrows */}
                    <button
                        onClick={prevSlide}
                        disabled={currentIndex === 0}
                        className={`${styles.navArrow} ${styles.navLeft}`}
                    >
                        <FaChevronLeft />
                    </button>
                    <button
                        onClick={nextSlide}
                        disabled={currentIndex === slides.length - 1}
                        className={`${styles.navArrow} ${styles.navRight}`}
                    >
                        <FaChevronRight />
                    </button>
                </div>

                {/* Thumbnail strip */}
                <div className={styles.thumbnailStrip}>
                    {slides.map((slide, i) => (
                        <button
                            key={slide.id}
                            onClick={() => goToSlide(i)}
                            className={`${styles.thumbnail} ${i === currentIndex ? styles.thumbnailActive : ''}`}
                        >
                            {slide.media_type === 'video' ? (
                                <video src={slide.media_url} muted className={styles.thumbMedia} />
                            ) : (
                                <img src={slide.media_url} alt="" className={styles.thumbMedia} />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
