# Instant Meeting — Website Widget Architecture

Full technical specification for the embeddable website widget feature, including live visitor engagement, stealth screen mirroring, live broadcast, and universal in-app browser handoff.

---

## 1. Feature Overview

A JavaScript snippet that hosts paste on their own website. It enables:

1. **Embeddable booking form** — customizable fields, managed from Instant Meeting dashboard
2. **Real-time visitor presence** — host sees who is on their website live
3. **Stealth DOM mirror** — host can watch what visitors are doing on the page (scoped to host's own domain only)
4. **Live broadcast popup** — host goes "live" (Facebook Live style), visitors see a popup with video + chat
5. **Two-way chat** — visitors reply via text while watching the live broadcast
6. **Invite to meeting** — host clicks one button to pull a visitor into a real Instant Meeting room
7. **Universal in-app browser escape** — guests in Facebook/Messenger/Instagram/TikTok in-app browsers are auto-redirected to a real browser

---

## 2. High-Level System Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                  HOST SIDE (Instant Meeting App)                │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ /host/widget   │  │ /host/widget/  │  │ /host/widget/    │  │
│  │ (config page)  │  │ live (engage)  │  │ viewer/[session] │  │
│  │                │  │                │  │ (DOM mirror)     │  │
│  │ • Domains      │  │ • Visitor list │  │                  │  │
│  │ • Embed code   │  │ • Go live btn  │  │ • rrweb replay   │  │
│  │ • Form editor  │  │ • Invite btn   │  │ • Sandboxed iframe│ │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│           │                  ▲                    ▲             │
│           ▼                  │                    │             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supabase (Postgres + Realtime)              │  │
│  │  • widget_configs        • widget_visitors                │  │
│  │  • widget_chat_messages  • live_engage_sessions           │  │
│  │  • meeting_join_tokens   • dom_mirror_events (optional)   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬──────────────────────────────────────────┘
                      │
                      │  WebSocket (Supabase Realtime Channels)
                      │  + REST (config, submit, invite)
                      │
┌─────────────────────┼──────────────────────────────────────────┐
│                     ▼            GUEST SIDE                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  External website (joes-plumbing.com) — widget embedded  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  im-widget.js (loaded via <script> tag)            │  │  │
│  │  │  ├── core.ts        — boot, config fetch, channel  │  │  │
│  │  │  ├── form.ts        — booking form renderer        │  │  │
│  │  │  ├── presence.ts    — heartbeat / page tracking    │  │  │
│  │  │  ├── mirror.ts      — rrweb DOM streaming          │  │  │
│  │  │  ├── live-viewer.ts — broadcast popup + video      │  │  │
│  │  │  ├── chat.ts        — guest reply input            │  │  │
│  │  │  └── invite.ts      — meeting invite handler       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ instantmeeting.app (guest entry pages — wrapped by gate) │  │
│  │  ├── /j/[code]      — universal join token redirect      │  │
│  │  ├── /room/[id]     — WebRTC meeting room                │  │
│  │  ├── /waiting/[id]  — waiting room                       │  │
│  │  └── /b/[id]        — booking page                       │  │
│  │                                                           │  │
│  │  All wrapped by <BrowserGate> → escapes in-app browsers  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Embedding Model — How A Host Installs The Widget

### 3.1 Host Setup (Inside `/host/widget`)

```
┌──────────────────────────────────────────────────────────┐
│  🌐 Website Widget                          [Enabled ●]  │
│                                                           │
│  Step 1: Enter your website                              │
│  ┌─────────────────────────────────┐  [Add]              │
│  │ joes-plumbing.com               │                     │
│  └─────────────────────────────────┘                     │
│                                                           │
│  Domains:                                                 │
│  • joes-plumbing.com  ✓  [Remove]                        │
│  • joe-heating.com    ✓  [Remove]                        │
│                                                           │
│  Step 2: Copy embed code                                  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ <script src="https://instantmeeting.app/widget/     │ │
│  │ im.js" data-key="pk_a8f3k2m9x1b4n7p0"></script>    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                          [📋 Copy]        │
│                                                           │
│  Step 3: Customize form fields (reuses existing editor)  │
│                                                           │
│  Status: ✅ Connected — last visitor 2 min ago            │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Identity: How `data-key` Maps To Host

- On first visit to `/host/widget`, system generates `widget_key` for the user
- Format: `pk_` + 20 base58 chars (e.g. `pk_a8f3k2m9x1b4n7p0q5w2`)
- Stored in `users.widget_key` column (UNIQUE)
- Public-safe (like Stripe publishable key) — only identifies who, never grants writes
- On widget load: `GET /api/widget/config?key=pk_a8f3...`
- Server: `SELECT * FROM users WHERE widget_key = $1`
- Verifies request `Origin` header is in `users.widget_domains[]`
- Returns: host name, avatar, form fields, theme, and `channelId = widget-{user_id}`

### 3.3 Cross-Domain Mechanics

| Layer | Mechanism | Cross-Domain Behavior |
|-------|-----------|----------------------|
| Script load | `<script src>` | No restriction — works like Google Analytics |
| API fetch  | `fetch()` | CORS — server sets `Access-Control-Allow-Origin` based on `widget_domains` |
| Realtime   | Supabase WebSocket | No same-origin restriction — works from any page |

---

## 4. Database Schema

### 4.1 New Columns On `users`

```sql
ALTER TABLE users ADD COLUMN widget_key TEXT UNIQUE;
ALTER TABLE users ADD COLUMN widget_domains TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN widget_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN widget_form_fields JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN widget_theme JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN widget_mirror_enabled BOOLEAN DEFAULT false;

CREATE INDEX idx_users_widget_key ON users(widget_key);
```

### 4.2 New Tables

```sql
-- Active visitors on host websites
CREATE TABLE widget_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,           -- generated client-side, persistent in localStorage
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  current_page_url TEXT,
  current_page_title TEXT,
  scroll_depth INTEGER DEFAULT 0,
  status TEXT DEFAULT 'browsing',     -- browsing | engaged | in_call | invited | joined | left
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',        -- { browser, device, referrer, country }
  mirror_active BOOLEAN DEFAULT false,
  claimed_by UUID REFERENCES users(id), -- which team member is engaging this visitor
  UNIQUE(host_id, session_id)
);

CREATE INDEX idx_visitors_host ON widget_visitors(host_id, last_heartbeat_at DESC);
CREATE INDEX idx_visitors_status ON widget_visitors(host_id, status);

-- Live broadcast sessions
CREATE TABLE live_engage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'live',         -- live | ended
  stream_type TEXT DEFAULT 'video',   -- video | audio
  livekit_room TEXT,                  -- LiveKit room name
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Chat messages between guests and host (during live or browsing)
CREATE TABLE widget_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visitor_session_id TEXT NOT NULL,
  sender TEXT NOT NULL,               -- 'host' | 'guest'
  sender_name TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_session ON widget_chat_messages(host_id, visitor_session_id, created_at);

-- Universal join tokens (used for invite handoff + any guest entry redirect)
CREATE TABLE meeting_join_tokens (
  code TEXT PRIMARY KEY,              -- 6-char base58 (e.g. "x8k2m9")
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  visitor_session_id TEXT,
  widget_context JSONB,               -- pages visited, form data, chat history
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '10 minutes',
  consumed BOOLEAN DEFAULT false
);

CREATE INDEX idx_join_tokens_expires ON meeting_join_tokens(expires_at) WHERE consumed = false;

-- Optional: persisted DOM mirror events (for replay later)
CREATE TABLE dom_mirror_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_session_id TEXT NOT NULL,
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_data JSONB NOT NULL,          -- rrweb event
  timestamp_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mirror_session ON dom_mirror_events(visitor_session_id, timestamp_ms);
```

### 4.3 Row-Level Security

```sql
ALTER TABLE widget_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_engage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_join_tokens ENABLE ROW LEVEL SECURITY;

-- Hosts can read/write only their own visitors
CREATE POLICY "host_owns_visitors" ON widget_visitors
  USING (host_id = auth.uid());

-- Same for chat, live sessions
CREATE POLICY "host_owns_chat" ON widget_chat_messages
  USING (host_id = auth.uid());

CREATE POLICY "host_owns_live" ON live_engage_sessions
  USING (host_id = auth.uid());

-- Join tokens: read-only via service role for /j/[code] route
-- Public widget submissions go through service-role API routes (bypass RLS)
```

---

## 5. API Routes (Next.js App Router)

### 5.1 Public (Widget-Facing)

| Method | Route | Purpose |
|--------|-------|---------|
| GET    | `/api/widget/config?key={pk}` | Returns form fields, theme, host info, channel id. Validates origin. |
| POST   | `/api/widget/submit`          | Guest submits booking form → creates `meetings` + `waiting_guests` row |
| POST   | `/api/widget/presence`        | Guest heartbeat (also sent via Realtime broadcast for speed) |
| POST   | `/api/widget/chat`            | Guest sends chat message |
| POST   | `/api/widget/invite/accept`   | Guest accepted invite → creates `meeting_join_tokens` entry |
| GET    | `/api/widget/health?key={pk}` | Used by dashboard "Status" indicator |

### 5.2 Host (Authenticated)

| Method | Route | Purpose |
|--------|-------|---------|
| GET    | `/api/host/widget/config`     | Get current widget config |
| PUT    | `/api/host/widget/config`     | Update domains, form fields, theme, toggles |
| POST   | `/api/host/widget/regenerate` | Regenerate widget_key (security rotation) |
| GET    | `/api/host/widget/visitors`   | List active visitors |
| POST   | `/api/host/widget/invite`     | Send invite to specific visitor |
| POST   | `/api/host/widget/live/start` | Start live broadcast session |
| POST   | `/api/host/widget/live/end`   | End live broadcast session |
| POST   | `/api/host/widget/mirror/start` | Activate DOM mirror for visitor |
| POST   | `/api/host/widget/mirror/stop`  | Deactivate mirror |

### 5.3 Universal Join Route

| Method | Route | Purpose |
|--------|-------|---------|
| GET    | `/j/[code]`                   | Validates token, restores context, redirects to `/room/[id]` |

---

## 6. Realtime Channels (Supabase Broadcast)

### 6.1 Channel: `widget-{hostId}`

Bidirectional channel between widget instances and host dashboard.

**Guest → Host events:**

```ts
type GuestSignal =
  | { event: 'visitor:join';      payload: { sessionId, page, title, referrer, device } }
  | { event: 'visitor:heartbeat'; payload: { sessionId, page, scrollDepth, timeOnPage } }
  | { event: 'visitor:navigate';  payload: { sessionId, fromPage, toPage } }
  | { event: 'visitor:leave';     payload: { sessionId } }
  | { event: 'visitor:form-open'; payload: { sessionId } }
  | { event: 'visitor:form-submit'; payload: { sessionId, formData } }
  | { event: 'guest:chat';        payload: { sessionId, text, timestamp } }
  | { event: 'invite:accept';     payload: { sessionId } }
  | { event: 'invite:decline';    payload: { sessionId } }
```

**Host → Guest events:**

```ts
type HostSignal =
  | { event: 'live:start';     payload: { hostName, streamType, livekitRoom } }
  | { event: 'live:end';       payload: {} }
  | { event: 'host:chat';      payload: { sessionId, hostName, text } }
  | { event: 'invite:meeting'; payload: { sessionId, joinCode, hostName } }
  | { event: 'mirror:request'; payload: { sessionId } }
  | { event: 'mirror:stop';    payload: { sessionId } }
```

### 6.2 Channel: `mirror-{hostId}-{sessionId}`

Private high-throughput channel for DOM mirror events. Only the targeted visitor publishes; only the host subscribes.

```ts
type MirrorEvent =
  | { event: 'mirror:snapshot'; payload: { rrwebEvents: Event[] } }   // initial full DOM
  | { event: 'mirror:incremental'; payload: { rrwebEvents: Event[] } } // mutations
```

### 6.3 Channel: `live-{liveSessionId}`

LiveKit room channel for one-to-many broadcast (host video → multiple visitors).

---

## 7. Widget Script Architecture

### 7.1 Build Pipeline

The widget is built as a **standalone bundle**, separate from the Next.js app:

```
src/widget/
├── index.ts              -- entry point
├── core/
│   ├── boot.ts           -- script init, read data-key, fetch config
│   ├── identity.ts       -- generate/restore session id from localStorage
│   ├── transport.ts      -- Supabase channel wrapper
│   └── api-client.ts     -- typed fetch wrapper
├── modules/
│   ├── form.ts           -- booking form renderer (in iframe)
│   ├── presence.ts       -- heartbeat loop, page tracking
│   ├── mirror.ts         -- rrweb integration, mutation streaming
│   ├── live-viewer.ts    -- LiveKit subscriber, video popup
│   ├── chat.ts           -- chat input + message feed
│   ├── invite.ts         -- invite popup, browser detection, redirect
│   └── ui/
│       ├── shadow-root.ts  -- creates isolated shadow DOM container
│       ├── popup.ts        -- generic popup component
│       └── styles.css      -- scoped widget styles
└── utils/
    ├── detect-in-app.ts    -- in-app browser detection
    ├── throttle.ts
    └── safe-storage.ts     -- localStorage with try/catch

build/
└── im.js                 -- bundled output (ESBuild, ~40KB gzipped target)
```

Build command: `npm run build:widget` → outputs to `public/widget/im.js`

### 7.2 Boot Sequence

```
1. <script src="im.js" data-key="pk_..."> loads
2. boot.ts reads data-key from current script element
3. Generate or restore sessionId from localStorage("im_session")
4. Fetch GET /api/widget/config?key=pk_... 
   ├── If 403 (origin not whitelisted) → silent abort
   ├── If 404 (key not found) → silent abort
   └── If 200 → continue
5. Create shadow DOM container attached to <body>
6. Connect to Supabase Realtime: channel widget-{hostId}
7. Send visitor:join broadcast
8. Initialize modules based on config flags:
   ├── form: always
   ├── presence: always (heartbeat every 10s)
   ├── mirror: only if config.mirror_enabled AND domain matches
   ├── live-viewer: lazy (only when live:start received)
   └── chat: lazy
9. Attach pagehide listener → send visitor:leave
```

### 7.3 Bundle Size Budget

| Module | Target |
|--------|--------|
| Core (boot, identity, transport) | 8 KB |
| Supabase realtime client (subset) | 12 KB |
| Form renderer | 4 KB |
| Presence | 1 KB |
| Mirror (rrweb) | 25 KB (lazy-loaded) |
| Live viewer (LiveKit client) | 30 KB (lazy-loaded) |
| Chat + Invite + UI | 5 KB |
| **Initial load total** | **~30 KB gzipped** |
| **Full feature set** | **~85 KB gzipped** |

Mirror and live-viewer are **lazy-loaded** via dynamic import only when triggered.

---

## 8. Universal In-App Browser Escape Layer

### 8.1 The Problem

In-app browsers (Facebook, Messenger, Instagram, TikTok, LinkedIn, Line, WeChat) cannot reliably:
- Use WebRTC (camera/mic blocked or unstable)
- Open new tabs
- Persist meaningful state across navigations

**Solution:** A single `<BrowserGate>` component that wraps every guest-facing page.

### 8.2 BrowserGate Component

```
src/components/BrowserGate.tsx

Wraps any page that needs WebRTC or stable browser features.
If in-app browser detected → renders <EscapeScreen>.
Otherwise → renders children normally.
```

```tsx
function BrowserGate({ children }: { children: React.ReactNode }) {
  const [env, setEnv] = useState<InAppEnv | null>(null)
  
  useEffect(() => {
    setEnv(detectInAppBrowser())
  }, [])
  
  if (env === null) return null  // SSR safety
  if (env.isInApp)  return <EscapeScreen currentUrl={window.location.href} env={env} />
  return <>{children}</>
}
```

### 8.3 Pages Wrapped

```
src/app/j/[code]/page.tsx       → <BrowserGate>
src/app/room/[id]/page.tsx      → <BrowserGate>
src/app/waiting/[id]/page.tsx   → <BrowserGate>
src/app/b/[id]/page.tsx         → <BrowserGate>

NOT wrapped:
src/app/host/**                  (host uses real browser already)
src/app/api/**                   (server routes)
src/app/(marketing pages)         (no WebRTC needed)
```

### 8.4 Detection Logic

```ts
// src/lib/detect-in-app-browser.ts

export interface InAppEnv {
  isInApp: boolean
  isAndroid: boolean
  isiOS: boolean
  appName: 'facebook' | 'messenger' | 'instagram' | 'tiktok' | 
           'linkedin' | 'line' | 'wechat' | null
}

export function detectInAppBrowser(): InAppEnv {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  
  const isFacebook  = /FBAN|FBAV/i.test(ua)
  const isMessenger = /Messenger/i.test(ua)
  const isInstagram = /Instagram/i.test(ua)
  const isTikTok    = /musical_ly|BytedanceWebview/i.test(ua)
  const isLinkedIn  = /LinkedInApp/i.test(ua)
  const isLine      = /\bLine\//i.test(ua)
  const isWeChat    = /MicroMessenger/i.test(ua)
  
  const isInApp = isFacebook || isMessenger || isInstagram || 
                  isTikTok || isLinkedIn || isLine || isWeChat
  
  return {
    isInApp,
    isAndroid: /Android/i.test(ua),
    isiOS: /iPhone|iPad|iPod/i.test(ua),
    appName: isFacebook ? 'facebook' :
             isMessenger ? 'messenger' :
             isInstagram ? 'instagram' :
             isTikTok ? 'tiktok' :
             isLinkedIn ? 'linkedin' :
             isLine ? 'line' :
             isWeChat ? 'wechat' : null
  }
}
```

### 8.5 EscapeScreen UI

```
┌──────────────────────────────────────┐
│              🎥                       │
│                                       │
│   Open this in your browser           │
│                                       │
│   Video calls don't work inside       │
│   {appName}. Tap below to continue.   │
│                                       │
│   ┌─────────────────────────────┐     │
│   │  📱 Open in Browser         │     │  ← <a href> tag
│   └─────────────────────────────┘     │
│                                       │
│   Or copy this link:                  │
│   ┌─────────────────────────────┐     │
│   │ instantmeeting.app/j/x8k2m9 │ 📋  │
│   └─────────────────────────────┘     │
│                                       │
│   For iOS: Tap ⋯ → Open in Safari     │
│   (shown only if appName==messenger)  │
└──────────────────────────────────────┘
```

### 8.6 Handoff Mechanics

```tsx
function EscapeScreen({ currentUrl, env }: Props) {
  function handleOpen(e: React.MouseEvent) {
    if (env.isAndroid) {
      e.preventDefault()
      const stripped = currentUrl.replace(/^https?:\/\//, '')
      window.location.href = 
        `intent://${stripped}#Intent;scheme=https;` +
        `package=com.android.chrome;end`
      return
    }
    // iOS: do nothing — let <a target="_blank"> tap behavior trigger Safari
    // Desktop in-app: same — target=_blank handles it
  }
  
  return (
    <div className="escape-screen">
      <h1>Open this in your browser</h1>
      <p>Video calls don't work inside {env.appName}.</p>
      <a href={currentUrl} 
         target="_blank" 
         rel="noopener noreferrer"
         onClick={handleOpen}
         className="open-button">
        📱 Open in Browser
      </a>
      <CopyLinkBox url={currentUrl} />
    </div>
  )
}
```

### 8.7 Why This Universal Layer Works For Every Entry Point

| Entry point | Behavior |
|-------------|----------|
| Widget invite popup → tap link in Messenger | Lands on `/j/x8k2m9` in Messenger browser → BrowserGate intercepts → escape screen → user taps → Safari/Chrome opens same URL → BrowserGate passes through → token consumed → redirect to room |
| Booking link shared in Instagram bio | Same flow on `/b/[id]` |
| Direct meeting link in WhatsApp | Same flow on `/room/[id]` |
| Waiting room link forwarded | Same flow on `/waiting/[id]` |

One component, fixes all share scenarios.

---

## 9. Universal Join Token System

### 9.1 Purpose

Provides short, pretty URLs for any guest meeting entry. Survives browser switches by storing context in DB.

### 9.2 Code Format

```ts
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function generateJoinCode(): string {
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

// Output: "x8k2m9", "Xn4w8R", etc.
// 58^6 = ~38 billion combinations (collision risk negligible for 10-min TTL)
```

### 9.3 Token Lifecycle

```
1. Host clicks "Invite to Meeting" on a visitor
   → POST /api/host/widget/invite { sessionId }
   
2. Server:
   ├── Creates meetings row (status='active', no scheduled_at, source='widget')
   ├── Generates join code
   ├── INSERT meeting_join_tokens (code, meeting_id, visitor_session_id, widget_context)
   ├── Broadcasts invite:meeting to widget channel with the code
   
3. Widget receives invite signal
   → Shows popup with link instantmeeting.app/j/{code}
   
4. Guest taps link
   → Browser navigates to /j/{code}
   → BrowserGate runs (escapes if in-app)
   → /j/[code]/page.tsx server-loads token
   ├── Validates: not expired, not consumed
   ├── Marks consumed = true
   ├── Restores widget_context to localStorage (sessionStorage)
   ├── Redirects to /room/{meeting_id}?from=widget
   
5. /room/[id] loads inside BrowserGate (passes through)
   → WebRTC starts
   → Host enters meeting with full visitor context preserved
```

### 9.4 Cleanup

```sql
-- Cron job (daily): purge expired/consumed tokens
DELETE FROM meeting_join_tokens 
WHERE expires_at < now() - INTERVAL '1 day';
```

---

## 10. DOM Mirror System (Stealth Screen View)

### 10.1 Scope Rules (Hard Constraints)

DOM mirror **only runs** when:
1. `widget_configs.mirror_enabled = true` for the host
2. The guest is on a domain in `users.widget_domains[]` (the host's own website)
3. Host has explicitly clicked "View Screen" on this specific visitor (`mirror:request` signal received)

DOM mirror **never runs** on:
- `instantmeeting.app/room/*` (already have WebRTC video)
- `instantmeeting.app/j/*` (handoff page, no purpose)
- Any domain not in the host's whitelist

### 10.2 Library: rrweb

[rrweb](https://github.com/rrweb-io/rrweb) is the de-facto standard for DOM recording. It captures:
- Initial DOM snapshot (full HTML/CSS)
- Mutation observers (DOM changes)
- Mouse movements and clicks
- Scroll position
- Viewport size
- Input changes (with masking support)

### 10.3 Privacy Defaults

```ts
import { record } from 'rrweb'

record({
  emit(event) {
    sendOverChannel(event)
  },
  // Always mask password fields
  maskInputOptions: {
    password: true,
    email: false,    // host wants to see emails
    tel: false,
  },
  // Mask any element with class "im-mask"
  maskTextSelector: '.im-mask, [data-im-mask]',
  // Block sensitive elements entirely
  blockClass: 'im-block',
  blockSelector: 'input[type="password"], input[autocomplete*="cc-"]',
  // Sample mouse movement to reduce bandwidth
  sampling: {
    mousemove: 50,    // 20fps
    scroll: 100,      // 10fps
    input: 'last',
  }
})
```

### 10.4 Streaming Architecture

```
Guest browser                Supabase                  Host browser
─────────────                ────────                  ────────────
  │                             │                          │
  │ rrweb.record()              │                          │
  │   ↓                         │                          │
  │ event buffer (50ms)         │                          │
  │   ↓                         │                          │
  │ channel.send(events)        │                          │
  ├────────────────────────────►│                          │
  │                             │ broadcast                │
  │                             ├─────────────────────────►│
  │                             │                          │
  │                             │              rrweb.Replayer
  │                             │              .addEvent(events)
  │                             │              renders in iframe
```

### 10.5 Bandwidth & Performance

- Average DOM mutation event: ~200 bytes
- Initial snapshot: 50–500 KB depending on page complexity
- Steady-state stream: 1–5 KB/sec
- Disabled on mobile by default (battery/data)
- Guest can be unaware (no UI indicator) — but **legally required** to disclose in host's privacy policy

### 10.6 Host Viewer Component

```
src/components/widget/DomMirrorViewer.tsx

Renders inside /host/widget/viewer/[sessionId]
├── Sandboxed iframe (no script execution)
├── rrweb.Replayer streams events into the iframe
├── "Live" indicator + visitor info overlay
├── Pause/Resume button
└── "Invite to Meeting" button (one-click)
```

---

## 11. Live Broadcast System (Facebook Live Style)

### 11.1 Architecture: LiveKit SFU

WebRTC P2P doesn't scale beyond 3 participants. For one-to-many broadcast (1 host → many visitors), use a Selective Forwarding Unit (SFU).

**Choice: LiveKit** (open-source, self-hostable, has a managed cloud option)

```
Host                  LiveKit SFU                Visitors
────                  ───────────                ────────
  │                       │                      │  │  │
  │ publish video         │                      │  │  │
  ├──────────────────────►│ forward stream       │  │  │
  │                       ├─────────────────────►│  │  │
  │                       ├────────────────────────►│  │
  │                       ├───────────────────────────►│
  │                       │                      │  │  │
```

### 11.2 Flow

```
1. Host clicks "Go Live" on /host/widget/live
   → POST /api/host/widget/live/start
   ├── Creates live_engage_sessions row
   ├── Generates LiveKit room name + access token
   ├── Returns to host: { livekitUrl, accessToken, sessionId }
   ├── Broadcasts live:start to widget channel
   
2. Host browser connects to LiveKit, publishes camera+mic
   
3. Each active widget instance receives live:start
   → Shows popup: "🔴 [Host] is live"
   → Guest taps popup
   → Lazy-loads live-viewer module + LiveKit client
   → Connects to LiveKit room as viewer (subscribe-only)
   → Renders host video stream in popup
   
4. Guest types chat message
   → POST /api/widget/chat (or via Supabase broadcast for speed)
   → Shows in feed for everyone watching + host dashboard
   
5. Host clicks "Invite [Maria] to Private Meeting"
   → Triggers invite flow (section 9)
   → Maria gets popup over the live stream
   → Maria taps → join token → /j/[code] → meeting room
   
6. Host clicks "End Live"
   → POST /api/host/widget/live/end
   → Broadcasts live:end → all widgets hide popup
   → live_engage_sessions.status = 'ended'
```

### 11.3 Widget Live Popup UI

```
Bottom-right corner of host's website:

┌────────────────────────────┐
│ 🔴 LIVE  Joe from Plumbing │
│ ┌────────────────────────┐ │
│ │                        │ │
│ │   [Host video feed]    │ │
│ │                        │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ Joe: Hi everyone!      │ │
│ │ Maria: Looking for...  │ │
│ │ Joe: I can help! Let   │ │
│ │   me show you...       │ │
│ ├────────────────────────┤ │
│ │ Type a message...      │ │
│ └────────────────────────┘ │
│  [Minimize]  [Close]       │
└────────────────────────────┘
```

---

## 12. Frontend File Structure (Full)

```
src/
├── app/
│   ├── j/
│   │   └── [code]/
│   │       └── page.tsx              -- universal join token redirect
│   ├── room/[id]/page.tsx            -- WRAP with <BrowserGate>
│   ├── waiting/[meetingId]/page.tsx  -- WRAP with <BrowserGate>
│   ├── b/[id]/page.tsx               -- public booking page (new)
│   ├── host/
│   │   ├── widget/
│   │   │   ├── page.tsx              -- main config page (Step 1-3 UI)
│   │   │   ├── live/
│   │   │   │   └── page.tsx          -- live engage panel
│   │   │   └── viewer/
│   │   │       └── [sessionId]/
│   │   │           └── page.tsx      -- DOM mirror viewer
│   │   └── (existing pages)
│   └── api/
│       ├── widget/
│       │   ├── config/route.ts
│       │   ├── submit/route.ts
│       │   ├── presence/route.ts
│       │   ├── chat/route.ts
│       │   ├── invite/accept/route.ts
│       │   └── health/route.ts
│       └── host/
│           └── widget/
│               ├── config/route.ts
│               ├── regenerate/route.ts
│               ├── visitors/route.ts
│               ├── invite/route.ts
│               ├── live/start/route.ts
│               ├── live/end/route.ts
│               └── mirror/[start|stop]/route.ts
│
├── components/
│   ├── BrowserGate.tsx               -- universal in-app escape wrapper
│   ├── EscapeScreen.tsx              -- escape UI shown by gate
│   ├── CopyLinkBox.tsx               -- copyable URL component
│   └── widget/
│       ├── WidgetConfigPanel.tsx     -- domains + form editor
│       ├── WidgetEmbedCode.tsx       -- copy-paste snippet
│       ├── WidgetStatusBadge.tsx     -- "Connected" indicator
│       ├── LiveEngagePanel.tsx       -- visitor list + actions
│       ├── VisitorCard.tsx           -- single visitor row
│       ├── DomMirrorViewer.tsx       -- rrweb replayer
│       ├── LiveBroadcastControls.tsx -- go live UI
│       └── ChatFeed.tsx              -- shared chat component
│
├── lib/
│   ├── detect-in-app-browser.ts      -- shared with widget bundle
│   ├── widget-key.ts                 -- generate / validate widget keys
│   ├── join-tokens.ts                -- create + consume tokens
│   ├── widget-realtime.ts            -- channel name helpers
│   └── (existing files)
│
├── widget/                           -- separate bundle source
│   ├── index.ts
│   ├── core/
│   │   ├── boot.ts
│   │   ├── identity.ts
│   │   ├── transport.ts
│   │   └── api-client.ts
│   ├── modules/
│   │   ├── form.ts
│   │   ├── presence.ts
│   │   ├── mirror.ts
│   │   ├── live-viewer.ts
│   │   ├── chat.ts
│   │   └── invite.ts
│   ├── ui/
│   │   ├── shadow-root.ts
│   │   ├── popup.ts
│   │   └── styles.css
│   └── utils/
│       ├── detect-in-app.ts          -- mirrored from src/lib
│       ├── throttle.ts
│       └── safe-storage.ts
│
└── public/
    └── widget/
        ├── im.js                     -- built widget bundle (output)
        └── im.js.map                 -- sourcemap
```

---

## 13. Build Pipeline

### 13.1 Widget Bundle (Separate From Next.js)

```json
// package.json scripts
{
  "build:widget": "esbuild src/widget/index.ts --bundle --minify --format=iife --outfile=public/widget/im.js --target=es2018 --sourcemap",
  "watch:widget": "npm run build:widget -- --watch",
  "build": "next build && npm run build:widget"
}
```

### 13.2 Versioning

- Bundle URL is **always** `instantmeeting.app/widget/im.js` (latest)
- For hosts wanting a stable pin: `instantmeeting.app/widget/v1/im.js`
- Cache headers: `Cache-Control: public, max-age=300, must-revalidate`
- Hash-based filename for internal modules (lazy chunks)

---

## 14. Security Model

### 14.1 Public Key (`widget_key`)

- Format: `pk_` + 20 base58 chars
- Stored in `users.widget_key`
- Public-safe (cannot grant writes by itself)
- Server validates: every request includes origin → check against `widget_domains[]`

### 14.2 Domain Whitelisting

- `GET /api/widget/config` reads `Origin` header
- If origin not in `widget_domains` → return 403 silently
- Realtime channel access also gated by domain check on subscription

### 14.3 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /api/widget/submit`   | 5 per IP per hour |
| `POST /api/widget/presence` | 30 per session per minute |
| `POST /api/widget/chat`     | 20 per session per minute |
| `GET /api/widget/config`    | 60 per IP per minute |

Implementation: in-memory LRU + Supabase fallback for distributed limit.

### 14.4 RLS Policies

- All `widget_*` tables: host can only see their own data
- `meeting_join_tokens`: server-only access (service role)
- Public widget routes use service role + manual auth checks

### 14.5 Privacy Compliance

- DOM mirror requires `users.widget_mirror_enabled = true` (off by default)
- Host must agree to disclosure in privacy policy (acknowledgement checkbox)
- Sensitive inputs always masked
- GDPR delete: `DELETE FROM widget_visitors WHERE host_id = $1 AND visitor_email = $2`

---

## 15. Notifications (Host Awareness)

To prevent missed visitors, multiple notification channels:

### 15.1 In-App (Always On)

- Dashboard shows live count in nav badge
- Sound plays when new visitor joins (host-toggleable)
- Title flashes "(1) New visitor — Instant Meeting"

### 15.2 Browser Push (Opt-In)

```
On /host/widget first visit:
  → Prompt: "Get notified when visitors arrive on your site"
  → Web Push API subscription
  → Stored in: user_push_subscriptions table
  → On visitor:join → server sends push if no active dashboard tab
```

### 15.3 Email/SMS Fallback (Future Phase)

If no host online for X seconds AND visitor still on site → email/SMS alert.

---

## 16. Lead Pipeline Integration

### 16.1 Form Submissions

Widget form submit → `POST /api/widget/submit`:

```
1. Create meetings row:
   ├── user_id = host_id
   ├── status = 'pending'
   ├── scheduled_at = (from form) or null for "talk now"
   ├── ai_objective = host's default
   └── source = 'widget'  -- new column
   
2. Create waiting_guests row:
   ├── meeting_id
   ├── guest_name, guest_email, guest_phone
   ├── custom_fields (JSONB form responses)
   └── status = 'waiting'
   
3. Update widget_visitors row:
   ├── visitor_name, visitor_email
   └── status = 'engaged'
   
4. Existing leads page (/host/leads) shows new lead automatically
```

### 16.2 Webhook Out (Future)

```
users.widget_webhook_url
  → POST to host's CRM on every form submit
  → Payload includes: lead data + visitor context (pages, time, chat)
```

---

## 17. Concurrency & Multi-Team Handling

### 17.1 Visitor Claim Lock

When two team members both click "Engage" on the same visitor:

```sql
UPDATE widget_visitors 
SET claimed_by = $team_member_id, status = 'engaged'
WHERE id = $visitor_id 
  AND claimed_by IS NULL
RETURNING *;
```

If RETURNING is empty → another member already claimed → show toast "Already engaged by [Name]".

### 17.2 Round-Robin Live Engage

Reuses existing `team_members` + `clock_sessions` tables. If team mode is on:
- New visitors auto-assigned to next available clocked-in member
- Member's dashboard highlights their assigned visitor
- Other members see visitor in read-only mode

---

## 18. Failure Modes & Resilience

| Failure | Behavior |
|---------|----------|
| Supabase Realtime down | Widget falls back to polling `/api/widget/presence` every 15s |
| `im.js` blocked by ad blocker | Silent — no widget appears (no degraded experience) |
| Host's CSP blocks the script | Host sees a setup warning in dashboard ("Your CSP needs to allow instantmeeting.app") |
| LiveKit down | Live broadcast feature disabled, chat still works |
| Mirror events too large | Auto-throttle, drop frames |
| Token expired before guest taps link | Guest sees "This invite has expired, please ask the host for a new one" |
| Guest's connection drops mid-mirror | Mirror stops, visitor marked as 'left' after 30s no heartbeat |
| Two browser tabs same visitor | Two sessionIds, both shown in dashboard (acceptable) |

---

## 19. Implementation Phases

### Phase 0: Universal Browser Gate (Foundation)
**Files:**
- `src/lib/detect-in-app-browser.ts`
- `src/components/BrowserGate.tsx`
- `src/components/EscapeScreen.tsx`
- `src/components/CopyLinkBox.tsx`
- Wrap existing `src/app/room/[id]/page.tsx` and `src/app/waiting/[meetingId]/page.tsx`

**Why first:** Standalone, no dependencies, immediately useful for existing flows.

### Phase 1: Widget Config Page
**Files:**
- `src/app/host/widget/page.tsx`
- `src/components/widget/WidgetConfigPanel.tsx`
- `src/components/widget/WidgetEmbedCode.tsx`
- `src/lib/widget-key.ts`
- Migration: add columns to `users`
- API: `GET/PUT /api/host/widget/config`, `POST /api/host/widget/regenerate`
- Add nav link "Website Widget" to host dashboard

### Phase 2: Widget Bundle + Booking Form
**Files:**
- `src/widget/` directory (full structure)
- `package.json` build scripts
- `public/widget/im.js` (output)
- API: `GET /api/widget/config`, `POST /api/widget/submit`
- Booking form module

### Phase 3: Real-Time Visitor Presence
**Files:**
- `src/widget/modules/presence.ts`
- `src/app/host/widget/live/page.tsx`
- `src/components/widget/LiveEngagePanel.tsx`
- `src/components/widget/VisitorCard.tsx`
- Migration: `widget_visitors` table
- Notification sounds + browser push

### Phase 4: Universal Join Tokens + Invite Flow
**Files:**
- `src/app/j/[code]/page.tsx`
- `src/lib/join-tokens.ts`
- `src/widget/modules/invite.ts`
- API: `POST /api/host/widget/invite`, `POST /api/widget/invite/accept`
- Migration: `meeting_join_tokens` table

### Phase 5: Live Broadcast + Chat
**Files:**
- LiveKit setup (server credentials, room management)
- `src/widget/modules/live-viewer.ts`
- `src/widget/modules/chat.ts`
- `src/components/widget/LiveBroadcastControls.tsx`
- `src/components/widget/ChatFeed.tsx`
- Migration: `live_engage_sessions`, `widget_chat_messages`

### Phase 6: DOM Mirror (Stealth Screen View)
**Files:**
- `src/widget/modules/mirror.ts` (rrweb integration)
- `src/app/host/widget/viewer/[sessionId]/page.tsx`
- `src/components/widget/DomMirrorViewer.tsx`
- Privacy policy generator + opt-in flow

---

## 20. Open Questions / Decisions Deferred

1. **LiveKit hosting**: self-host vs. LiveKit Cloud (decide before Phase 5)
2. **rrweb persistence**: stream-only vs. record to DB for replay (Phase 6)
3. **Mobile widget**: collapse to a button on small screens? (Phase 2)
4. **White-label**: custom widget domain for tenants (future)
5. **Webhook out**: push form submits to external CRMs (future)
6. **Analytics dashboard**: visitor → conversion funnel (future)

---

## 21. Reference Comparisons

| Feature | Comparable Product |
|---------|-------------------|
| Embed widget | Intercom, Crisp, Tawk.to |
| Booking form | Calendly, Cal.com |
| Visitor presence | Drift, HubSpot Live |
| DOM mirror | Hotjar, FullStory, LogRocket |
| Live broadcast | Facebook Live, Twitch |
| In-app browser escape | Calendly's deep link handler |

This combines all of the above into a single product for live sales engagement.

---

**End of architecture document.**
