interface ErrorLike {
    message?: string | null
}

const OPTIONAL_LEAD_FORM_COLUMNS = new Set([
    'meta_capi_access_token',
    'meta_capi_dataset_id',
    'meta_capi_test_event_code',
    'facebook_purchase_value',
    'send_qualified_to_facebook',
    'send_purchase_to_facebook',
    'qualified_media_mode',
])

type InsertResult<T> = {
    data: T | null
    error: ErrorLike | null
}

type UpdateResult<T> = {
    data: T | null
    error: ErrorLike | null
}

function omitColumn<T extends Record<string, unknown>>(record: T, column: keyof T) {
    const next = { ...record }
    delete next[column]
    return next
}

export function isMissingLeadFormsColumnError(
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
            message.includes(`lead_forms.${normalizedColumn}`) ||
            message.includes(`lead_forms."${normalizedColumn}"`)
        )

    const postgrestSchemaCacheMiss =
        message.includes('schema cache') &&
        message.includes(`'${normalizedColumn}'`) &&
        message.includes("column of 'lead_forms'")

    return postgresMissingColumn || postgrestSchemaCacheMiss
}

function getMissingLeadFormsColumn(error: ErrorLike | null | undefined): string | null {
    const message = error?.message || ''

    const schemaCacheMatch = message.match(/'([^']+)' column of 'lead_forms'/i)
    if (schemaCacheMatch?.[1]) {
        return schemaCacheMatch[1]
    }

    const postgresMatch = message.match(/lead_forms\.(?:"([^"]+)"|([a-z0-9_]+))/i)
    if (postgresMatch?.[1]) {
        return postgresMatch[1]
    }

    if (postgresMatch?.[2]) {
        return postgresMatch[2]
    }

    return null
}

function getMissingOptionalLeadFormsColumn(
    error: ErrorLike | null | undefined,
    payload: Record<string, unknown>
): string | null {
    const column = getMissingLeadFormsColumn(error)
    if (!column || !(column in payload)) {
        return null
    }

    if (!OPTIONAL_LEAD_FORM_COLUMNS.has(column)) {
        return null
    }

    if (isMissingLeadFormsColumnError(error, column)) {
        return column
    }

    return null
}

export async function insertLeadFormWithCompat<T>(
    supabase: any,
    payload: Record<string, unknown>
): Promise<InsertResult<T>> {
    let nextPayload = { ...payload }

    while (true) {
        const result = await supabase
            .from('lead_forms')
            .insert(nextPayload)
            .select()
            .single()

        if (!result.error) {
            return result
        }

        const missingColumn = getMissingOptionalLeadFormsColumn(result.error, nextPayload)
        if (!missingColumn) {
            return result
        }

        nextPayload = omitColumn(nextPayload, missingColumn)
    }
}

export async function updateLeadFormWithCompat<T>(
    supabase: any,
    formId: string,
    payload: Record<string, unknown>
): Promise<UpdateResult<T>> {
    let nextPayload = { ...payload }

    while (true) {
        const result = await supabase
            .from('lead_forms')
            .update(nextPayload)
            .eq('id', formId)
            .select()
            .single()

        if (!result.error) {
            return result
        }

        const missingColumn = getMissingOptionalLeadFormsColumn(result.error, nextPayload)
        if (!missingColumn) {
            return result
        }

        nextPayload = omitColumn(nextPayload, missingColumn)
    }
}
