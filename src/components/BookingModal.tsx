'use client'

import { useState, useMemo } from 'react'
import styles from './BookingModal.module.css'
import { FaCheckCircle, FaTimes } from 'react-icons/fa'

interface BookingModalProps {
    host: BookingHost
    onClose: () => void
    onSuccess?: () => void
    meetingId?: string
    guestId?: string
    mode?: 'new' | 'reschedule'
}

interface BookingHost {
    id: string
    name: string | null
    available_from: string | null
    available_to: string | null
    meeting_duration: number | null
    booking_title?: string | null
    booking_description?: string | null
    booking_note_placeholder?: string | null
    booking_form_fields?: Array<{
        id: string
        label: string
        type: 'short_text' | 'long_text' | 'multiple_choice' | 'email' | 'phone' | 'number' | 'date' | 'time'
        required: boolean
        placeholder?: string
        options?: string[]
    }> | null
    availability_mode?: 'always' | 'never' | 'scheduled'
}

export default function BookingModal({ host, onClose, onSuccess, meetingId, guestId, mode = 'new' }: BookingModalProps) {
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        name: '',
        note: ''
    })
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [selectedTime, setSelectedTime] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})

    // Generate next 7 days for selection (naive implementation)
    // Filter by host availability if needed (e.g. check "available_from" days?)
    // For now, assume M-F or all days, or just show next 5 days.
    const availableDates = useMemo(() => {
        const dates = []
        const today = new Date()
        for (let i = 1; i <= 7; i++) { // Start from tomorrow? Or today?
            const d = new Date(today)
            d.setDate(today.getDate() + i)
            // Skip weekends if we want strict business logic, but let's keep it simple
            dates.push(d)
        }
        return dates
    }, [])

    // Generate time slots based on host settings
    const timeSlots = useMemo(() => {
        if (!host.available_from || !host.available_to) return []

        const slots = []
        const start = parseInt(host.available_from.split(':')[0])
        const end = parseInt(host.available_to.split(':')[0])
        const duration = host.meeting_duration || 30

        // Simple slot generation
        for (let hour = start; hour < end; hour++) {
            for (let min = 0; min < 60; min += duration) {
                // Ensure we don't go past end time
                if (hour === end && min > 0) break;

                const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
                slots.push(timeString)
            }
        }
        return slots
    }, [host.available_from, host.available_to, host.meeting_duration])

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            const customFieldPayload = customFields.map(field => ({
                id: field.id,
                label: field.label,
                value: customAnswers[field.id] || ''
            }))
                .filter(field => field.value.trim() !== '')

            const endpoint = mode === 'reschedule' && meetingId
                ? `/api/meetings/${meetingId}/reschedule/guest`
                : '/api/meetings/public'

            const payload: Record<string, unknown> = {
                hostId: host.id,
                guestName: formData.name,
                note: formData.note,
                date: selectedDate,
                time: selectedTime,
                customFields: customFieldPayload,
            }

            if (mode === 'reschedule' && meetingId) {
                payload.meetingId = meetingId
                payload.guestId = guestId
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                setSuccess(true)
                onSuccess?.()
            } else {
                const error = await res.json()
                console.error('Booking failed:', error)
                // Don't use alert() as it causes hydration issues
                setError(error.message || 'Something went wrong. Please try again.')
            }
        } catch (err) {
            console.error(err)
            setError('Failed to book meeting')
        } finally {
            setSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className={styles.overlay}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h3>{mode === 'reschedule' ? 'Reschedule Sent!' : 'Booking Confirmed!'}</h3>
                        <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                    </div>
                    <div className={styles.success}>
                        <FaCheckCircle className={styles.successIcon} />
                        <p>{mode === 'reschedule'
                            ? `Your new time has been sent to ${host.name || 'the host'}.`
                            : `Your meeting request has been sent to ${host.name || 'the host'}.`
                        }</p>
                        <p>You will receive a confirmation email shortly.</p>
                        <button onClick={onClose} className={styles.actionBtn}>Close</button>
                    </div>
                </div>
            </div>
        )
    }

    const bookingTitle = host.booking_title || 'Schedule a Meeting'
    const bookingDescription = host.booking_description || 'Share your details and pick a time that works.'
    const notePlaceholder = host.booking_note_placeholder || "I'd like to discuss..."
    const customFields = Array.isArray(host.booking_form_fields) ? host.booking_form_fields : []

    const requiredFieldsMissing = customFields.some((field) => {
        if (!field.required) return false
        const value = customAnswers[field.id]
        return !value || value.trim() === ''
    })

    // Check if name is missing
    const nameMissing = !formData.name.trim()

    const handleFieldChange = (fieldId: string, value: string) => {
        setCustomAnswers(prev => ({ ...prev, [fieldId]: value }))
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>
                        {step === 1 ? 'Contact Info' : 'Select a Time'}
                    </h3>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <div className={styles.content}>
                    <div className={styles.bookingIntro}>
                        <h4>{bookingTitle}</h4>
                        <p>{bookingDescription}</p>
                    </div>
                    {step === 1 ? (
                        <div className={styles.step}>
                            <div className={styles.inputGroup}>
                                <label>Your Name</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Jane Doe"
                                    autoFocus
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Note (Optional)</label>
                                <textarea
                                    value={formData.note}
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                                    placeholder={notePlaceholder}
                                />
                            </div>
                            {customFields.length > 0 && (
                                <div className={styles.customFields}>
                                    {customFields.map((field) => (
                                        <div key={field.id} className={styles.inputGroup}>
                                            <label>
                                                {field.label}
                                                {field.required && <span className={styles.required}> *</span>}
                                            </label>
                                            {field.type === 'long_text' ? (
                                                <textarea
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || "Your answer"}
                                                />
                                            ) : field.type === 'multiple_choice' ? (
                                                <select
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                >
                                                    <option value="">Select an option</option>
                                                    {(field.options || []).map(option => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                            ) : field.type === 'email' ? (
                                                <input
                                                    type="email"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || "your.email@example.com"}
                                                />
                                            ) : field.type === 'phone' ? (
                                                <input
                                                    type="tel"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || "+1 (555) 123-4567"}
                                                />
                                            ) : field.type === 'number' ? (
                                                <input
                                                    type="number"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || "123"}
                                                />
                                            ) : field.type === 'date' ? (
                                                <input
                                                    type="date"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                />
                                            ) : field.type === 'time' ? (
                                                <input
                                                    type="time"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || "Your answer"}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                className={styles.actionBtn}
                                onClick={() => setStep(2)}
                                disabled={nameMissing || requiredFieldsMissing}
                            >
                                Next
                            </button>
                        </div>
                    ) : (
                        <div className={styles.step}>
                            <div className={styles.inputGroup}>
                                <label>Available Dates</label>
                                <div className={styles.slots}>
                                    {availableDates.map(date => (
                                        <button
                                            key={date.toISOString()}
                                            className={`${styles.slotBtn} ${selectedDate === date.toISOString().split('T')[0] ? styles.selected : ''}`}
                                            onClick={() => setSelectedDate(date.toISOString().split('T')[0])}
                                        >
                                            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedDate && (
                                <div className={styles.inputGroup}>
                                    <label>Available Times ({host.meeting_duration || 30} mins)</label>
                                    <div className={styles.slots}>
                                        {timeSlots.map(time => (
                                            <button
                                                key={time}
                                                className={`${styles.slotBtn} ${selectedTime === time ? styles.selected : ''}`}
                                                onClick={() => setSelectedTime(time)}
                                            >
                                                {time}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className={styles.error}>
                                    {error}
                                </div>
                            )}
                            <button
                                className={styles.actionBtn}
                                onClick={handleSubmit}
                                disabled={!selectedDate || !selectedTime || submitting}
                            >
                                {submitting ? 'Booking...' : 'Confirm Booking'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
