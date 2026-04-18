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
import { useRef, useState, useEffect } from 'react'
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
                        className={styles.navSignIn}
                        onClick={() => setShowLogin(true)}
                    >
                        Sign in
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.heroBadge}>
                    <FaBolt /> Live &amp; booking rolled into one link
                </div>
                <h1 className={styles.heroTitle}>
                    Turn website visitors into
                    <span className={styles.heroGradient}> booked calls.</span>
                </h1>
                <p className={styles.heroSubtitle}>
                    Qualify leads with AI forms, auto-admit the right ones, and let the
                    rest book a time — all from one link you paste anywhere.
                </p>
                <div className={styles.heroCtas}>
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => setShowSignup(true)}
                    >
                        Get started — ₱699 <FaArrowRight />
                    </button>
                    <a href="#pricing" className={styles.btnGhost}>
                        See what&apos;s included
                    </a>
                </div>
                <div className={styles.heroTrust}>
                    <span><FaCheck /> No contract</span>
                    <span><FaCheck /> Cancel anytime</span>
                    <span><FaCheck /> Paid via GCash</span>
                </div>
            </section>

            {/* Features */}
            <section id="features" className={styles.features}>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                        <FaMagic />
                    </div>
                    <h3>AI lead qualifier</h3>
                    <p>
                        Describe your business once — AI builds a form that scores every
                        lead and hands you the good ones instantly.
                    </p>
                </div>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg,#22c55e,#10b981)' }}>
                        <FaBolt />
                    </div>
                    <h3>Auto-admit qualified leads</h3>
                    <p>
                        Qualified? They walk straight into your meeting room. Not a fit?
                        They book a time that suits you both.
                    </p>
                </div>
                <div className={styles.featureCard}>
                    <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg,#ec4899,#f43f5e)' }}>
                        <FaUsers />
                    </div>
                    <h3>One link. Everywhere.</h3>
                    <p>
                        Drop the website widget or share the link from your bio — guests
                        see your content while they wait so nobody drops off.
                    </p>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className={styles.pricing}>
                <div className={styles.pricingHeader}>
                    <span className={styles.eyebrow}>Simple pricing</span>
                    <h2>One plan. Everything you need.</h2>
                    <p>
                        Limited launch price. Pay once, use it forever — no monthly
                        surprises.
                    </p>
                </div>
                <div className={styles.pricingCard}>
                    <div className={styles.pricingRibbon}>
                        <FaBolt /> Launch deal — 53% off
                    </div>
                    <div className={styles.pricingName}>Starter Pro</div>
                    <div className={styles.pricingPriceRow}>
                        <span className={styles.pricingOld}>₱1,499</span>
                        <span className={styles.pricingNew}>₱699</span>
                    </div>
                    <div className={styles.pricingNote}>Lifetime · one-time payment</div>

                    <div className={styles.pricingBonus}>
                        <FaFacebook />
                        <div>
                            <strong>Free Facebook ads setup</strong>
                            <span>For your first month — we set up and launch your first ad.</span>
                        </div>
                    </div>

                    <ul className={styles.pricingFeatures}>
                        <li><FaCheck /> AI-generated lead qualification forms</li>
                        <li><FaCheck /> Auto-admit qualified leads instantly</li>
                        <li><FaCheck /> Booking calendar for non-qualified / after-hours</li>
                        <li><FaCheck /> Live video room with waiting-room content reels</li>
                        <li><FaCheck /> Website embed widget</li>
                        <li><FaCheck /> Team clock-in &amp; round-robin assignment</li>
                        <li><FaCheck /> Lead CRM: tags, bulk actions, export</li>
                        <li><FaCheck /> 1 month free Facebook ads setup</li>
                    </ul>

                    <button
                        type="button"
                        className={styles.pricingCta}
                        onClick={() => setShowSignup(true)}
                    >
                        Claim this deal <FaArrowRight />
                    </button>
                    <div className={styles.pricingSmall}>
                        Pay via GCash or scan our QR — admin verifies within 24 hours.
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

    const gcashNumber = process.env.NEXT_PUBLIC_GCASH_NUMBER || '0917 123 4567'
    const qrImage = process.env.NEXT_PUBLIC_GCASH_QR_URL || ''

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
                                        Number: <code>{gcashNumber}</code> · or scan the QR
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
                                        Admin verifies within 24 hours and emails you the go-ahead.
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
