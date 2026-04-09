import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * POST /api/integrations/ih/disconnect
 *
 * Called by InstantHomes server when the user disconnects their IM account.
 * Clears ih_* fields on the IM user.
 *
 * Body: { imUserId }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { imUserId } = body

        if (!imUserId) {
            return NextResponse.json({ error: 'imUserId is required' }, { status: 400 })
        }

        // Clear IH integration fields
        const { error } = await db()
            .from('users')
            .update({
                ih_linked: false,
                ih_tenant_id: null,
                ih_tenant_slug: null,
                ih_tenant_name: null,
                ih_linked_at: null,
                ih_funnel_domains: [],
            })
            .eq('id', imUserId)

        if (error) {
            console.error('Failed to disconnect IH:', error)
            return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
        }

        // Also remove any integration tokens for this user
        await db()
            .from('integration_tokens')
            .delete()
            .eq('user_id', imUserId)
            .eq('platform', 'instant_homes')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Integration disconnect error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
