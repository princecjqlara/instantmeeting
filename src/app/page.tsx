'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    FaVideo,
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
import HeroFlow from '@/components/HeroFlow'
import ScarcityBanner from '@/components/ScarcityBanner'
import SellerLeadFunnel from '@/components/SellerLeadFunnel'

const TESTIMONIAL_VIDEOS = [
    {
        slug: 'testimonial-1',
        badge: 'Customer Testimonial',
        title: 'How InstantMeeting helped qualify leads faster',
        quote: 'A quick look at how clients are using InstantMeeting to turn inquiries into booked conversations.',
        featured: true,
    },
    {
        slug: 'testimonial-2',
        badge: 'Customer Testimonial',
        title: 'Real client feedback on the live intake flow',
        quote: 'See how the qualification flow feels from the client side and why it builds trust quickly.',
        featured: false,
    },
    {
        slug: 'testimonial-3',
        badge: 'Customer Testimonial',
        title: 'What prospects notice first about the experience',
        quote: 'A short customer story about how the one-link journey feels smoother than back-and-forth follow ups.',
        featured: false,
    },
] as const

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

            <ScarcityBanner />

            {/* Top Nav */}
            <nav className={styles.nav}>
                <div className={styles.brand}>
                    <FaVideo /> InstantMeeting
                </div>
                <div className={styles.navActions}>
                    <a href="#seller-funnel" className={styles.navLink}>How it works</a>
                    <button
                        type="button"
                        className={styles.navLink}
                        onClick={() => setShowLogin(true)}
                    >
                        Sign in
                    </button>
                    <a
                        href="#seller-funnel"
                        className={`${styles.navJoin} ${styles.joinGlow}`}
                    >
                        Join now <span className={styles.joinArrow}><FaArrowRight style={{ fontSize: 10 }} /></span>
                    </a>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.heroBadge}>
                    <span className={styles.heroBadgeDot} /> Free Facebook ads setup included <span className={styles.heroBadgeTag}>₱0 setup fee</span>
                </div>
                <h1 className={styles.heroTitle}>
                    What if lahat ng nag-i-inquire sa&rsquo;yo,
                    <span className={styles.heroGradient}> ma-convert mo lahat?</span>
                </h1>

                <div className={styles.vslWrap}>
                    <video
                        className={styles.vslVideo}
                        src="/api/testimonials/testimonial-1"
                        controls
                        playsInline
                        preload="metadata"
                    />
                </div>

                <p className={styles.heroSubtitle}>
                    Hindi impossible. Ang InstantMeeting ay nag-fi-filter, nag-bu-book, at nag-a-admit ng bawat seryosong inquiry sa live video room — habang sila hot pa.
                </p>

                <div className={styles.heroCtas}>
                    <a
                        href="#seller-funnel"
                        className={`${styles.btnPrimaryLg} ${styles.joinGlow}`}
                    >
                        Sumali na <span className={styles.joinArrow}><FaArrowRight /></span>
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
            </section>

            {/* Seller Lead Diagnostic Funnel */}
            <section className={styles.funnelSection}>
                <div className={styles.funnelHeader}>
                    <span className={styles.eyebrow}>Pipeline Diagnostic — para sa mga real estate agents</span>
                    <h2>6 tanong lang. Ikukwenta mo mismo kung magkano ang komisyon na nawawala sa iyo bawat buwan — at kung paano ito itigil.</h2>
                </div>
                <SellerLeadFunnel />
                <HeroFlow />
            </section>

            <section className={styles.testimonialsSection}>
                <div className={styles.testimonialsHeader}>
                    <span className={styles.eyebrow}>Testimonials</span>
                    <h2>See what clients say after using InstantMeeting</h2>
                    <p>
                        Real customer testimonials from businesses using InstantMeeting to qualify and convert leads faster.
                    </p>
                </div>

                <div className={styles.testimonialsGrid}>
                    {TESTIMONIAL_VIDEOS.map((video, index) => (
                        <article
                            key={video.slug}
                            className={video.featured ? styles.testimonialFeaturedCard : styles.testimonialCard}
                        >
                            <div className={styles.testimonialVideoWrap}>
                                <video
                                    className={styles.testimonialVideo}
                                    src={`/api/testimonials/${video.slug}`}
                                    controls={!video.featured}
                                    autoPlay={video.featured}
                                    muted
                                    loop={video.featured}
                                    playsInline
                                    preload="metadata"
                                />
                            </div>
                            <div className={styles.testimonialCopy}>
                                <span className={styles.testimonialBadge}>{video.badge}</span>
                                <h3>{video.title}</h3>
                                <p>{video.quote}</p>
                                <span className={styles.testimonialIndex}>0{index + 1}</span>
                            </div>
                        </article>
                    ))}
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
