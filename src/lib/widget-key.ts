import { randomBytes } from 'crypto'

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function generateWidgetKey(): string {
    const bytes = randomBytes(20)
    let key = 'pk_'
    for (const b of bytes) key += ALPHABET[b % ALPHABET.length]
    return key
}

export function isValidWidgetKey(key: string | null | undefined): boolean {
    return !!key && /^pk_[A-Za-z0-9]{20}$/.test(key)
}

/** Extract origin host (no protocol) from a request Origin header. */
export function originHost(origin: string | null): string | null {
    if (!origin) return null
    try {
        return new URL(origin).host.toLowerCase()
    } catch {
        return null
    }
}

/** Compare a request origin against a host's whitelisted domains. */
export function originMatchesDomains(origin: string | null, domains: string[] | null | undefined): boolean {
    const host = originHost(origin)
    if (!host || !domains || domains.length === 0) return false
    return domains.some((d) => {
        const normalized = d.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
        return host === normalized || host.endsWith('.' + normalized)
    })
}
