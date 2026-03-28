'use client'

import { useState, useEffect, useRef } from 'react'
import { Presentation, PresentationSlide } from '@/lib/types'
import {
    FaPlus, FaTimes, FaTrash, FaSpinner, FaUpload,
    FaArrowUp, FaArrowDown, FaImage, FaVideo, FaPlay
} from 'react-icons/fa'
import styles from './PresentationManager.module.css'

interface PresentationManagerProps {
    isOpen: boolean
    onClose: () => void
}

export default function PresentationManager({ isOpen, onClose }: PresentationManagerProps) {
    const [presentations, setPresentations] = useState<Presentation[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const selected = presentations.find(p => p.id === selectedId) || null

    useEffect(() => {
        if (isOpen) {
            fetchPresentations()
        }
    }, [isOpen])

    const fetchPresentations = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/presentations')
            if (res.ok) {
                const data = await res.json()
                setPresentations(data)
            }
        } catch (err) {
            console.error('Error fetching presentations:', err)
        } finally {
            setLoading(false)
        }
    }

    const createPresentation = async () => {
        if (creating) return
        setCreating(true)
        try {
            const res = await fetch('/api/presentations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle || 'Untitled Presentation' }),
            })
            if (res.ok) {
                const data = await res.json()
                setPresentations(prev => [data, ...prev])
                setSelectedId(data.id)
                setNewTitle('')
            }
        } catch (err) {
            console.error('Error creating presentation:', err)
        } finally {
            setCreating(false)
        }
    }

    const deletePresentation = async (id: string) => {
        if (!confirm('Delete this presentation and all its slides?')) return
        try {
            const res = await fetch(`/api/presentations?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                setPresentations(prev => prev.filter(p => p.id !== id))
                if (selectedId === id) setSelectedId(null)
            }
        } catch (err) {
            console.error('Error deleting:', err)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || !selectedId) return

        setUploading(true)
        for (const file of Array.from(files)) {
            try {
                const resourceType = file.type.startsWith('image/') ? 'image' : 'video'

                // 1. Get Cloudinary signature
                const signRes = await fetch('/api/cloudinary/sign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: 'instantmeeting/presentations' }),
                })
                if (!signRes.ok) throw new Error('Failed to sign upload')
                const signData = await signRes.json()

                // 2. Upload to Cloudinary
                const uploadForm = new FormData()
                uploadForm.append('file', file)
                uploadForm.append('api_key', signData.apiKey)
                uploadForm.append('timestamp', String(signData.timestamp))
                uploadForm.append('signature', signData.signature)
                uploadForm.append('folder', signData.folder)

                const cloudRes = await fetch(
                    `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`,
                    { method: 'POST', body: uploadForm }
                )
                if (!cloudRes.ok) throw new Error('Cloudinary upload failed')
                const uploadResult = await cloudRes.json()

                // 3. Save slide to DB
                const slideRes = await fetch('/api/presentations/slides', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationId: selectedId,
                        mediaUrl: uploadResult.secure_url,
                        mediaType: resourceType,
                        cloudinaryPublicId: uploadResult.public_id,
                        thumbnailUrl: resourceType === 'video'
                            ? uploadResult.secure_url.replace(/\.[^/.]+$/, '.jpg')
                            : uploadResult.secure_url,
                    }),
                })
                if (slideRes.ok) {
                    const newSlide = await slideRes.json()
                    setPresentations(prev =>
                        prev.map(p =>
                            p.id === selectedId
                                ? { ...p, slides: [...(p.slides || []), newSlide] }
                                : p
                        )
                    )
                }
            } catch (err) {
                console.error('Upload error:', err)
                alert(`Failed to upload ${file.name}`)
            }
        }
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const deleteSlide = async (slideId: string) => {
        try {
            const res = await fetch(`/api/presentations/slides?id=${slideId}`, { method: 'DELETE' })
            if (res.ok && selectedId) {
                setPresentations(prev =>
                    prev.map(p =>
                        p.id === selectedId
                            ? { ...p, slides: (p.slides || []).filter(s => s.id !== slideId) }
                            : p
                    )
                )
            }
        } catch (err) {
            console.error('Error deleting slide:', err)
        }
    }

    const moveSlide = async (index: number, direction: 'up' | 'down') => {
        if (!selected?.slides) return
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= selected.slides.length) return

        const newSlides = [...selected.slides]
        const temp = newSlides[index]
        newSlides[index] = newSlides[newIndex]
        newSlides[newIndex] = temp

        // Update local state first
        setPresentations(prev =>
            prev.map(p =>
                p.id === selectedId ? { ...p, slides: newSlides } : p
            )
        )

        // Persist order
        try {
            await fetch('/api/presentations/slides', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: newSlides.map((s, i) => ({ id: s.id, order_index: i })),
                }),
            })
        } catch (err) {
            console.error('Error reordering:', err)
        }
    }

    if (!isOpen) return null

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>📊 Presentations</h2>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <div className={styles.modalBody}>
                    {/* Left: Presentation List */}
                    <div className={styles.sidebar}>
                        <div className={styles.createRow}>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                placeholder="Presentation name"
                                className={styles.input}
                                onKeyDown={e => e.key === 'Enter' && createPresentation()}
                            />
                            <button
                                onClick={createPresentation}
                                disabled={creating}
                                className={styles.createBtn}
                            >
                                {creating ? <FaSpinner className={styles.spin} /> : <FaPlus />}
                            </button>
                        </div>

                        {loading ? (
                            <div className={styles.loadingState}>
                                <FaSpinner className={styles.spin} />
                            </div>
                        ) : presentations.length === 0 ? (
                            <p className={styles.emptyText}>No presentations yet</p>
                        ) : (
                            <div className={styles.list}>
                                {presentations.map(p => (
                                    <div
                                        key={p.id}
                                        className={`${styles.listItem} ${selectedId === p.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedId(p.id)}
                                    >
                                        <div className={styles.listItemInfo}>
                                            <span className={styles.listTitle}>{p.title}</span>
                                            <span className={styles.slideCount}>
                                                {(p.slides || []).length} slides
                                            </span>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); deletePresentation(p.id) }}
                                            className={styles.deleteBtn}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Slide Editor */}
                    <div className={styles.editor}>
                        {!selected ? (
                            <div className={styles.editorEmpty}>
                                <FaImage style={{ fontSize: '2rem', opacity: 0.3 }} />
                                <p>Select or create a presentation to manage slides</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.editorHeader}>
                                    <h3>{selected.title}</h3>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className={styles.uploadBtn}
                                    >
                                        {uploading ? (
                                            <><FaSpinner className={styles.spin} /> Uploading...</>
                                        ) : (
                                            <><FaUpload /> Add Slides</>
                                        )}
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                </div>

                                {(selected.slides || []).length === 0 ? (
                                    <div className={styles.editorEmpty}>
                                        <FaUpload style={{ fontSize: '2rem', opacity: 0.3 }} />
                                        <p>Upload photos or videos to add slides</p>
                                    </div>
                                ) : (
                                    <div className={styles.slideGrid}>
                                        {(selected.slides || []).map((slide, index) => (
                                            <div key={slide.id} className={styles.slideCard}>
                                                <div className={styles.slideNumber}>{index + 1}</div>
                                                <div className={styles.slidePreview}>
                                                    {slide.media_type === 'video' ? (
                                                        <>
                                                            <video src={slide.media_url} muted className={styles.slideMedia} />
                                                            <div className={styles.videoIcon}><FaPlay /></div>
                                                        </>
                                                    ) : (
                                                        <img src={slide.media_url} alt={`Slide ${index + 1}`} className={styles.slideMedia} />
                                                    )}
                                                </div>
                                                <div className={styles.slideActions}>
                                                    <button
                                                        onClick={() => moveSlide(index, 'up')}
                                                        disabled={index === 0}
                                                        className={styles.reorderBtn}
                                                    >
                                                        <FaArrowUp />
                                                    </button>
                                                    <button
                                                        onClick={() => moveSlide(index, 'down')}
                                                        disabled={index === (selected.slides || []).length - 1}
                                                        className={styles.reorderBtn}
                                                    >
                                                        <FaArrowDown />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSlide(slide.id)}
                                                        className={styles.slideDeleteBtn}
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
