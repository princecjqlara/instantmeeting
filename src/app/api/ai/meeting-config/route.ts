/**
 * Meeting AI Config API
 * 
 * Supports both user-level "default" config (applies to all meetings)
 * and per-meeting overrides.
 * 
 * GET  — get AI config (default or per-meeting)
 * POST — save AI config (objective, flow, knowledge_base_id)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meetingId = req.nextUrl.searchParams.get('meetingId')
    if (!meetingId) {
        return NextResponse.json({ error: 'meetingId required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // If "default", load user-level config from profiles
    if (meetingId === 'default') {
        const { data, error } = await supabase
            .from('profiles')
            .select('ai_default_objective, ai_default_flow, ai_default_knowledge_base_id')
            .eq('email', session.user.email)
            .single()

        if (error || !data) {
            // Return empty config if no profile or columns don't exist yet
            return NextResponse.json({
                ai_objective: null,
                ai_flow: null,
                ai_knowledge_base_id: null,
            })
        }

        return NextResponse.json({
            ai_objective: data.ai_default_objective ?? null,
            ai_flow: data.ai_default_flow ?? null,
            ai_knowledge_base_id: data.ai_default_knowledge_base_id ?? null,
        })
    }

    // Resolve user ID for ownership check
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Per-meeting config — try meeting first, fall back to user defaults
    const { data, error } = await supabase
        .from('meetings')
        .select('ai_objective, ai_flow, ai_knowledge_base_id')
        .eq('id', meetingId)
        .eq('user_id', user.id)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If meeting has no AI config, fall back to user defaults
    if (!data.ai_objective && !data.ai_flow && !data.ai_knowledge_base_id) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('ai_default_objective, ai_default_flow, ai_default_knowledge_base_id')
            .eq('email', session.user.email)
            .single()

        if (profile) {
            return NextResponse.json({
                ai_objective: profile.ai_default_objective ?? null,
                ai_flow: profile.ai_default_flow ?? null,
                ai_knowledge_base_id: profile.ai_default_knowledge_base_id ?? null,
            })
        }
    }

    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { meetingId, objective, flow, knowledgeBaseId } = body

    if (!meetingId) {
        return NextResponse.json({ error: 'meetingId required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // If "default", save to user profile as defaults for all meetings
    if (meetingId === 'default') {
        const updateData: Record<string, unknown> = {}

        if (objective !== undefined) {
            updateData.ai_default_objective = objective || null
        }

        if (flow !== undefined) {
            updateData.ai_default_flow = flow || null
        }

        if (knowledgeBaseId !== undefined) {
            updateData.ai_default_knowledge_base_id = knowledgeBaseId || null
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('email', session.user.email)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    }

    // Resolve user ID for ownership check
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Per-meeting config
    const updateData: Record<string, unknown> = {}

    if (objective !== undefined) {
        updateData.ai_objective = objective || null
    }

    if (flow !== undefined) {
        updateData.ai_flow = flow || null
    }

    if (knowledgeBaseId !== undefined) {
        updateData.ai_knowledge_base_id = knowledgeBaseId || null
    }

    const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meetingId)
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
