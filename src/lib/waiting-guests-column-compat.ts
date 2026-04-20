interface ErrorLike {
    message?: string | null
}

const REQUIRED_WAITING_GUEST_COLUMNS = new Set(['meeting_id', 'guest_name', 'status'])

type InsertResult<T> = {
    data: T | null
    error: ErrorLike | null
}

function omitColumn<T extends Record<string, unknown>>(record: T, column: keyof T) {
    const next = { ...record }
    delete next[column]
    return next
}

export function isMissingWaitingGuestsColumnError(
    error: ErrorLike | null | undefined,
    column: string
): boolean {
    if (!error?.message) {
        return false
    }

    const message = error.message.toLowerCase()
    const normalizedColumn = column.toLowerCase()

    const postgresMissingColumn =
        message.includes('does not exist') &&
        (
            message.includes(`waiting_guests.${normalizedColumn}`) ||
            message.includes(`waiting_guests."${normalizedColumn}"`)
        )

    const postgrestSchemaCacheMiss =
        message.includes('schema cache') &&
        message.includes(`'${normalizedColumn}'`) &&
        message.includes("column of 'waiting_guests'")

    return postgresMissingColumn || postgrestSchemaCacheMiss
}

function getMissingWaitingGuestsColumn(error: ErrorLike | null | undefined): string | null {
    const message = error?.message || ''

    const schemaCacheMatch = message.match(/'([^']+)' column of 'waiting_guests'/i)
    if (schemaCacheMatch?.[1]) {
        return schemaCacheMatch[1]
    }

    const postgresMatch = message.match(/waiting_guests\.(?:"([^"]+)"|([a-z0-9_]+))/i)
    if (postgresMatch?.[1]) {
        return postgresMatch[1]
    }

    if (postgresMatch?.[2]) {
        return postgresMatch[2]
    }

    return null
}

function getMissingOptionalColumn(
    error: ErrorLike | null | undefined,
    payload: Record<string, unknown>
): string | null {
    const column = getMissingWaitingGuestsColumn(error)
    if (!column) {
        return null
    }

    if (!(column in payload)) {
        return null
    }

    if (REQUIRED_WAITING_GUEST_COLUMNS.has(column)) {
        return null
    }

    if (isMissingWaitingGuestsColumnError(error, column)) {
        return column
    }

    return null
}

export async function insertWaitingGuestWithCompat<T>(
    supabase: any,
    payload: Record<string, unknown>
): Promise<InsertResult<T>> {
    let nextPayload = { ...payload }

    while (true) {
        const result = await supabase
            .from('waiting_guests')
            .insert(nextPayload)
            .select('*')
            .single()

        if (!result.error) {
            return result
        }

        const missingColumn = getMissingOptionalColumn(result.error, nextPayload)
        if (!missingColumn) {
            return result
        }

        nextPayload = omitColumn(nextPayload, missingColumn)
    }
}
