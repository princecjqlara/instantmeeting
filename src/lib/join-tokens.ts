import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function generateJoinCode(): string {
    const bytes = randomBytes(6)
    let code = ''
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length]
    return code
}

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function createJoinToken(opts: {
    meetingId: string
    visitorSessionId?: string | null
    widgetContext?: Record<string, unknown> | null
}): Promise<string> {
    const supabase = db()
    for (let i = 0; i < 5; i++) {
        const code = generateJoinCode()
        const { error } = await supabase.from('meeting_join_tokens').insert({
            code,
            meeting_id: opts.meetingId,
            visitor_session_id: opts.visitorSessionId || null,
            widget_context: opts.widgetContext || null,
        })
        if (!error) return code
    }
    throw new Error('Could not generate unique join code')
}

export async function consumeJoinToken(code: string) {
    const supabase = db()
    const { data: token } = await supabase
        .from('meeting_join_tokens')
        .select('*')
        .eq('code', code)
        .single()
    if (!token) return null
    if (token.consumed) return token // allow re-use within same browser; idempotent redirect
    if (new Date(token.expires_at).getTime() < Date.now()) return null
    await supabase.from('meeting_join_tokens').update({ consumed: true }).eq('code', code)
    return token
}
