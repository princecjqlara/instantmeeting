import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get content metrics with real vs fake engagement breakdown
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all content with engagement data
    const { data: content, error } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get real engagement from engagement table
    const { data: engagementData, error: engagementError } = await supabase
        .from('content_engagement')
        .select('content_id, type, created_at')
        .in('content_id', content?.map(c => c.id) || [])

    if (engagementError) {
        console.error('Engagement fetch error:', engagementError)
    }

    // Process metrics
    const metrics = content?.map(item => {
        const itemEngagement = engagementData?.filter(e => e.content_id === item.id) || []
        const realViews = itemEngagement.filter(e => e.type === 'view').length
        const realLikes = itemEngagement.filter(e => e.type === 'like').length
        const realComments = itemEngagement.filter(e => e.type === 'comment').length

        return {
            id: item.id,
            title: item.title,
            caption: item.caption,
            thumbnail_url: item.thumbnail_url,
            created_at: item.created_at,
            duration_seconds: item.duration_seconds,
            views: {
                total: item.views || 0,
                real: realViews,
                fake: (item.views || 0) - realViews
            },
            likes: {
                total: item.likes || 0,
                real: realLikes,
                fake: (item.likes || 0) - realLikes
            },
            comments: {
                total: item.comments || 0,
                real: realComments,
                fake: (item.comments || 0) - realComments
            }
        }
    }) || []

    // Calculate totals
    const totals = metrics.reduce((acc, item) => ({
        views: { 
            total: acc.views.total + item.views.total,
            real: acc.views.real + item.views.real,
            fake: acc.views.fake + item.views.fake
        },
        likes: { 
            total: acc.likes.total + item.likes.total,
            real: acc.likes.real + item.likes.real,
            fake: acc.likes.fake + item.likes.fake
        },
        comments: { 
            total: acc.comments.total + item.comments.total,
            real: acc.comments.real + item.comments.real,
            fake: acc.comments.fake + item.comments.fake
        }
    }), {
        views: { total: 0, real: 0, fake: 0 },
        likes: { total: 0, real: 0, fake: 0 },
        comments: { total: 0, real: 0, fake: 0 }
    })

    return NextResponse.json({
        content: metrics,
        totals
    })
}
