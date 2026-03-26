'use client'

import { useMemo, useState } from 'react'
import styles from './BookingModal.module.css'
import {
    FaCalendarAlt,
    FaCheckCircle,
    FaChevronLeft,
    FaChevronRight,
    FaClock,
    FaTimes,
} from 'react-icons/fa'
import { buildBookingCalendarMonth, buildTimeSlots } from '@/lib/booking-calendar'

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
    timezone?: string | null
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

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BookingModal({ host, onClose, onSuccess, meetingId, guestId, mode = 'new' }: BookingModalProps) {
    const [step, setStep] = useState<'calendar' | 'details'>('calendar')
    const [formData, setFormData] = useState({
        name: '',
        note: ''
    })
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedTime, setSelectedTime] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
    const [today] = useState(() => new Date())
    const [calendarMonth, setCalendarMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

    const bookingTitle = host.booking_title || 'Schedule a Meeting'
    const bookingDescription = host.booking_description || 'Choose a time first, then share your details.'
    const notePlaceholder = host.booking_note_placeholder || "I'd like to discuss..."
    const customFields = Array.isArray(host.booking_form_fields) ? host.booking_form_fields : []
    const displayTimeZone = host.timezone || 'UTC'

    const calendarCells = useMemo(() => buildBookingCalendarMonth({
        currentMonth: calendarMonth,
        today,
        selectedDate,
    }), [calendarMonth, selectedDate, today])

    const timeSlots = useMemo(() => buildTimeSlots(
        host.available_from,
        host.available_to,
        host.meeting_duration,
    ), [host.available_from, host.available_to, host.meeting_duration])

    const monthLabel = useMemo(() => calendarMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    }), [calendarMonth])

    const currentMonthStart = useMemo(
        () => new Date(today.getFullYear(), today.getMonth(), 1),
        [today]
    )

    const canGoToPreviousMonth =
        calendarMonth.getFullYear() > currentMonthStart.getFullYear() ||
        (calendarMonth.getFullYear() === currentMonthStart.getFullYear() && calendarMonth.getMonth() > currentMonthStart.getMonth())

    const selectedDateLabel = useMemo(() => {
        if (!selectedDate) {
            return null
        }

        return new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        })
    }, [selectedDate])

    const selectedTimeLabel = useMemo(() => {
        if (!selectedTime) {
            return null
        }

        return new Date(`2000-01-01T${selectedTime}:00`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }, [selectedTime])

    const selectedSlotLabel = selectedDateLabel && selectedTimeLabel
        ? `${selectedDateLabel} at ${selectedTimeLabel}`
        : null

    const requiredFieldsMissing = customFields.some((field) => {
        if (!field.required) return false
        const value = customAnswers[field.id]
        return !value || value.trim() === ''
    })

    const nameMissing = !formData.name.trim()

    const handleFieldChange = (fieldId: string, value: string) => {
        setCustomAnswers(prev => ({ ...prev, [fieldId]: value }))
    }

    const handleDateSelect = (isoDate: string) => {
        if (selectedDate !== isoDate) {
            setSelectedTime('')
        }

        setError(null)
        setSelectedDate(isoDate)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        setError(null)

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
                const responseError = await res.json()
                console.error('Booking failed:', responseError)
                setError(responseError.message || 'Something went wrong. Please try again.')
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
                        <button onClick={onClose} className={styles.closeBtn} aria-label="Close booking modal"><FaTimes /></button>
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

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>{step === 'calendar' ? 'Pick a Time' : 'Your Details'}</h3>
                    <button onClick={onClose} className={styles.closeBtn} aria-label="Close booking modal"><FaTimes /></button>
                </div>

                <div className={styles.content}>
                    <div className={styles.bookingIntro}>
                        <h4>{bookingTitle}</h4>
                        <p>{bookingDescription}</p>
                    </div>

                    {selectedSlotLabel && (
                        <div className={styles.selectedSummary}>
                            <FaCalendarAlt />
                            <span>{selectedSlotLabel}</span>
                        </div>
                    )}

                    {step === 'calendar' ? (
                        <div className={styles.step}>
                            <div className={styles.calendarShell}>
                                <div className={styles.calendarHeader}>
                                    <div>
                                        <span className={styles.sectionEyebrow}>Calendar</span>
                                        <strong>{monthLabel}</strong>
                                    </div>
                                    <div className={styles.calendarNav}>
                                        <button
                                            type="button"
                                            className={styles.navBtn}
                                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                                            disabled={!canGoToPreviousMonth}
                                            aria-label="Previous month"
                                        >
                                            <FaChevronLeft />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.navBtn}
                                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                                            aria-label="Next month"
                                        >
                                            <FaChevronRight />
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.weekDays}>
                                    {weekDays.map((day) => (
                                        <span key={day} className={styles.weekDay}>{day}</span>
                                    ))}
                                </div>

                                <div className={styles.calendarGrid}>
                                    {calendarCells.map((cell) => (
                                        <button
                                            key={cell.isoDate}
                                            type="button"
                                            className={`${styles.dayBtn} ${cell.isCurrentMonth ? '' : styles.dayOutsideMonth} ${cell.isSelected ? styles.daySelected : ''} ${cell.isToday ? styles.dayToday : ''}`}
                                            onClick={() => handleDateSelect(cell.isoDate)}
                                            disabled={cell.isPast}
                                        >
                                            <span className={styles.dayNumber}>{cell.dayOfMonth}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.timeBlock}>
                                <div className={styles.timeHeader}>
                                    <div>
                                        <span className={styles.sectionEyebrow}>Times</span>
                                        <strong>{selectedDateLabel || 'Choose a day to see available times'}</strong>
                                        <span className={styles.timezoneNote}>Times shown in {displayTimeZone}</span>
                                    </div>
                                    <span className={styles.durationBadge}>
                                        <FaClock />
                                        {host.meeting_duration || 30} mins
                                    </span>
                                </div>

                                {timeSlots.length === 0 ? (
                                    <div className={styles.emptySlots}>
                                        No time slots are available yet. Ask the host to update their availability window.
                                    </div>
                                ) : (
                                    <div className={styles.slots}>
                                        {timeSlots.map(time => {
                                            const timeLabel = new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })

                                            return (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    className={`${styles.slotBtn} ${selectedTime === time ? styles.selected : ''}`}
                                                    onClick={() => {
                                                        setSelectedTime(time)
                                                        setError(null)
                                                    }}
                                                    disabled={!selectedDate}
                                                >
                                                    {timeLabel}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => setStep('details')}
                                disabled={!selectedDate || !selectedTime}
                            >
                                Continue to details
                            </button>
                        </div>
                    ) : (
                        <div className={styles.step}>
                            <div className={styles.formSectionHeader}>
                                <div>
                                    <span className={styles.sectionEyebrow}>Guest Form</span>
                                    <strong>Tell {host.name || 'the host'} a bit about you</strong>
                                </div>
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() => setStep('calendar')}
                                >
                                    Change time
                                </button>
                            </div>

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
                                                    placeholder={field.placeholder || 'Your answer'}
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
                                                    placeholder={field.placeholder || 'your.email@example.com'}
                                                />
                                            ) : field.type === 'phone' ? (
                                                <input
                                                    type="tel"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || '+1 (555) 123-4567'}
                                                />
                                            ) : field.type === 'number' ? (
                                                <input
                                                    type="number"
                                                    value={customAnswers[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder || '123'}
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
                                                    placeholder={field.placeholder || 'Your answer'}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {error && (
                                <div className={styles.error}>
                                    {error}
                                </div>
                            )}

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() => setStep('calendar')}
                                >
                                    Back to calendar
                                </button>
                                <button
                                    type="button"
                                    className={styles.actionBtn}
                                    onClick={handleSubmit}
                                    disabled={nameMissing || requiredFieldsMissing || !selectedDate || !selectedTime || submitting}
                                >
                                    {submitting ? 'Booking...' : 'Confirm Booking'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
