/**
 * Document Upload API
 * POST — Upload text content to a knowledge base (chunk + embed + store)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ingestDocument } from '@/lib/rag-pipeline'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: knowledgeBaseId } = await params

    const body = await req.json()
    const { content, sourceName } = body

    if (!content || typeof content !== 'string') {
        return NextResponse.json(
            { error: 'content (string) is required' },
            { status: 400 }
        )
    }

    if (content.length < 20) {
        return NextResponse.json(
            { error: 'Content too short (min 20 characters)' },
            { status: 400 }
        )
    }

    try {
        const result = await ingestDocument(
            knowledgeBaseId,
            content,
            sourceName || 'Uploaded Document'
        )

        return NextResponse.json({
            success: true,
            chunksCreated: result.chunksCreated,
        })
    } catch (error) {
        console.error('Document upload error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
            { status: 500 }
        )
    }
}
