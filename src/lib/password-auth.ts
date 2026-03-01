import bcrypt from 'bcryptjs'

export async function isValidCredentialPassword(
    inputPassword: string,
    passwordHash: string
): Promise<boolean> {
    const exactMatch = await bcrypt.compare(inputPassword, passwordHash)
    if (exactMatch) {
        return true
    }

    const trimmedPassword = inputPassword.trim()
    if (trimmedPassword === inputPassword) {
        return false
    }

    return bcrypt.compare(trimmedPassword, passwordHash)
}
