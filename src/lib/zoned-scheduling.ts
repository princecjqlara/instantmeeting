interface ZonedDateTimeParts {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
    return Number(parts.find((part) => part.type === type)?.value ?? '0')
}

function isValidTimeZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
        return true
    } catch {
        return false
    }
}

function getZonedParts(timestamp: number, timeZone: string): ZonedDateTimeParts {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    })

    const parts = formatter.formatToParts(new Date(timestamp))

    return {
        year: getPart(parts, 'year'),
        month: getPart(parts, 'month'),
        day: getPart(parts, 'day'),
        hour: getPart(parts, 'hour'),
        minute: getPart(parts, 'minute'),
        second: getPart(parts, 'second'),
    }
}

export function combineDateAndTimeInTimeZone(date: string, time: string, timeZone?: string) {
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    const safeTimeZone = timeZone && isValidTimeZone(timeZone) ? timeZone : 'UTC'
    const desiredUtcTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0)
    let candidateTimestamp = desiredUtcTimestamp

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const zonedParts = getZonedParts(candidateTimestamp, safeTimeZone)
        const zonedAsUtcTimestamp = Date.UTC(
            zonedParts.year,
            zonedParts.month - 1,
            zonedParts.day,
            zonedParts.hour,
            zonedParts.minute,
            zonedParts.second,
        )
        const difference = desiredUtcTimestamp - zonedAsUtcTimestamp

        if (difference === 0) {
            break
        }

        candidateTimestamp += difference
    }

    return new Date(candidateTimestamp).toISOString()
}
