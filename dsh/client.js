// dsh-notifier — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-notifier/client.js and
// executed through the lazy-CJS module table (window.__ModuleLoader__.load).
// Only platform seed words and registered client bundles may be required;
// `react` is a seed word, so this file needs no externals.
//
// Registers a "通知 / Notifications" settings section that mirrors the
// original form: multi-select enabled channels, per-channel config fields,
// and per-channel "测试 XX 通知" buttons. Non-secret fields persist through
// the DSH settings wire (settingsScope); secret fields are write-only inputs
// (the Host redacts role('secret') values, so we only learn whether one is
// configured from the describe mirror's `secrets` sidecar).

window.__ModuleLoader__.load({
  id: 'dsh-notifier',
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
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        lineHeight: '18px',
      },
      badgeOn: { background: 'rgba(46,160,67,0.15)', color: 'var(--dsw-alias-state-success-primary, #2ea043)' },
      badgeOff: { background: 'rgba(127,127,127,0.15)', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' },
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

    function initDraft(value) {
      const v = value && typeof value === 'object' ? value : {}
      const s = (key, fallback) => (typeof v[key] === 'string' ? v[key] : fallback)
      return {
        enabledNotifiers: Array.isArray(v.enabledNotifiers) ? v.enabledNotifiers.filter((id) => CHANNELS.some((c) => c.id === id)) : ['notifyx'],
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
        React.createElement(
          'div',
          { style: styles.rowBetween },
          React.createElement('span', { style: styles.fieldLabel }, label),
          React.createElement(
            'span',
            { style: Object.assign({}, styles.badge, configured ? styles.badgeOn : styles.badgeOff) },
            configured ? '已配置' : '未配置',
          ),
        ),
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

    function NotifierSection(props) {
      return React.createElement('div', { style: styles.section }, props.renderSlot('settings.notifier.item', {}))
    }

    function createNotifierPage(scope, mirror) {
      const getScope = () => scope.getSnapshot()
      const subscribeScope = (cb) => scope.subscribe(cb)
      const getMirror = () => mirror.getSnapshot()
      const subscribeMirror = (cb) => mirror.subscribe(cb)

      return function NotifierPage() {
        const snap = React.useSyncExternalStore(subscribeScope, getScope)
        const mirrored = React.useSyncExternalStore(subscribeMirror, getMirror)

        const [draft, setDraft] = React.useState(() => initDraft(snap.value))
        const [secretDrafts, setSecretDrafts] = React.useState(emptySecrets)
        const [saving, setSaving] = React.useState(false)
        const [testing, setTesting] = React.useState(null)
        const [saveMsg, setSaveMsg] = React.useState(null)
        const [testMsg, setTestMsg] = React.useState(null)

        const configured = {}
        for (const key of SECRET_KEYS) configured[key] = secretConfigured(mirrored, key)

        const writable = snap.writable !== false
        const ready = snap.status === 'ready'

        const setField = (key, value) => setDraft((d) => Object.assign({}, d, { [key]: value }))

        const toggleChannel = (id) => {
          setDraft((d) => {
            const next = d.enabledNotifiers.includes(id)
              ? d.enabledNotifiers.filter((x) => x !== id)
              : [...d.enabledNotifiers, id]
            return Object.assign({}, d, { enabledNotifiers: next })
          })
        }

        const save = async () => {
          if (saving) return
          setSaving(true)
          setSaveMsg(null)
          const writes = []
          for (const field of TEXT_FIELDS) writes.push(scope.set(field.key, draft[field.key]))
          writes.push(scope.set('enabledNotifiers', draft.enabledNotifiers))
          for (const key of SECRET_KEYS) {
            const value = (secretDrafts[key] || '').trim()
            if (value !== '') writes.push(scope.set(key, value))
          }
          let ok = true
          for (const write of writes) {
            try {
              await write
            } catch (error) {
              ok = false
            }
          }
          if (ok) {
            setSecretDrafts(emptySecrets())
            setSaveMsg({ ok: true, text: '已保存' })
          } else {
            setSaveMsg({ ok: false, text: '保存失败，请重试' })
          }
          setSaving(false)
        }

        const resetAll = async () => {
          setDraft(initDraft(snap.base))
          setSecretDrafts(emptySecrets())
          setSaveMsg(null)
          const writes = []
          for (const field of TEXT_FIELDS) writes.push(scope.unset(field.key))
          writes.push(scope.unset('enabledNotifiers'))
          for (const key of SECRET_KEYS) writes.push(scope.unset(key))
          await Promise.all(writes.map((w) => w.catch(() => {})))
          setSaveMsg({ ok: true, text: '已重置为默认值' })
        }

        const clearSecret = async (key) => {
          try {
            await scope.unset(key)
            setSecretDrafts((d) => Object.assign({}, d, { [key]: '' }))
          } catch (error) {
            setSaveMsg({ ok: false, text: '清除密钥失败' })
          }
        }

        const testChannel = async (id) => {
          if (testing) return
          setTesting(id)
          setTestMsg(null)
          try {
            const response = await fetch('/dsh-notifier/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channel: id }),
            })
            const data = await response.json().catch(() => ({}))
            if (data && data.ok) setTestMsg({ ok: true, channel: id, text: `${channelLabel(id)} 发送成功` })
            else setTestMsg({ ok: false, channel: id, text: `${channelLabel(id)} 失败: ${(data && data.error) || '未知错误'}` })
          } catch (error) {
            setTestMsg({ ok: false, channel: id, text: `${channelLabel(id)} 请求失败: ${error && error.message ? error.message : error}` })
          } finally {
            setTesting(null)
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
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardTitle }, '启用渠道'),
            React.createElement(
              'div',
              { style: styles.checkboxRow },
              CHANNELS.map((channel) =>
                React.createElement(
                  'label',
                  {
                    key: channel.id,
                    style: Object.assign({}, styles.checkbox, draft.enabledNotifiers.includes(channel.id) ? styles.checkboxOn : {}),
                  },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: draft.enabledNotifiers.includes(channel.id),
                    disabled: !writable,
                    onChange: () => toggleChannel(channel.id),
                    style: { margin: 0 },
                  }),
                  channel.label,
                ),
              ),
            ),
            React.createElement('div', { style: styles.cardHint }, '仅向勾选的渠道发送通知。'),
          ),

          // NotifyX
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, 'NotifyX'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: () => testChannel('notifyx') }, testing === 'notifyx' ? '测试中…' : '测试 NotifyX 通知'),
            ),
            React.createElement('div', { style: styles.cardHint }, 'API Key 不写回设置文件；留空保持当前值。'),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.notifyxApiKey,
              configured: configured.notifyxApiKey,
              value: secretDrafts.notifyxApiKey,
              disabled: !writable,
              onChange: (v) => setSecretDrafts((d) => Object.assign({}, d, { notifyxApiKey: v })),
              onClear: () => clearSecret('notifyxApiKey'),
            }),
            testMsg && testMsg.channel === 'notifyx'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ),

          // 企业微信应用通知 (webhook)
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '企业微信应用通知'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: () => testChannel('webhook') }, testing === 'webhook' ? '测试中…' : '测试 Webhook 通知'),
            ),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.webhookUrl,
              configured: configured.webhookUrl,
              value: secretDrafts.webhookUrl,
              disabled: !writable,
              onChange: (v) => setSecretDrafts((d) => Object.assign({}, d, { webhookUrl: v })),
              onClear: () => clearSecret('webhookUrl'),
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'webhookMethod').label },
              React.createElement('select', { style: styles.input, value: draft.webhookMethod, disabled: !writable, onChange: (e) => setField('webhookMethod', e.target.value) },
                ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((o) => React.createElement('option', { key: o, value: o }, o)),
              ),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'webhookHeaders').label, hint: 'JSON 对象，例如 {"X-Token":"..."}' },
              React.createElement('textarea', { style: styles.textarea, placeholder: '{"X-Token":"..."}', value: draft.webhookHeaders, disabled: !writable, onChange: (e) => setField('webhookHeaders', e.target.value) }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'webhookTemplate').label, hint: '可选；支持 {{title}} {{content}} {{timestamp}} 占位符' },
              React.createElement('textarea', { style: styles.textarea, placeholder: '{"msg":"{{title}} - {{content}}"', value: draft.webhookTemplate, disabled: !writable, onChange: (e) => setField('webhookTemplate', e.target.value) }),
            ),
            testMsg && testMsg.channel === 'webhook'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ),

          // 企业微信机器人
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '企业微信机器人'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: () => testChannel('wechatbot') }, testing === 'wechatbot' ? '测试中…' : '测试机器人通知'),
            ),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.wechatbotWebhook,
              configured: configured.wechatbotWebhook,
              value: secretDrafts.wechatbotWebhook,
              disabled: !writable,
              onChange: (v) => setSecretDrafts((d) => Object.assign({}, d, { wechatbotWebhook: v })),
              onClear: () => clearSecret('wechatbotWebhook'),
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'wechatbotMsgType').label },
              React.createElement('select', { style: styles.input, value: draft.wechatbotMsgType, disabled: !writable, onChange: (e) => setField('wechatbotMsgType', e.target.value) },
                ['text', 'markdown'].map((o) => React.createElement('option', { key: o, value: o }, o)),
              ),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'wechatbotAtMobiles').label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: '13800000000', value: draft.wechatbotAtMobiles, disabled: !writable, onChange: (e) => setField('wechatbotAtMobiles', e.target.value) }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'wechatbotAtAll').label },
              React.createElement('select', { style: styles.input, value: draft.wechatbotAtAll, disabled: !writable, onChange: (e) => setField('wechatbotAtAll', e.target.value) },
                ['false', 'true'].map((o) => React.createElement('option', { key: o, value: o }, o === 'true' ? '@所有人' : '不 @')),
              ),
            ),
            testMsg && testMsg.channel === 'wechatbot'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ),

          // 邮件通知
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '邮件通知'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: () => testChannel('email') }, testing === 'email' ? '测试中…' : '测试邮件通知'),
            ),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.resendApiKey,
              configured: configured.resendApiKey,
              value: secretDrafts.resendApiKey,
              disabled: !writable,
              onChange: (v) => setSecretDrafts((d) => Object.assign({}, d, { resendApiKey: v })),
              onClear: () => clearSecret('resendApiKey'),
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'emailFrom').label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: 'noreply@example.com', value: draft.emailFrom, disabled: !writable, onChange: (e) => setField('emailFrom', e.target.value) }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'emailFromName').label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: 'DSH 通知', value: draft.emailFromName, disabled: !writable, onChange: (e) => setField('emailFromName', e.target.value) }),
            ),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'emailTo').label },
              React.createElement('input', { type: 'text', style: styles.input, placeholder: 'me@example.com', value: draft.emailTo, disabled: !writable, onChange: (e) => setField('emailTo', e.target.value) }),
            ),
            testMsg && testMsg.channel === 'email'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ),

          // 飞书机器人
          React.createElement(
            'div',
            { style: styles.card },
            React.createElement('div', { style: styles.cardHead },
              React.createElement('span', { style: styles.cardTitle }, '飞书机器人'),
              React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || testing !== null, onClick: () => testChannel('feishu') }, testing === 'feishu' ? '测试中…' : '测试飞书通知'),
            ),
            React.createElement('div', { style: styles.cardHint }, '自定义机器人 Webhook；加签密钥可选（开启签名校验时填写）。'),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.feishuWebhook,
              configured: configured.feishuWebhook,
              value: secretDrafts.feishuWebhook,
              disabled: !writable,
              onChange: (v) => setSecretDrafts((d) => Object.assign({}, d, { feishuWebhook: v })),
              onClear: () => clearSecret('feishuWebhook'),
            }),
            React.createElement(SecretInput, {
              label: SECRET_LABELS.feishuSecret,
              configured: configured.feishuSecret,
              value: secretDrafts.feishuSecret,
              disabled: !writable,
              onChange: (v) => setSecretDrafts((d) => Object.assign({}, d, { feishuSecret: v })),
              onClear: () => clearSecret('feishuSecret'),
            }),
            React.createElement(Field, { label: TEXT_FIELDS.find((f) => f.key === 'feishuAtAll').label },
              React.createElement('select', { style: styles.input, value: draft.feishuAtAll, disabled: !writable, onChange: (e) => setField('feishuAtAll', e.target.value) },
                ['false', 'true'].map((o) => React.createElement('option', { key: o, value: o }, o === 'true' ? '@所有人' : '不 @')),
              ),
            ),
            testMsg && testMsg.channel === 'feishu'
              ? React.createElement('div', { style: Object.assign({}, styles.msg, testMsg.ok ? styles.msgOk : styles.msgErr) }, testMsg.text)
              : null,
          ),

          // Actions
          React.createElement(
            'div',
            { style: styles.btnRow },
            React.createElement('button', { type: 'button', style: Object.assign({}, styles.btn, styles.btnPrimary), disabled: !writable || saving, onClick: save }, saving ? '保存中…' : '保存'),
            React.createElement('button', { type: 'button', style: styles.btn, disabled: !writable || saving, onClick: resetAll }, '重置为默认'),
          ),
          saveMsg ? React.createElement('div', { style: Object.assign({}, styles.msg, saveMsg.ok ? styles.msgOk : styles.msgErr) }, saveMsg.text) : null,
          React.createElement('div', { style: styles.cardHint }, '测试按钮使用已保存的配置；修改后请先“保存”再测试。'),
        )
      }
    }

    function channelLabel(id) {
      const channel = CHANNELS.find((c) => c.id === id)
      return channel ? channel.label : id
    }

    const inject = ['slots', 'settingsScope']

    function apply(ctx) {
      const scope = ctx.settingsScope.bind({ namespace: NS })
      const mirror = ctx.settingsScope.describe()
      const NotifierPage = createNotifierPage(scope, mirror)

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'notifier',
            order: 25,
            label: '通知 / Notifications',
            children: { 'settings.notifier.item': { kind: 'list', scope: 'root' } },
          },
          NotifierSection,
        ),
      )

      ctx.slots.inject('settings.notifier.item', () =>
        ctx.slots.register(
          {
            name: 'settings.notifier.item',
            id: 'notifier-page',
            order: 0,
          },
          NotifierPage,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
