/**
 * Meeting Summary API
 * POST — Generate AI meeting summary from chat history
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { generateMeetingSummary } from '@/lib/rag-pipeline'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { meetingId, chatHistory } = body

    if (!meetingId) {
        return NextResponse.json({ error: 'meetingId required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Get meeting context
    const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('ai_objective, ai_flow, ai_meeting_notes')
        .eq('id', meetingId)
        .single()

    if (meetingError) {
        return NextResponse.json({ error: meetingError.message }, { status: 500 })
    }

    // If already has notes, return them (unless force regenerate)
    if (meeting?.ai_meeting_notes && !body.forceRegenerate) {
        return NextResponse.json(meeting.ai_meeting_notes)
    }

    try {
        const notes = await generateMeetingSummary(
            meetingId,
            chatHistory || [],
            meeting?.ai_objective,
            meeting?.ai_flow
        )

        return NextResponse.json(notes)
    } catch (error) {
        console.error('Summary generation error:', error)
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        )
    }
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
    const { data, error } = await supabase
        .from('meetings')
        .select('ai_summary, ai_meeting_notes')
        .eq('id', meetingId)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data?.ai_meeting_notes || null)
}
