/**
 * NVIDIA NIM API Integration
 *
 * Uses OpenAI-compatible endpoints at integrate.api.nvidia.com
 * - Chat: nvidia/llama-3.1-nemotron-70b-instruct
 * - Embeddings: nvidia/nv-embedqa-e5-v5 (1024-dim)
 */

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const CHAT_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct'
const EMBEDDING_MODEL = 'nvidia/nv-embedqa-e5-v5'

function getApiKey(): string {
    const key = process.env.NVIDIA_API_KEY?.trim()
    if (!key) {
        throw new Error('NVIDIA_API_KEY is not set in environment variables')
    }
    return key
}

/* ---------- Embeddings ---------- */

export async function generateEmbedding(text: string): Promise<number[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: [text.substring(0, 2048)], // Truncate to model max
            input_type: 'query',
            encoding_format: 'float',
            truncate: 'END',
        }),
        signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
        const errBody = await response.text()
        console.error('NVIDIA Embedding API error:', response.status, errBody)
        throw new Error(`Embedding API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data[0].embedding as number[]
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Batch up to 50 at a time
    const batchSize = 50
    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize).map((t) => t.substring(0, 2048))

        const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getApiKey()}`,
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: batch,
                input_type: 'passage',
                encoding_format: 'float',
                truncate: 'END',
            }),
        })

        if (!response.ok) {
            const errBody = await response.text()
            console.error('NVIDIA Embedding batch error:', response.status, errBody)
            throw new Error(`Embedding API error: ${response.status}`)
        }

        const data = await response.json()
        const embeddings = data.data
            .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
            .map((d: { embedding: number[] }) => d.embedding)

        allEmbeddings.push(...embeddings)
    }

    return allEmbeddings
}

/* ---------- Chat Completions ---------- */

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export async function chatCompletion(
    messages: ChatMessage[],
    options: {
        temperature?: number
        maxTokens?: number
        stream?: false
    } = {}
): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            temperature: options.temperature ?? 0.6,
            max_tokens: options.maxTokens ?? 1024,
            stream: false,
        }),
        signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
        const errBody = await response.text()
        console.error('NVIDIA Chat API error:', response.status, errBody)
        throw new Error(`Chat API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content as string
}

export async function chatCompletionStream(
    messages: ChatMessage[],
    options: {
        temperature?: number
        maxTokens?: number
    } = {}
): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            temperature: options.temperature ?? 0.6,
            max_tokens: options.maxTokens ?? 1024,
            stream: true,
        }),
        signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
        const errBody = await response.text()
        console.error('NVIDIA Chat stream error:', response.status, errBody)
        throw new Error(`Chat API error: ${response.status}`)
    }

    if (!response.body) {
        throw new Error('No response body for streaming')
    }

    // Transform the SSE stream from NVIDIA into a clean text stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            while (true) {
                const { done, value } = await reader.read()
                if (done) {
                    controller.close()
                    return
                }

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n')

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || !trimmed.startsWith('data: ')) continue
                    const jsonStr = trimmed.slice(6)
                    if (jsonStr === '[DONE]') {
                        controller.close()
                        return
                    }

                    try {
                        const parsed = JSON.parse(jsonStr)
                        const content = parsed.choices?.[0]?.delta?.content
                        if (content) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                            )
                        }
                    } catch {
                        // Skip malformed chunks
                    }
                }
            }
        },
        cancel() {
            reader.cancel()
        },
    })
}

/* ---------- Document Chunking ---------- */

export function chunkDocument(
    text: string,
    chunkSize = 500,
    chunkOverlap = 100
): string[] {
    const chunks: string[] = []

    if (text.length <= chunkSize) {
        return [text.trim()].filter(Boolean)
    }

    let start = 0
    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length)

        // Try to break at sentence boundary
        if (end < text.length) {
            const lastPeriod = text.lastIndexOf('. ', end)
            const lastNewline = text.lastIndexOf('\n', end)
            const breakPoint = Math.max(lastPeriod, lastNewline)

            if (breakPoint > start + chunkSize * 0.5) {
                end = breakPoint + 1
            }
        }

        const chunk = text.slice(start, end).trim()
        if (chunk.length > 20) {
            chunks.push(chunk)
        }

        start = end - chunkOverlap
        if (start >= text.length) break
    }

    return chunks
}
