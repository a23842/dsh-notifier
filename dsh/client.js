// @a23842/dsh-notifier — browser half (client plugin bundle).
//
// Registers a "通知 / Notifications" settings section with layered switches
// (master, browser-local, per-run-end, per-blocking-type, sound) and per-channel
// external-notifier config cards. Also starts a notification watcher that
// subscribes to mux+host streams via ctx.connection.api.events, detects
// running→idle transitions and blocking events, and delivers local browser
// notifications (new Notification()) when the app is in the background.

window.__ModuleLoader__.load({
  id: '@a23842/dsh-notifier',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var React = require('react')

    const NS = 'dsh-notifier'

    const CHANNELS = [
      { id: 'notifyx', label: 'NotifyX', hint: 'notifyx.cn 推送' },
      { id: 'webhook', label: '企业微信应用通知', hint: '通用 Webhook' },
      { id: 'wechatbot', label: '企业微信机器人', hint: '群机器人 Webhook' },
      { id: 'email', label: '邮件通知', hint: 'Resend' },
      { id: 'feishu', label: '飞书机器人', hint: '自定义机器人 Webhook' },
    ]

    const SECRET_KEYS = ['notifyxApiKey', 'webhookUrl', 'wechatbotWebhook', 'resendApiKey', 'feishuWebhook', 'feishuSecret']

    const TEXT_FIELDS = [
      { key: 'webhookMethod', label: '请求方法', type: 'select', options: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'webhookHeaders', label: '自定义请求头（JSON）', type: 'textarea', placeholder: '{"X-Token":"..."}' },
      { key: 'webhookTemplate', label: '消息模板（JSON）', type: 'textarea', placeholder: '{"msg":"{{title}} - {{content}}"}' },
      { key: 'wechatbotMsgType', label: '消息类型', type: 'select', options: ['text', 'markdown'] },
      { key: 'wechatbotAtMobiles', label: '@ 手机号（逗号分隔）', type: 'text', placeholder: '13800000000' },
      { key: 'wechatbotAtAll', label: '@ 所有人', type: 'select', options: ['false', 'true'] },
      { key: 'emailFrom', label: '发件人地址', type: 'text', placeholder: 'noreply@example.com' },
      { key: 'emailFromName', label: '发件人名称', type: 'text', placeholder: 'DSH 通知' },
      { key: 'emailTo', label: '收件人', type: 'text', placeholder: 'me@example.com' },
      { key: 'feishuAtAll', label: '@ 所有人', type: 'select', options: ['false', 'true'] },
    ]

    const SECRET_LABELS = {
      notifyxApiKey: 'NotifyX API Key',
      webhookUrl: 'Webhook URL',
      wechatbotWebhook: '机器人 Webhook URL',
      resendApiKey: 'Resend API Key',
      feishuWebhook: '飞书机器人 Webhook URL',
      feishuSecret: '飞书机器人加签密钥（可选）',
    }

    const styles = {
      section: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' },
      card: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'var(--dsw-alias-bg-container, transparent)',
      },
      cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
      cardTitle: { fontSize: '14px', fontWeight: 600 },
      cardHint: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' },
      field: { display: 'flex', flexDirection: 'column', gap: '4px' },
      fieldLabel: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, rgba(127,127,127,0.9))' },
      fieldHint: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.7))' },
      input: {
        boxSizing: 'border-box',
        width: '100%',
        padding: '8px 10px',
        fontSize: '13px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
        background: 'var(--dsw-alias-bg-input, transparent)',
        color: 'var(--dsw-alias-text-primary, inherit)',
        outline: 'none',
      },
      textarea: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '64px',
        padding: '8px 10px',
        fontSize: '13px',
        fontFamily: 'inherit',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
        background: 'var(--dsw-alias-bg-input, transparent)',
        color: 'var(--dsw-alias-text-primary, inherit)',
        outline: 'none',
        resize: 'vertical',
      },
      checkboxRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      checkbox: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
        cursor: 'pointer',
        fontSize: '13px',
        userSelect: 'none',
      },
      checkboxOn: {
        borderColor: 'var(--dsw-alias-brand, #667eea)',
        color: 'var(--dsw-alias-brand, #667eea)',
      },
      switchRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' },
      switchLabel: { fontSize: '13px', color: 'var(--dsw-alias-label-primary, inherit)' },
      switchDesc: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.7))' },
      toggle: {
        boxSizing: 'border-box',
        border: '1px solid var(--dsw-alias-border-l2, rgba(217,221,227,0.6))',
        background: 'var(--dsw-alias-bg-layer-2, rgba(229,231,235,0.5))',
        cursor: 'pointer',
        borderRadius: '999px',
        flex: 'none',
        width: '38px',
        height: '22px',
        padding: 0,
        position: 'relative',
        transition: 'background .15s, border-color .15s',
      },
      toggleChecked: {
        background: 'var(--dsw-alias-state-success-primary, #16a34a)',
        borderColor: 'var(--dsw-alias-state-success-primary, #16a34a)',
      },
      toggleKnob: {
        background: '#fff',
        borderRadius: '999px',
        width: '16px',
        height: '16px',
        position: 'absolute',
        top: '2px',
        left: '2px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        transition: 'left .15s',
      },
      toggleKnobOn: {
        left: '18px',
      },
      btn: {
        padding: '8px 14px',
        fontSize: '13px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))',
        background: 'transparent',
        color: 'var(--dsw-alias-text-primary, inherit)',
        cursor: 'pointer',
      },
      btnPrimary: {
        background: 'var(--dsw-alias-brand, #667eea)',
        borderColor: 'var(--dsw-alias-brand, #667eea)',
        color: '#fff',
      },
      btnRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      msg: { fontSize: '12px', lineHeight: '18px' },
      msgOk: { color: 'var(--dsw-alias-state-success-primary, #2ea043)' },
      msgErr: { color: 'var(--dsw-alias-state-error-primary, #f85149)' },
      rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
    }

    // ---- toggle switch component ------------------------------------------------

    function Toggle(props) {
      return React.createElement(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked === true,
          'aria-label': props.label,
          disabled: props.disabled,
          onClick: props.onChange,
          style: Object.assign({}, styles.toggle, props.checked ? styles.toggleChecked : {}, props.disabled ? { opacity: 0.5, cursor: 'default' } : {}),
        },
        React.createElement('span', { style: Object.assign({}, styles.toggleKnob, props.checked ? styles.toggleKnobOn : {}) }),
      )
    }

    // ---- settings helpers -------------------------------------------------------

    function initDraft(value) {
      const v = value && typeof value === 'object' ? value : {}
      const s = (key, fallback) => (typeof v[key] === 'string' ? v[key] : fallback)
      const b = (key, fallback) => (typeof v[key] === 'boolean' ? v[key] : fallback)
      return {
        enabled: b('enabled', true),
        sound: b('sound', true),
        title: s('title', 'DeepSeek Harness'),
        browserNotify: b('browserNotify', false),
        onRunEnd: b('onRunEnd', true),
        onBlocked: b('onBlocked', true),
        onQuestion: b('onQuestion', true),
        onApproval: b('onApproval', true),
        enabledNotifiers: Array.isArray(v.enabledNotifiers) ? v.enabledNotifiers.filter((id) => CHANNELS.some((c) => c.id === id)) : ['notifyx'],
        notifyOnGoalComplete: b('notifyOnGoalComplete', false),
        webhookMethod: s('webhookMethod', 'POST'),
        webhookHeaders: s('webhookHeaders', ''),
        webhookTemplate: s('webhookTemplate', ''),
        wechatbotMsgType: s('wechatbotMsgType', 'text'),
        wechatbotAtMobiles: s('wechatbotAtMobiles', ''),
        wechatbotAtAll: s('wechatbotAtAll', 'false'),
        emailFrom: s('emailFrom', ''),
        emailFromName: s('emailFromName', ''),
        emailTo: s('emailTo', ''),
        feishuAtAll: s('feishuAtAll', 'false'),
      }
    }

    function emptySecrets() {
      return { notifyxApiKey: '', webhookUrl: '', wechatbotWebhook: '', resendApiKey: '', feishuWebhook: '', feishuSecret: '' }
    }

    function secretConfigured(mirrored, key) {
      const nsView = mirrored && mirrored.view ? mirrored.view.namespaces.find((n) => n.ns === NS) : undefined
      const entry = nsView && Array.isArray(nsView.secrets) ? nsView.secrets.find((s) => Array.isArray(s.path) && s.path[0] === key) : undefined
      return entry ? entry.set === true : false
    }

    function Field(props) {
      return React.createElement(
        'label',
        { style: styles.field },
        React.createElement('span', { style: styles.fieldLabel }, props.label),
        props.children,
        props.hint ? React.createElement('span', { style: styles.fieldHint }, props.hint) : null,
      )
    }

    function SecretInput(props) {
      const { label, configured, value, onChange, onClear, disabled } = props
      return React.createElement(
        'div',
        { style: styles.field },
        React.createElement('span', { style: styles.fieldLabel }, label),
        React.createElement('input', {
          type: 'password',
          style: styles.input,
          placeholder: '留空表示保持当前密钥',
          value,
          disabled,
          onChange: (e) => onChange(e.target.value),
        }),
        React.createElement(
          'div',
          { style: styles.btnRow },
          React.createElement('button', { type: 'button', style: styles.btn, disabled: disabled || !configured, onClick: onClear }, '清除密钥'),
        ),
      )
    }

    // ---- notification watcher (browser-local) -----------------------------------
    // Ported from competitor's client-side watcher (plain JS, no TS imports).

    const RECONNECT_DELAY_MS = 3000
    const IDLE_GRACE_MS = 1500

    function delay(ms, signal) {
      return new Promise((resolve) => {
        var timer = setTimeout(function () {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }, ms)
        function onAbort() {
          clearTimeout(timer)
          resolve()
        }
        signal.addEventListener('abort', onAbort, { once: true })
      })
    }

    function resultText(kind) {
      switch (kind) {
        case 'completed': return '任务已完成'
        case 'error': return '任务失败'
        case 'aborted': return '任务已中止'
        case 'max-tokens': return '任务达到 token 上限'
        case 'blocked': return '任务被阻塞'
        case 'interrupted': return '任务被中断'
        default: return '任务结束'
      }
    }

    function clipTitle(title) {
      if (typeof title !== 'string' || title.trim() === '') return ''
      var chars = title.trim()
      return chars.length > 80 ? chars.slice(0, 80) + '…' : chars
    }

    function buildBody(result, title) {
      return title ? result + ' - 任务：' + title : result
    }

    function blockedQuestionText(argumentsString) {
      if (typeof argumentsString !== 'string') return ''
      var parsed
      try { parsed = JSON.parse(argumentsString) } catch { return '' }
      var questions = parsed && parsed.questions
      if (!Array.isArray(questions) || questions.length === 0) return ''
      var question = questions[0] && questions[0].question
      if (typeof question !== 'string' || question.trim() === '') return ''
      var chars = question.trim()
      return chars.length > 80 ? chars.slice(0, 80) + '…' : chars
    }

    function blockedBody(kind, detail, title) {
      var label = kind === 'question' ? '需要回答' : kind === 'approval' ? '需要批准' : '需要处理'
      var base = detail === '' || label === '需要处理' ? '需要处理' : label + '：' + detail
      return title ? base + ' — ' + title : base
    }

    function approvalDetail(toolName, reason) {
      if (!toolName) return ''
      return reason ? toolName + ' — ' + reason : toolName
    }

    function isAppInForeground() {
      if (typeof document === 'undefined') return false
      return document.visibilityState === 'visible' && document.hasFocus()
    }

    // Browser notification backend (inlined, no TS/imports).
    var browserBackendWarned = false
    function browserBackendWarnOnce(message) {
      if (browserBackendWarned) return
      browserBackendWarned = true
      console.warn('[dsh-notifier] ' + message)
    }

    var browserBackend = {
      ensurePermission: function () {
        if (typeof Notification === 'undefined') return Promise.resolve(false)
        if (Notification.permission === 'granted') return Promise.resolve(true)
        if (Notification.permission === 'denied') return Promise.resolve(false)
        try {
          return Notification.requestPermission().then(function (result) { return result === 'granted' })
        } catch { return Promise.resolve(false) }
      },
      notify: function (title, body, silent) {
        var self = this
        if (typeof Notification === 'undefined') {
          browserBackendWarnOnce('当前环境没有 Notification API，通知被跳过。')
          return Promise.resolve(false)
        }
        return self.ensurePermission().then(function (granted) {
          if (!granted) {
            browserBackendWarnOnce('通知权限未授予，可在设置卡片点击「发送测试通知」授权。')
            return false
          }
          try {
            new Notification(title, { body: body, silent: silent })
            return true
          } catch (error) {
            console.warn('[dsh-notifier] 通知投递失败：', error)
            return false
          }
        })
      },
    }

    // RunEndNotifier
    function createRunEndNotifier(notify) {
      var reasons = new Map()
      return {
        onSessionEvent: function (sessionId, event) {
          if (event.type !== 'turn/end') return
          var data = event.data
          var kind = data && data.reason && typeof data.reason.kind === 'string' ? data.reason.kind : 'unknown'
          reasons.set(sessionId, kind)
        },
        hasReason: function (sessionId) { return reasons.has(sessionId) },
        onRunStart: function (sessionId) { reasons.delete(sessionId) },
        onIdle: function (sessionId) {
          var kind = reasons.get(sessionId)
          if (kind === undefined) return
          reasons.delete(sessionId)
          notify(kind, sessionId)
        },
      }
    }

    // BlockedNotifier
    function createBlockedNotifier(notify) {
      return {
        onSessionEvent: function (sessionId, event) {
          if (event.type === 'tool/call') {
            var data = event.data
            if (!data || data.name !== 'ask_user_question') return
            var detail = typeof data.arguments === 'string' ? blockedQuestionText(data.arguments) : ''
            notify('question', detail, sessionId)
          } else if (event.type === 'approval/asked') {
            var data2 = event.data
            var toolName = data2 && typeof data2.toolName === 'string' ? data2.toolName : ''
            var reason = data2 && typeof data2.reason === 'string' ? data2.reason : ''
            notify('approval', approvalDetail(toolName, reason), sessionId)
          }
        },
      }
    }

    // NotificationWatcher
    function createNotificationWatcher(deps) {
      var runEnd = createRunEndNotifier(function (kind, sessionId) { emitRunEnd(kind, sessionId) })
      var blocked = createBlockedNotifier(function (kind, detail, sessionId) { emitBlocked(kind, detail, sessionId) })
      var running = new Set()
      var pendingIdle = new Map()
      var idleGraceMs = deps.idleGraceMs || IDLE_GRACE_MS

      function log(msg) { if (deps.log) deps.log(msg) }

      function seedRunning() {
        running.clear()
        var byId = deps.sessions.list.getSnapshot().byId
        for (var id in byId) {
          var row = byId[id]
          if (row && row.running) running.add(id)
        }
      }

      function isSubagent(sessionId) {
        var byId = deps.sessions.list.getSnapshot().byId
        var row = byId[sessionId]
        return row && row.origin === 'subagent'
      }

      function getTitle(sessionId) {
        var byId = deps.sessions.list.getSnapshot().byId
        var row = byId[sessionId]
        return row ? row.title : undefined
      }

      function resolveConfig() {
        var snap = deps.scope.getSnapshot()
        var value = snap.value || {}
        var b = function (key, fallback) { return typeof value[key] === 'boolean' ? value[key] : fallback }
        var s = function (key, fallback) { return typeof value[key] === 'string' && value[key] !== '' ? value[key] : fallback }
        return {
          enabled: b('enabled', true),
          sound: b('sound', true),
          title: s('title', 'DeepSeek Harness'),
          browserNotify: b('browserNotify', false),
          onRunEnd: b('onRunEnd', true),
          onBlocked: b('onBlocked', true),
          onQuestion: b('onQuestion', true),
          onApproval: b('onApproval', true),
        }
      }

      function emitRunEnd(kind, sessionId) {
        var config = resolveConfig()
        if (!config.enabled || !config.browserNotify || !config.onRunEnd) {
          log('run-end ' + kind + ' @' + sessionId + ' muted (browserNotify/onRunEnd off)')
          return
        }
        if (isAppInForeground()) {
          log('notify suppressed (app in foreground)')
          return
        }
        var body = buildBody(resultText(kind), clipTitle(getTitle(sessionId)))
        log('notify run-end: ' + body + ' @' + sessionId)
        browserBackend.notify(config.title, body, !config.sound).catch(function (err) { log('notify error ' + String(err)) })
      }

      function emitBlocked(kind, detail, sessionId) {
        var config = resolveConfig()
        if (!config.enabled || !config.browserNotify) return
        if (kind === 'question' && !config.onQuestion) return
        if (kind === 'approval' && !config.onApproval) return
        if (isAppInForeground()) {
          log('notify suppressed (app in foreground)')
          return
        }
        var body = blockedBody(kind, detail, clipTitle(getTitle(sessionId)))
        log('notify blocked: ' + body)
        browserBackend.notify(config.title, body, !config.sound).catch(function (err) { log('notify error ' + String(err)) })
      }

      function cancelIdleTimer(sessionId) {
        var timer = pendingIdle.get(sessionId)
        if (timer !== undefined) {
          clearTimeout(timer)
          pendingIdle.delete(sessionId)
        }
      }

      function settleIdle(sessionId, why) {
        cancelIdleTimer(sessionId)
        if (runEnd.hasReason(sessionId)) {
          log('idle @' + sessionId + ' settled: ' + why)
          runEnd.onIdle(sessionId)
        } else {
          log('idle @' + sessionId + ' dropped: ' + why + ', no turn/end recorded')
        }
      }

      function onMuxFrame(frame) {
        if (frame.type !== 'session/event') return
        var sessionId = frame.sessionId
        var event = frame.event
        if (!event || !event.type) return
        if (event.type === 'turn/end' || event.type === 'tool/call' || event.type === 'approval/asked') {
          log('mux ' + event.type + ' @' + sessionId + (isSubagent(sessionId) ? ' (subagent)' : ''))
        }
        if (isSubagent(sessionId)) return
        runEnd.onSessionEvent(sessionId, event)
        blocked.onSessionEvent(sessionId, event)
        if (event.type === 'turn/end' && pendingIdle.has(sessionId)) {
          settleIdle(sessionId, 'turn/end arrived in grace window')
        }
      }

      function onHostFrame(frame) {
        if (frame.type !== 'host/session-status') return
        var sessionId = frame.sessionId
        var run = frame.running
        log('host running=' + run + ' @' + sessionId + ' tracked=' + running.has(sessionId))
        if (run) {
          running.add(sessionId)
          runEnd.onRunStart(sessionId)
          return
        }
        if (!running.delete(sessionId)) return
        if (isSubagent(sessionId)) return
        if (runEnd.hasReason(sessionId)) {
          runEnd.onIdle(sessionId)
          return
        }
        log('idle @' + sessionId + ' pending grace ' + idleGraceMs + 'ms')
        cancelIdleTimer(sessionId)
        pendingIdle.set(sessionId, setTimeout(function () {
          settleIdle(sessionId, 'grace expired')
        }, idleGraceMs))
      }

      function loop(stream, signal) {
        var fn = async function () {
          while (!signal.aborted) {
            log(stream + ': open')
            try {
              var iter = deps.events[stream]({}, signal)
              for await (var envelope of iter) {
                if (stream === 'mux') onMuxFrame(envelope.payload)
                else onHostFrame(envelope.payload)
              }
            } catch (error) {
              log(stream + ': error ' + String(error))
            }
            if (signal.aborted) return
            log(stream + ': closed, reconnecting')
            await delay(RECONNECT_DELAY_MS, signal)
            if (signal.aborted) return
            seedRunning()
          }
        }
        fn()
      }

      return {
        start: function () {
          var controller = new AbortController()
          seedRunning()
          loop('mux', controller.signal)
          loop('host', controller.signal)
          return function () {
            controller.abort()
            pendingIdle.forEach(function (timer) { clearTimeout(timer) })
            pendingIdle.clear()
          }
        },
      }
    }

    // ---- settings page component ------------------------------------------------

    function NotifierSection(props) {
      return React.createElement('div', { style: styles.section }, props.renderSlot('settings.notifier.item', {}))
    }

    function createNotifierPage(scope, mirror) {
      var getScope = function () { return scope.getSnapshot() }
      var subscribeScope = function (cb) { return scope.subscribe(cb) }
      var getMirror = function () { return mirror.getSnapshot() }
      var subscribeMirror = function (cb) { return mirror.subscribe(cb) }

      return function NotifierPage() {
        var snap = React.useSyncExternalStore(subscribeScope, getScope)
        var mirrored = React.useSyncExternalStore(subscribeMirror, getMirror)

        var _a = React.useState(function () { return initDraft(snap.value) })
        var draft = _a[0]
        var setDraft = _a[1]

        var _b = React.useState(emptySecrets)
        var secretDrafts = _b[0]
        var setSecretDrafts = _b[1]

        var _c = React.useState(false)
        var saving = _c[0]
        var setSaving = _c[1]

        var _d = React.useState(null)
        var testing = _d[0]
        var setTesting = _d[1]

        var _e = React.useState(null)
        var saveMsg = _e[0]
        var setSaveMsg = _e[1]

        var _f = React.useState(null)
        var testMsg = _f[0]
        var setTestMsg = _f[1]

        var _g = React.useState(null)
        var notifyMsg = _g[0]
        var setNotifyMsg = _g[1]

        var configured = {}
        for (var i = 0; i < SECRET_KEYS.length; i++) configured[SECRET_KEYS[i]] = secretConfigured(mirrored, SECRET_KEYS[i])

        var writable = snap.writable !== false
        var ready = snap.status === 'ready'

        var setField = function (key, value) { return setDraft(function (d) { return Object.assign({}, d, (_h = {}, _h[key] = value, _h)); var _h }) }

        var autoSave = function (key, value) {
          setField(key, value)
          scope.set(key, value).catch(function () {})
        }

        var toggleChannel = function (id) {
          setDraft(function (d) {
            var next = d.enabledNotifiers.includes(id)
              ? d.enabledNotifiers.filter(function (x) { return x !== id })
              : d.enabledNotifiers.concat([id])
            autoSave('enabledNotifiers', next)
            return Object.assign({}, d, { enabledNotifiers: next })
          })
        }

        var save = function () {
          if (saving) return
          setSaving(true)
          setSaveMsg(null)
          var writes = []
          // New boolean fields
          writes.push(scope.set('enabled', draft.enabled))
          writes.push(scope.set('sound', draft.sound))
          writes.push(scope.set('title', draft.title))
          writes.push(scope.set('browserNotify', draft.browserNotify))
          writes.push(scope.set('onRunEnd', draft.onRunEnd))
          writes.push(scope.set('onBlocked', draft.onBlocked))
          writes.push(scope.set('onQuestion', draft.onQuestion))
          writes.push(scope.set('onApproval', draft.onApproval))
          // Existing text fields
          for (var j = 0; j < TEXT_FIELDS.length; j++) writes.push(scope.set(TEXT_FIELDS[j].key, draft[TEXT_FIELDS[j].key]))
          writes.push(scope.set('enabledNotifiers', draft.enabledNotifiers))
          writes.push(scope.set('notifyOnGoalComplete', draft.notifyOnGoalComplete))
          for (var k = 0; k < SECRET_KEYS.length; k++) {
            var value = (secretDrafts[SECRET_KEYS[k]] || '').trim()
            if (value !== '') writes.push(scope.set(SECRET_KEYS[k], value))
          }
          var ok = true
          Promise.all(writes.map(function (w) { return w.catch(function () { ok = false }) })).then(function () {
            if (ok) {
              setSecretDrafts(emptySecrets())
              setSaveMsg({ ok: true, text: '已保存' })
            } else {
              setSaveMsg({ ok: false, text: '保存失败，请重试' })
            }
            setSaving(false)
          })
        }

        var resetAll = function () {
          setDraft(initDraft(snap.base))
          setSecretDrafts(emptySecrets())
          setSaveMsg(null)
          var writes = []
          writes.push(scope.unset('enabled'))
          writes.push(scope.unset('sound'))
          writes.push(scope.unset('title'))
          writes.push(scope.unset('browserNotify'))
          writes.push(scope.unset('onRunEnd'))
          writes.push(scope.unset('onBlocked'))
          writes.push(scope.unset('onQuestion'))
          writes.push(scope.unset('onApproval'))
          for (var j = 0; j < TEXT_FIELDS.length; j++) writes.push(scope.unset(TEXT_FIELDS[j].key))
          writes.push(scope.unset('enabledNotifiers'))
          writes.push(scope.unset('notifyOnGoalComplete'))
          for (var k = 0; k < SECRET_KEYS.length; k++) writes.push(scope.unset(SECRET_KEYS[k]))
          Promise.all(writes.map(function (w) { return w.catch(function () {}) })).then(function () {
            setSaveMsg({ ok: true, text: '已重置为默认值' })
          })
        }

        var clearSecret = function (key) {
          scope.unset(key).then(function () {
            setSecretDrafts(function (d) { return Object.assign({}, d, (_h = {}, _h[key] = '', _h)); var _h })
          }).catch(function () {
            setSaveMsg({ ok: false, text: '清除密钥失败' })
          })
        }

        var testChannel = function (id) {
          if (testing) return
          setTesting(id)
          setTestMsg(null)
          fetch('/dsh-notifier/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: id }),
          }).then(function (response) { return response.json().catch(function () { return {} }) }).then(function (data) {
            if (data && data.ok) setTestMsg({ ok: true, channel: id, text: channelLabel(id) + ' 发送成功' })
            else setTestMsg({ ok: false, channel: id, text: channelLabel(id) + ' 失败: ' + ((data && data.error) || '未知错误') })
          }).catch(function (error) {
            setTestMsg({ ok: false, channel: id, text: channelLabel(id) + ' 请求失败: ' + (error && error.message ? error.message : error) })
          }).then(function () { setTesting(null) })
        }

        var testNotification = function () {
          if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().then(function (result) {
              if (result === 'granted') {
                setNotifyMsg({ ok: true, text: '通知权限已获取' })
                browserBackend.notify('dsh-notifier 测试', '这是一条测试通知。', false).then(function (sent) {
                  if (sent) setNotifyMsg({ ok: true, text: '测试通知已发送' })
                })
              } else {
                setNotifyMsg({ ok: false, text: '通知权限被拒绝' })
              }
            })
          } else {
            browserBackend.notify('dsh-notifier 测试', '这是一条测试通知。', false).then(function (sent) {
              if (sent) setNotifyMsg({ ok: true, text: '测试通知已发送' })
              else setNotifyMsg({ ok: false, text: '通知权限未授予' })
            })
          }
        }

        if (!ready) {
          return React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHint }, snap.status === 'loading' ? '加载中…' : '设置不可用'),
          )
        }

        return React.createElement(
          'div',
          { style: styles.section },

          // ---- Master Switch Card ----
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardTitle }, '通知设置'),
            React.createElement(
              'div',
              { style: styles.switchRow },
              React.createElement('span', { style: styles.switchLabel }, '启用通知'),
              React.createElement(Toggle, {
                checked: draft.enabled,
                disabled: !writable,
                onChange: function () { autoSave('enabled', !draft.enabled) },
              }),
            ),
            React.createElement(
              'div',
              { style: styles.switchRow },
              React.createElement('span', { style: styles.switchLabel }, '浏览器本地通知'),
              React.createElement('span', { style: styles.switchDesc }, '页面在后台时弹出系统通知'),
              React.createElement(Toggle, {
                checked: draft.browserNotify,
                disabled: !writable,
                onChange: function () { autoSave('browserNotify', !draft.browserNotify) },
              }),
            ),
            draft.browserNotify ? React.createElement('div', null,
              React.createElement(
                'div',
                { style: styles.switchRow },
                React.createElement('span', { style: styles.switchLabel }, '运行结束时通知'),
                React.createElement(Toggle, {
                  checked: draft.onRunEnd,
                  disabled: !writable,
                  onChange: function () { autoSave('onRunEnd', !draft.onRunEnd) },
                }),
              ),
              React.createElement(
                'div',
                { style: styles.switchRow },
                React.createElement('span', { style: styles.switchLabel }, '提问时通知'),
                React.createElement(Toggle, {
                  checked: draft.onQuestion,
                  disabled: !writable,
                  onChange: function () { autoSave('onQuestion', !draft.onQuestion) },
                }),
              ),
              React.createElement(
                'div',
                { style: styles.switchRow },
                React.createElement('span', { style: styles.switchLabel }, '审批请求时通知'),
                React.createElement(Toggle, {
                  checked: draft.onApproval,
                  disabled: !writable,
                  onChange: function () { autoSave('onApproval', !draft.onApproval) },
                }),
              ),
              React.createElement(
                'div',
                { style: styles.switchRow },
                React.createElement('span', { style: styles.switchLabel }, '声音'),
                React.createElement(Toggle, {
                  checked: draft.sound,
                  disabled: !writable,
                  onChange: function () { autoSave('sound', !draft.sound) },
                }),
              ),
              React.createElement(
                'div',
                { style: styles.btnRow },
                React.createElement('button', { type: 'button', style: styles.btn, onClick: testNotification }, '发送测试通知'),
                notifyMsg
                  ? React.createElement('span', { style: Object.assign({}, styles.msg, notifyMsg.ok ? styles.msgOk : styles.msgErr) }, notifyMsg.text)
                  : null,
              ),
            ) : null,
          ),

          // ---- 启用渠道 Card ----
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardTitle }, '启用渠道'),
            React.createElement(
              'div',
              { style: styles.checkboxRow },
              CHANNELS.map(function (channel) {
                return React.createElement(
                  'label',
                  {
                    key: channel.id,
                    style: Object.assign({}, styles.checkbox, draft.enabledNotifiers.includes(channel.id) ? styles.checkboxOn : {}),
                  },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: draft.enabledNotifiers.includes(channel.id),
                    disabled: !writable,
                    onChange: function () { toggleChannel(channel.id) },
                    style: { margin: 0 },
                  }),
                  channel.label,
                )
              }),
            ),
            React.createElement(
              'div',
              { style: styles.checkboxRow },
              React.createElement(
                'label',
                { style: Object.assign({}, styles.checkbox, draft.notifyOnGoalComplete ? styles.checkboxOn : {}) },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: draft.notifyOnGoalComplete === true,
                  disabled: !writable,
                  onChange: function () { autoSave('notifyOnGoalComplete', !draft.notifyOnGoalComplete) },
                  style: { margin: 0 },
                }),
                '目标完成时自动通知',
              ),
            ),
            React.createElement('div', { style: styles.cardHint }, '仅向勾选的渠道发送通知。'),
          ),

          // ---- Per-channel config cards (only visible when checked) ----

          // NotifyX
          draft.enabledNotifiers.includes('notifyx') ? React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, 'NotifyX'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: function () { testChannel('notifyx') } }, testing === 'notifyx' ? '测试中…' : '测试 NotifyX 通知'),
            ),
            React.createElement('div', { style: styles.cardHint }, 'API Key 不写回设置文件；留空保持当前值。'),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.notifyxApiKey,
              configured: configured.notifyxApiKey,
              value: secretDrafts.notifyxApiKey,
              disabled: !writable,
              onChange: function (v) { setSecretDrafts(function (d) { return Object.assign({}, d, { notifyxApiKey: v }) }) },
              onClear: function () { clearSecret('notifyxApiKey') },
            }),
            testMsg && testMsg.channel === 'notifyx'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ) : null,

          // 企业微信应用通知 (webhook)
          draft.enabledNotifiers.includes('webhook') ? React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '企业微信应用通知'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: function () { testChannel('webhook') } }, testing === 'webhook' ? '测试中…' : '测试 Webhook 通知'),
            ),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.webhookUrl,
              configured: configured.webhookUrl,
              value: secretDrafts.webhookUrl,
              disabled: !writable,
              onChange: function (v) { setSecretDrafts(function (d) { return Object.assign({}, d, { webhookUrl: v }) }) },
              onClear: function () { clearSecret('webhookUrl') },
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'webhookMethod' }).label },
              React.createElement('select', { style: styles.input, value: draft.webhookMethod, disabled: !writable, onChange: function (e) { setField('webhookMethod', e.target.value) } },
                ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map(function (o) { return React.createElement('option', { key: o, value: o }, o) }),
              ),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'webhookHeaders' }).label, hint: 'JSON 对象，例如 {"X-Token":"..."}' },
              React.createElement('textarea', { style: styles.textarea, placeholder: '{"X-Token":"..."}', value: draft.webhookHeaders, disabled: !writable, onChange: function (e) { setField('webhookHeaders', e.target.value) } }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'webhookTemplate' }).label, hint: '可选；支持 {{title}} {{content}} {{timestamp}} 占位符' },
              React.createElement('textarea', { style: styles.textarea, placeholder: '{"msg":"{{title}} - {{content}}"}', value: draft.webhookTemplate, disabled: !writable, onChange: function (e) { setField('webhookTemplate', e.target.value) } }),
            ),
            testMsg && testMsg.channel === 'webhook'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ) : null,

          // 企业微信机器人
          draft.enabledNotifiers.includes('wechatbot') ? React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '企业微信机器人'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: function () { testChannel('wechatbot') } }, testing === 'wechatbot' ? '测试中…' : '测试机器人通知'),
            ),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.wechatbotWebhook,
              configured: configured.wechatbotWebhook,
              value: secretDrafts.wechatbotWebhook,
              disabled: !writable,
              onChange: function (v) { setSecretDrafts(function (d) { return Object.assign({}, d, { wechatbotWebhook: v }) }) },
              onClear: function () { clearSecret('wechatbotWebhook') },
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'wechatbotMsgType' }).label },
              React.createElement('select', { style: styles.input, value: draft.wechatbotMsgType, disabled: !writable, onChange: function (e) { setField('wechatbotMsgType', e.target.value) } },
                ['text', 'markdown'].map(function (o) { return React.createElement('option', { key: o, value: o }, o) }),
              ),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'wechatbotAtMobiles' }).label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: '13800000000', value: draft.wechatbotAtMobiles, disabled: !writable, onChange: function (e) { setField('wechatbotAtMobiles', e.target.value) } }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'wechatbotAtAll' }).label },
              React.createElement('select', { style: styles.input, value: draft.wechatbotAtAll, disabled: !writable, onChange: function (e) { setField('wechatbotAtAll', e.target.value) } },
                ['false', 'true'].map(function (o) { return React.createElement('option', { key: o, value: o }, o === 'true' ? '@所有人' : '不 @') }),
              ),
            ),
            testMsg && testMsg.channel === 'wechatbot'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ) : null,

          // 邮件通知
          draft.enabledNotifiers.includes('email') ? React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '邮件通知'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: function () { testChannel('email') } }, testing === 'email' ? '测试中…' : '测试邮件通知'),
            ),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.resendApiKey,
              configured: configured.resendApiKey,
              value: secretDrafts.resendApiKey,
              disabled: !writable,
              onChange: function (v) { setSecretDrafts(function (d) { return Object.assign({}, d, { resendApiKey: v }) }) },
              onClear: function () { clearSecret('resendApiKey') },
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'emailFrom' }).label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: 'noreply@example.com', value: draft.emailFrom, disabled: !writable, onChange: function (e) { setField('emailFrom', e.target.value) } }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'emailFromName' }).label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: 'DSH 通知', value: draft.emailFromName, disabled: !writable, onChange: function (e) { setField('emailFromName', e.target.value) } }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'emailTo' }).label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: 'me@example.com', value: draft.emailTo, disabled: !writable, onChange: function (e) { setField('emailTo', e.target.value) } }),
            ),
            testMsg && testMsg.channel === 'email'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ) : null,

          // 飞书机器人
          draft.enabledNotifiers.includes('feishu') ? React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '飞书机器人'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: function () { testChannel('feishu') } }, testing === 'feishu' ? '测试中…' : '测试飞书通知'),
            ),
            React.createElement('div', { style: styles.cardHint }, '自定义机器人 Webhook；加签密钥可选（开启签名校验时填写）。'),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.feishuWebhook,
              configured: configured.feishuWebhook,
              value: secretDrafts.feishuWebhook,
              disabled: !writable,
              onChange: function (v) { setSecretDrafts(function (d) { return Object.assign({}, d, { feishuWebhook: v }) }) },
              onClear: function () { clearSecret('feishuWebhook') },
            }),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.feishuSecret,
              configured: configured.feishuSecret,
              value: secretDrafts.feishuSecret,
              disabled: !writable,
              onChange: function (v) { setSecretDrafts(function (d) { return Object.assign({}, d, { feishuSecret: v }) }) },
              onClear: function () { clearSecret('feishuSecret') },
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find(function (f) { return f.key === 'feishuAtAll' }).label },
              React.createElement('select', { style: styles.input, value: draft.feishuAtAll, disabled: !writable, onChange: function (e) { setField('feishuAtAll', e.target.value) } },
                ['false', 'true'].map(function (o) { return React.createElement('option', { key: o, value: o }, o === 'true' ? '@所有人' : '不 @') }),
              ),
            ),
            testMsg && testMsg.channel === 'feishu'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ) : null,

          // ---- Actions ----
          React.createElement(
            'div',
            { style: styles.btnRow },
            React.createElement('button', { type: 'button', style: Object.assign({}, styles.btn, styles.btnPrimary), disabled: !writable || saving, onClick: save }, saving ? '保存中…' : '保存'),
            React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || saving, onClick: resetAll }, '重置为默认'),
          ),
          saveMsg ? React.createElement('div', { style: Object.assign({}, styles.msg, saveMsg.ok ? styles.msgOk : styles.msgErr) }, saveMsg.text) : null,
          React.createElement('div', { style: styles.cardHint }, '测试按钮使用已保存的配置；修改后请先"保存"再测试。'),
        )
      }
    }

    function channelLabel(id) {
      var channel = CHANNELS.find(function (c) { return c.id === id })
      return channel ? channel.label : id
    }

    // ---- plugin exports ---------------------------------------------------------

    var inject = ['slots', 'settingsScope', 'connection', 'sessions']

    function apply(ctx) {
      var scope = ctx.settingsScope.bind({ namespace: NS })
      var mirror = ctx.settingsScope.describe()
      var NotifierPage = createNotifierPage(scope, mirror)

      // Register settings section
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          {
            name: 'settings.section',
            id: 'notifier',
            order: 25,
            label: '通知',
            children: { 'settings.notifier.item': { kind: 'list', scope: 'root' } },
          },
          NotifierSection,
        )
      })

      ctx.slots.inject('settings.notifier.item', function () {
        return ctx.slots.register(
          {
            name: 'settings.notifier.item',
            id: 'notifier-page',
            order: 0,
          },
          NotifierPage,
        )
      })

      // Start notification watcher (browser-local)
      try {
        var watcher = createNotificationWatcher({
          scope: scope,
          sessions: ctx.sessions,
          events: ctx.connection.api.events,
          log: function (message) { console.debug('[dsh-notifier]', message) },
        })
        ctx.effect(function () { return watcher.start() }, 'dsh-notifier: watcher')
      } catch (error) {
        console.warn('[dsh-notifier] watcher failed to start:', error)
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})