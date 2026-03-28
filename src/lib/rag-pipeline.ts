/**
 * RAG Pipeline
 *
 * 1. Ingest: chunk document → embed chunks → store in pgvector
 * 2. Query: embed question → vector search → build context → LLM response
 * 3. Summary: collect chat + context → generate meeting notes
 */

import { createClient } from '@supabase/supabase-js'
import {
    generateEmbedding,
    generateEmbeddings,
    chunkDocument,
    chatCompletion,
    chatCompletionStream,
    type ChatMessage,
} from './nvidia-ai'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/* ---------- Interfaces ---------- */

export interface AIFlowStep {
    step_number: number
    title: string
    description: string
    suggested_questions?: string[]
}

export interface RetrievedChunk {
    id: string
    content: string
    source_name: string | null
    similarity: number
}

export interface MeetingNotes {
    summary: string
    key_points: string[]
    action_items: string[]
    decisions_made: string[]
    next_steps: string[]
    generated_at: string
}

/* ---------- Document Ingestion ---------- */

export async function ingestDocument(
    knowledgeBaseId: string,
    text: string,
    sourceName: string
): Promise<{ chunksCreated: number }> {
    const supabase = getSupabaseClient()

    // 1. Chunk the document
    const chunks = chunkDocument(text, 500, 100)
    if (chunks.length === 0) {
        return { chunksCreated: 0 }
    }

    // 2. Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks)

    // 3. Store chunks + embeddings in pgvector
    const rows = chunks.map((content, i) => ({
        knowledge_base_id: knowledgeBaseId,
        content,
        source_name: sourceName,
        token_count: Math.ceil(content.length / 4), // rough token estimate
        embedding: JSON.stringify(embeddings[i]),
    }))

    const { error } = await supabase.from('ai_knowledge_chunks').insert(rows)

    if (error) {
        console.error('Chunk insert error:', error)
        throw new Error(`Failed to store document chunks: ${error.message}`)
    }

    // 4. Update document count
    const { count } = await supabase
        .from('ai_knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)

    await supabase
        .from('ai_knowledge_bases')
        .update({ document_count: count ?? chunks.length })
        .eq('id', knowledgeBaseId)

    return { chunksCreated: chunks.length }
}

/* ---------- RAG Query ---------- */

export async function queryRAG(
    query: string,
    knowledgeBaseId: string | null,
    meetingContext: {
        objective?: string | null
        flow?: AIFlowStep[] | null
        currentFlowStep?: number
        chatHistory?: Array<{ role: string; text: string }>
    }
): Promise<ReadableStream<Uint8Array>> {
    // 1. Retrieve relevant chunks (if knowledge base exists)
    let retrievedChunks: RetrievedChunk[] = []

    if (knowledgeBaseId) {
        retrievedChunks = await searchKnowledge(query, knowledgeBaseId)
    }

    // 2. Build the system prompt
    const systemPrompt = buildSystemPrompt(
        meetingContext.objective,
        meetingContext.flow,
        meetingContext.currentFlowStep,
        retrievedChunks
    )

    // 3. Build conversation messages
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]

    // Add recent chat history for context
    if (meetingContext.chatHistory) {
        const recentHistory = meetingContext.chatHistory.slice(-6)
        for (const msg of recentHistory) {
            messages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.text,
            })
        }
    }

    messages.push({ role: 'user', content: query })

    // 4. Stream the LLM response
    return chatCompletionStream(messages, {
        temperature: 0.5,
        maxTokens: 800,
    })
}

export async function queryRAGNonStreaming(
    query: string,
    knowledgeBaseId: string | null,
    meetingContext: {
        objective?: string | null
        flow?: AIFlowStep[] | null
        currentFlowStep?: number
        chatHistory?: Array<{ role: string; text: string }>
    }
): Promise<string> {
    let retrievedChunks: RetrievedChunk[] = []

    if (knowledgeBaseId) {
        retrievedChunks = await searchKnowledge(query, knowledgeBaseId)
    }

    const systemPrompt = buildSystemPrompt(
        meetingContext.objective,
        meetingContext.flow,
        meetingContext.currentFlowStep,
        retrievedChunks
    )

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]

    if (meetingContext.chatHistory) {
        const recentHistory = meetingContext.chatHistory.slice(-6)
        for (const msg of recentHistory) {
            messages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.text,
            })
        }
    }

    messages.push({ role: 'user', content: query })

    return chatCompletion(messages, {
        temperature: 0.5,
        maxTokens: 800,
    })
}

/* ---------- Knowledge Search ---------- */

async function searchKnowledge(
    query: string,
    knowledgeBaseId: string
): Promise<RetrievedChunk[]> {
    const supabase = getSupabaseClient()

    // 1. Embed the query
    const queryEmbedding = await generateEmbedding(query)

    // 2. Call the vector similarity search function
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_knowledge_base_id: knowledgeBaseId,
        match_threshold: 0.5,
        match_count: 5,
    })

    if (error) {
        console.error('Vector search error:', error)
        return []
    }

    return (data || []) as RetrievedChunk[]
}

/* ---------- System Prompt Builder ---------- */

function buildSystemPrompt(
    objective?: string | null,
    flow?: AIFlowStep[] | null,
    currentFlowStep?: number,
    retrievedChunks?: RetrievedChunk[]
): string {
    const parts: string[] = []

    parts.push(
        `You are an intelligent meeting assistant embedded in a video call. ` +
        `You help the host navigate the conversation, provide relevant information, ` +
        `suggest questions, and ensure the meeting stays on track. ` +
        `Be concise, professional, and actionable. Use bullet points when helpful. ` +
        `Never mention that you are an AI or that you retrieved information from a knowledge base — ` +
        `present everything naturally as expert knowledge.`
    )

    if (objective) {
        parts.push(`\n## Meeting Objective\n${objective}`)
    }

    if (flow && flow.length > 0) {
        parts.push(`\n## Conversation Flow`)
        for (const step of flow) {
            const marker = currentFlowStep !== undefined && step.step_number === currentFlowStep
                ? '→ (CURRENT STEP)'
                : ''
            parts.push(`${step.step_number}. **${step.title}** ${marker}\n   ${step.description}`)
        }
    }

    if (retrievedChunks && retrievedChunks.length > 0) {
        parts.push(`\n## Relevant Knowledge`)
        for (const chunk of retrievedChunks) {
            const source = chunk.source_name ? ` [Source: ${chunk.source_name}]` : ''
            parts.push(`---\n${chunk.content}${source}\n`)
        }
    }

    return parts.join('\n')
}

/* ---------- Meeting Summary Generator ---------- */

export async function generateMeetingSummary(
    meetingId: string,
    chatHistory: Array<{ name: string; text: string; timestamp: string }>,
    objective?: string | null,
    flow?: AIFlowStep[] | null
): Promise<MeetingNotes> {
    const systemPrompt = `You are a meeting summarizer. Given the meeting chat transcript and context, generate a comprehensive meeting summary in JSON format.

The JSON must have these exact fields:
- "summary": A 2-3 sentence overview of what was discussed
- "key_points": Array of strings — the main topics/ideas discussed
- "action_items": Array of strings — tasks that need to be done next (include who if mentioned)
- "decisions_made": Array of strings — any decisions or agreements reached
- "next_steps": Array of strings — planned follow-up actions

If a section has no items, use an empty array. Be concise and specific. Return ONLY valid JSON, no markdown.`

    const contextParts: string[] = []

    if (objective) {
        contextParts.push(`Meeting Objective: ${objective}`)
    }

    if (flow && flow.length > 0) {
        contextParts.push(`Planned Flow: ${flow.map((s) => s.title).join(' → ')}`)
    }

    if (chatHistory.length > 0) {
        contextParts.push(`\nChat Transcript:`)
        for (const msg of chatHistory) {
            contextParts.push(`[${msg.timestamp}] ${msg.name}: ${msg.text}`)
        }
    } else {
        contextParts.push(`\nNote: No chat messages were recorded in this meeting.`)
    }

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextParts.join('\n') },
    ]

    const response = await chatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 1200,
    })

    // Parse the JSON response
    try {
        const parsed = JSON.parse(response)
        const notes: MeetingNotes = {
            summary: parsed.summary || 'Meeting completed.',
            key_points: parsed.key_points || [],
            action_items: parsed.action_items || [],
            decisions_made: parsed.decisions_made || [],
            next_steps: parsed.next_steps || [],
            generated_at: new Date().toISOString(),
        }

        // Store in database
        const supabase = getSupabaseClient()
        await supabase
            .from('meetings')
            .update({
                ai_summary: notes.summary,
                ai_meeting_notes: notes,
            })
            .eq('id', meetingId)

        return notes
    } catch (parseError) {
        console.error('Failed to parse meeting summary JSON:', parseError)
        // Return a basic summary
        const notes: MeetingNotes = {
            summary: response.substring(0, 500),
            key_points: [],
            action_items: [],
            decisions_made: [],
            next_steps: [],
            generated_at: new Date().toISOString(),
        }

        const supabase = getSupabaseClient()
        await supabase
            .from('meetings')
            .update({
                ai_summary: notes.summary,
                ai_meeting_notes: notes,
            })
            .eq('id', meetingId)

        return notes
    }
}
