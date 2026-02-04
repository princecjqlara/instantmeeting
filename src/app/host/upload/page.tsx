'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Content } from '@/lib/types'
import styles from './page.module.css'
import {
    FaUpload, FaArrowLeft, FaTrash, FaPlay,
    FaSpinner, FaCheck, FaGripVertical
} from 'react-icons/fa'

export default function UploadPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [content, setContent] = useState<Content[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const response = await fetch('/api/content')
                if (response.ok) {
                    const data = await response.json()
                    setContent(data)
                }
            } catch (error) {
                console.error('Error fetching content:', error)
            } finally {
                setLoading(false)
            }
        }

        if (session) {
            fetchContent()
        }
    }, [session])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        setUploadProgress(0)

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const formData = new FormData()
            formData.append('file', file)
            formData.append('title', file.name.replace(/\.[^/.]+$/, ''))

            try {
                const response = await fetch('/api/content', {
                    method: 'POST',
                    body: formData,
                })

                if (response.ok) {
                    const newContent = await response.json()
                    setContent(prev => [...prev, newContent])
                }
            } catch (error) {
                console.error('Error uploading:', error)
            }

            setUploadProgress(((i + 1) / files.length) * 100)
        }

        setUploading(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const deleteContent = async (id: string) => {
        try {
            const response = await fetch(`/api/content?id=${id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                setContent(prev => prev.filter(c => c.id !== id))
            }
        } catch (error) {
            console.error('Error deleting:', error)
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <button
                    onClick={() => router.back()}
                    className={styles.backBtn}
                >
                    <FaArrowLeft />
                </button>
                <h1>Your Content</h1>
                <span className={styles.count}>{content.length} reels</span>
            </header>

            {/* Upload Section */}
            <section className={styles.uploadSection}>
                <div
                    className={`${styles.uploadZone} ${uploading ? styles.uploading : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploading ? (
                        <>
                            <FaSpinner className={styles.spinIcon} />
                            <p>Uploading... {Math.round(uploadProgress)}%</p>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <FaUpload className={styles.uploadIcon} />
                            <p>Drop videos here or click to upload</p>
                            <span>Supports MP4, MOV, WebM</span>
                        </>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleFileSelect}
                    className={styles.hiddenInput}
                />
            </section>

            {/* Content List */}
            <section className={styles.contentSection}>
                {content.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No content yet</p>
                        <span>Upload videos that guests will see while waiting</span>
                    </div>
                ) : (
                    <div className={styles.contentGrid}>
                        {content.map((item) => (
                            <div key={item.id} className={styles.contentCard}>
                                <div className={styles.thumbnail}>
                                    <video
                                        src={item.cloudinary_url}
                                        muted
                                        className={styles.video}
                                    />
                                    <div className={styles.playOverlay}>
                                        <FaPlay />
                                    </div>
                                    {item.duration_seconds && (
                                        <span className={styles.duration}>
                                            {Math.floor(item.duration_seconds / 60)}:
                                            {(item.duration_seconds % 60).toString().padStart(2, '0')}
                                        </span>
                                    )}
                                </div>

                                <div className={styles.cardContent}>
                                    <div className={styles.cardInfo}>
                                        <FaGripVertical className={styles.dragHandle} />
                                        <span className={styles.title}>{item.title || 'Untitled'}</span>
                                    </div>

                                    <button
                                        onClick={() => deleteContent(item.id)}
                                        className={styles.deleteBtn}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Info */}
            <section className={styles.infoSection}>
                <div className={styles.infoCard}>
                    <FaCheck className={styles.infoIcon} />
                    <div>
                        <h3>How it works</h3>
                        <p>
                            Videos you upload here will be shown to guests in your waiting rooms.
                            They&apos;ll swipe through your content like TikTok while waiting to be admitted.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}
