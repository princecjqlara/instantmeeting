'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Content } from '@/lib/types'
import styles from './page.module.css'
import {
    FaUpload, FaArrowLeft, FaTrash, FaPlay,
    FaSpinner, FaCheck, FaEye, FaHeart, FaComment, FaEdit, FaSave, FaClosedCaptioning,
    FaArrowUp, FaArrowDown, FaGripVertical
} from 'react-icons/fa'

export default function UploadPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [content, setContent] = useState<Content[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ views: 0, likes: 0, comments: 0, caption: '' })
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
            formData.append('views', '0')
            formData.append('likes', '0')
            formData.append('comments', '0')

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

    const startEditing = (item: Content) => {
        setEditingId(item.id)
        setEditForm({
            views: item.views || 0,
            likes: item.likes || 0,
            comments: item.comments || 0,
            caption: item.caption || ''
        })
    }

    const saveEngagement = async () => {
        if (!editingId) return

        try {
            const response = await fetch('/api/content', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    ...editForm
                })
            })

            if (response.ok) {
                const updated = await response.json()
                setContent(prev => prev.map(c => c.id === editingId ? updated : c))
                setEditingId(null)
            }
        } catch (error) {
            console.error('Error saving:', error)
        }
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
        return num.toString()
    }

    const moveContent = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= content.length) return

        const newContent = [...content]
        const temp = newContent[index]
        newContent[index] = newContent[newIndex]
        newContent[newIndex] = temp
        setContent(newContent)

        // Update order in database
        try {
            await fetch('/api/content/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: newContent.map((item, i) => ({ id: item.id, order_index: i }))
                })
            })
        } catch (error) {
            console.error('Error reordering:', error)
            // Revert on error
            setContent(content)
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
                        {content.map((item, index) => (
                            <div key={item.id} className={styles.contentCard}>
                                {/* Reorder Controls */}
                                <div className={styles.reorderControls}>
                                    <button
                                        onClick={() => moveContent(index, 'up')}
                                        disabled={index === 0}
                                        className={styles.reorderBtn}
                                        title="Move up"
                                    >
                                        <FaArrowUp />
                                    </button>
                                    <FaGripVertical className={styles.gripIcon} />
                                    <button
                                        onClick={() => moveContent(index, 'down')}
                                        disabled={index === content.length - 1}
                                        className={styles.reorderBtn}
                                        title="Move down"
                                    >
                                        <FaArrowDown />
                                    </button>
                                </div>

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
                                    <span className={styles.title}>{item.title || 'Untitled'}</span>

                                    {/* Engagement Stats */}
                                    {editingId === item.id ? (
                                        <div className={styles.editForm}>
                                            <div className={styles.captionInput}>
                                                <FaClosedCaptioning />
                                                <textarea
                                                    value={editForm.caption}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, caption: e.target.value }))}
                                                    placeholder="Add caption..."
                                                    rows={2}
                                                />
                                            </div>
                                            <div className={styles.metricsRow}>
                                                <div className={styles.inputGroup}>
                                                    <FaEye />
                                                    <input
                                                        type="number"
                                                        value={editForm.views}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, views: parseInt(e.target.value) || 0 }))}
                                                        min="0"
                                                    />
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <FaHeart />
                                                    <input
                                                        type="number"
                                                        value={editForm.likes}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, likes: parseInt(e.target.value) || 0 }))}
                                                        min="0"
                                                    />
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <FaComment />
                                                    <input
                                                        type="number"
                                                        value={editForm.comments}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, comments: parseInt(e.target.value) || 0 }))}
                                                        min="0"
                                                    />
                                                </div>
                                                <button onClick={saveEngagement} className={styles.saveBtn}>
                                                    <FaSave />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={styles.engagementStats}>
                                            {item.caption && <span className={styles.caption}>{item.caption}</span>}
                                            <div className={styles.metricsDisplay}>
                                                <span><FaEye /> {formatNumber(item.views || 0)}</span>
                                                <span><FaHeart /> {formatNumber(item.likes || 0)}</span>
                                                <span><FaComment /> {formatNumber(item.comments || 0)}</span>
                                            </div>
                                            <button onClick={() => startEditing(item)} className={styles.editBtn}>
                                                <FaEdit />
                                            </button>
                                        </div>
                                    )}

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
                            Edit the engagement numbers to display custom views, likes, and comments.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}
