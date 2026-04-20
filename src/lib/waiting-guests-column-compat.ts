interface ErrorLike {
    message?: string | null
}

const OPTIONAL_WAITING_GUEST_COLUMNS = [
    'pipeline_stage_changed_at',
    'submitted_at',
    'lead_session_token',
    'qualification_reasoning',
    'qualification_score',
    'lead_answers',
    'pipeline_stage',
] as const

type OptionalWaitingGuestColumn = (typeof OPTIONAL_WAITING_GUEST_COLUMNS)[number]

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

function getMissingOptionalColumn(
    error: ErrorLike | null | undefined,
    payload: Record<string, unknown>
): OptionalWaitingGuestColumn | null {
    for (const column of OPTIONAL_WAITING_GUEST_COLUMNS) {
        if (!(column in payload)) {
            continue
        }

        if (isMissingWaitingGuestsColumnError(error, column)) {
            return column
        }
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
