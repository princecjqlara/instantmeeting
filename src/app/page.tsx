'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    FaVideo,
    FaBolt,
    FaUsers,
    FaMagic,
    FaCheck,
    FaEnvelope,
    FaLock,
    FaPhone,
    FaUser,
    FaUpload,
    FaQrcode,
    FaTimes,
    FaArrowRight,
    FaFacebook,
    FaSpinner,
} from 'react-icons/fa'
import { useRef, useState, useEffect, useMemo } from 'react'
import styles from './page.module.css'
import HeroFlow from '@/components/HeroFlow'

export default function Home() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [showLogin, setShowLogin] = useState(false)
    const [showSignup, setShowSignup] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [loggingIn, setLoggingIn] = useState(false)

    const offerEndsAt = useMemo(() => {
        if (typeof window === 'undefined') return Date.now() + 24 * 60 * 60 * 1000
        const envEnd = process.env.NEXT_PUBLIC_OFFER_ENDS_AT
        if (envEnd) {
            const t = Date.parse(envEnd)
            if (!Number.isNaN(t)) return t
        }
        const stored = localStorage.getItem('offerEndsAt')
        if (stored) {
            const n = Number(stored)
            if (n > Date.now()) return n
        }
        const ends = Date.now() + 24 * 60 * 60 * 1000
        try {
            localStorage.setItem('offerEndsAt', String(ends))
        } catch {
            /* ignore */
        }
        return ends
    }, [])

    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [])

    const remaining = Math.max(0, offerEndsAt - now)
    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000)
    const pad = (n: number) => n.toString().padStart(2, '0')

    const slotsLeft = 7

    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/host/dashboard')
        }
    }, [status, router])

    useEffect(() => {
        if (status !== 'unauthenticated') return
        if (typeof window === 'undefined') return

        const sessionKey = 'instantmeeting:landing-capi-visit'
        if (window.sessionStorage.getItem(sessionKey)) return

        const readCookie = (name: string) => {
            const hit = document.cookie
                .split('; ')
                .find((entry) => entry.startsWith(`${name}=`))

            return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null
        }

        const sendLandingCapiVisit = async () => {
            try {
                const url = new URL(window.location.href)
                const response = await fetch('/api/capi/instantmeeting', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        page_url: url.toString(),
                        fbclid: url.searchParams.get('fbclid'),
                        fbp: readCookie('_fbp'),
                        fbc: readCookie('_fbc'),
                    }),
                })
                const payload = await response.json().catch(() => null)

                if (payload?.sent) {
                    window.sessionStorage.setItem(sessionKey, '1')
                }
            } catch {
                // Let the next page load retry the landing-page CAPI event.
            }
        }

        void sendLandingCapiVisit()
    }, [status])

    if (status === 'authenticated') return null

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoginError('')
        setLoggingIn(true)
        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        })
        if (result?.error) {
            setLoginError(
                result.error === 'CredentialsSignin' ? 'Invalid email or password' : result.error
            )
            setLoggingIn(false)
        } else {
            router.push('/host/dashboard')
        }
    }

    return (
        <main className={styles.main}>

            {/* Top Nav */}
            <nav className={styles.nav}>
                <div className={styles.brand}>
                    <FaVideo /> InstantMeeting
                </div>
                <div className={styles.navActions}>
                    <a href="#features" className={styles.navLink}>Features</a>
                    <a href="#pricing" className={styles.navLink}>Pricing</a>
                    <button
                        type="button"
                        className={styles.navLink}
                        onClick={() => setShowLogin(true)}
                    >
                        Sign in
                    </button>
                    <button
                        type="button"
                        className={styles.navJoin}
                        onClick={() => setShowSignup(true)}
                    >
                        Join now <FaArrowRight style={{ fontSize: 10 }} />
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.scarcityRow}>
                    <span>
                        <span className={styles.slotsDot} />
                        <strong>{slotsLeft}</strong> slots at launch price
                    </span>
                    <span className={styles.scarcityDivider} />
                    <span>
                        Offer ends in{' '}
                        <strong>
                            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
                        </strong>
                    </span>
                </div>

                <h1 className={styles.heroTitle}>
                    Qualify, meet, and book clients
                    <span className={styles.heroGradient}> from one link.</span>
                </h1>
                <p className={styles.heroSubtitle}>
                    Prospects fill a short intake form. Qualified leads are admitted
                    straight into your live video room. Everyone else books a time on
                    your calendar.
                </p>

                <div className={styles.heroPriceRow}>
                    <span className={styles.heroOldPrice}>₱1,499</span>
                    <span className={styles.heroNewPrice}>₱699/month</span>
                    <span className={styles.heroSave}>Save ₱800</span>
                </div>

                <div className={styles.heroCtas}>
                    <button
                        type="button"
                        className={styles.btnPrimaryLg}
                        onClick={() => setShowSignup(true)}
                    >
                        Join now <FaArrowRight />
                    </button>
                    <a href="#pricing" className={styles.btnGhost}>
                        View plan details
                    </a>
                    <a
                        href="https://www.facebook.com/aresmediaph"
                        className={styles.btnGhost}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <FaFacebook /> Contact us
                    </a>
                </div>
                <div className={styles.heroTrust}>
                    <span><FaCheck /> Facebook ads setup included (1 month)</span>
                    <span><FaCheck /> Monthly access</span>
                    <span><FaCheck /> Monthly payment via GCash</span>
                </div>

                <HeroFlow />
            </section>

            {/* Features */}
            <section id="features" className={styles.features}>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon}>
                        <FaMagic />
                    </div>
                    <h3>Scored intake forms</h3>
                    <p>
                        Configure a short form that scores every submission against
                        your ideal-client criteria.
                    </p>
                </div>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon}>
                        <FaBolt />
                    </div>
                    <h3>Instant admission or booking</h3>
                    <p>
                        Qualified leads join your live video room immediately. Others
                        are routed to your booking calendar automatically.
                    </p>
                </div>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon}>
                        <FaUsers />
                    </div>
                    <h3>Deploy anywhere</h3>
                    <p>
                        Embed the widget on your website or share the universal link.
                        One consistent flow across every channel.
                    </p>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className={styles.pricing}>
                <div className={styles.pricingHeader}>
                    <span className={styles.eyebrow}>Pricing</span>
                    <h2>Single plan, monthly payment</h2>
                    <p>Launch pricing for early customers. Monthly billing, no hidden fees.</p>
                </div>
                <div className={styles.pricingCard}>
                    <div className={styles.pricingRibbon}>
                        Launch pricing · 53% off · {slotsLeft} slots left
                    </div>
                    <div className={styles.countdownRow}>
                        Offer ends in{' '}
                        <strong>
                            {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
                        </strong>
                    </div>
                    <div className={styles.pricingName}>Full access</div>
                    <div className={styles.pricingPriceRow}>
                        <span className={styles.pricingOld}>₱1,499</span>
                        <span className={styles.pricingNew}>₱699/month</span>
                    </div>
                    <div className={styles.pricingNote}>Monthly · billed at ₱699/month</div>

                    <div className={styles.pricingBonus}>
                        <FaFacebook />
                        <div>
                            <strong>Facebook ads setup included</strong>
                            <span>We configure and launch your first ad campaign during your first month.</span>
                        </div>
                    </div>

                    <ul className={styles.pricingFeatures}>
                        <li><FaCheck /> Scored lead qualification forms</li>
                        <li><FaCheck /> Instant admission for qualified leads</li>
                        <li><FaCheck /> Built-in booking calendar</li>
                        <li><FaCheck /> Live video room with content reels</li>
                        <li><FaCheck /> Embeddable website widget</li>
                        <li><FaCheck /> Team clock-in with round-robin routing</li>
                        <li><FaCheck /> Lead management with tags &amp; bulk actions</li>
                        <li><FaCheck /> Facebook ads setup (1 month)</li>
                    </ul>

                    <button
                        type="button"
                        className={styles.pricingCta}
                        onClick={() => setShowSignup(true)}
                    >
                        Join now — ₱699/month <FaArrowRight />
                    </button>
                    <div className={styles.pricingSmall}>
                        Payment via GCash. Accounts verified within 24 hours.
                    </div>
                </div>
            </section>

            {/* Guest quick-join */}
            <section className={styles.guestSection}>
                <h3>Joining a meeting?</h3>
                <p>Enter the meeting ID provided by your host.</p>
                <form
                    className={styles.guestForm}
                    onSubmit={(e) => {
                        e.preventDefault()
                        const formData = new FormData(e.target as HTMLFormElement)
                        const meetingId = formData.get('meetingId')
                        if (meetingId) {
                            const waitingPath = `/waiting/${meetingId}`
                            const waitingTab = window.open(waitingPath, '_blank')
                            if (!waitingTab) router.push(waitingPath)
                        }
                    }}
                >
                    <input
                        type="text"
                        name="meetingId"
                        placeholder="Enter meeting ID…"
                        className={styles.guestInput}
                    />
                    <button type="submit" className={styles.btnGhost}>
                        Join waiting room
                    </button>
                </form>
            </section>

            <footer className={styles.footer}>
                <span>© {new Date().getFullYear()} InstantMeeting</span>
                <button type="button" className={styles.navLink} onClick={() => setShowLogin(true)}>
                    Host sign in
                </button>
            </footer>

            {showLogin && (
                <LoginModal
                    email={email}
                    password={password}
                    error={loginError}
                    loading={loggingIn}
                    onEmail={setEmail}
                    onPassword={setPassword}
                    onSubmit={handleLogin}
                    onClose={() => setShowLogin(false)}
                    onSwitchToSignup={() => {
                        setShowLogin(false)
                        setShowSignup(true)
                    }}
                />
            )}

            {showSignup && (
                <SignupModal
                    onClose={() => setShowSignup(false)}
                    onSwitchToLogin={() => {
                        setShowSignup(false)
                        setShowLogin(true)
                    }}
                />
            )}
        </main>
    )
}

function LoginModal({
    email,
    password,
    error,
    loading,
    onEmail,
    onPassword,
    onSubmit,
    onClose,
    onSwitchToSignup,
}: {
    email: string
    password: string
    error: string
    loading: boolean
    onEmail: (v: string) => void
    onPassword: (v: string) => void
    onSubmit: (e: React.FormEvent) => void
    onClose: () => void
    onSwitchToSignup: () => void
}) {
    return (
        <div className={styles.modalScrim} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                    <FaTimes />
                </button>
                <h2 className={styles.modalTitle}>Welcome back</h2>
                <p className={styles.modalSubtitle}>Sign in to your dashboard.</p>
                <form className={styles.formStack} onSubmit={onSubmit}>
                    <label className={styles.inputWrap}>
                        <FaEnvelope />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => onEmail(e.target.value)}
                            required
                        />
                    </label>
                    <label className={styles.inputWrap}>
                        <FaLock />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => onPassword(e.target.value)}
                            required
                        />
                    </label>
                    {error && <div className={styles.errorBox}>{error}</div>}
                    <button type="submit" className={styles.btnPrimary} disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in'} {!loading && <FaArrowRight />}
                    </button>
                </form>
                <div className={styles.modalFoot}>
                    Don&apos;t have an account?{' '}
                        <button type="button" className={styles.linkBtn} onClick={onSwitchToSignup}>
                        Claim the ₱699/month plan →
                        </button>
                </div>
            </div>
        </div>
    )
}

function SignupModal({
    onClose,
    onSwitchToLogin,
}: {
    onClose: () => void
    onSwitchToLogin: () => void
}) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [receipt, setReceipt] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const gcashNumber = process.env.NEXT_PUBLIC_GCASH_NUMBER || '0992 703 1276'
    const gcashName = process.env.NEXT_PUBLIC_GCASH_NAME || 'PR***E C* L.'
    const qrImage = process.env.NEXT_PUBLIC_GCASH_QR_URL || '/gcash-qr-crop.jpg'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!receipt) {
            setError('Upload your payment receipt to continue.')
            return
        }
        setSubmitting(true)
        try {
            const fd = new FormData()
            const readCookie = (name: string) => {
                if (typeof document === 'undefined') return null
                const hit = document.cookie
                    .split('; ')
                    .find((chunk) => chunk.startsWith(`${name}=`))
                return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null
            }

            const pageUrl = typeof window !== 'undefined' ? window.location.href : 'https://instantmeeting.ai/'
            const fbclid = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('fbclid') : null

            fd.append('name', name)
            fd.append('email', email)
            fd.append('phone', phone)
            fd.append('password', password)
            fd.append('receipt', receipt)
            if (pageUrl) fd.append('page_url', pageUrl)
            if (fbclid) fd.append('fbclid', fbclid)
            const fbp = readCookie('_fbp')
            const fbc = readCookie('_fbc')
            if (fbp) fd.append('fbp', fbp)
            if (fbc) fd.append('fbc', fbc)
            const res = await fetch('/api/signup', { method: 'POST', body: fd })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Signup failed.')
                return
            }
            setSuccess(data.message || "Payment received! We'll email you once verified.")
        } catch {
            setError('Network error. Try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className={styles.modalScrim} onClick={onClose}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                        <FaTimes />
                    </button>
                    <div className={styles.successIcon}>
                        <FaCheck />
                    </div>
                    <h2 className={styles.modalTitle}>Signup received</h2>
                    <p className={styles.modalSubtitle}>{success}</p>
                    <p className={styles.modalSubtitle}>
                        Once verified, sign in with <strong>{email}</strong> using the
                        password you set above.
                    </p>
                    <button type="button" className={styles.btnPrimary} onClick={onSwitchToLogin}>
                        Go to sign in <FaArrowRight />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.modalScrim} onClick={onClose}>
            <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                    <FaTimes />
                </button>
                <div className={styles.signupGrid}>
                    <div>
                        <h2 className={styles.modalTitle}>Complete your signup</h2>
                        <p className={styles.modalSubtitle}>
                            <strong style={{ color: '#fff' }}>₱699/month</strong>{' '}
                            <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>₱1,499</span>{' '}
                            · Facebook ads setup included.
                        </p>

                        <div className={styles.paySteps}>
                            <div className={styles.payStep}>
                                <span className={styles.payStepNum}>1</span>
                                <div>
                                    <strong>Send ₱699/month via GCash</strong>
                                    <div className={styles.payMeta}>
                                        Number: <code>{gcashNumber}</code>
                                    </div>
                                    <div className={styles.payMeta}>
                                        Account name: <strong style={{ color: '#e0e7ff' }}>{gcashName}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.qrFrame}>
                                {qrImage ? (
                                    <img src={qrImage} alt="GCash QR code" />
                                ) : (
                                    <div className={styles.qrPlaceholder}>
                                        <FaQrcode />
                                        <span>GCash QR</span>
                                        <small>Ask admin for the live QR image or pay to the number above.</small>
                                    </div>
                                )}
                            </div>

                            <div className={styles.payStep}>
                                <span className={styles.payStepNum}>2</span>
                                <div>
                                    <strong>Fill your details and upload the receipt</strong>
                                    <div className={styles.payMeta}>
                                        We check the receipt within 24 hours, then your account goes live.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form className={styles.formStack} onSubmit={handleSubmit}>
                        <label className={styles.inputWrap}>
                            <FaUser />
                            <input
                                type="text"
                                placeholder="Full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </label>
                        <label className={styles.inputWrap}>
                            <FaEnvelope />
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>
                        <label className={styles.inputWrap}>
                            <FaPhone />
                            <input
                                type="tel"
                                placeholder="Phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </label>
                        <label className={styles.inputWrap}>
                            <FaLock />
                            <input
                                type="password"
                                placeholder="Choose a password (min 6)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </label>

                        <div className={styles.uploader}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={styles.uploadBtn}
                            >
                                <FaUpload /> {receipt ? 'Change GCash receipt' : 'Upload GCash receipt'}
                            </button>
                            {receipt && (
                                <div className={styles.uploadName}>
                                    <FaCheck /> {receipt.name}
                                </div>
                            )}
                        </div>

                        {error && <div className={styles.errorBox}>{error}</div>}

                        <button type="submit" className={styles.btnPrimary} disabled={submitting || !receipt}>
                            {submitting ? (
                                <>
                                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Sending…
                                </>
                            ) : (
                                <>
                                    Submit GCash receipt <FaArrowRight />
                                </>
                            )}
                        </button>

                        <div className={styles.modalFoot}>
                            Already signed up?{' '}
                            <button type="button" className={styles.linkBtn} onClick={onSwitchToLogin}>
                                Sign in →
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
