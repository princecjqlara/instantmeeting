'use client'

import { useState, useEffect } from 'react'
import { FaClock, FaCheck, FaTimes } from 'react-icons/fa'
import styles from './AvailabilitySettings.module.css'

interface AvailabilityData {
    availability_mode: 'always' | 'never' | 'scheduled'
    available_from: string | null
    available_to: string | null
    timezone: string | null
}

export default function AvailabilitySettings() {
    const [settings, setSettings] = useState<AvailabilityData>({
        availability_mode: 'always',
        available_from: null,
        available_to: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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

    const saveSchedule = () => {
        updateAvailability({
            availability_mode: 'scheduled',
            available_from: settings.available_from,
            available_to: settings.available_to
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

            {settings.availability_mode === 'scheduled' && (
                <div className={styles.scheduleForm}>
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
                    <button
                        className={styles.saveScheduleBtn}
                        onClick={saveSchedule}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Schedule'}
                    </button>
                </div>
            )}
        </div>
    )
}
