export interface MetaCapiConfigRow {
    meta_capi_access_token?: string | null
    meta_capi_dataset_id?: string | null
    meta_capi_test_event_code?: string | null
}

export interface MetaCapiConfigCandidate extends MetaCapiConfigRow {
    role?: string | null
}

export interface MetaCapiConfig {
    accessToken: string
    datasetId: string
    testEventCode?: string
}

export function normalizeMetaCapiConfig(
    row: MetaCapiConfigRow | null | undefined
): MetaCapiConfig | null {
    const accessToken = row?.meta_capi_access_token?.trim()
    const datasetId = row?.meta_capi_dataset_id?.trim()
    const testEventCode = row?.meta_capi_test_event_code?.trim()

    if (!accessToken || !datasetId) {
        return null
    }

    return {
        accessToken,
        datasetId,
        ...(testEventCode ? { testEventCode } : {}),
    }
}

export function selectMetaCapiConfig(
    rows: MetaCapiConfigCandidate[] | null | undefined
): MetaCapiConfig | null {
    if (!rows?.length) {
        return null
    }

    for (const row of rows) {
        if (row?.role !== 'organizer') {
            continue
        }

        const config = normalizeMetaCapiConfig(row)
        if (config) {
            return config
        }
    }

    for (const row of rows) {
        const config = normalizeMetaCapiConfig(row)
        if (config) {
            return config
        }
    }

    return null
}
