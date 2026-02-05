'use client'

import { useState, useMemo } from 'react'
import { User } from '@/lib/types'
import styles from './BookingModal.module.css'
import { FaCheckCircle, FaTimes } from 'react-icons/fa'

interface BookingModalProps {
    host: User
    onClose: () => void
}

export default function BookingModal({ host, onClose }: BookingModalProps) {
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        note: ''
    })
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [selectedTime, setSelectedTime] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)

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
            const res = await fetch('/api/meetings/public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hostId: host.id,
                    guestName: formData.name,
                    guestEmail: formData.email,
                    note: formData.note,
                    date: selectedDate, // ISO string
                    time: selectedTime
                })
            })

            if (res.ok) {
                setSuccess(true)
            } else {
                alert('Something went wrong. Please try again.')
            }
        } catch (err) {
            console.error(err)
            alert('Failed to book meeting')
        } finally {
            setSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className={styles.overlay}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h3>Booking Confirmed!</h3>
                        <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                    </div>
                    <div className={styles.success}>
                        <FaCheckCircle className={styles.successIcon} />
                        <p>Your meeting request has been sent to {host.name || 'the host'}.</p>
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
                    <h3>
                        {step === 1 ? 'Contact Info' : 'Select a Time'}
                    </h3>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <div className={styles.content}>
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
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="jane@example.com"
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Note (Optional)</label>
                                <textarea
                                    value={formData.note}
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                                    placeholder="I'd like to discuss..."
                                />
                            </div>
                            <button
                                className={styles.actionBtn}
                                onClick={() => setStep(2)}
                                disabled={!formData.name || !formData.email}
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
