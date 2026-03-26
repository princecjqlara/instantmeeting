const WEEKDAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface GuestJoinRecord {
    joined_at: string
}

export interface AverageJoinTime {
    minutes: number
    label: string
}

export interface WeekdayJoinInsight {
    weekday: string
    count: number
    averageTime: AverageJoinTime
}

export interface GuestJoinInsights {
    totalJoins: number
    overallAverage: AverageJoinTime | null
    weekdays: WeekdayJoinInsight[]
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
    return parts.find((part) => part.type === type)?.value ?? ''
}

function getJoinTimeParts(joinedAt: string, timeZone: string) {
    const date = new Date(joinedAt)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    })

    const parts = formatter.formatToParts(date)
    const weekday = getDatePart(parts, 'weekday')
    const hour = Number(getDatePart(parts, 'hour'))
    const minute = Number(getDatePart(parts, 'minute'))

    return {
        weekday,
        minutesAfterMidnight: hour * 60 + minute,
    }
}

function averageClockMinutes(values: number[]) {
    if (values.length === 1) {
        return values[0]
    }

    const sorted = [...values].sort((a, b) => a - b)
    let largestGap = -1
    let splitIndex = 0

    for (let index = 0; index < sorted.length; index += 1) {
        const current = sorted[index]
        const next = index === sorted.length - 1 ? sorted[0] + 1440 : sorted[index + 1]
        const gap = next - current

        if (gap > largestGap) {
            largestGap = gap
            splitIndex = (index + 1) % sorted.length
        }
    }

    const rotated = sorted.map((value, index) => {
        const rotatedIndex = (splitIndex + index) % sorted.length
        const rotatedValue = sorted[rotatedIndex]

        return rotatedIndex < splitIndex ? rotatedValue + 1440 : rotatedValue
    })

    return Math.round(rotated.reduce((sum, value) => sum + value, 0) / rotated.length) % 1440
}

function formatAverageTime(minutes: number): AverageJoinTime {
    const safeMinutes = ((minutes % 1440) + 1440) % 1440
    const hours = Math.floor(safeMinutes / 60)
    const mins = safeMinutes % 60
    const label = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(new Date(Date.UTC(2026, 0, 1, hours, mins)))

    return {
        minutes: safeMinutes,
        label,
    }
}

export function buildGuestJoinInsights(records: GuestJoinRecord[], timeZone = 'UTC'): GuestJoinInsights {
    if (records.length === 0) {
        return {
            totalJoins: 0,
            overallAverage: null,
            weekdays: [],
        }
    }

    const weekdayBuckets = new Map<string, number[]>()
    const allJoinMinutes: number[] = []

    for (const record of records) {
        const joinTime = getJoinTimeParts(record.joined_at, timeZone)

        if (!joinTime) {
            continue
        }

        const weekdayMinutes = weekdayBuckets.get(joinTime.weekday) ?? []

        weekdayMinutes.push(joinTime.minutesAfterMidnight)
        weekdayBuckets.set(joinTime.weekday, weekdayMinutes)
        allJoinMinutes.push(joinTime.minutesAfterMidnight)
    }

    if (allJoinMinutes.length === 0) {
        return {
            totalJoins: 0,
            overallAverage: null,
            weekdays: [],
        }
    }

    const weekdays = Array.from(weekdayBuckets.entries())
        .sort((a, b) => WEEKDAY_ORDER.indexOf(a[0]) - WEEKDAY_ORDER.indexOf(b[0]))
        .map(([weekday, minutes]) => ({
            weekday,
            count: minutes.length,
            averageTime: formatAverageTime(averageClockMinutes(minutes)),
        }))

    return {
        totalJoins: allJoinMinutes.length,
        overallAverage: formatAverageTime(averageClockMinutes(allJoinMinutes)),
        weekdays,
    }
}
