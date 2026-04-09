import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * POST /api/integrations/ih/validate
 *
 * Called by InstantHomes server during account linking.
 * Validates IM credentials and returns user info + widget key.
 *
 * Body: { email, password, ihTenantId, ihTenantSlug, ihTenantName }
 * Returns: { userId, widgetKey, username, email }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { email, password, ihTenantId, ihTenantSlug, ihTenantName } = body

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Look up user by email
        const { data: user, error: userError } = await db()
            .from('users')
            .select('id, email, name, username, widget_key, password_hash')
            .eq('email', email)
            .single()

        if (userError || !user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // Validate password if user has a password_hash
        if (user.password_hash && password) {
            // Use bcrypt comparison — dynamic import for edge compatibility
            const bcrypt = await import('bcryptjs')
            const valid = await bcrypt.compare(password, user.password_hash)

            if (!valid) {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
            }
        }

        // Generate widget_key if the user doesn't have one yet
        let widgetKey = user.widget_key

        if (!widgetKey) {
            const { randomBytes } = await import('crypto')
            const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
            let key = 'pk_'
            const bytes = randomBytes(20)
            for (const b of bytes) {
                key += ALPHABET[b % ALPHABET.length]
            }
            widgetKey = key

            await db()
                .from('users')
                .update({
                    widget_key: widgetKey,
                    widget_enabled: true,
                })
                .eq('id', user.id)
        }

        // Mark the user as linked to InstantHomes
        await db()
            .from('users')
            .update({
                ih_linked: true,
                ih_tenant_id: ihTenantId || null,
                ih_tenant_slug: ihTenantSlug || null,
                ih_tenant_name: ihTenantName || null,
                ih_linked_at: new Date().toISOString(),
            })
            .eq('id', user.id)

        return NextResponse.json({
            userId: user.id,
            widgetKey,
            username: user.username || user.name || '',
            email: user.email,
        })
    } catch (error) {
        console.error('Integration validate error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
