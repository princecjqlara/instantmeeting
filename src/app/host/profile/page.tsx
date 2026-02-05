'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Content } from '@/lib/types'
import styles from './page.module.css'
import {
    FaArrowLeft, FaCamera, FaUser, FaLink, FaCopy, FaCheck, FaSave, FaPlay
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

    if (status === 'loading' || loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button onClick={() => router.back()} className={styles.backBtn}>
                    <FaArrowLeft />
                </button>
                <h1>Edit Profile</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={styles.saveBtn}
                >
                    {saved ? <FaCheck /> : <FaSave />}
                </button>
            </header>

            <div className={styles.content}>
                {/* Avatar */}
                <div className={styles.avatarSection}>
                    <div className={styles.avatarWrapper}>
                        {settings.avatar_url ? (
                            <img
                                src={settings.avatar_url}
                                alt="Profile"
                                className={styles.avatar}
                            />
                        ) : (
                            <div className={styles.avatarPlaceholder}>
                                <FaUser />
                            </div>
                        )}
                        <button
                            className={styles.changeAvatar}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                        >
                            {uploadingAvatar ? <div className={styles.miniSpinner}></div> : <FaCamera />}
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className={styles.hiddenInput}
                    />
                </div>

                {/* Form Fields */}
                <div className={styles.form}>
                    <div className={styles.field}>
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
                                placeholder="yourname"
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>Display Name</label>
                        <input
                            type="text"
                            value={settings.name}
                            onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Your Name"
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Bio</label>
                        <textarea
                            value={settings.bio}
                            onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                            placeholder="Tell people about yourself..."
                            rows={3}
                            maxLength={150}
                        />
                        <span className={styles.charCount}>{settings.bio.length}/150</span>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}
                </div>

                {/* Universal Link Section */}
                {settings.username && (
                    <div className={styles.linkSection}>
                        <h2><FaLink /> Your Universal Link</h2>
                        <p>Share this link - guests will be directed to your active meeting</p>
                        <div className={styles.linkPreview}>
                            <code>{typeof window !== 'undefined' ? window.location.origin : ''}/join/{settings.username}</code>
                            <button onClick={copyProfileLink}>
                                {copied ? <FaCheck /> : <FaCopy />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Grid */}
                {content.length > 0 && (
                    <div className={styles.contentSection}>
                        <h2>Your Content</h2>
                        <div className={styles.contentGrid}>
                            {content.map((item) => (
                                <div key={item.id} className={styles.contentItem}>
                                    <video
                                        src={item.cloudinary_url}
                                        className={styles.contentThumb}
                                        muted
                                        playsInline
                                    />
                                    <div className={styles.contentOverlay}>
                                        <FaPlay />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
