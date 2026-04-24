'use client'

import { useRef, useState } from 'react'
import { FaArrowRight, FaCheck, FaFacebook, FaLock, FaQrcode, FaSpinner, FaUpload } from 'react-icons/fa'
import styles from './SellerLeadFunnel.module.css'

type OptionValue = string

type Question = {
    id: string
    prompt: string
    helper?: string
    options: { value: OptionValue; label: string }[]
}

const QUESTIONS: Question[] = [
    {
        id: 'deals',
        prompt: "Sa average, ilang deals ang naco-close mo sa isang buwan?",
        helper: "Walang mali na sagot -- gusto lang naming malaman ang baseline mo.",
        options: [
            { value: '0-1', label: "0 – 1 deal" },
            { value: '2-3', label: "2 – 3 deals" },
            { value: '4-6', label: "4 – 6 deals" },
            { value: '7+', label: "7 o higit pa" },
        ],
    },
    {
        id: 'drop-off',
        prompt: "Para sa bawat deal na naco-close mo, ilang sellers ang nawala sa daan -- hindi naabot, nag-ghost, o nawalan ng interes bago pa kayo makapag-usap nang maayos?",
        helper: "Presuppose namin na may nawawala -- tanong lang kung ilan.",
        options: [
            { value: '1-2', label: "1 – 2 sellers -- mababa ang drop-off ko" },
            { value: '3-5', label: "3 – 5 sellers -- may nawawala pero manageable" },
            { value: '6-10', label: "6 – 10 sellers -- medyo marami na" },
            { value: '10+', label: "Higit 10 -- hindi ko na mabilang" },
        ],
    },
    {
        id: 'peso-loss',
        prompt: "Rough estimate lang: kung ang average commission mo ay nasa ₱50,000 hanggang ₱150,000 per deal, at may mga sellers na nawawala sa iyo bawat buwan -- magkano ang komisyon na hindi mo nakukuha?",
        helper: "Ikaw mismo ang mag-co-compute -- ang sarili mong numero ay mas masakit kaysa anumang statistic.",
        options: [
            { value: '50k-200k', label: "₱50,000 – ₱200,000 bawat buwan -- malaki na iyon" },
            { value: '200k-500k', label: "₱200,000 – ₱500,000 -- hindi ko pa naisip ito nang ganito" },
            { value: '500k+', label: "Higit ₱500,000 -- nakakatakot isipin" },
            { value: 'unknown', label: "Hindi ko alam ang exact -- pero siguradong malaki" },
        ],
    },
    {
        id: 'competitor',
        prompt: "Isang serious seller ang nag-inquire sa iyong Facebook page ngayon. Hindi mo nakita ang notification agad. After 2 oras, nag-reply ka na. Pero may isang agent na nakapag-video call na sa kanya 45 minuto matapos ng inquiry. Sino ang makukuha ng listing na iyon?",
        options: [
            { value: 'them', label: "Ang kabilang agent -- obvious iyon" },
            { value: 'depends', label: "Depende pa rin sa relationship at presentation" },
            { value: 'me', label: "Baka ako pa rin -- quality over speed" },
            { value: 'worried', label: "Hindi ko alam -- pero nag-aalala ako dito" },
        ],
    },
    {
        id: 'identity',
        prompt: "May dalawang klase ng agent sa real estate ngayon. Yung nagtatrabaho PARA sa kanilang negosyo -- lagi on-call, laging available, laging nag-fo-follow up. At yung negosyo ay nagtatrabaho PARA SA KANILA -- may sistema, may filter, may kalayaan. Saan ka ngayon?",
        options: [
            { value: 'for-biz', label: "Type 1 -- nagtatrabaho ako para sa negosyo ko, lagi akong on-call" },
            { value: 'half', label: "Halos 50-50 -- may sistema pero hindi pa sapat" },
            { value: 'biz-for-me', label: "Type 2 -- ang negosyo ay nagtatrabaho para sa akin na" },
            { value: 'want-2', label: "Gusto ko ang Type 2 pero hindi ko pa alam kung paano" },
        ],
    },
    {
        id: 'future',
        prompt: "Kung wala kang babaguhin sa susunod na 6 na buwan -- parehong sistema, parehong proseso -- ano ang pinaka-malamang mangyari sa iyong pipeline?",
        helper: "Maging tapat -- ito ang pinakamahalaga mong sagot.",
        options: [
            { value: 'worse', label: "Magiging mas malala -- mas maraming mawawalang leads habang tumatagal" },
            { value: 'same', label: "Magiging pareho lang -- okay na rin naman iyon sa akin" },
            { value: 'better', label: "Magiging mas mabuti -- kaya ko pa ito harapin mag-isa" },
            { value: 'scared', label: "Hindi ko alam -- at iyon mismo ang nag-aalala sa akin" },
        ],
    },
]

type Tier = 'urgent' | 'leaking' | 'scale'

function computeTier(answers: Record<string, OptionValue>): { tier: Tier; title: string; body: string; badge: string; urgency: string } {
    const dropOff = answers['drop-off']
    const pesoLoss = answers['peso-loss']
    const competitor = answers['competitor']
    const future = answers['future']

    const highLoss = pesoLoss === '200k-500k' || pesoLoss === '500k+' || pesoLoss === 'unknown'
    const highDropOff = dropOff === '6-10' || dropOff === '10+'
    const competitorWin = competitor === 'them' || competitor === 'worried'
    const fearfulFuture = future === 'worse' || future === 'scared'

    if ((highLoss || highDropOff) && competitorWin) {
        return {
            tier: 'urgent',
            badge: "Kritikal -- Lugi Ka Ngayon",
            title: "Ikino-compute mo mismo na may malaking komisyon na nawawala sa iyo bawat buwan -- at alam mo na ang karibal mo ang kumukuha nito.",
            body: "Iyon ay hindi isang problema ng hinaharap -- nangyayari iyon ngayon, sa bawat inquiry na hindi mo nasagot sa loob ng 5 minuto. Ang InstantMeeting ay humaharang sa leak na iyon: automatic qualifier, instant video room admission, at booking sa kalendaryo mo -- lahat sa iisang link. Ang seller ay nararamdamang inaalagaan. Ikaw ay kumikita. Iyon ang pagkakaiba.",
            urgency: "Bawat araw na walang sistema = komisyon na napupunta sa agent na mas mabilis sumasagot.",
        }
    }

    if (fearfulFuture || highDropOff) {
        return {
            tier: 'leaking',
            badge: "Pipeline Mo ay Tumutulong",
            title: "Alam mo na kung wala kang babaguhin, mas marami pang mawawala -- at iyon mismo ang nag-aalala sa iyo.",
            body: "Hindi ito problema ng effort -- problema ito ng sistema. Ang mga agents na gumagamit ng InstantMeeting ay hindi na nag-a-aksaya ng kahit isang mensahe sa pag-qualify. Isang link lang -- nag-fi-filter ng serious sellers, nag-a-admit agad sa live video room, at nag-bu-book sa kalendaryo. Ang leak sa pipeline mo, tinatambal namin iyon.",
            urgency: "Ang bawat no-show at pa-check lang ay may katumbas na pera -- at lumalaki iyon habang walang sistema.",
        }
    }

    return {
        tier: 'scale',
        badge: "Handa Ka na mag-Scale",
        title: "Malakas na ang base mo -- ang tanong na lang: gaano kalakas ang ceiling ng current system mo?",
        body: "Ang mga agents na may solid na response speed ay karaniwang nag-hi-hit ng bottleneck sa coordination at qualification sa mas mataas na volume. Ang InstantMeeting ay nag-ha-handle ng round-robin routing, team clock-in, lead scoring, at live video room nang walang dagdag na admin sa iyo. Kung gusto mo ng mas malaking pipeline na hindi ka mag-burn out -- ito ang sistema.",
        urgency: "Ang growth without system ay chaos lang na naka-disguise. Handa ka na ba talagang mag-scale?",
    }
}

const FEATURES = [
    'Scored lead qualification forms',
    'Instant admission for qualified leads',
    'Built-in booking calendar',
    'Live video room with content reels',
    'Embeddable website widget',
    'Team clock-in with round-robin routing',
    'Lead management with tags and bulk actions',
    'Free Facebook ads setup (first month)',
]

export type SellerLeadFunnelProps = {
    onPrimaryAction?: () => void
    onSecondaryAction?: () => void
    contactHref?: string
}

export default function SellerLeadFunnel({
    onSecondaryAction,
    contactHref = 'https://www.facebook.com/aresmediaph',
}: SellerLeadFunnelProps) {
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, OptionValue>>({})

    const [captured, setCaptured] = useState(false)
    const [captureName, setCaptureName] = useState('')
    const [captureContact, setCaptureContact] = useState('')
    const [captureLoading, setCaptureLoading] = useState(false)

    const [checkoutEmail, setCheckoutEmail] = useState('')
    const [checkoutPhone, setCheckoutPhone] = useState('')
    const [checkoutPassword, setCheckoutPassword] = useState('')
    const [receipt, setReceipt] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [checkoutError, setCheckoutError] = useState<string | null>(null)
    const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const gcashNumber = process.env.NEXT_PUBLIC_GCASH_NUMBER || '0992 703 1276'
    const gcashName = process.env.NEXT_PUBLIC_GCASH_NAME || 'PR***E C* L.'
    const qrImage = process.env.NEXT_PUBLIC_GCASH_QR_URL || '/gcash-qr-crop.jpg'

    const MID_CAPTURE_STEP = 3
    const totalSteps = QUESTIONS.length
    const isCapture = step === MID_CAPTURE_STEP && !captured
    const isResult = step >= totalSteps
    const isQuestion = !isCapture && !isResult
    const effectiveStep = step < MID_CAPTURE_STEP ? step : captured ? step + 1 : step
    const effectiveTotal = totalSteps + 1
    const progressPct = isResult ? 100 : Math.round((effectiveStep / effectiveTotal) * 100)

    const handleSelect = (questionId: string, value: OptionValue) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }))
        setStep((s) => s + 1)
    }

    const handleBack = () => {
        if (step > 0) setStep((s) => s - 1)
    }

    const handleRestart = () => {
        setAnswers({})
        setStep(0)
        setCaptured(false)
        setCaptureName('')
        setCaptureContact('')
        setCheckoutEmail('')
        setCheckoutPhone('')
        setCheckoutPassword('')
        setReceipt(null)
        setCheckoutError(null)
        setCheckoutSuccess(null)
    }

    const handleCapture = async (e: React.FormEvent) => {
        e.preventDefault()
        setCaptureLoading(true)
        setCheckoutPhone(captureContact.trim())
        try {
            await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: captureName, contact: captureContact, answers }),
            })
        } catch {
            // non-blocking
        } finally {
            setCaptureLoading(false)
            setCaptured(true)
        }
    }

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault()
        setCheckoutError(null)
        if (!receipt) {
            setCheckoutError('I-upload ang GCash receipt para matuloy.')
            return
        }
        setSubmitting(true)
        try {
            const fd = new FormData()
            const readCookie = (name: string) => {
                if (typeof document === 'undefined') return null
                const hit = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
                return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : null
            }
            const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
            const fbclid = typeof window !== 'undefined'
                ? new URL(window.location.href).searchParams.get('fbclid')
                : null
            fd.append('name', captureName)
            fd.append('email', checkoutEmail)
            fd.append('phone', checkoutPhone)
            fd.append('password', checkoutPassword)
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
                setCheckoutError(data.error || 'May error -- subukan ulit.')
                return
            }
            setCheckoutSuccess(data.message || 'Payment received! Ie-email namin kayo pagka-verify.')
        } catch {
            setCheckoutError('Network error. Subukan ulit.')
        } finally {
            setSubmitting(false)
        }
    }

    const current = QUESTIONS[step]
    const result = isResult ? computeTier(answers) : null

    return (
        <section id="seller-funnel" className={styles.funnel} aria-label="Seller lead fit check">
            <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
                <span className={styles.progressLabel}>
                    {isResult
                        ? 'Resulta + Checkout'
                        : isCapture
                        ? 'Quick info muna'
                        : `Tanong ${step + 1} sa ${totalSteps}`}
                </span>
            </div>

            {isQuestion && current && (
                <>
                    <h3 className={styles.question}>{current.prompt}</h3>
                    {current.helper && <p className={styles.helper}>{current.helper}</p>}
                    <div className={styles.options}>
                        {current.options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                className={styles.option}
                                onClick={() => handleSelect(current.id, opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.navRow}>
                        <button type="button" className={styles.backBtn} onClick={handleBack} disabled={step === 0}>
                            Back
                        </button>
                    </div>
                </>
            )}

            {isCapture && (
                <form className={styles.captureForm} onSubmit={handleCapture}>
                    <p className={styles.captureEyebrow}>Halos halfway ka na -- quick info muna.</p>
                    <h3 className={styles.question}>
                        Sino ka, at saan ka namin maaabot?
                    </h3>
                    <p className={styles.helper}>
                        Para ma-save namin ang iyong progress at ma-send sa&rsquo;yo ang detalyadong pipeline report pagkatapos ng diagnostic -- ilagay mo lang ang pangalan at numero mo.
                    </p>
                    <div className={styles.captureFields}>
                        <input
                            className={styles.captureInput}
                            type="text"
                            placeholder="Pangalan mo"
                            value={captureName}
                            onChange={(e) => setCaptureName(e.target.value)}
                            required
                        />
                        <input
                            className={styles.captureInput}
                            type="tel"
                            placeholder="Phone number (e.g. 09XX XXX XXXX)"
                            value={captureContact}
                            onChange={(e) => setCaptureContact(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className={styles.primary} disabled={captureLoading}>
                        {captureLoading ? 'Sandali lang...' : <>Ituloy ang diagnostic <FaArrowRight /></>}
                    </button>
                    <p className={styles.captureDisclaimer}>
                        Hindi namin ibebenta ang iyong info. Promise.
                    </p>
                </form>
            )}

            {isResult && result && (
                <div className={styles.result}>
                    <span className={styles.resultTier}>{result.badge}</span>
                    <h3 className={styles.resultTitle}>{result.title}</h3>
                    <p className={styles.resultBody}>{result.body}</p>
                    <p className={styles.resultUrgency}>{result.urgency}</p>

                    {checkoutSuccess ? (
                        <div className={styles.successBlock}>
                            <div className={styles.successIcon}><FaCheck /></div>
                            <h4>Signup received!</h4>
                            <p>{checkoutSuccess}</p>
                            <p>Mag-sign in gamit ang <strong>{checkoutEmail}</strong> pagka-verify.</p>
                        </div>
                    ) : (
                        <div className={styles.checkoutBlock}>
                            <div className={styles.checkoutHeader}>
                                <div className={styles.priceRow}>
                                    <span className={styles.priceOld}>&#8369;1,499</span>
                                    <span className={styles.priceNew}>&#8369;699/month</span>
                                </div>
                                <p className={styles.priceNote}>
                                    Facebook ads setup kasama &middot; cancel anytime &middot; verified within 24 hours
                                </p>
                                <ul className={styles.features}>
                                    {FEATURES.map((f) => <li key={f}>{f}</li>)}
                                </ul>
                            </div>

                            <div className={styles.checkoutGrid}>
                                <div className={styles.gcashSide}>
                                    <div className={styles.payStep}>
                                        <span className={styles.payStepNum}>1</span>
                                        <div>
                                            <strong>Mag-send ng &#8369;699 via GCash</strong>
                                            <div className={styles.payMeta}>Number: <code>{gcashNumber}</code></div>
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
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.payStep}>
                                        <span className={styles.payStepNum}>2</span>
                                        <div>
                                            <strong>I-fill ang form at i-upload ang receipt</strong>
                                            <div className={styles.payMeta}>
                                                Che-check namin ang receipt within 24 hours, tapos live na ang account mo.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <form className={styles.checkoutForm} onSubmit={handleCheckout}>
                                    <div className={styles.checkoutName}>
                                        Hi, <strong>{captureName}</strong>! I-complete na lang ang details:
                                    </div>
                                    <input
                                        className={styles.captureInput}
                                        type="email"
                                        placeholder="Email address"
                                        value={checkoutEmail}
                                        onChange={(e) => setCheckoutEmail(e.target.value)}
                                        required
                                    />
                                    <input
                                        className={styles.captureInput}
                                        type="tel"
                                        placeholder="Phone number"
                                        value={checkoutPhone}
                                        onChange={(e) => setCheckoutPhone(e.target.value)}
                                        required
                                    />
                                    <div className={styles.captureInputIcon}>
                                        <FaLock />
                                        <input
                                            className={styles.captureInput}
                                            type="password"
                                            placeholder="Gumawa ng password (min 6)"
                                            value={checkoutPassword}
                                            onChange={(e) => setCheckoutPassword(e.target.value)}
                                            minLength={6}
                                            required
                                        />
                                    </div>
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
                                        <FaUpload />{' '}
                                        {receipt ? 'Palitan ang GCash receipt' : 'I-upload ang GCash receipt'}
                                    </button>
                                    {receipt && (
                                        <div className={styles.uploadName}>
                                            <FaCheck /> {receipt.name}
                                        </div>
                                    )}
                                    {checkoutError && <div className={styles.errorBox}>{checkoutError}</div>}
                                    <button
                                        type="submit"
                                        className={styles.primary}
                                        disabled={submitting || !receipt}
                                    >
                                        {submitting ? (
                                            <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Nagse-send...</>
                                        ) : (
                                            <>I-submit ang GCash receipt <FaArrowRight /></>
                                        )}
                                    </button>
                                </form>
                            </div>

                            <div className={styles.checkoutFooter}>
                                {onSecondaryAction ? (
                                    <button type="button" className={styles.secondary} onClick={onSecondaryAction}>
                                        <FaFacebook /> May tanong ako -- chat muna
                                    </button>
                                ) : (
                                    <a className={styles.secondary} href={contactHref} target="_blank" rel="noreferrer">
                                        <FaFacebook /> May tanong ako -- chat muna
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    <button type="button" className={styles.restart} onClick={handleRestart}>
                        Magsimula ulit
                    </button>
                </div>
            )}
        </section>
    )
}
