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
            {/* Decorative blobs */}
            <div className={styles.blob1} />
            <div className={styles.blob2} />
            <div className={styles.blob3} />

            {/* Top Nav */}
            <nav className={styles.nav}>
                <div className={styles.brand}>
                    <FaVideo /> InstantMeeting
                </div>
                <div className={styles.navActions}>
                    <a href="#pricing" className={styles.navLink}>Pricing</a>
                    <a href="#features" className={styles.navLink}>Features</a>
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
                        Join now
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.scarcityRow}>
                    <span className={styles.slotsPill}>
                        🔥 Only <strong>{slotsLeft}</strong> slots left at ₱699
                    </span>
                    <span className={styles.timerPill}>
                        Deal ends in{' '}
                        <strong>
                            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
                        </strong>
                    </span>
                </div>

                <h1 className={styles.heroTitle}>
                    Meet leads the moment
                    <span className={styles.heroGradient}> they find you.</span>
                </h1>
                <p className={styles.heroSubtitle}>
                    One link. Leads fill a short form, the good ones land straight in
                    your room, the rest book a time.
                </p>

                <div className={styles.heroPriceRow}>
                    <span className={styles.heroOldPrice}>₱1,499</span>
                    <span className={styles.heroNewPrice}>₱699</span>
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
                        See what&apos;s included
                    </a>
                </div>
                <div className={styles.heroTrust}>
                    <span><FaCheck /> 1 month FB ads setup free</span>
                    <span><FaCheck /> Lifetime access</span>
                    <span><FaCheck /> Paid via GCash</span>
                </div>
            </section>

            {/* Features */}
            <section id="features" className={styles.features}>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                        <FaMagic />
                    </div>
                    <h3>Qualifying form</h3>
                    <p>
                        A short form scores every lead and tells you who&apos;s worth
                        your time.
                    </p>
                </div>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg,#22c55e,#10b981)' }}>
                        <FaBolt />
                    </div>
                    <h3>Instant meet or book</h3>
                    <p>
                        Qualified leads go straight to your room. Everyone else picks a
                        slot on your calendar.
                    </p>
                </div>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg,#ec4899,#f43f5e)' }}>
                        <FaUsers />
                    </div>
                    <h3>One link, anywhere</h3>
                    <p>
                        Drop the widget on your site or share the link in your bio.
                        Same flow everywhere.
                    </p>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className={styles.pricing}>
                <div className={styles.pricingHeader}>
                    <span className={styles.eyebrow}>Pricing</span>
                    <h2>One plan. Pay once.</h2>
                    <p>Launch price. No monthly fees.</p>
                </div>
                <div className={styles.pricingCard}>
                    <div className={styles.pricingRibbon}>
                        <FaBolt /> Launch deal — 53% off · {slotsLeft} slots left
                    </div>
                    <div className={styles.countdownRow}>
                        ⏳ Offer ends in{' '}
                        <strong>
                            {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
                        </strong>
                    </div>
                    <div className={styles.pricingName}>Full access</div>
                    <div className={styles.pricingPriceRow}>
                        <span className={styles.pricingOld}>₱1,499</span>
                        <span className={styles.pricingNew}>₱699</span>
                    </div>
                    <div className={styles.pricingNote}>Lifetime · one-time payment</div>

                    <div className={styles.pricingBonus}>
                        <FaFacebook />
                        <div>
                            <strong>First month of Facebook ads, on us</strong>
                            <span>We set up and launch your first ad for free.</span>
                        </div>
                    </div>

                    <ul className={styles.pricingFeatures}>
                        <li><FaCheck /> Lead qualification forms</li>
                        <li><FaCheck /> Instant admit for qualified leads</li>
                        <li><FaCheck /> Booking calendar for everyone else</li>
                        <li><FaCheck /> Live video room with content reels</li>
                        <li><FaCheck /> Website embed widget</li>
                        <li><FaCheck /> Team clock-in &amp; round-robin</li>
                        <li><FaCheck /> Leads table with tags and bulk actions</li>
                        <li><FaCheck /> 1 month Facebook ads setup</li>
                    </ul>

                    <button
                        type="button"
                        className={styles.pricingCta}
                        onClick={() => setShowSignup(true)}
                    >
                        Join now — pay ₱699 <FaArrowRight />
                    </button>
                    <div className={styles.pricingSmall}>
                        Pay via GCash. We verify within 24 hours.
                    </div>
                </div>
            </section>

            {/* Guest quick-join */}
            <section className={styles.guestSection}>
                <h3>Got a meeting link?</h3>
                <p>Jump into a host&apos;s waiting room.</p>
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
                        Claim the ₱699 deal →
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
            fd.append('name', name)
            fd.append('email', email)
            fd.append('phone', phone)
            fd.append('password', password)
            fd.append('receipt', receipt)
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
                    <h2 className={styles.modalTitle}>You&apos;re in line 🎉</h2>
                    <p className={styles.modalSubtitle}>{success}</p>
                    <p className={styles.modalSubtitle}>
                        Once verified, sign in with <strong>{email}</strong> and the password
                        you just set.
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
                        <h2 className={styles.modalTitle}>Claim your spot</h2>
                        <p className={styles.modalSubtitle}>
                            <strong style={{ color: '#fff' }}>₱699</strong>{' '}
                            <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>₱1,499</span>{' '}
                            · includes 1 month Facebook ads setup.
                        </p>

                        <div className={styles.paySteps}>
                            <div className={styles.payStep}>
                                <span className={styles.payStepNum}>1</span>
                                <div>
                                    <strong>Send ₱699 via GCash</strong>
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
                                <FaUpload /> {receipt ? 'Change receipt' : 'Upload receipt'}
                            </button>
                            {receipt && (
                                <div className={styles.uploadName}>
                                    <FaCheck /> {receipt.name}
                                </div>
                            )}
                        </div>

                        {error && <div className={styles.errorBox}>{error}</div>}

                        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                            {submitting ? (
                                <>
                                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Sending…
                                </>
                            ) : (
                                <>
                                    Submit for review <FaArrowRight />
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
