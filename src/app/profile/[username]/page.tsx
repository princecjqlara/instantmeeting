'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Content } from '@/lib/types'
import ReelPlayer from '@/components/ReelPlayer'
import styles from './page.module.css'
import {
    FaUserPlus, FaEnvelope, FaPlay, FaHeart, FaEye,
    FaVideo, FaCheck, FaTimes, FaClock
} from 'react-icons/fa'

interface ProfileData {
    user: {
        id: string
        name: string | null
        username: string
        bio: string | null
        avatar_url: string | null
        followers: number
        following: number
        totalViews: number
        totalLikes: number
        contentCount: number
        availability_mode: 'always' | 'never' | 'scheduled'
    }
    content: Content[]
    isAvailable: boolean
    activeMeeting: { id: string; title: string } | null
}

export default function ProfilePage() {
    const params = useParams()
    const router = useRouter()
    const username = params.username as string
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedReel, setSelectedReel] = useState<number | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch(`/api/profile/${username}`)
                if (response.ok) {
                    const data = await response.json()
                    setProfile(data)
                } else {
                    setError('Profile not found')
                }
            } catch {
                setError('Failed to load profile')
            } finally {
                setLoading(false)
            }
        }

        if (username) {
            fetchProfile()
        }
    }, [username])

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
        return num.toString()
    }

    const handleJoinMeeting = () => {
        if (profile?.activeMeeting) {
            router.push(`/waiting/${profile.activeMeeting.id}`)
        }
    }

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        )
    }

    if (error || !profile) {
        return (
            <div className={styles.error}>
                <h1>@{username}</h1>
                <p>{error || 'Profile not found'}</p>
            </div>
        )
    }

    const { user, content, isAvailable, activeMeeting } = profile

    return (
        <div className={styles.container}>
            {/* Profile Header */}
            <header className={styles.header}>
                <div className={styles.avatarSection}>
                    {user.avatar_url ? (
                        <img
                            src={user.avatar_url}
                            alt={user.name || username}
                            className={styles.avatar}
                        />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            {(user.name || username).charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div className={styles.profileInfo}>
                    <h1 className={styles.username}>@{user.username}</h1>
                    {user.name && <h2 className={styles.displayName}>{user.name}</h2>}

                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <strong>{formatNumber(user.following)}</strong>
                            <span>Following</span>
                        </div>
                        <div className={styles.stat}>
                            <strong>{formatNumber(user.followers)}</strong>
                            <span>Followers</span>
                        </div>
                        <div className={styles.stat}>
                            <strong>{formatNumber(user.totalLikes)}</strong>
                            <span>Likes</span>
                        </div>
                    </div>

                    {user.bio && <p className={styles.bio}>{user.bio}</p>}

                    <div className={styles.actions}>
                        <button className={styles.followBtn}>
                            <FaUserPlus /> Follow
                        </button>
                        <button className={styles.messageBtn}>
                            <FaEnvelope />
                        </button>
                    </div>
                </div>
            </header>

            {/* Availability Status */}
            <div className={`${styles.availabilityBanner} ${isAvailable ? styles.available : styles.unavailable}`}>
                {isAvailable ? (
                    <>
                        <FaCheck className={styles.statusIcon} />
                        <span>Available for meetings</span>
                        {activeMeeting && (
                            <button className={styles.joinBtn} onClick={handleJoinMeeting}>
                                Join Meeting
                            </button>
                        )}
                    </>
                ) : user.availability_mode === 'never' ? (
                    <>
                        <FaTimes className={styles.statusIcon} />
                        <span>Not accepting meetings</span>
                    </>
                ) : (
                    <>
                        <FaClock className={styles.statusIcon} />
                        <span>Currently unavailable</span>
                    </>
                )}
            </div>

            {/* Content Tabs */}
            <div className={styles.tabs}>
                <button className={`${styles.tab} ${styles.active}`}>
                    <FaVideo /> Videos
                </button>
            </div>

            {/* Content Grid */}
            <div className={styles.contentGrid}>
                {content.length === 0 ? (
                    <div className={styles.emptyContent}>
                        <FaVideo />
                        <p>No videos yet</p>
                    </div>
                ) : (
                    content.map((item, index) => (
                        <div
                            key={item.id}
                            className={styles.contentCard}
                            onClick={() => setSelectedReel(index)}
                        >
                            <div className={styles.thumbnail}>
                                {item.thumbnail_url ? (
                                    <img src={item.thumbnail_url} alt={item.title || ''} />
                                ) : (
                                    <video src={item.cloudinary_url} muted />
                                )}
                                <div className={styles.playOverlay}>
                                    <FaPlay />
                                </div>
                            </div>
                            <div className={styles.cardStats}>
                                <span><FaEye /> {formatNumber(item.views || 0)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Full Screen Reel Player */}
            {selectedReel !== null && (
                <div className={styles.reelModal}>
                    <button
                        className={styles.closeReel}
                        onClick={() => setSelectedReel(null)}
                    >
                        <FaTimes />
                    </button>
                    <div className={styles.reelContainer}>
                        <ReelPlayer
                            reels={content.slice(selectedReel)}
                            hostName={user.name || user.username}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
