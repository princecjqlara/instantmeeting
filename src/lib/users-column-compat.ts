interface ErrorLike {
    message?: string | null
}

export function isMissingUsersColumnError(
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
            message.includes(`users.${normalizedColumn}`) ||
            message.includes(`users."${normalizedColumn}"`)
        )

    const postgrestSchemaCacheMiss =
        message.includes('schema cache') &&
        message.includes(`'${normalizedColumn}'`) &&
        message.includes("column of 'users'")

    return postgresMissingColumn || postgrestSchemaCacheMiss
}
