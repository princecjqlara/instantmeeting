import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * GET /api/integrations/ih/status?userId={imUserId}
 *
 * Called by InstantHomes server to check link status.
 * Returns current connection details.
 */
export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data: user, error } = await db()
        .from('users')
        .select('id, email, name, username, widget_key, ih_linked, ih_tenant_id, ih_tenant_slug, ih_tenant_name, ih_linked_at, ih_funnel_domains')
        .eq('id', userId)
        .single()

    if (error || !user) {
        return NextResponse.json({ connected: false }, { status: 200 })
    }

    return NextResponse.json({
        connected: !!user.ih_linked,
        username: user.username || user.name || '',
        email: user.email,
        widgetKey: user.widget_key,
        tenantId: user.ih_tenant_id,
        tenantSlug: user.ih_tenant_slug,
        tenantName: user.ih_tenant_name,
        linkedAt: user.ih_linked_at,
        funnelDomains: user.ih_funnel_domains || [],
    })
}
