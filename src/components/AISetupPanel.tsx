/**
 * AISetupPanel — Pre-call AI configuration modal
 *
 * Allows the host to configure:
 * - Meeting objective (what's the goal?)
 * - Conversation flow (step-by-step plan)
 * - Knowledge base selection + document upload
 *
 * Saves everything to the meeting record via API.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    FaBrain,
    FaTimes,
    FaPlus,
    FaTrash,
    FaUpload,
    FaSave,
    FaSpinner,
    FaCheck,
    FaDatabase,
    FaCloudUploadAlt,
} from 'react-icons/fa'
import styles from './AISetupPanel.module.css'

interface FlowStep {
    step_number: number
    title: string
    description: string
}

interface KnowledgeBase {
    id: string
    name: string
    description: string | null
    document_count: number
}

interface AISetupPanelProps {
    isOpen: boolean
    onClose: () => void
    meetingId: string
}

export default function AISetupPanel({
    isOpen,
    onClose,
    meetingId,
}: AISetupPanelProps) {
    const [objective, setObjective] = useState('')
    const [flowSteps, setFlowSteps] = useState<FlowStep[]>([
        { step_number: 1, title: '', description: '' },
    ])
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
    const [selectedKBId, setSelectedKBId] = useState<string>('')
    const [newKBName, setNewKBName] = useState('')
    const [isCreatingKB, setIsCreatingKB] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState('')
    const [saveStatus, setSaveStatus] = useState('')

    // Load existing config + knowledge bases
    useEffect(() => {
        if (!isOpen) return

        // Load meeting config
        fetch(`/api/ai/meeting-config?meetingId=${meetingId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.ai_objective) setObjective(data.ai_objective)
                if (data.ai_flow && data.ai_flow.length > 0) {
                    setFlowSteps(data.ai_flow)
                }
                if (data.ai_knowledge_base_id) {
                    setSelectedKBId(data.ai_knowledge_base_id)
                }
            })
            .catch(() => {})

        // Load knowledge bases
        fetch('/api/ai/knowledge-base')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setKnowledgeBases(data)
                }
            })
            .catch(() => {})
    }, [isOpen, meetingId])

    // Add flow step
    const addFlowStep = () => {
        setFlowSteps((prev) => [
            ...prev,
            {
                step_number: prev.length + 1,
                title: '',
                description: '',
            },
        ])
    }

    // Remove flow step
    const removeFlowStep = (index: number) => {
        setFlowSteps((prev) => {
            const updated = prev.filter((_, i) => i !== index)
            return updated.map((s, i) => ({ ...s, step_number: i + 1 }))
        })
    }

    // Update flow step
    const updateFlowStep = (
        index: number,
        field: 'title' | 'description',
        value: string
    ) => {
        setFlowSteps((prev) =>
            prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
        )
    }

    // Create new knowledge base
    const createKB = async () => {
        if (!newKBName.trim()) return
        setIsCreatingKB(true)

        try {
            const res = await fetch('/api/ai/knowledge-base', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKBName.trim() }),
            })

            if (!res.ok) throw new Error('Failed')

            const kb = await res.json()
            setKnowledgeBases((prev) => [kb, ...prev])
            setSelectedKBId(kb.id)
            setNewKBName('')
        } catch (error) {
            console.error('Create KB error:', error)
        } finally {
            setIsCreatingKB(false)
        }
    }

    // Handle file upload
    const handleFileUpload = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (!file || !selectedKBId) return

            setIsUploading(true)
            setUploadStatus('')

            try {
                const text = await file.text()

                const res = await fetch(
                    `/api/ai/knowledge-base/${selectedKBId}/upload`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: text,
                            sourceName: file.name,
                        }),
                    }
                )

                if (!res.ok) throw new Error('Upload failed')

                const data = await res.json()
                setUploadStatus(
                    `✓ ${file.name} — ${data.chunksCreated} chunks embedded`
                )

                // Refresh KB list to update document count
                const kbRes = await fetch('/api/ai/knowledge-base')
                const kbData = await kbRes.json()
                if (Array.isArray(kbData)) {
                    setKnowledgeBases(kbData)
                }
            } catch (error) {
                console.error('Upload error:', error)
                setUploadStatus('✗ Upload failed. Try again.')
            } finally {
                setIsUploading(false)
                // Reset file input
                event.target.value = ''
            }
        },
        [selectedKBId]
    )

    // Save configuration
    const handleSave = async () => {
        setIsSaving(true)
        setSaveStatus('')

        try {
            // Filter out empty flow steps
            const validSteps = flowSteps.filter((s) => s.title.trim())

            const res = await fetch('/api/ai/meeting-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId,
                    objective: objective.trim() || null,
                    flow:
                        validSteps.length > 0
                            ? validSteps.map((s, i) => ({
                                  ...s,
                                  step_number: i + 1,
                              }))
                            : null,
                    knowledgeBaseId: selectedKBId || null,
                }),
            })

            if (!res.ok) throw new Error('Save failed')

            setSaveStatus('Saved!')
            setTimeout(() => {
                onClose()
                setSaveStatus('')
            }, 800)
        } catch (error) {
            console.error('Save error:', error)
            setSaveStatus('Failed to save')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className={styles.overlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
        }}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.modalIcon}>
                        <FaBrain />
                    </div>
                    <h2>AI Assistant Setup</h2>
                    <button className={styles.modalCloseBtn} onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                {/* Body */}
                <div className={styles.modalBody}>
                    {/* ─── Objective ─────────────────────────────────────── */}
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>
                            🎯 Meeting Objective
                        </label>
                        <p className={styles.sectionDesc}>
                            What&apos;s the primary goal of this meeting?
                        </p>
                        <div className={styles.textareaWrap}>
                            <textarea
                                value={objective}
                                onChange={(e) => setObjective(e.target.value)}
                                placeholder="e.g., Close the deal on Enterprise plan, Onboard new client, Product demo..."
                                maxLength={500}
                            />
                        </div>
                    </div>

                    {/* ─── Conversation Flow ─────────────────────────────── */}
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>
                            📋 Conversation Flow
                        </label>
                        <p className={styles.sectionDesc}>
                            Define the steps you want to follow during the
                            meeting
                        </p>
                        <div className={styles.flowBuilder}>
                            {flowSteps.map((step, i) => (
                                <div key={i} className={styles.flowItem}>
                                    <div className={styles.flowNum}>
                                        {step.step_number}
                                    </div>
                                    <div className={styles.flowItemInputs}>
                                        <input
                                            type="text"
                                            value={step.title}
                                            onChange={(e) =>
                                                updateFlowStep(
                                                    i,
                                                    'title',
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Step title (e.g., Introduction)"
                                            maxLength={100}
                                        />
                                        <input
                                            type="text"
                                            value={step.description}
                                            onChange={(e) =>
                                                updateFlowStep(
                                                    i,
                                                    'description',
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Brief description (optional)"
                                            maxLength={200}
                                        />
                                    </div>
                                    {flowSteps.length > 1 && (
                                        <button
                                            className={styles.removeStepBtn}
                                            onClick={() => removeFlowStep(i)}
                                            title="Remove step"
                                        >
                                            <FaTrash />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                className={styles.addStepBtn}
                                onClick={addFlowStep}
                            >
                                <FaPlus /> Add Step
                            </button>
                        </div>
                    </div>

                    {/* ─── Knowledge Base ────────────────────────────────── */}
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>
                            <FaDatabase /> Knowledge Base
                        </label>
                        <p className={styles.sectionDesc}>
                            Attach documents so the AI can reference your
                            materials during the call
                        </p>
                        <div className={styles.kbSelector}>
                            <select
                                className={styles.kbSelect}
                                value={selectedKBId}
                                onChange={(e) => setSelectedKBId(e.target.value)}
                            >
                                <option value="">
                                    None — No knowledge base
                                </option>
                                {knowledgeBases.map((kb) => (
                                    <option key={kb.id} value={kb.id}>
                                        {kb.name} ({kb.document_count} chunks)
                                    </option>
                                ))}
                            </select>

                            <div className={styles.kbActions}>
                                <input
                                    type="text"
                                    value={newKBName}
                                    onChange={(e) =>
                                        setNewKBName(e.target.value)
                                    }
                                    placeholder="New knowledge base name..."
                                    style={{
                                        flex: 1,
                                        padding: '8px 10px',
                                        background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '13px',
                                    }}
                                />
                                <button
                                    className={styles.kbNewBtn}
                                    onClick={createKB}
                                    disabled={
                                        !newKBName.trim() || isCreatingKB
                                    }
                                >
                                    {isCreatingKB ? (
                                        <FaSpinner className="spin" />
                                    ) : (
                                        <FaPlus />
                                    )}{' '}
                                    Create
                                </button>
                            </div>
                        </div>

                        {/* Document Upload */}
                        {selectedKBId && (
                            <div className={styles.uploadArea}>
                                <FaCloudUploadAlt
                                    className={styles.uploadIcon}
                                />
                                <p>
                                    {isUploading ? (
                                        <>
                                            <FaSpinner className="spin" />{' '}
                                            Uploading and embedding...
                                        </>
                                    ) : (
                                        <>
                                            <strong>
                                                Click or drag a file
                                            </strong>{' '}
                                            to upload (.txt, .md, .csv)
                                        </>
                                    )}
                                </p>
                                <input
                                    type="file"
                                    accept=".txt,.md,.csv,.json,.log"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                {uploadStatus && (
                                    <div className={styles.uploadStatus}>
                                        {uploadStatus}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.modalFooter}>
                    {saveStatus && (
                        <span
                            style={{
                                fontSize: 13,
                                color: saveStatus.includes('Saved')
                                    ? '#00ff88'
                                    : '#ff6b6b',
                                marginRight: 'auto',
                            }}
                        >
                            {saveStatus.includes('Saved') && <FaCheck />}{' '}
                            {saveStatus}
                        </span>
                    )}
                    <button className={styles.cancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <FaSpinner className="spin" /> Saving...
                            </>
                        ) : (
                            <>
                                <FaSave /> Save Configuration
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
