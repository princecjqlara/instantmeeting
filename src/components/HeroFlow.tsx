'use client'

import styles from './HeroFlow.module.css'

// A compact, animated line diagram that shows the product flow:
//   Form  →  Qualifier  →  [ Live room · Booking ]
// Draws vector paths with stroke-dashoffset keyframes so the
// connections appear to draw in, then streaming dots travel along
// each line to show live routing.

export default function HeroFlow() {
    return (
        <div className={styles.frame} aria-hidden>
            <svg
                viewBox="0 0 720 260"
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
                role="presentation"
            >
                <defs>
                    <linearGradient id="flowEdge" x1="0" x2="1">
                        <stop offset="0%" stopColor="rgba(214,235,253,0.05)" />
                        <stop offset="50%" stopColor="rgba(214,235,253,0.45)" />
                        <stop offset="100%" stopColor="rgba(214,235,253,0.05)" />
                    </linearGradient>
                    <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>
                </defs>

                {/* Connection paths */}
                <path
                    className={styles.edge}
                    d="M 170 130 L 330 130"
                    stroke="url(#flowEdge)"
                    strokeWidth="1"
                    fill="none"
                />
                <path
                    className={`${styles.edge} ${styles.edge2}`}
                    d="M 470 130 C 540 130, 560 70, 600 70"
                    stroke="url(#flowEdge)"
                    strokeWidth="1"
                    fill="none"
                />
                <path
                    className={`${styles.edge} ${styles.edge3}`}
                    d="M 470 130 C 540 130, 560 190, 600 190"
                    stroke="url(#flowEdge)"
                    strokeWidth="1"
                    fill="none"
                />

                {/* Traveling particles */}
                <circle r="2.2" fill="#f0f0f0" className={styles.particle1}>
                    <animateMotion dur="3.2s" repeatCount="indefinite">
                        <mpath href="#edge-main" />
                    </animateMotion>
                </circle>
                <circle r="2" fill="#11ff99" className={styles.particle2}>
                    <animateMotion dur="3.8s" repeatCount="indefinite" begin="1.2s">
                        <mpath href="#edge-up" />
                    </animateMotion>
                </circle>
                <circle r="2" fill="#3b9eff" className={styles.particle3}>
                    <animateMotion dur="4.2s" repeatCount="indefinite" begin="2.1s">
                        <mpath href="#edge-down" />
                    </animateMotion>
                </circle>

                {/* Hidden motion paths so <animateMotion> can reference them */}
                <path id="edge-main" d="M 170 130 L 330 130" fill="none" stroke="none" />
                <path id="edge-up" d="M 470 130 C 540 130, 560 70, 600 70" fill="none" stroke="none" />
                <path id="edge-down" d="M 470 130 C 540 130, 560 190, 600 190" fill="none" stroke="none" />

                {/* Node: Form */}
                <g transform="translate(70, 90)">
                    <rect
                        width="100"
                        height="80"
                        rx="10"
                        fill="rgba(255,255,255,0.02)"
                        stroke="rgba(214,235,253,0.19)"
                    />
                    <rect x="12" y="16" width="60" height="4" rx="2" fill="rgba(240,240,240,0.3)" />
                    <rect x="12" y="30" width="76" height="8" rx="2" fill="rgba(240,240,240,0.08)" />
                    <rect x="12" y="44" width="60" height="4" rx="2" fill="rgba(240,240,240,0.3)" />
                    <rect x="12" y="56" width="40" height="8" rx="2" fill="rgba(240,240,240,0.08)" />
                    <text
                        x="50"
                        y="104"
                        textAnchor="middle"
                        fill="rgba(240,240,240,0.65)"
                        fontSize="11"
                        fontFamily="Inter, system-ui, sans-serif"
                        fontWeight="500"
                    >
                        Form
                    </text>
                </g>

                {/* Node: Qualifier */}
                <g transform="translate(330, 90)">
                    <rect
                        width="140"
                        height="80"
                        rx="10"
                        fill="rgba(255,255,255,0.02)"
                        stroke="rgba(214,235,253,0.19)"
                    />
                    <circle cx="70" cy="40" r="14" fill="none" stroke="rgba(255,255,255,0.4)" />
                    <circle
                        cx="70"
                        cy="40"
                        r="14"
                        fill="none"
                        stroke="rgba(17,255,153,0.9)"
                        strokeWidth="2"
                        strokeDasharray="88"
                        strokeDashoffset="22"
                        className={styles.scoreRing}
                        transform="rotate(-90 70 40)"
                    />
                    <text
                        x="70"
                        y="44"
                        textAnchor="middle"
                        fill="#f0f0f0"
                        fontSize="10"
                        fontFamily="Inter, system-ui, sans-serif"
                        fontWeight="600"
                    >
                        82
                    </text>
                    <text
                        x="70"
                        y="104"
                        textAnchor="middle"
                        fill="rgba(240,240,240,0.65)"
                        fontSize="11"
                        fontFamily="Inter, system-ui, sans-serif"
                        fontWeight="500"
                    >
                        Qualifier
                    </text>
                </g>

                {/* Node: Live room */}
                <g transform="translate(600, 30)" className={styles.nodeAdmit}>
                    <rect
                        width="100"
                        height="80"
                        rx="10"
                        fill="rgba(17,255,153,0.04)"
                        stroke="rgba(17,255,153,0.35)"
                    />
                    <circle cx="50" cy="34" r="14" fill="rgba(17,255,153,0.15)" stroke="rgba(17,255,153,0.6)" />
                    <polygon points="46,28 46,40 56,34" fill="rgba(17,255,153,0.9)" />
                    <text
                        x="50"
                        y="62"
                        textAnchor="middle"
                        fill="#f0f0f0"
                        fontSize="10"
                        fontFamily="Inter, system-ui, sans-serif"
                        fontWeight="600"
                    >
                        Live room
                    </text>
                </g>

                {/* Node: Booking */}
                <g transform="translate(600, 150)" className={styles.nodeBook}>
                    <rect
                        width="100"
                        height="80"
                        rx="10"
                        fill="rgba(59,158,255,0.04)"
                        stroke="rgba(59,158,255,0.32)"
                    />
                    <rect x="30" y="20" width="40" height="30" rx="4" fill="rgba(59,158,255,0.12)" stroke="rgba(59,158,255,0.55)" />
                    <line x1="30" y1="30" x2="70" y2="30" stroke="rgba(59,158,255,0.55)" strokeWidth="1" />
                    <rect x="52" y="36" width="10" height="8" rx="1.5" fill="rgba(59,158,255,0.8)" />
                    <text
                        x="50"
                        y="62"
                        textAnchor="middle"
                        fill="#f0f0f0"
                        fontSize="10"
                        fontFamily="Inter, system-ui, sans-serif"
                        fontWeight="600"
                    >
                        Booking
                    </text>
                </g>
            </svg>
        </div>
    )
}
