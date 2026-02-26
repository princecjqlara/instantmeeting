'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FaGoogle, FaVideo, FaClock, FaPlay } from 'react-icons/fa'
import { useEffect } from 'react'
import styles from './page.module.css'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      const windowHeight = window.innerHeight

      // Parallax effect for phone frame
      const phoneFrame = document.querySelector(`.${styles.phoneFrame}`) as HTMLElement
      if (phoneFrame) {
        const phoneSpeed = 0.3
        const phoneOffset = scrollPosition * phoneSpeed
        phoneFrame.style.transform = `translateY(${phoneOffset}px)`
      }

      // Parallax effect for features
      const features = document.querySelectorAll(`.${styles.feature}`)
      features.forEach((feature, index) => {
        const element = feature as HTMLElement
        const rect = element.getBoundingClientRect()
        const elementTop = rect.top + scrollPosition
        const elementCenter = elementTop + rect.height / 2

        // Only animate when element is in viewport
        if (elementCenter < scrollPosition + windowHeight && elementTop > scrollPosition) {
          const featureSpeed = 0.2 + (index * 0.1)
          const featureOffset = (scrollPosition - elementTop + windowHeight) * featureSpeed
          element.style.transform = `translateY(${featureOffset}px)`
        }
      })

      // Floating particles parallax
      const particles = document.querySelectorAll(`.${styles.parallaxParticle}`)
      particles.forEach((particle, index) => {
        const element = particle as HTMLElement
        const particleSpeed = 0.5 + (index * 0.2)
        const particleOffset = scrollPosition * particleSpeed
        element.style.transform = `translateY(${particleOffset}px)`
      })
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Redirect logged in users to dashboard
  if (status === 'authenticated') {
    router.push('/host/dashboard')
    return null
  }

  return (
    <main className={styles.main}>
      {/* Parallax Background Particles */}
      <div className={styles.parallaxContainer}>
        <div className={`${styles.parallaxParticle} ${styles.particle1}`}></div>
        <div className={`${styles.parallaxParticle} ${styles.particle2}`}></div>
        <div className={`${styles.parallaxParticle} ${styles.particle3}`}></div>
        <div className={`${styles.parallaxParticle} ${styles.particle4}`}></div>
      </div>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <FaVideo /> Video Meetings Reimagined
          </div>

          <h1 className={styles.title}>
            Waiting Rooms
            <span className={styles.gradient}> That Engage</span>
          </h1>

          <p className={styles.subtitle}>
            Create meetings where guests can browse your TikTok-style content
            while waiting. No more boring lobby screens.
          </p>

          <div className={styles.cta}>
            <button
              onClick={() => signIn('google')}
              className="button-primary"
            >
              <FaGoogle />
              Get Started with Google
            </button>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.phoneFrame}>
            <div className={styles.phoneScreen}>
              <div className={styles.mockReel}>
                <div className={styles.mockVideo}></div>
                <div className={styles.mockControls}>
                  <FaPlay />
                </div>
                <div className={styles.mockStatus}>
                  <FaClock /> Waiting...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🎬</div>
          <h3>Upload Your Content</h3>
          <p>Share videos that represent you. Guests watch while they wait.</p>
        </div>

        <div className={styles.feature}>
          <div className={styles.featureIcon}>⚡</div>
          <h3>Instant Notifications</h3>
          <p>Real-time updates when you admit guests. No refresh needed.</p>
        </div>

        <div className={styles.feature}>
          <div className={styles.featureIcon}>🔗</div>
          <h3>In-Browser Video</h3>
          <p>No external apps needed. P2P video chat right inside the app.</p>
        </div>
      </section>

      {/* Join as Guest */}
      <section className={styles.guestSection}>
        <h2>Have a meeting link?</h2>
        <p>Enter the waiting room ID to join as a guest</p>
        <form
          className={styles.guestForm}
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.target as HTMLFormElement)
            const meetingId = formData.get('meetingId')
            if (meetingId) {
              router.push(`/waiting/${meetingId}`)
            }
          }}
        >
          <input
            type="text"
            name="meetingId"
            placeholder="Enter meeting ID..."
            className="input"
          />
          <button type="submit" className="button-secondary">
            Join Waiting Room
          </button>
        </form>
      </section>
    </main>
  )
}
