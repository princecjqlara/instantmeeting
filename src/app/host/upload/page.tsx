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
    const [uploadMessage, setUploadMessage] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ views: 0, likes: 0, comments: 0, caption: '', title: '', description: '' })
    const fileInputRef = useRef<HTMLInputElement>(null)
    const uploadAbortRef = useRef<AbortController | null>(null)
    const cancelUploadRef = useRef(false)

    const isImageUrl = (url?: string) => {
        if (!url) return false
        return url.includes('/image/upload/') || /\.(png|jpe?g|gif|webp)$/i.test(url)
    }

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

        const selectedFiles = Array.from(files).slice(0, 1)
        if (files.length > 1) {
            setUploadMessage('Uploading the first selected file only')
        }

        setUploading(true)
        setUploadProgress(0)
        if (files.length <= 1) {
            setUploadMessage('')
        }
        cancelUploadRef.current = false

        for (let i = 0; i < selectedFiles.length; i++) {
            if (cancelUploadRef.current) {
                setUploadMessage('Upload stopped')
                break
            }

            const file = selectedFiles[i]
            const resourceType = file.type.startsWith('image/') ? 'image' : 'video'
            const abortController = new AbortController()
            uploadAbortRef.current = abortController

            try {
                const signRes = await fetch('/api/cloudinary/sign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: 'instantmeeting/reels' }),
                    signal: abortController.signal,
                })

                if (!signRes.ok) {
                    const signErr = await signRes.json()
                    throw new Error(signErr.error || 'Failed to sign upload')
                }

                const signData = await signRes.json()
                const uploadForm = new FormData()
                uploadForm.append('file', file)
                uploadForm.append('api_key', signData.apiKey)
                uploadForm.append('timestamp', String(signData.timestamp))
                uploadForm.append('signature', signData.signature)
                uploadForm.append('folder', signData.folder)

                const cloudinaryRes = await fetch(
                    `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`,
                    {
                        method: 'POST',
                        body: uploadForm,
                        signal: abortController.signal,
                    }
                )

                if (!cloudinaryRes.ok) {
                    const err = await cloudinaryRes.json()
                    throw new Error(err.error?.message || 'Cloudinary upload failed')
                }

                const uploadResult = await cloudinaryRes.json()
                const response = await fetch('/api/content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: file.name.replace(/\.[^/.]+$/, ''),
                        description: '',
                        cloudinary_url: uploadResult.secure_url,
                        cloudinary_public_id: uploadResult.public_id,
                        thumbnail_url: resourceType === 'video'
                            ? uploadResult.secure_url.replace(/\.[^/.]+$/, '.jpg')
                            : uploadResult.secure_url,
                        duration_seconds: resourceType === 'video' ? Math.round(uploadResult.duration || 0) : 0,
                        views: 0,
                        likes: 0,
                        comments: 0,
                    })
                })

                if (response.ok) {
                    const newContent = await response.json()
                    setContent(prev => [...prev, newContent])
                } else {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to save content')
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') {
                    setUploadMessage('Upload stopped')
                    break
                }
                setUploadMessage((error as Error).message || 'Upload failed')
                console.error('Error uploading:', error)
            }

            setUploadProgress(((i + 1) / selectedFiles.length) * 100)
        }

        setUploading(false)
        uploadAbortRef.current = null
        cancelUploadRef.current = false
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const stopUpload = () => {
        cancelUploadRef.current = true
        if (uploadAbortRef.current) {
            uploadAbortRef.current.abort()
        }
    }

    const deleteContent = async (id: string) => {
        try {
            const response = await fetch(`/api/content?id=${id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                setContent(prev => prev.filter(c => c.id !== id))
            } else {
                const errorData = await response.json()
                console.error('Error deleting content:', errorData.error)
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
            caption: item.caption || '',
            title: item.title || '',
            description: item.description || ''
        })
    }

    const saveEngagement = async () => {
        if (!editingId) return

        try {
            // Prepare update data, only include non-empty caption
            const updateData: Record<string, any> = {
                id: editingId,
                views: editForm.views,
                likes: editForm.likes,
                comments: editForm.comments,
                title: editForm.title,
                description: editForm.description
            }
            
            // Only include caption if it has content
            if (editForm.caption.trim() !== '') {
                updateData.caption = editForm.caption.trim()
            }

            const response = await fetch('/api/content', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })

            if (response.ok) {
                const updated = await response.json()
                setContent(prev => prev.map(c => c.id === editingId ? updated : c))
                setEditingId(null)
            } else {
                const errorData = await response.json()
                console.error('Save error:', errorData.error)
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
                            {uploadMessage && <span className={styles.uploadMessage}>{uploadMessage}</span>}
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <button
                                type="button"
                                className={styles.stopUploadBtn}
                                onClick={stopUpload}
                            >
                                Stop uploading
                            </button>
                        </>
                    ) : (
                        <>
                            <FaUpload className={styles.uploadIcon} />
                            <p>Drop media here or click to upload</p>
                            <span>Supports MP4, MOV, WebM, JPG, PNG</span>
                        </>
                    )}
                </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*,image/*"
                        multiple
                    onChange={handleFileSelect}
                    onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
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
                                    {isImageUrl(item.cloudinary_url) ? (
                                        <img
                                            src={item.cloudinary_url}
                                            alt={item.title || 'Uploaded image'}
                                            className={styles.video}
                                        />
                                    ) : (
                                        <video
                                            src={item.cloudinary_url}
                                            muted
                                            className={styles.video}
                                        />
                                    )}
                                    {!isImageUrl(item.cloudinary_url) && (
                                        <div className={styles.playOverlay}>
                                            <FaPlay />
                                        </div>
                                    )}
                                    {!isImageUrl(item.cloudinary_url) && item.duration_seconds ? (
                                        <span className={styles.duration}>
                                            {Math.floor(item.duration_seconds / 60)}:
                                            {(item.duration_seconds % 60).toString().padStart(2, '0')}
                                        </span>
                                    ) : null}
                                </div>

                                <div className={styles.cardContent}>
                                    <span className={styles.title}>{item.title || 'Untitled'}</span>

                                    {/* Engagement Stats */}
                                    {editingId === item.id ? (
                                        <div className={styles.editForm}>
                                            <div className={styles.titleInput}>
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                    placeholder="Video title..."
                                                    className={styles.titleField}
                                                />
                                            </div>
                                            <div className={styles.captionInput}>
                                                <FaClosedCaptioning />
                                                <textarea
                                                    value={editForm.caption}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, caption: e.target.value }))}
                                                    placeholder="Short caption (shown on video)..."
                                                    rows={2}
                                                />
                                            </div>
                                            <div className={styles.descriptionInput}>
                                                <textarea
                                                    value={editForm.description}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Longer description (optional)..."
                                                    rows={3}
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
