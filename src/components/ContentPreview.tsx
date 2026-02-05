'use client'

import { useState } from 'react'
import { Content } from '@/lib/types'
import styles from './ContentPreview.module.css'
import { FaPlay, FaTimes, FaFilm } from 'react-icons/fa'

interface ContentPreviewProps {
    content: Content[]
    onUploadClick?: () => void
}

export default function ContentPreview({ content, onUploadClick }: ContentPreviewProps) {
    const [previewVideo, setPreviewVideo] = useState<Content | null>(null)

    const formatDuration = (seconds?: number) => {
        if (!seconds) return ''
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (content.length === 0) {
        return (
            <div className={styles.emptyState}>
                <FaFilm className={styles.emptyIcon} />
                <p>No content uploaded yet</p>
                <button onClick={onUploadClick} className="button-primary">
                    Upload Reels
                </button>
            </div>
        )
    }

    return (
        <>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h3>Your Content</h3>
                    <span className={styles.count}>{content.length} reels</span>
                </div>

                <div className={styles.scrollContainer}>
                    {content.map(item => (
                        <div
                            key={item.id}
                            className={styles.thumbnail}
                            onClick={() => setPreviewVideo(item)}
                        >
                            <video
                                src={item.cloudinary_url}
                                className={styles.video}
                                muted
                                preload="metadata"
                            />
                            <div className={styles.overlay}>
                                <FaPlay className={styles.playIcon} />
                            </div>
                            {item.duration_seconds && (
                                <span className={styles.duration}>
                                    {formatDuration(item.duration_seconds)}
                                </span>
                            )}
                            {item.title || item.caption ? (
                                <span className={styles.title}>{item.title || item.caption}</span>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>

            {/* Preview Modal */}
            {previewVideo && (
                <div className={styles.modal} onClick={() => setPreviewVideo(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button
                            className={styles.closeBtn}
                            onClick={() => setPreviewVideo(null)}
                        >
                            <FaTimes />
                        </button>
                        <video
                            src={previewVideo.cloudinary_url}
                            className={styles.previewVideo}
                            controls
                            autoPlay
                        />
                        {previewVideo.title && (
                            <h4 className={styles.previewTitle}>{previewVideo.title}</h4>
                        )}
                        {previewVideo.description && (
                            <p className={styles.previewDescription}>{previewVideo.description}</p>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
