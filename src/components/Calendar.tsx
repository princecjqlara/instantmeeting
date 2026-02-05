'use client'

import { useMemo } from 'react'
import { Meeting } from '@/lib/types'
import styles from './Calendar.module.css'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

interface CalendarProps {
    meetings: Meeting[]
    currentMonth: Date
    onMonthChange: (date: Date) => void
    onDateClick?: (date: Date, meetings: Meeting[]) => void
}

export default function Calendar({ meetings, currentMonth, onMonthChange, onDateClick }: CalendarProps) {
    const { days, weekDays, monthYear } = useMemo(() => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()

        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const startPadding = firstDay.getDay()

        const days: (Date | null)[] = []

        // Add empty cells for padding
        for (let i = 0; i < startPadding; i++) {
            days.push(null)
        }

        // Add days of month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i))
        }

        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

        return { days, weekDays, monthYear }
    }, [currentMonth])

    const getMeetingsForDate = (date: Date): Meeting[] => {
        return meetings.filter(meeting => {
            const meetingDate = new Date(meeting.created_at)
            return (
                meetingDate.getFullYear() === date.getFullYear() &&
                meetingDate.getMonth() === date.getMonth() &&
                meetingDate.getDate() === date.getDate()
            )
        })
    }

    const prevMonth = () => {
        onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const isToday = (date: Date) => {
        const today = new Date()
        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        )
    }

    return (
        <div className={styles.calendar}>
            <div className={styles.header}>
                <button onClick={prevMonth} className={styles.navBtn}>
                    <FaChevronLeft />
                </button>
                <h3>{monthYear}</h3>
                <button onClick={nextMonth} className={styles.navBtn}>
                    <FaChevronRight />
                </button>
            </div>

            <div className={styles.weekDays}>
                {weekDays.map(day => (
                    <div key={day} className={styles.weekDay}>{day}</div>
                ))}
            </div>

            <div className={styles.days}>
                {days.map((date, index) => {
                    if (!date) {
                        return <div key={`empty-${index}`} className={styles.emptyDay} />
                    }

                    const dateMeetings = getMeetingsForDate(date)
                    const hasMeetings = dateMeetings.length > 0

                    return (
                        <div
                            key={date.toISOString()}
                            className={`${styles.day} ${isToday(date) ? styles.today : ''} ${hasMeetings ? styles.hasMeetings : ''}`}
                            onClick={() => onDateClick?.(date, dateMeetings)}
                        >
                            <span className={styles.dayNumber}>{date.getDate()}</span>
                            {hasMeetings && (
                                <span className={styles.meetingCount}>{dateMeetings.length}</span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
