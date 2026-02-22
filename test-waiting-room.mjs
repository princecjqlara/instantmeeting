/**
 * Waiting Room Auto-Remove Simulation
 * ─────────────────────────────────────
 * Uses Supabase service role directly to create isolated test data
 * so no manual setup is needed — just run:
 *
 *   node test-waiting-room.mjs
 *
 * Requires: dev server running at http://localhost:3000
 *           .env.local with SUPABASE_* and NEXT_PUBLIC_SUPABASE_* variables
 */

import { readFileSync } from 'fs'

// ─── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
    const env = {}
    try {
        const raw = readFileSync('.env.local', 'utf8')
        for (const line of raw.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const idx = trimmed.indexOf('=')
            if (idx < 0) continue
            const key = trimmed.slice(0, idx).trim()
            const val = trimmed.slice(idx + 1).trim()
            env[key] = val.replace(/^["']|["']$/g, '')
        }
    } catch {
        console.error('❌  Could not read .env.local')
        process.exit(1)
    }
    return env
}

const env = loadEnv()
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const BASE_URL = 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('\n❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local\n')
    process.exit(1)
}

// ─── Supabase REST helpers ────────────────────────────────────────────────────
const sbHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
}

async function sbInsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`sbInsert(${table}): ${JSON.stringify(json)}`)
    return Array.isArray(json) ? json[0] : json
}

async function sbSelect(table, filter) {
    const qs = Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&limit=1`, {
        headers: { ...sbHeaders, Prefer: 'return=representation' },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`sbSelect(${table}): ${JSON.stringify(json)}`)
    return json[0] ?? null
}

async function sbDelete(table, filter) {
    const qs = Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
        method: 'DELETE',
        headers: sbHeaders,
    })
}

// ─── HTTP helpers against the dev server ─────────────────────────────────────
async function httpPost(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return { status: res.status, data: await res.json() }
}

async function httpPatch(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return { status: res.status, data: await res.json() }
}

async function httpGet(path) {
    const res = await fetch(`${BASE_URL}${path}`)
    return { status: res.status, data: await res.json() }
}

// ─── Pretty print ─────────────────────────────────────────────────────────────
const C = { reset: '', green: '', red: '', cyan: '', yellow: '', bold: '' }
const pass = (msg) => console.log(`  [PASS] ${msg}`)
const fail = (msg) => console.log(`  [FAIL] ${msg}`)
const info = (msg) => console.log(`  [INFO] ${msg}`)
const sep = (title) => console.log(`\n=== ${title} ===`)

// ─── Create a real temporary test meeting in Supabase ─────────────────────────
async function createTestMeeting() {
    // Find the first user in the DB to be our "host"
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?limit=1`, { headers: sbHeaders })
    const users = await res.json()
    if (!users?.length) throw new Error('No users found in Supabase — create a user first.')
    const hostId = users[0].id

    const meeting = await sbInsert('meetings', {
        user_id: hostId,
        title: '[TEST] Auto-Delete Me',
        status: 'pending',
    })
    info(`Created test meeting id=${meeting.id}  (will be cleaned up)`)
    return { meeting, hostId }
}

// ─── SCENARIO A: Guest leaves the page ───────────────────────────────────────
async function scenarioA(meetingId) {
    sep('Scenario A — Guest navigates away (page leave)')

    // Step 1: Join waiting room
    const join = await httpPost('/api/waiting', { meetingId, guestName: 'Page Leave Guest' })
    if (join.status !== 200) { fail(`Join failed: ${JSON.stringify(join.data)}`); return }
    const guestId = join.data.id
    pass(`Guest joined  id=${guestId}  status=${join.data.status}`)

    // Step 2: Verify status via API
    const check = await httpGet(`/api/waiting?meetingId=${meetingId}&guestId=${guestId}`)
    const st = check.data?.guest?.status
    st === 'waiting' ? pass(`API shows status=waiting`) : fail(`Expected 'waiting', got '${st}'`)

    // Step 3: Simulate page-leave PATCH
    const leave = await httpPatch('/api/waiting', { guestId, status: 'left' })
    if (leave.status !== 200) { fail(`PATCH failed: ${JSON.stringify(leave.data)}`); return }
    pass(`PATCH accepted  status=${leave.data.status}  left_at=${leave.data.left_at}`)

    // Step 4: Verify in DB
    const row = await sbSelect('waiting_guests', { id: guestId })
    row?.status === 'left' ? pass(`DB confirms status=left`) : fail(`DB shows status=${row?.status}`)

    // Step 5: Verify dashboard filter
    const after = await httpGet(`/api/waiting?meetingId=${meetingId}&guestId=${guestId}`)
    const final = after.data?.guest?.status
    final === 'left' ? pass(`API returns status=left (would be filtered out in dashboard)`) : fail(`API status=${final}`)
}

// ─── SCENARIO B: Guest submits booking form ───────────────────────────────────
async function scenarioB(meetingId) {
    sep('Scenario B — Guest submits booking form (onSuccess)')

    const join = await httpPost('/api/waiting', { meetingId, guestName: 'Form Submit Guest' })
    if (join.status !== 200) { fail(`Join failed: ${JSON.stringify(join.data)}`); return }
    const guestId = join.data.id
    pass(`Guest joined  id=${guestId}`)

    // Simulate BookingModal onSuccess → PATCH
    const leave = await httpPatch('/api/waiting', { guestId, status: 'left' })
    if (leave.status !== 200) { fail(`onSuccess PATCH failed: ${JSON.stringify(leave.data)}`); return }
    pass(`onSuccess PATCH accepted  status=${leave.data.status}`)

    const row = await sbSelect('waiting_guests', { id: guestId })
    row?.status === 'left' ? pass(`DB confirms removed from waiting room`) : fail(`DB shows status=${row?.status}`)
}

// ─── SCENARIO C: Edge cases ───────────────────────────────────────────────────
async function scenarioC(meetingId) {
    sep('Scenario C — Edge cases')

    // 1. Invalid status rejected
    const join = await httpPost('/api/waiting', { meetingId, guestName: 'Edge Case Guest' })
    if (join.status !== 200) { fail(`Join failed`); return }
    const guestId = join.data.id

    const bad = await httpPatch('/api/waiting', { guestId, status: 'banned' })
    bad.status === 400
        ? pass(`Invalid status 'banned' correctly rejected (HTTP 400)`)
        : fail(`Expected 400 but got ${bad.status}`)

    // 2. Missing guestId rejected
    const noId = await httpPatch('/api/waiting', { status: 'left' })
    noId.status === 400
        ? pass(`Missing guestId correctly rejected (HTTP 400)`)
        : fail(`Expected 400 but got ${noId.status}`)

    // Cleanup
    await httpPatch('/api/waiting', { guestId, status: 'left' })
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════════════╗`)
    console.log(`║   Waiting Room Auto-Remove Simulation          ║`)
    console.log(`╚════════════════════════════════════════════════╝${C.reset}`)
    console.log(`  Server : ${BASE_URL}`)
    console.log(`  DB     : ${SUPABASE_URL}`)

    let meetingId, hostId
    try {
        const created = await createTestMeeting()
        meetingId = created.meeting.id
        hostId = created.hostId
    } catch (err) {
        console.error(`\n${C.red}  💥 Could not create test meeting:${C.reset}`, err.message)
        process.exit(1)
    }

    try {
        await scenarioA(meetingId)
        await scenarioB(meetingId)
        await scenarioC(meetingId)
    } catch (err) {
        console.error(`\n${C.red}  💥 Unexpected error:${C.reset}`, err.message)
    } finally {
        // ─── Cleanup: Delete all test records ─────────────────────────────────
        sep('Cleanup')
        await sbDelete('waiting_guests', { meeting_id: meetingId })
        await sbDelete('meetings', { id: meetingId })
        pass(`Test meeting and guests deleted from DB`)
    }

    console.log(`\n${C.bold}${C.green}  ✓ Simulation complete.${C.reset}\n`)
}

main()
