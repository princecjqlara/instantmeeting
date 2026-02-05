'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Content } from '@/lib/types'
import styles from './page.module.css'
import {
    FaArrowLeft, FaCamera, FaUser, FaCopy, FaCheck, FaPlay, FaShare,
    FaTh, FaBookmark, FaHeart, FaCog, FaPlus
} from 'react-icons/fa'

interface ProfileSettings {
    username: string
    name: string
    bio: string
    avatar_url: string | null
}

export default function ProfileSettingsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [settings, setSettings] = useState<ProfileSettings>({
        username: '',
        name: '',
        bio: '',
        avatar_url: null
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [content, setContent] = useState<Content[]>([])
    const [editing, setEditing] = useState(false)
    const [activeTab, setActiveTab] = useState<'grid' | 'liked'>('grid')
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [settingsRes, contentRes] = await Promise.all([
                    fetch('/api/profile/settings'),
                    fetch('/api/content')
                ])

                if (settingsRes.ok) {
                    const data = await settingsRes.json()
                    setSettings(data)
                }

                if (contentRes.ok) {
                    const contentData = await contentRes.json()
                    setContent(contentData)
                }
            } catch (err) {
                console.error('Error fetching settings:', err)
            } finally {
                setLoading(false)
            }
        }

        if (session) {
            fetchSettings()
        }
    }, [session])

    const handleSave = async () => {
        setSaving(true)
        setError(null)

        try {
            const response = await fetch('/api/profile/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })

            if (response.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
            } else {
                const data = await response.json()
                setError(data.error || 'Failed to save')
            }
        } catch {
            setError('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const copyProfileLink = () => {
        if (settings.username) {
            const url = `${window.location.origin}/join/${settings.username}`
            navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingAvatar(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                const data = await response.json()
                setSettings(prev => ({ ...prev, avatar_url: data.avatar_url }))
            } else {
                const data = await response.json()
                setError(data.error || 'Failed to upload avatar')
            }
        } catch {
            setError('Failed to upload avatar')
        } finally {
            setUploadingAvatar(false)
        }
    }

    const totalLikes = content.reduce((sum, item) => sum + (item.likes || 0), 0)
    const totalViews = content.reduce((sum, item) => sum + (item.views || 0), 0)

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
                <button onClick={() => router.back()} className={styles.iconBtn}>
                    <FaArrowLeft />
                </button>
                <div className={styles.headerTitle}>
                    <span>{settings.username || 'username'}</span>
                </div>
                <button onClick={() => router.push('/host/dashboard')} className={styles.iconBtn}>
                    <FaCog />
                </button>
            </header>

            <div className={styles.profileContent}>
                {/* Avatar Section */}
                <div className={styles.avatarSection}>
                    <div className={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()}>
                        {settings.avatar_url ? (
                            <img src={settings.avatar_url} alt="Profile" className={styles.avatar} />
                        ) : (
                            <div className={styles.avatarPlaceholder}>
                                <FaUser />
                            </div>
                        )}
                        <div className={styles.addBadge}>
                            {uploadingAvatar ? <div className={styles.miniSpinner}></div> : <FaPlus />}
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className={styles.hiddenInput}
                    />
                </div>

                {/* Username */}
                <div className={styles.usernameDisplay}>
                    @{settings.username || 'username'}
                </div>

                {/* Stats Row */}
                <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>{content.length}</span>
                        <span className={styles.statLabel}>Following</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>{totalViews}</span>
                        <span className={styles.statLabel}>Followers</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>{totalLikes}</span>
                        <span className={styles.statLabel}>Likes</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                    <button
                        className={styles.editProfileBtn}
                        onClick={() => setEditing(!editing)}
                    >
                        {editing ? 'Done' : 'Edit profile'}
                    </button>
                    <button
                        className={styles.shareProfileBtn}
                        onClick={copyProfileLink}
                    >
                        {copied ? <FaCheck /> : 'Share profile'}
                    </button>
                    <button className={styles.addFriendBtn}>
                        <FaPlus />
                    </button>
                </div>

                {/* Bio */}
                {editing ? (
                    <div className={styles.editSection}>
                        <div className={styles.editField}>
                            <label>Username</label>
                            <div className={styles.usernameInput}>
                                <span>@</span>
                                <input
                                    type="text"
                                    value={settings.username}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                                    }))}
                                    placeholder="username"
                                />
                            </div>
                        </div>
                        <div className={styles.editField}>
                            <label>Name</label>
                            <input
                                type="text"
                                value={settings.name}
                                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Your name"
                            />
                        </div>
                        <div className={styles.editField}>
                            <label>Bio</label>
                            <textarea
                                value={settings.bio}
                                onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                                placeholder="Add a bio..."
                                rows={3}
                                maxLength={80}
                            />
                            <span className={styles.charCount}>{settings.bio.length}/80</span>
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                        <button
                            className={styles.saveBtn}
                            onClick={() => { handleSave(); setEditing(false); }}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                        </button>
                    </div>
                ) : (
                    <div className={styles.bioSection}>
                        {settings.name && <div className={styles.displayName}>{settings.name}</div>}
                        <div className={styles.bioText}>{settings.bio || 'No bio yet'}</div>
                    </div>
                )}

                {/* Content Tabs */}
                <div className={styles.contentTabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'grid' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('grid')}
                    >
                        <FaTh />
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'liked' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('liked')}
                    >
                        <FaHeart />
                    </button>
                </div>

                {/* Content Grid */}
                <div className={styles.contentGrid}>
                    {content.length === 0 ? (
                        <div className={styles.emptyContent}>
                            <p>No videos yet</p>
                        </div>
                    ) : (
                        content.map((item) => (
                            <div key={item.id} className={styles.contentItem}>
                                <video
                                    src={item.cloudinary_url}
                                    className={styles.contentThumb}
                                    muted
                                    playsInline
                                />
                                <div className={styles.contentOverlay}>
                                    <FaPlay />
                                    <span>{item.views || 0}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

