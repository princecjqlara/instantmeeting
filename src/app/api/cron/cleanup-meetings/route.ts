import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint to auto-end stale meetings.
 *
 * Marks meetings as 'completed' if they have been 'active' for longer than
 * the configured duration (default 30 min) or 'pending' for over 2 hours.
 *
 * Protected by a CRON_SECRET env variable — set this in your environment
 * and configure your cron service (e.g., cron-job.org, Vercel Cron, etc.)
 * to call: POST /api/cron/cleanup-meetings
 * with header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()

    // 1. End 'active' meetings older than their configured duration (or 30 min default)
    //    We check host_joined_at — if the host joined over (meeting_duration) minutes ago, end it.
    const { data: staleMeetings, error: fetchError } = await supabase
        .from('meetings')
        .select('id, user_id, host_joined_at, users!inner(meeting_duration)')
        .eq('status', 'active')
        .not('host_joined_at', 'is', null)

    if (fetchError) {
        console.error('[Cron] Error fetching active meetings:', fetchError)
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    let endedCount = 0

    for (const meeting of staleMeetings || []) {
        const joinedAt = new Date(meeting.host_joined_at)
        const durationMin = (meeting as any).users?.meeting_duration || 30
        const maxAge = durationMin * 60 * 1000 // convert to ms
        const elapsed = now.getTime() - joinedAt.getTime()

        if (elapsed > maxAge) {
            const { error: updateError } = await supabase
                .from('meetings')
                .update({
                    status: 'completed',
                    ended_at: now.toISOString(),
                })
                .eq('id', meeting.id)

            if (!updateError) {
                // Also mark waiting guests as left
                await supabase
                    .from('waiting_guests')
                    .update({ status: 'left' })
                    .eq('meeting_id', meeting.id)
                    .neq('status', 'left')

                // Broadcast end-meeting signal so any connected peers get kicked
                const channel = supabase.channel(`room:${meeting.id}`)
                await channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'end-meeting', from: 'system' },
                }).catch(() => {})

                endedCount++
            }
        }
    }

    // 2. End 'pending' meetings older than 2 hours (never started)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    const { data: pendingEnded, error: pendingError } = await supabase
        .from('meetings')
        .update({
            status: 'completed',
            ended_at: now.toISOString(),
        })
        .eq('status', 'pending')
        .lt('created_at', twoHoursAgo)
        .select('id')

    if (pendingError) {
        console.error('[Cron] Error cleaning pending meetings:', pendingError)
    }

    const pendingCount = pendingEnded?.length || 0

    // 3. End 'active' meetings with no host_joined_at older than 1 hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const { data: noHostEnded, error: noHostError } = await supabase
        .from('meetings')
        .update({
            status: 'completed',
            ended_at: now.toISOString(),
        })
        .eq('status', 'active')
        .is('host_joined_at', null)
        .lt('created_at', oneHourAgo)
        .select('id')

    if (noHostError) {
        console.error('[Cron] Error cleaning no-host meetings:', noHostError)
    }

    const noHostCount = noHostEnded?.length || 0

    console.log(`[Cron] Cleanup: ${endedCount} active expired, ${pendingCount} pending expired, ${noHostCount} no-host expired`)

    return NextResponse.json({
        cleaned: {
            activeExpired: endedCount,
            pendingExpired: pendingCount,
            noHostExpired: noHostCount,
        },
    })
}

// Also support GET for easier cron service configuration
export async function GET(req: NextRequest) {
    return POST(req)
}
