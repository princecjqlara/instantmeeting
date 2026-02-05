'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import {
    FaArrowLeft, FaEye, FaHeart, FaCommentDots, FaVideo,
    FaChartLine, FaTrophy, FaBolt, FaGhost, FaUsers
} from 'react-icons/fa'

interface ContentMetrics {
    id: string
    title: string | null
    caption: string | null
    thumbnail_url: string | null
    created_at: string
    duration_seconds: number | null
    views: { total: number; real: number; fake: number }
    likes: { total: number; real: number; fake: number }
    comments: { total: number; real: number; fake: number }
}

interface Totals {
    views: { total: number; real: number; fake: number }
    likes: { total: number; real: number; fake: number }
    comments: { total: number; real: number; fake: number }
}

export default function ContentMetricsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [metrics, setMetrics] = useState<ContentMetrics[]>([])
    const [totals, setTotals] = useState<Totals | null>(null)
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'date'>('date')

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await fetch('/api/analytics/content')
                if (res.ok) {
                    const data = await res.json()
                    setMetrics(data.content)
                    setTotals(data.totals)
                }
            } catch (error) {
                console.error('Error fetching metrics:', error)
            } finally {
                setLoading(false)
            }
        }

        if (session) {
            fetchMetrics()
        }
    }, [session])

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
        return num.toString()
    }

    const getPercentage = (real: number, total: number) => {
        if (total === 0) return 0
        return Math.round((real / total) * 100)
    }

    const sortedMetrics = [...metrics].sort((a, b) => {
        switch (sortBy) {
            case 'views': return b.views.total - a.views.total
            case 'likes': return b.likes.total - a.likes.total
            case 'comments': return b.comments.total - a.comments.total
            case 'date': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            default: return 0
        }
    })

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
                    <FaChartLine />
                    <span>Content Analytics</span>
                </div>
                <div className={styles.headerSpacer}></div>
            </header>

            {/* Overview Stats */}
            {totals && (
                <section className={styles.overviewSection}>
                    <h2 className={styles.sectionTitle}>
                        <FaTrophy />
                        Performance Overview
                    </h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #00d4ff, #0099cc)' }}>
                                <FaEye />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statValue}>{formatNumber(totals.views.total)}</span>
                                <span className={styles.statLabel}>Total Views</span>
                                <div className={styles.statBreakdown}>
                                    <span className={styles.real}>{formatNumber(totals.views.real)} real</span>
                                    <span className={styles.fake}>{formatNumber(totals.views.fake)} fake</span>
                                </div>
                            </div>
                            <div className={styles.percentageBadge} style={{ 
                                background: getPercentage(totals.views.real, totals.views.total) > 50 
                                    ? 'rgba(0, 255, 136, 0.2)' 
                                    : 'rgba(255, 215, 0, 0.2)',
                                color: getPercentage(totals.views.real, totals.views.total) > 50 
                                    ? '#00ff88' 
                                    : '#ffd700'
                            }}>
                                {getPercentage(totals.views.real, totals.views.total)}% real
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ff3366, #cc0033)' }}>
                                <FaHeart />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statValue}>{formatNumber(totals.likes.total)}</span>
                                <span className={styles.statLabel}>Total Likes</span>
                                <div className={styles.statBreakdown}>
                                    <span className={styles.real}>{formatNumber(totals.likes.real)} real</span>
                                    <span className={styles.fake}>{formatNumber(totals.likes.fake)} fake</span>
                                </div>
                            </div>
                            <div className={styles.percentageBadge} style={{ 
                                background: getPercentage(totals.likes.real, totals.likes.total) > 50 
                                    ? 'rgba(0, 255, 136, 0.2)' 
                                    : 'rgba(255, 215, 0, 0.2)',
                                color: getPercentage(totals.likes.real, totals.likes.total) > 50 
                                    ? '#00ff88' 
                                    : '#ffd700'
                            }}>
                                {getPercentage(totals.likes.real, totals.likes.total)}% real
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
                                <FaCommentDots />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statValue}>{formatNumber(totals.comments.total)}</span>
                                <span className={styles.statLabel}>Total Comments</span>
                                <div className={styles.statBreakdown}>
                                    <span className={styles.real}>{formatNumber(totals.comments.real)} real</span>
                                    <span className={styles.fake}>{formatNumber(totals.comments.fake)} fake</span>
                                </div>
                            </div>
                            <div className={styles.percentageBadge} style={{ 
                                background: getPercentage(totals.comments.real, totals.comments.total) > 50 
                                    ? 'rgba(0, 255, 136, 0.2)' 
                                    : 'rgba(255, 215, 0, 0.2)',
                                color: getPercentage(totals.comments.real, totals.comments.total) > 50 
                                    ? '#00ff88' 
                                    : '#ffd700'
                            }}>
                                {getPercentage(totals.comments.real, totals.comments.total)}% real
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Content List */}
            <section className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        <FaVideo />
                        Content Performance
                    </h2>
                    <div className={styles.sortOptions}>
                        <span>Sort by:</span>
                        {(['date', 'views', 'likes', 'comments'] as const).map(option => (
                            <button
                                key={option}
                                className={`${styles.sortBtn} ${sortBy === option ? styles.activeSort : ''}`}
                                onClick={() => setSortBy(option)}
                            >
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.contentList}>
                    {sortedMetrics.map((item) => (
                        <div key={item.id} className={styles.contentCard}>
                            <div className={styles.contentPreview}>
                                {item.thumbnail_url ? (
                                    <img src={item.thumbnail_url} alt={item.title || 'Content'} />
                                ) : (
                                    <div className={styles.noThumbnail}>
                                        <FaVideo />
                                    </div>
                                )}
                                {item.duration_seconds && (
                                    <span className={styles.duration}>
                                        {Math.floor(item.duration_seconds / 60)}:{(item.duration_seconds % 60).toString().padStart(2, '0')}
                                    </span>
                                )}
                            </div>

                            <div className={styles.contentInfo}>
                                <h3 className={styles.contentTitle}>
                                    {item.title || item.caption || 'Untitled Content'}
                                </h3>
                                <span className={styles.contentDate}>
                                    {new Date(item.created_at).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>

                            <div className={styles.engagementGrid}>
                                <div className={styles.engagementItem}>
                                    <div className={styles.engagementHeader}>
                                        <FaEye className={styles.engagementIcon} />
                                        <span className={styles.engagementTotal}>{formatNumber(item.views.total)}</span>
                                    </div>
                                    <div className={styles.engagementBar}>
                                        <div 
                                            className={styles.engagementReal} 
                                            style={{ width: `${getPercentage(item.views.real, item.views.total)}%` }}
                                        />
                                    </div>
                                    <div className={styles.engagementLabels}>
                                        <span className={styles.realLabel}>
                                            <FaBolt /> {formatNumber(item.views.real)}
                                        </span>
                                        <span className={styles.fakeLabel}>
                                            <FaGhost /> {formatNumber(item.views.fake)}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.engagementItem}>
                                    <div className={styles.engagementHeader}>
                                        <FaHeart className={styles.engagementIcon} />
                                        <span className={styles.engagementTotal}>{formatNumber(item.likes.total)}</span>
                                    </div>
                                    <div className={styles.engagementBar}>
                                        <div 
                                            className={styles.engagementReal} 
                                            style={{ width: `${getPercentage(item.likes.real, item.likes.total)}%` }}
                                        />
                                    </div>
                                    <div className={styles.engagementLabels}>
                                        <span className={styles.realLabel}>
                                            <FaBolt /> {formatNumber(item.likes.real)}
                                        </span>
                                        <span className={styles.fakeLabel}>
                                            <FaGhost /> {formatNumber(item.likes.fake)}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.engagementItem}>
                                    <div className={styles.engagementHeader}>
                                        <FaCommentDots className={styles.engagementIcon} />
                                        <span className={styles.engagementTotal}>{formatNumber(item.comments.total)}</span>
                                    </div>
                                    <div className={styles.engagementBar}>
                                        <div 
                                            className={styles.engagementReal} 
                                            style={{ width: `${getPercentage(item.comments.real, item.comments.total)}%` }}
                                        />
                                    </div>
                                    <div className={styles.engagementLabels}>
                                        <span className={styles.realLabel}>
                                            <FaBolt /> {formatNumber(item.comments.real)}
                                        </span>
                                        <span className={styles.fakeLabel}>
                                            <FaGhost /> {formatNumber(item.comments.fake)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {metrics.length === 0 && (
                    <div className={styles.emptyState}>
                        <FaVideo className={styles.emptyIcon} />
                        <p>No content yet</p>
                        <span>Upload your first video to see analytics</span>
                    </div>
                )}
            </section>
        </div>
    )
}
