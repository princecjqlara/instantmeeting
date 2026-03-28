/**
 * AIAssistantPanel — In-call AI assistant sidebar
 *
 * Host-only panel that provides:
 * - Flow progress tracker with clickable steps
 * - AI chat with RAG-powered responses (streaming)
 * - Quick suggestion chips
 * - Meeting summary generation
 *
 * Invisible to guests — only shown when session.user exists.
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    FaBrain,
    FaPaperPlane,
    FaClipboardList,
    FaCheck,
    FaSpinner,
    FaFileAlt,
    FaLightbulb,
    FaListOl,
    FaArrowRight,
    FaTasks,
    FaChevronRight,
    FaDatabase,
    FaMicrophone,
    FaMicrophoneSlash,
} from 'react-icons/fa'
import styles from './AIAssistantPanel.module.css'

interface FlowStep {
    step_number: number
    title: string
    description: string
    suggested_questions?: string[]
}

interface AIMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
}

interface MeetingNotes {
    summary: string
    key_points: string[]
    action_items: string[]
    decisions_made: string[]
    next_steps: string[]
    generated_at: string
}

interface ChatHistoryMessage {
    name: string
    text: string
    timestamp: string
}

interface AIAssistantPanelProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    chatMessages?: ChatHistoryMessage[]
    guestTranscript?: string | null
    startGuestRecognition?: () => void
    stopGuestRecognition?: () => void
    clearGuestTranscript?: () => void
}

export default function AIAssistantPanel({
    isOpen,
    onClose,
    roomId,
    chatMessages = [],
    guestTranscript = null,
    startGuestRecognition,
    stopGuestRecognition,
    clearGuestTranscript,
}: AIAssistantPanelProps) {
    const [activeTab, setActiveTab] = useState<'chat' | 'flow' | 'summary'>('chat')
    const [messages, setMessages] = useState<AIMessage[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [objective, setObjective] = useState<string | null>(null)
    const [flowSteps, setFlowSteps] = useState<FlowStep[]>([])
    const [currentFlowStep, setCurrentFlowStep] = useState(0)
    const [knowledgeBaseName, setKnowledgeBaseName] = useState<string | null>(null)
    const [meetingNotes, setMeetingNotes] = useState<MeetingNotes | null>(null)
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
    const [isRecordingGuest, setIsRecordingGuest] = useState(false)

    const chatScrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Load meeting AI config on mount
    useEffect(() => {
        if (!roomId) return

        fetch(`/api/ai/meeting-config?meetingId=${roomId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.ai_objective) setObjective(data.ai_objective)
                if (data.ai_flow) setFlowSteps(data.ai_flow)
            })
            .catch(() => {
                // Config not found — that's fine
            })
    }, [roomId])

    // Auto-scroll chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
        }
    }, [messages])

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && activeTab === 'chat') {
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen, activeTab])

    // Send message to AI
    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return

            const userMsg: AIMessage = {
                id: `u-${Date.now()}`,
                role: 'user',
                content: text.trim(),
            }

            setMessages((prev) => [...prev, userMsg])
            setInput('')
            setIsLoading(true)

            // Build chat history for context
            const aiChatHistory = messages.slice(-6).map((m) => ({
                role: m.role,
                text: m.content,
            }))

            try {
                const response = await fetch('/api/ai/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: text.trim(),
                        meetingId: roomId,
                        currentFlowStep,
                        chatHistory: aiChatHistory,
                    }),
                })

                if (!response.ok) {
                    throw new Error('AI query failed')
                }

                const reader = response.body?.getReader()
                if (!reader) throw new Error('No response stream')

                const decoder = new TextDecoder()
                const aiMsgId = `a-${Date.now()}`

                // Add empty assistant message
                setMessages((prev) => [
                    ...prev,
                    { id: aiMsgId, role: 'assistant', content: '' },
                ])

                // Stream the response
                let fullContent = ''
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split('\n')

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed || !trimmed.startsWith('data: ')) continue
                        try {
                            const parsed = JSON.parse(trimmed.slice(6))
                            if (parsed.content) {
                                fullContent += parsed.content
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === aiMsgId
                                            ? { ...m, content: fullContent }
                                            : m
                                    )
                                )
                            }
                        } catch {
                            // Skip malformed SSE lines
                        }
                    }
                }
            } catch (error) {
                console.error('AI chat error:', error)
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `e-${Date.now()}`,
                        role: 'assistant',
                        content:
                            '⚠️ Sorry, I couldn\'t process that. Please try again.',
                    },
                ])
            } finally {
                setIsLoading(false)
            }
        },
        [isLoading, messages, roomId, currentFlowStep]
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        sendMessage(input)
    }

    const toggleRecordGuest = () => {
        if (!isRecordingGuest) {
            setIsRecordingGuest(true)
            startGuestRecognition?.()
        } else {
            setIsRecordingGuest(false)
            stopGuestRecognition?.()
        }
    }

    useEffect(() => {
        if (guestTranscript) {
            sendMessage(`Guest said: "${guestTranscript}"`)
            clearGuestTranscript?.()
            setIsRecordingGuest(false)
        }
    }, [guestTranscript, sendMessage, clearGuestTranscript])

    const generateSummary = async () => {
        setIsGeneratingSummary(true)
        try {
            const response = await fetch('/api/ai/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId: roomId,
                    chatHistory: chatMessages,
                    forceRegenerate: !!meetingNotes,
                }),
            })

            if (!response.ok) throw new Error('Failed')

            const notes: MeetingNotes = await response.json()
            setMeetingNotes(notes)
        } catch (error) {
            console.error('Summary error:', error)
        } finally {
            setIsGeneratingSummary(false)
        }
    }

    // Default suggestions based on current flow step
    const suggestions =
        flowSteps[currentFlowStep]?.suggested_questions || [
            'What should I cover next?',
            'Summarize key points so far',
            'Help me handle an objection',
        ]

    return (
        <aside className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
            {/* ─── Header ──────────────────────────────────────────────────── */}
            <div className={styles.header}>
                <div className={styles.headerIcon}>
                    <FaBrain />
                </div>
                <div className={styles.headerText}>
                    <h3>AI Assistant</h3>
                    <span>Powered by NVIDIA NIM</span>
                </div>
                {knowledgeBaseName && (
                    <div className={styles.knowledgeBadge}>
                        <FaDatabase /> {knowledgeBaseName}
                    </div>
                )}
                <button className={styles.closeBtn} onClick={onClose}>
                    Close
                </button>
            </div>

            {/* ─── Tabs ────────────────────────────────────────────────────── */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'chat' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <FaLightbulb style={{ marginRight: 4 }} /> Chat
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'flow' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('flow')}
                >
                    <FaListOl style={{ marginRight: 4 }} /> Flow
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    <FaClipboardList style={{ marginRight: 4 }} /> Summary
                </button>
            </div>

            {/* ─── Objective Banner ────────────────────────────────────────── */}
            {objective && activeTab !== 'summary' && (
                <div className={styles.objectiveBanner}>
                    <label>🎯 Objective</label>
                    <p>{objective}</p>
                </div>
            )}

            {/* ─── Chat Tab ────────────────────────────────────────────────── */}
            {activeTab === 'chat' && (
                <>
                    <div ref={chatScrollRef} className={styles.chatArea}>
                        {messages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>🤖</div>
                                <p>
                                    Ask me anything about the meeting.
                                    <br />
                                    I&apos;ll use your knowledge base and
                                    objectives for context.
                                </p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={
                                        msg.role === 'user'
                                            ? styles.msgUser
                                            : styles.msgAI
                                    }
                                    dangerouslySetInnerHTML={
                                        msg.role === 'assistant'
                                            ? {
                                                  __html: formatAIResponse(
                                                      msg.content
                                                  ),
                                              }
                                            : undefined
                                    }
                                >
                                    {msg.role === 'user' ? msg.content : undefined}
                                </div>
                            ))
                        )}
                        {isLoading && messages[messages.length - 1]?.content === '' && (
                            <div className={styles.typing}>
                                <div className={styles.typingDot} />
                                <div className={styles.typingDot} />
                                <div className={styles.typingDot} />
                            </div>
                        )}
                    </div>

                    {/* Suggestions */}
                    {messages.length < 3 && (
                        <div className={styles.suggestions}>
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    className={styles.suggestionChip}
                                    onClick={() => sendMessage(s)}
                                    disabled={isLoading}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <form className={styles.inputArea} onSubmit={handleSubmit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask your AI assistant..."
                            maxLength={500}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className={`${styles.recordBtn} ${isRecordingGuest ? styles.recordingActive : ''}`}
                            onClick={toggleRecordGuest}
                            title={isRecordingGuest ? "Stop Recording Guest" : "Record Guest Speech"}
                        >
                            {isRecordingGuest ? <FaMicrophoneSlash className={styles.pulseIcon} /> : <FaMicrophone />}
                        </button>
                        <button
                            type="submit"
                            className={styles.sendBtn}
                            disabled={!input.trim() || isLoading}
                        >
                            {isLoading ? <FaSpinner className="spin" /> : <FaPaperPlane />}
                        </button>
                    </form>
                </>
            )}

            {/* ─── Flow Tab ────────────────────────────────────────────────── */}
            {activeTab === 'flow' && (
                <div className={styles.flowTracker} style={{ flex: 1, overflowY: 'auto' }}>
                    {flowSteps.length === 0 ? (
                        <div className={styles.emptyState} style={{ padding: 40 }}>
                            <FaListOl style={{ fontSize: 28, opacity: 0.3 }} />
                            <p>
                                No conversation flow configured.
                                <br />
                                Set one up from your dashboard before the call.
                            </p>
                        </div>
                    ) : (
                        <>
                            <h4>Conversation Flow</h4>
                            <div className={styles.flowSteps}>
                                {flowSteps.map((step, i) => (
                                    <div
                                        key={step.step_number}
                                        className={`${styles.flowStep} ${
                                            i === currentFlowStep
                                                ? styles.flowStepActive
                                                : ''
                                        } ${
                                            i < currentFlowStep
                                                ? styles.flowStepCompleted
                                                : ''
                                        }`}
                                        onClick={() => setCurrentFlowStep(i)}
                                    >
                                        <div
                                            className={`${styles.flowStepDot} ${
                                                i === currentFlowStep
                                                    ? styles.flowStepDotActive
                                                    : ''
                                            } ${
                                                i < currentFlowStep
                                                    ? styles.flowStepDotDone
                                                    : ''
                                            }`}
                                        >
                                            {i < currentFlowStep ? (
                                                <FaCheck />
                                            ) : i === currentFlowStep ? (
                                                <FaArrowRight />
                                            ) : (
                                                step.step_number
                                            )}
                                        </div>
                                        <div className={styles.flowStepInfo}>
                                            <h5>{step.title}</h5>
                                            <p>{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {currentFlowStep < flowSteps.length - 1 && (
                                <button
                                    className={styles.generateBtn}
                                    style={{ marginTop: 12 }}
                                    onClick={() =>
                                        setCurrentFlowStep((prev) => prev + 1)
                                    }
                                >
                                    <FaChevronRight /> Next Step
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ─── Summary Tab ─────────────────────────────────────────────── */}
            {activeTab === 'summary' && (
                <div className={styles.summaryTab}>
                    {!meetingNotes ? (
                        <div className={styles.summaryEmpty}>
                            <FaFileAlt style={{ fontSize: 32, opacity: 0.3 }} />
                            <p>
                                Generate an AI-powered summary of your meeting
                                with key points, action items, and next steps.
                            </p>
                            <button
                                className={styles.generateBtn}
                                onClick={generateSummary}
                                disabled={isGeneratingSummary}
                            >
                                {isGeneratingSummary ? (
                                    <>
                                        <FaSpinner className="spin" /> Generating...
                                    </>
                                ) : (
                                    <>
                                        <FaBrain /> Generate Meeting Notes
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            <div className={styles.summarySection}>
                                <h4>
                                    <FaFileAlt /> Summary
                                </h4>
                                <p>{meetingNotes.summary}</p>
                            </div>

                            {/* Key Points */}
                            {meetingNotes.key_points.length > 0 && (
                                <div className={styles.summarySection}>
                                    <h4>
                                        <FaLightbulb /> Key Points
                                    </h4>
                                    <ul>
                                        {meetingNotes.key_points.map((pt, i) => (
                                            <li key={i}>{pt}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Action Items */}
                            {meetingNotes.action_items.length > 0 && (
                                <div className={styles.summarySection}>
                                    <h4>
                                        <FaTasks /> Action Items
                                    </h4>
                                    <ul>
                                        {meetingNotes.action_items.map((item, i) => (
                                            <li key={i} className={styles.actionItem}>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Decisions */}
                            {meetingNotes.decisions_made.length > 0 && (
                                <div className={styles.summarySection}>
                                    <h4>
                                        <FaCheck /> Decisions Made
                                    </h4>
                                    <ul>
                                        {meetingNotes.decisions_made.map(
                                            (d, i) => (
                                                <li key={i}>{d}</li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Next Steps */}
                            {meetingNotes.next_steps.length > 0 && (
                                <div className={styles.summarySection}>
                                    <h4>
                                        <FaArrowRight /> Next Steps
                                    </h4>
                                    <ul>
                                        {meetingNotes.next_steps.map((ns, i) => (
                                            <li key={i}>{ns}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Regenerate Button */}
                            <button
                                className={styles.generateBtn}
                                onClick={generateSummary}
                                disabled={isGeneratingSummary}
                                style={{ alignSelf: 'center', marginTop: 4 }}
                            >
                                {isGeneratingSummary ? (
                                    <>
                                        <FaSpinner className="spin" />{' '}
                                        Regenerating...
                                    </>
                                ) : (
                                    <>
                                        <FaBrain /> Regenerate Notes
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            )}
        </aside>
    )
}

/* ---------- Helpers ---------- */

function formatAIResponse(content: string): string {
    if (!content) return ''

    let html = content
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Unordered lists
        .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
        // Numbered lists
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Paragraphs
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>')

    // Wrap consecutive <li> in <ul>
    html = html.replace(
        /(<li>.*?<\/li>(?:\s*<br\/?>\s*)?)+/g,
        (match) => `<ul>${match.replace(/<br\/?>/g, '')}</ul>`
    )

    return html
}
