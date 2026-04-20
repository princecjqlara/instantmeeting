interface MetaCapiRequestOptions {
    testEventCode?: string | null
}

export function buildMetaCapiRequestBody(
    event: Record<string, unknown>,
    options: MetaCapiRequestOptions = {}
) {
    const payload: {
        data: Record<string, unknown>[]
        test_event_code?: string
    } = {
        data: [event],
    }

    const testEventCode = options.testEventCode?.trim()
    if (testEventCode) {
        payload.test_event_code = testEventCode
    }

    return payload
}
