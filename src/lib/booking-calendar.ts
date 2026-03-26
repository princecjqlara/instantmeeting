export interface BookingCalendarCell {
    isoDate: string
    dayOfMonth: number
    isCurrentMonth: boolean
    isPast: boolean
    isSelected: boolean
    isToday: boolean
}

interface BuildBookingCalendarMonthOptions {
    currentMonth: Date
    today?: Date
    selectedDate?: string
}

function pad(value: number) {
    return value.toString().padStart(2, '0')
}

export function toIsoDate(date: Date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function buildBookingCalendarMonth({
    currentMonth,
    today = new Date(),
    selectedDate,
}: BuildBookingCalendarMonthOptions): BookingCalendarCell[] {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const gridStart = new Date(year, month, 1 - startOffset)
    const normalizedToday = startOfDay(today)

    return Array.from({ length: 42 }, (_, index) => {
        const cellDate = new Date(gridStart)
        cellDate.setDate(gridStart.getDate() + index)

        const cellDay = startOfDay(cellDate)
        const isoDate = toIsoDate(cellDay)

        return {
            isoDate,
            dayOfMonth: cellDay.getDate(),
            isCurrentMonth: cellDay.getMonth() === month,
            isPast: cellDay < normalizedToday,
            isSelected: isoDate === selectedDate,
            isToday: cellDay.getTime() === normalizedToday.getTime(),
        }
    })
}

export function buildTimeSlots(
    availableFrom: string | null | undefined,
    availableTo: string | null | undefined,
    durationMinutes: number | null | undefined,
) {
    const fromTime = availableFrom || '09:00'
    const toTime = availableTo || '17:00'
    const duration = durationMinutes || 30

    const [startHour, startMinute] = fromTime.split(':').map(Number)
    const [endHour, endMinute] = toTime.split(':').map(Number)

    const startTotal = startHour * 60 + (startMinute || 0)
    const endTotal = endHour * 60 + (endMinute || 0)

    if (duration <= 0 || endTotal <= startTotal) {
        return []
    }

    const slots: string[] = []

    for (let minutes = startTotal; minutes + duration <= endTotal; minutes += duration) {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        slots.push(`${pad(hours)}:${pad(mins)}`)
    }

    return slots
}
