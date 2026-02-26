export interface ChatMessage {
    id: string
    peerId: string
    name: string
    text: string
    timestamp: string
    isLocal: boolean
}

interface CreateChatMessageInput {
    id?: string
    peerId: string
    name: string
    text: string
    timestamp?: string
    isLocal?: boolean
}

export const DEFAULT_CHAT_HISTORY_LIMIT = 150

function createChatMessageId() {
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createChatMessage(input: CreateChatMessageInput): ChatMessage | null {
    const text = input.text.trim()
    if (!text) {
        return null
    }

    return {
        id: input.id || createChatMessageId(),
        peerId: input.peerId,
        name: input.name.trim() || 'Guest',
        text,
        timestamp: input.timestamp || new Date().toISOString(),
        isLocal: Boolean(input.isLocal),
    }
}

export function appendChatMessage(
    existing: ChatMessage[],
    message: ChatMessage,
    maxMessages: number = DEFAULT_CHAT_HISTORY_LIMIT
) {
    if (maxMessages <= 0) {
        return []
    }

    const nextMessages = [...existing, message]
    if (nextMessages.length <= maxMessages) {
        return nextMessages
    }

    return nextMessages.slice(nextMessages.length - maxMessages)
}
