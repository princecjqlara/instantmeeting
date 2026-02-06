'use client'

import { useState, useEffect } from 'react'
import { FaClock, FaCheck, FaTimes } from 'react-icons/fa'
import styles from './AvailabilitySettings.module.css'

interface AvailabilityData {
    availability_mode: 'always' | 'never' | 'scheduled'
    available_from: string | null
    available_to: string | null
    timezone: string | null
    scroll_threshold?: number
    meeting_duration?: number
    booking_title?: string
    booking_description?: string
    booking_note_placeholder?: string
}

export default function AvailabilitySettings() {
    const [settings, setSettings] = useState<AvailabilityData>({
        availability_mode: 'always',
        available_from: null,
        available_to: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        booking_title: 'Schedule a Meeting',
        booking_description: 'Share your details and pick a time that works.',
        booking_note_placeholder: "I'd like to discuss..."
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/availability')
                if (response.ok) {
                    const data = await response.json()
                    setSettings(prev => ({ ...prev, ...data }))
                }
            } catch (error) {
                console.error('Error fetching availability:', error)
            }
        }
        fetchSettings()
    }, [])

    const updateAvailability = async (updates: Partial<AvailabilityData>) => {
        setSaving(true)
        try {
            const response = await fetch('/api/availability', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            })
            if (response.ok) {
                const data = await response.json()
                setSettings(prev => ({ ...prev, ...data }))
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
            }
        } catch (error) {
            console.error('Error updating availability:', error)
        } finally {
            setSaving(false)
        }
    }

    const setMode = (mode: 'always' | 'never' | 'scheduled') => {
        setSettings(prev => ({ ...prev, availability_mode: mode }))
        updateAvailability({ availability_mode: mode })
    }

    const handleTimeChange = (field: 'available_from' | 'available_to', value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }))
    }

    const saveSettings = () => {
        updateAvailability({
            availability_mode: settings.availability_mode,
            available_from: settings.available_from,
            available_to: settings.available_to,
            scroll_threshold: settings.scroll_threshold,
            meeting_duration: settings.meeting_duration,
            booking_title: settings.booking_title,
            booking_description: settings.booking_description,
            booking_note_placeholder: settings.booking_note_placeholder
        })
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <FaClock className={styles.icon} />
                <div>
                    <h3>Availability</h3>
                    <span>When can guests request meetings?</span>
                </div>
                {saved && <span className={styles.savedBadge}><FaCheck /> Saved</span>}
            </div>

            <div className={styles.modes}>
                <button
                    className={`${styles.modeBtn} ${settings.availability_mode === 'always' ? styles.active : ''}`}
                    onClick={() => setMode('always')}
                >
                    <FaCheck />
                    Always Free
                </button>
                <button
                    className={`${styles.modeBtn} ${settings.availability_mode === 'never' ? styles.active : ''} ${styles.never}`}
                    onClick={() => setMode('never')}
                >
                    <FaTimes />
                    Not Available
                </button>
                <button
                    className={`${styles.modeBtn} ${settings.availability_mode === 'scheduled' ? styles.active : ''}`}
                    onClick={() => setMode('scheduled')}
                >
                    <FaClock />
                    Set Schedule
                </button>
            </div>

            {settings.availability_mode !== 'always' && (
                <div className={styles.scheduleForm}>
                    <div className={styles.settingsRow}>
                        <div className={styles.settingGroup}>
                            <label>Scrolls before prompt</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={settings.scroll_threshold || 3}
                                onChange={(e) => setSettings(prev => ({ ...prev, scroll_threshold: parseInt(e.target.value) || 3 }))}
                            />
                        </div>
                        <div className={styles.settingGroup}>
                            <label>Meeting Duration (min)</label>
                            <select
                                value={settings.meeting_duration || 30}
                                onChange={(e) => setSettings(prev => ({ ...prev, meeting_duration: parseInt(e.target.value) || 30 }))}
                            >
                                <option value="15">15 minutes</option>
                                <option value="30">30 minutes</option>
                                <option value="45">45 minutes</option>
                                <option value="60">1 hour</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.bookingSettings}>
                        <div className={styles.settingGroup}>
                            <label>Form Title</label>
                            <input
                                type="text"
                                value={settings.booking_title || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, booking_title: e.target.value }))}
                                placeholder="Schedule a Meeting"
                            />
                        </div>
                        <div className={styles.settingGroup}>
                            <label>Form Description</label>
                            <textarea
                                rows={2}
                                value={settings.booking_description || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, booking_description: e.target.value }))}
                                placeholder="Share your details and pick a time that works."
                            />
                        </div>
                        <div className={styles.settingGroup}>
                            <label>Note Placeholder</label>
                            <input
                                type="text"
                                value={settings.booking_note_placeholder || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, booking_note_placeholder: e.target.value }))}
                                placeholder="I'd like to discuss..."
                            />
                        </div>
                    </div>

                    {settings.availability_mode === 'scheduled' && (
                        <>
                            <div className={styles.timeRow}>
                                <div className={styles.timeInput}>
                                    <label>Available from</label>
                                    <input
                                        type="time"
                                        value={settings.available_from || '09:00'}
                                        onChange={(e) => handleTimeChange('available_from', e.target.value)}
                                    />
                                </div>
                                <span className={styles.to}>to</span>
                                <div className={styles.timeInput}>
                                    <label>Until</label>
                                    <input
                                        type="time"
                                        value={settings.available_to || '17:00'}
                                        onChange={(e) => handleTimeChange('available_to', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className={styles.timezone}>
                                Timezone: {settings.timezone || 'UTC'}
                            </div>
                        </>
                    )}
                    <button
                        className={styles.saveScheduleBtn}
                        onClick={saveSettings}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            )}
        </div>
    )
}
