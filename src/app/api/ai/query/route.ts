/**
 * AI RAG Query API
 * POST — Query the AI assistant with RAG context (streaming SSE)
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { queryRAG } from '@/lib/rag-pipeline'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { query, meetingId, currentFlowStep, chatHistory } = body

    if (!query || typeof query !== 'string') {
        return new Response('query is required', { status: 400 })
    }

    // Load meeting AI config
    let meetingContext: {
        objective?: string | null
        flow?: Array<{
            step_number: number
            title: string
            description: string
            suggested_questions?: string[]
        }> | null
        currentFlowStep?: number
        chatHistory?: Array<{ role: string; text: string }>
    } = {
        currentFlowStep,
        chatHistory,
    }

    let knowledgeBaseId: string | null = null

    if (meetingId) {
        const supabase = getSupabase()
        // Fetch user and meeting in parallel for speed
        const [{ data: user }, { data: meetings }] = await Promise.all([
            supabase.from('users').select('id').eq('email', session.user.email).single(),
            supabase.from('meetings').select('ai_objective, ai_flow, ai_knowledge_base_id, user_id').eq('id', meetingId).single(),
        ])

        const meeting = meetings && user && meetings.user_id === user.id ? meetings : null

        if (meeting) {
            meetingContext = {
                ...meetingContext,
                objective: meeting.ai_objective,
                flow: meeting.ai_flow,
            }
            knowledgeBaseId = meeting.ai_knowledge_base_id
        }
    }

    try {
        const stream = await queryRAG(query, knowledgeBaseId, meetingContext)

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        console.error('AI Query error:', error)
        return new Response(
            JSON.stringify({ error: 'AI query failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}
