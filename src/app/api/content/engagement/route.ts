import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { id, type } = body

    if (!id || !type || !['view', 'like', 'comment'].includes(type)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Get current counts first
    const { data: current, error: fetchError } = await supabase
        .from('content')
        .select('views, likes, comments')
        .eq('id', id)
        .single()

    if (fetchError || !current) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const updateData: Record<string, number> = {}
    if (type === 'view') updateData.views = (current.views || 0) + 1
    if (type === 'like') updateData.likes = (current.likes || 0) + 1
    if (type === 'comment') updateData.comments = (current.comments || 0) + 1

    const { data, error } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}
