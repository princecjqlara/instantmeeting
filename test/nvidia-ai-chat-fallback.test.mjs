import test from 'node:test'
import assert from 'node:assert/strict'

import { chatCompletion, chatCompletionStream } from '../src/lib/nvidia-ai.ts'

async function readStream(stream) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let output = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += decoder.decode(value, { stream: true })
    }

    output += decoder.decode()
    return output
}

test('chatCompletion retries with a fallback NVIDIA model after a 503', async () => {
    const originalFetch = global.fetch
    const originalApiKey = process.env.NVIDIA_API_KEY
    const requestedModels = []

    process.env.NVIDIA_API_KEY = 'test-key'
    global.fetch = async (_url, options) => {
        const body = JSON.parse(String(options.body))
        requestedModels.push(body.model)

        if (requestedModels.length === 1) {
            return new Response('temporarily unavailable', { status: 503 })
        }

        return new Response(
            JSON.stringify({
                choices: [{ message: { content: 'fallback succeeded' } }],
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }

    try {
        const result = await chatCompletion([{ role: 'user', content: 'Build a lead form' }])

        assert.equal(result, 'fallback succeeded')
        assert.equal(requestedModels.length, 2)
        assert.equal(requestedModels[0], 'meta/llama-3.1-405b-instruct')
        assert.equal(requestedModels[1], 'meta/llama-3.3-70b-instruct')
        assert.notEqual(requestedModels[0], requestedModels[1])
    } finally {
        global.fetch = originalFetch
        if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY
        else process.env.NVIDIA_API_KEY = originalApiKey
    }
})

test('chatCompletionStream retries with a fallback NVIDIA model after a 503', async () => {
    const originalFetch = global.fetch
    const originalApiKey = process.env.NVIDIA_API_KEY
    const requestedModels = []

    process.env.NVIDIA_API_KEY = 'test-key'
    global.fetch = async (_url, options) => {
        const body = JSON.parse(String(options.body))
        requestedModels.push(body.model)

        if (requestedModels.length === 1) {
            return new Response('temporarily unavailable', { status: 503 })
        }

        const encoder = new TextEncoder()
        const upstream = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        'data: {"choices":[{"delta":{"content":"stream fallback"}}]}\n\n'
                    )
                )
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
            },
        })

        return new Response(upstream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        })
    }

    try {
        const stream = await chatCompletionStream([{ role: 'user', content: 'Build a lead form' }])
        const output = await readStream(stream)

        assert.match(output, /stream fallback/)
        assert.equal(requestedModels.length, 2)
        assert.equal(requestedModels[0], 'meta/llama-3.1-405b-instruct')
        assert.equal(requestedModels[1], 'meta/llama-3.3-70b-instruct')
    } finally {
        global.fetch = originalFetch
        if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY
        else process.env.NVIDIA_API_KEY = originalApiKey
    }
})

test('chatCompletion stops on a non-retriable 404 response', async () => {
    const originalFetch = global.fetch
    const originalApiKey = process.env.NVIDIA_API_KEY
    const requestedModels = []

    process.env.NVIDIA_API_KEY = 'test-key'
    global.fetch = async (_url, options) => {
        const body = JSON.parse(String(options.body))
        requestedModels.push(body.model)
        return new Response('missing model', { status: 404 })
    }

    try {
        await assert.rejects(
            chatCompletion([{ role: 'user', content: 'Build a lead form' }]),
            /Chat API error: 404/
        )
        assert.deepEqual(requestedModels, ['meta/llama-3.1-405b-instruct'])
    } finally {
        global.fetch = originalFetch
        if (originalApiKey === undefined) delete process.env.NVIDIA_API_KEY
        else process.env.NVIDIA_API_KEY = originalApiKey
    }
})
