'use client'

import { useEffect, useState } from 'react'
import { FaFire } from 'react-icons/fa'
import styles from './ScarcityBanner.module.css'

export default function ScarcityBanner() {
    const [timeLeft, setTimeLeft] = useState('')
    const [slots, setSlots] = useState(3)

    useEffect(() => {
        const today = new Date()
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
        setSlots(2 + (seed % 3))

        const tick = () => {
            const now = new Date()
            const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
            const midnight = new Date(manila)
            midnight.setHours(24, 0, 0, 0)
            const diff = midnight.getTime() - manila.getTime()
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            const s = Math.floor((diff % 60000) / 1000)
            setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [])

    return (
        <div className={styles.banner} role="status" aria-live="polite">
            <span className={styles.slots}>
                <FaFire /> <strong>{slots} slots</strong> remaining ngayong araw
            </span>
            <span className={styles.timer}>
                Mag-e-expire sa: <strong className={styles.countdown}>{timeLeft || '--:--:--'}</strong>
            </span>
        </div>
    )
}
