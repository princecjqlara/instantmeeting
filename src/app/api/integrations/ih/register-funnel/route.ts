import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * POST /api/integrations/ih/register-funnel
 *
 * Called by InstantHomes when a funnel enables the IM widget.
 * Auto-whitelists the funnel domain and returns widget config.
 *
 * Body: { imUserId, funnelDomain, funnelSlug, tenantSlug }
 * Returns: { widgetKey, meetingUrl }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { imUserId, funnelDomain, funnelSlug, tenantSlug } = body

        if (!imUserId) {
            return NextResponse.json({ error: 'imUserId is required' }, { status: 400 })
        }

        // Look up the user
        const { data: user, error: userError } = await db()
            .from('users')
            .select('id, widget_key, widget_domains, ih_funnel_domains, username')
            .eq('id', imUserId)
            .single()

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Add the funnel domain to both widget_domains and ih_funnel_domains
        const currentWidgetDomains: string[] = user.widget_domains || []
        const currentFunnelDomains: string[] = user.ih_funnel_domains || []

        const updatedWidgetDomains = currentWidgetDomains.includes(funnelDomain)
            ? currentWidgetDomains
            : [...currentWidgetDomains, funnelDomain]

        const updatedFunnelDomains = currentFunnelDomains.includes(funnelDomain)
            ? currentFunnelDomains
            : [...currentFunnelDomains, funnelDomain]

        await db()
            .from('users')
            .update({
                widget_domains: updatedWidgetDomains,
                ih_funnel_domains: updatedFunnelDomains,
                widget_enabled: true,
            })
            .eq('id', user.id)

        // Build the meeting URL
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://instantmeeting.app'
        const meetingUrl = user.username
            ? `${baseUrl}/join/${user.username}`
            : `${baseUrl}/join/${user.id}`

        return NextResponse.json({
            widgetKey: user.widget_key,
            meetingUrl,
            domain: funnelDomain,
            whitelisted: true,
        })
    } catch (error) {
        console.error('Register funnel error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/integrations/ih/register-funnel
 *
 * Called when a funnel disables IM widget.
 * Removes the funnel domain from whitelist.
 *
 * Body: { imUserId, funnelDomain }
 */
export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json()
        const { imUserId, funnelDomain } = body

        if (!imUserId || !funnelDomain) {
            return NextResponse.json({ error: 'imUserId and funnelDomain are required' }, { status: 400 })
        }

        const { data: user } = await db()
            .from('users')
            .select('id, widget_domains, ih_funnel_domains')
            .eq('id', imUserId)
            .single()

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const updatedFunnelDomains = (user.ih_funnel_domains || []).filter((d: string) => d !== funnelDomain)

        // Only remove from widget_domains if it was an IH-added domain
        const updatedWidgetDomains = (user.widget_domains || []).filter((d: string) => d !== funnelDomain)

        await db()
            .from('users')
            .update({
                widget_domains: updatedWidgetDomains,
                ih_funnel_domains: updatedFunnelDomains,
            })
            .eq('id', user.id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Unregister funnel error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
