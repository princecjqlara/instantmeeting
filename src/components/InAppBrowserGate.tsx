'use client'

import { useEffect, useState } from 'react'

/**
 * Detects in-app browsers (Messenger, Facebook, Instagram, etc.)
 * and attempts to auto-redirect to the system browser.
 *
 * On Android: tries intent:// URL to open Chrome, then falls back to UI.
 * On iOS: no reliable auto-redirect — shows UI prompt immediately.
 *
 * If not an in-app browser, renders children normally.
 */

const IN_APP_REGEX = /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|WhatsApp|Viber|Pinterest|LinkedIn/i

function isInAppBrowser(): boolean {
    if (typeof navigator === 'undefined') return false
    return IN_APP_REGEX.test(navigator.userAgent || '')
}

function isAndroid(): boolean {
    if (typeof navigator === 'undefined') return false
    return /android/i.test(navigator.userAgent || '')
}

function tryOpenSystemBrowser(url: string): void {
    if (isAndroid()) {
        // Android: intent URL scheme to open in Chrome
        const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
        window.location.href = intentUrl
    } else {
        // iOS / other: try _system target (works in some WebViews)
        window.open(url, '_system')
    }
    // Also copy to clipboard as fallback
    navigator.clipboard?.writeText(url).catch(() => {})
}

export default function InAppBrowserGate({ children }: { children: React.ReactNode }) {
    const [showGate, setShowGate] = useState(false)
    const [attempted, setAttempted] = useState(false)

    useEffect(() => {
        if (!isInAppBrowser()) return

        // Try auto-redirect on Android
        if (isAndroid() && !attempted) {
            setAttempted(true)
            tryOpenSystemBrowser(window.location.href)
            // Show fallback UI after a short delay (in case redirect didn't work)
            const timer = setTimeout(() => setShowGate(true), 1500)
            return () => clearTimeout(timer)
        }

        // iOS or other: show gate immediately
        setShowGate(true)
    }, [attempted])

    if (!showGate) return <>{children}</>

    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0f',
            padding: '24px',
        }}>
            <div style={{
                background: 'rgba(20, 20, 31, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '40px 32px',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
            }}>
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff9f43 0%, #ee5a24 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                }}>
                    🌐
                </div>

                <h2 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: 700 }}>
                    Open in Browser
                </h2>

                <p style={{ color: '#9ca0b3', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                    This in-app browser doesn&apos;t support camera and microphone.
                    Please open this link in Chrome or Safari.
                </p>

                <button
                    onClick={() => tryOpenSystemBrowser(currentUrl)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Open in Browser
                </button>

                <div style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}>
                    <p style={{ color: '#8b8fa3', fontSize: '12px', margin: 0 }}>
                        Or copy this link and paste in your browser:
                    </p>
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                    }}>
                        <code style={{
                            flex: 1,
                            padding: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '6px',
                            color: '#667eea',
                            fontSize: '11px',
                            wordBreak: 'break-all',
                            textAlign: 'left',
                        }}>
                            {currentUrl}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard?.writeText(currentUrl)
                                    .then(() => alert('Link copied!'))
                                    .catch(() => {})
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'rgba(255,255,255,0.1)',
                                color: '#ccc',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Copy
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => setShowGate(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b6f83',
                        fontSize: '12px',
                        cursor: 'pointer',
                        marginTop: '4px',
                    }}
                >
                    Continue anyway (limited features)
                </button>
            </div>
        </div>
    )
}
