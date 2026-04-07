/*! Instant Meeting Widget — vanilla JS bundle */
(function () {
    'use strict'
    if (window.__IM_WIDGET_LOADED__) return
    window.__IM_WIDGET_LOADED__ = true

    var script = document.currentScript || (function () {
        var s = document.getElementsByTagName('script')
        return s[s.length - 1]
    })()
    var key = script && script.getAttribute('data-key')
    if (!key) return

    // Origin = where the widget script was served from (the IM app)
    var src = script.getAttribute('src') || ''
    var apiBase = ''
    try { apiBase = new URL(src, location.href).origin } catch (e) { return }

    // ---- session id (persistent) ----
    var sessionId
    try {
        sessionId = localStorage.getItem('im_session')
        if (!sessionId) {
            sessionId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
            localStorage.setItem('im_session', sessionId)
        }
    } catch (e) {
        sessionId = 'v_' + Math.random().toString(36).slice(2)
    }

    var config = null
    var inviteCode = null

    // ---- fetch config ----
    fetch(apiBase + '/api/widget/config?key=' + encodeURIComponent(key))
        .then(function (r) { return r.ok ? r.json() : null })
        .then(function (cfg) {
            if (!cfg) return
            config = cfg
            init()
        })
        .catch(function () { /* silent */ })

    function init() {
        injectStyles()
        renderLauncher()
        startPresence()
        startInvitePoll()
    }

    function injectStyles() {
        var css = [
            '.im-launcher{position:fixed;bottom:20px;right:20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:26px;border:none;font-family:system-ui,sans-serif}',
            '.im-launcher:hover{transform:scale(1.05)}',
            '.im-panel{position:fixed;bottom:90px;right:20px;z-index:2147483000;width:340px;max-width:calc(100vw - 40px);max-height:75vh;overflow:auto;background:#fff;color:#222;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.3);font-family:system-ui,sans-serif;padding:20px}',
            '.im-panel h3{margin:0 0 12px;font-size:18px}',
            '.im-field{margin-bottom:10px;display:flex;flex-direction:column;gap:4px}',
            '.im-field label{font-size:12px;color:#555;font-weight:600}',
            '.im-field input,.im-field textarea{padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-family:inherit}',
            '.im-btn{width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px}',
            '.im-close{position:absolute;top:10px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:#999}',
            '.im-invite{position:fixed;bottom:90px;right:20px;z-index:2147483001;background:#0f9d58;color:#fff;padding:18px 22px;border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.4);font-family:system-ui,sans-serif;max-width:320px}',
            '.im-invite a{display:inline-block;margin-top:10px;padding:10px 18px;background:#fff;color:#0f9d58;border-radius:8px;text-decoration:none;font-weight:700}',
        ].join('\n')
        var style = document.createElement('style')
        style.textContent = css
        document.head.appendChild(style)
    }

    var launcher, panel
    function renderLauncher() {
        launcher = document.createElement('button')
        launcher.className = 'im-launcher'
        launcher.title = 'Talk to ' + (config.hostName || 'us')
        launcher.innerHTML = '💬'
        launcher.onclick = togglePanel
        document.body.appendChild(launcher)
    }

    function togglePanel() {
        if (panel) {
            panel.remove()
            panel = null
            return
        }
        panel = document.createElement('div')
        panel.className = 'im-panel'
        panel.style.position = 'fixed'

        var fields = config.formFields && config.formFields.length
            ? config.formFields
            : [
                { id: 'name', label: 'Your name', type: 'text', required: true },
                { id: 'email', label: 'Email', type: 'email', required: false },
                { id: 'phone', label: 'Phone', type: 'tel', required: false },
                { id: 'note', label: 'How can we help?', type: 'textarea', required: false },
            ]

        var form = document.createElement('form')
        form.innerHTML = '<button type="button" class="im-close">×</button><h3>Talk to ' + escapeHtml(config.hostName || 'us') + '</h3>'
        fields.forEach(function (f) {
            var fid = 'im_f_' + f.id
            var field = document.createElement('div')
            field.className = 'im-field'
            var input = f.type === 'textarea'
                ? '<textarea id="' + fid + '" rows="3"' + (f.required ? ' required' : '') + '></textarea>'
                : '<input id="' + fid + '" type="' + (f.type || 'text') + '"' + (f.required ? ' required' : '') + ' />'
            field.innerHTML = '<label for="' + fid + '">' + escapeHtml(f.label) + (f.required ? ' *' : '') + '</label>' + input
            form.appendChild(field)
        })
        var submit = document.createElement('button')
        submit.type = 'submit'
        submit.className = 'im-btn'
        submit.textContent = 'Send message'
        form.appendChild(submit)

        form.onsubmit = function (e) {
            e.preventDefault()
            var payload = { key: key, sessionId: sessionId, customFields: [] }
            fields.forEach(function (f) {
                var v = (document.getElementById('im_f_' + f.id) || {}).value || ''
                if (f.id === 'name') payload.name = v
                else if (f.id === 'email') payload.email = v
                else if (f.id === 'phone') payload.phone = v
                else payload.customFields.push({ id: f.id, value: v })
            })
            submit.textContent = 'Sending…'
            submit.disabled = true
            fetch(apiBase + '/api/widget/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).then(function (r) { return r.json() }).then(function (j) {
                if (j && j.ok) {
                    panel.innerHTML = '<button type="button" class="im-close">×</button><h3>Thanks!</h3><p>We&rsquo;ll be right with you.</p>'
                    panel.querySelector('.im-close').onclick = togglePanel
                } else {
                    submit.textContent = 'Send message'
                    submit.disabled = false
                    alert('Could not send. Please try again.')
                }
            }).catch(function () {
                submit.textContent = 'Send message'
                submit.disabled = false
            })
        }

        panel.appendChild(form)
        panel.querySelector('.im-close').onclick = togglePanel
        document.body.appendChild(panel)
    }

    // ---- presence (Phase 3) ----
    function sendPresence(extra) {
        var body = {
            key: key,
            sessionId: sessionId,
            page: location.href,
            title: document.title,
            referrer: document.referrer,
            scrollDepth: Math.round((window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100) || 0,
        }
        if (extra) for (var k in extra) body[k] = extra[k]
        try {
            fetch(apiBase + '/api/widget/presence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true,
            }).catch(function () { })
        } catch (e) { }
    }

    function startPresence() {
        sendPresence({ event: 'join' })
        setInterval(function () { sendPresence({ event: 'heartbeat' }) }, 10000)
        window.addEventListener('pagehide', function () { sendPresence({ event: 'leave' }) })
    }

    // ---- invite poll (Phase 4) ----
    function startInvitePoll() {
        setInterval(function () {
            fetch(apiBase + '/api/widget/invite/check?key=' + encodeURIComponent(key) + '&sessionId=' + encodeURIComponent(sessionId))
                .then(function (r) { return r.ok ? r.json() : null })
                .then(function (j) {
                    if (j && j.code && j.code !== inviteCode) {
                        inviteCode = j.code
                        showInvite(j.code, j.hostName || config.hostName || 'Host')
                    }
                })
                .catch(function () { })
        }, 5000)
    }

    function showInvite(code, hostName) {
        var existing = document.querySelector('.im-invite')
        if (existing) existing.remove()
        var box = document.createElement('div')
        box.className = 'im-invite'
        var url = apiBase + '/j/' + code
        box.innerHTML = '<strong>' + escapeHtml(hostName) + '</strong> is inviting you to a private meeting.<br><a href="' + url + '" target="_blank" rel="noopener">Join now →</a>'
        document.body.appendChild(box)
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        })
    }
})()
