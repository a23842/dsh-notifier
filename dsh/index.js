// dsh-notifier — host half.
//
// Registers:
//   * a `send_notification` model tool (fan-out to the enabled channels),
//   * the `dsh-notifier` settings namespace (typed via schemastery; secrets
//     via role('secret') so keys never cross the wire),
//   * a loopback-only `/dsh-notifier/test` route the settings page drives for
//     the "测试 XX 通知" buttons.
//
// Optional seams (settings / webServer) ride scoped ctx.inject so the plugin
// stays loadable on hosts that do not provide them; the tool itself requires
// only `tools`, which every agent runtime provides.

import { createHmac } from 'node:crypto'
import z from '@deepseek-ai/schemastery'

export const inject = ['tools']

// Inlined from @deepseek-ai/dsh-settings: the `settingsNamespace` branded-string
// helper was removed as a named export in dsh 0.1.2-alpha, and a missing ESM
// named import is a module-evaluation SyntaxError that stops the host from
// booting at all. The namespace grammar is unchanged (lowercase kebab-case).
const SETTINGS_NS = (() => {
  const value = 'dsh-notifier'
  const pattern = /^[a-z][a-z0-9-]*$/
  if (!pattern.test(value)) throw new TypeError(`settings namespace "${value}" must match ${String(pattern)}`)
  return value
})()

// ---- schema (flat, matching the original form field ids) -------------------

const NotifierConfig = z.object({
  enabledNotifiers: z.array(z.string()).default(['notifyx']),
  notifyOnGoalComplete: z.boolean().default(false),
  notifyxApiKey: z.string().role('secret'),
  webhookUrl: z.string().role('secret'),
  webhookMethod: z.string().default('POST'),
  webhookHeaders: z.string().default(''),
  webhookTemplate: z.string().default(''),
  wechatbotWebhook: z.string().role('secret'),
  wechatbotMsgType: z.string().default('text'),
  wechatbotAtMobiles: z.string().default(''),
  wechatbotAtAll: z.string().default('false'),
  resendApiKey: z.string().role('secret'),
  emailFrom: z.string().default(''),
  emailFromName: z.string().default(''),
  emailTo: z.string().default(''),
  feishuWebhook: z.string().role('secret'),
  feishuSecret: z.string().role('secret'),
  feishuAtAll: z.string().default('false'),
})

// Secret fields are intentionally absent from the composition base: a secret
// that is absent resolves to `undefined`, which dsh-settings' redaction
// sidecar reports as `set: false` → the settings page shows "未配置". A
// `.default('')` (or an empty-string base value) would make the resolved
// secret always defined and thus always "已配置", even when the user set
// nothing.
const CONFIG_DEFAULTS = {
  enabledNotifiers: ['notifyx'],
  notifyOnGoalComplete: false,
  webhookMethod: 'POST',
  webhookHeaders: '',
  webhookTemplate: '',
  wechatbotMsgType: 'text',
  wechatbotAtMobiles: '',
  wechatbotAtAll: 'false',
  emailFrom: '',
  emailFromName: '',
  emailTo: '',
  feishuAtAll: 'false',
}

const CHANNELS = ['notifyx', 'webhook', 'wechatbot', 'email', 'feishu']

const TOOL_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    sent: { type: 'array', items: { type: 'string' } },
    failed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['channel', 'error'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['sent', 'failed', 'summary'],
  additionalProperties: false,
}

// ---- helpers ---------------------------------------------------------------

function formatBeijingTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

function stripMarkdown(value) {
  return String(value ?? '').replace(/(\**|\*|##|#|`)/g, '')
}

// Normalize a resolved settings value (or the defaults) into the plain shape
// the senders read. Secrets are present here (this never crosses a wire).
function normalizeConfig(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const enabled = Array.isArray(s.enabledNotifiers)
    ? s.enabledNotifiers.filter((item) => CHANNELS.includes(item))
    : []
  const str = (key, fallback = '') => (typeof s[key] === 'string' ? s[key] : fallback)
  return {
    enabledNotifiers: enabled,
    notifyxApiKey: str('notifyxApiKey'),
    webhookUrl: str('webhookUrl'),
    webhookMethod: str('webhookMethod', 'POST').trim() || 'POST',
    webhookHeaders: str('webhookHeaders'),
    webhookTemplate: str('webhookTemplate'),
    wechatbotWebhook: str('wechatbotWebhook'),
    wechatbotMsgType: str('wechatbotMsgType', 'text').trim() || 'text',
    wechatbotAtMobiles: str('wechatbotAtMobiles'),
    wechatbotAtAll: str('wechatbotAtAll', 'false'),
    resendApiKey: str('resendApiKey'),
    emailFrom: str('emailFrom'),
    emailFromName: str('emailFromName'),
    emailTo: str('emailTo'),
    feishuWebhook: str('feishuWebhook'),
    feishuSecret: str('feishuSecret'),
    feishuAtAll: str('feishuAtAll', 'false'),
    notifyOnGoalComplete: s.notifyOnGoalComplete === true,
  }
}

function emailHtml(title, content) {
  const body = String(content ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${String(title)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background-color:#f5f5f5}
.container{max-width:600px;margin:0 auto;background-color:#ffffff}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px 20px;text-align:center}
.header h1{color:white;margin:0;font-size:24px}
.content{padding:30px 20px}
.highlight{background-color:#e3f2fd;padding:15px;border-radius:8px;margin:20px 0;color:#444;line-height:1.6}
.footer{background-color:#f8f9fa;padding:20px;text-align:center;color:#666;font-size:14px}
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>📅 ${String(title)}</h1></div>
<div class="content"><div class="highlight">${body}</div></div>
<div class="footer"><p>DSH 通知 | 发送时间: ${formatBeijingTime()}</p></div>
</div>
</body>
</html>`
}

// ---- senders ---------------------------------------------------------------
// Each returns { ok, error } where error is a human-readable string on failure.

async function sendNotifyX(title, content, c) {
  try {
    if (!c.notifyxApiKey) return { ok: false, error: '未配置 API Key' }
    const response = await fetch(`https://www.notifyx.cn/api/v1/send/${encodeURIComponent(c.notifyxApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, description: 'DSH 通知' }),
    })
    const result = await response.json()
    if (result?.status === 'queued') return { ok: true }
    return { ok: false, error: `NotifyX 未入队: ${JSON.stringify(result).slice(0, 240)}` }
  } catch (error) {
    return { ok: false, error: `NotifyX 请求失败: ${error?.message ?? error}` }
  }
}

async function sendWebhook(title, content, c) {
  try {
    if (!c.webhookUrl) return { ok: false, error: '未配置 Webhook URL' }
    const timestamp = formatBeijingTime(new Date())
    const headers = { 'Content-Type': 'application/json' }
    if (c.webhookHeaders) {
      try {
        const custom = JSON.parse(c.webhookHeaders)
        Object.assign(headers, custom)
      } catch {
        return { ok: false, error: '自定义请求头不是合法 JSON' }
      }
    }
    let body
    if (c.webhookTemplate) {
      try {
        const template = JSON.parse(c.webhookTemplate)
        body = JSON.parse(
          JSON.stringify(template)
            .replace(/\{\{title\}\}/g, title)
            .replace(/\{\{content\}\}/g, content)
            .replace(/\{\{timestamp\}\}/g, timestamp),
        )
      } catch {
        return { ok: false, error: '消息模板不是合法 JSON' }
      }
    } else {
      body = { title, content, timestamp }
    }
    const response = await fetch(c.webhookUrl, {
      method: c.webhookMethod,
      headers,
      body: JSON.stringify(body),
    })
    if (response.ok) return { ok: true }
    const text = await response.text().catch(() => '')
    return { ok: false, error: `HTTP ${response.status} ${text.slice(0, 240)}` }
  } catch (error) {
    return { ok: false, error: `Webhook 请求失败: ${error?.message ?? error}` }
  }
}

async function sendWechatBot(title, content, c) {
  try {
    if (!c.wechatbotWebhook) return { ok: false, error: '未配置机器人 Webhook' }
    const msgType = c.wechatbotMsgType
    let messageData
    if (msgType === 'markdown') {
      messageData = { msgtype: 'markdown', markdown: { content: `# ${title}\n\n${content}` } }
    } else {
      messageData = { msgtype: 'text', text: { content: `${title}\n\n${content}` } }
    }
    if (c.wechatbotAtAll === 'true') {
      if (msgType === 'text') messageData.text.mentioned_list = ['@all']
    } else if (c.wechatbotAtMobiles) {
      const mobiles = c.wechatbotAtMobiles.split(',').map((m) => m.trim()).filter(Boolean)
      if (mobiles.length > 0 && msgType === 'text') messageData.text.mentioned_mobile_list = mobiles
    }
    const response = await fetch(c.wechatbotWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData),
    })
    const text = await response.text()
    if (response.ok) {
      try {
        const result = JSON.parse(text)
        if (result?.errcode === 0) return { ok: true }
        return { ok: false, error: `企业微信机器人错误 ${result?.errcode ?? '?'}: ${result?.errmsg ?? text}`.slice(0, 240) }
      } catch {
        return { ok: false, error: `机器人响应解析失败: ${text.slice(0, 240)}` }
      }
    }
    return { ok: false, error: `HTTP ${response.status} ${text.slice(0, 240)}` }
  } catch (error) {
    return { ok: false, error: `机器人请求失败: ${error?.message ?? error}` }
  }
}

async function sendEmail(title, content, c) {
  try {
    if (!c.resendApiKey || !c.emailFrom || !c.emailTo) {
      return { ok: false, error: '邮件缺少必要参数（API Key / 发件人 / 收件人）' }
    }
    const from = c.emailFromName ? `${c.emailFromName} <${c.emailFrom}>` : c.emailFrom
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: c.emailTo,
        subject: title,
        html: emailHtml(title, content),
        text: content,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (response.ok && result?.id) return { ok: true }
    return { ok: false, error: `邮件发送失败: ${JSON.stringify(result).slice(0, 240)}` }
  } catch (error) {
    return { ok: false, error: `邮件请求失败: ${error?.message ?? error}` }
  }
}

async function sendFeishu(title, content, c) {
  try {
    if (!c.feishuWebhook) return { ok: false, error: '未配置飞书机器人 Webhook' }
    const timestamp = Math.floor(Date.now() / 1000)
    let body
    if (c.feishuSecret) {
      // 飞书自定义机器人加签：string_to_sign = `${timestamp}\n${secret}`，
      // 以该字符串为 key、空消息做 HMAC-SHA256，再 base64。
      const stringToSign = `${timestamp}\n${c.feishuSecret}`
      const sign = createHmac('sha256', stringToSign).update('').digest('base64')
      body = { timestamp: `${timestamp}`, sign, msg_type: 'text', content: { text: `${title}\n\n${content}` } }
    } else {
      body = { msg_type: 'text', content: { text: `${title}\n\n${content}` } }
    }
    if (c.feishuAtAll === 'true') {
      body.content.text += '\n<at user_id="all">所有人</at>'
    }
    const response = await fetch(c.feishuWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await response.text().catch(() => '')
    if (response.ok) {
      try {
        const result = JSON.parse(text)
        if (result?.code === 0 || result?.StatusCode === 0) return { ok: true }
        return { ok: false, error: `飞书机器人错误 ${result?.code ?? result?.StatusCode ?? '?'}: ${result?.msg ?? text}`.slice(0, 240) }
      } catch {
        return { ok: false, error: `飞书机器人响应解析失败: ${text.slice(0, 240)}` }
      }
    }
    return { ok: false, error: `HTTP ${response.status} ${text.slice(0, 240)}` }
  } catch (error) {
    return { ok: false, error: `飞书机器人请求失败: ${error?.message ?? error}` }
  }
}

async function sendToChannel(channel, title, content, c) {
  switch (channel) {
    case 'notifyx': return sendNotifyX(title, `## ${title}\n\n${content}`, c)
    case 'webhook': return sendWebhook(title, stripMarkdown(content), c)
    case 'wechatbot': return sendWechatBot(title, stripMarkdown(content), c)
    case 'email': return sendEmail(title, stripMarkdown(content), c)
    case 'feishu': return sendFeishu(title, stripMarkdown(content), c)
    default: return { ok: false, error: `未知渠道: ${channel}` }
  }
}

async function sendToAllChannels(title, content, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const results = {}
  const errors = []
  for (const channel of config.enabledNotifiers) {
    try {
      results[channel] = await sendToChannel(channel, title, content, config)
    } catch (error) {
      results[channel] = { ok: false, error: error?.message ?? String(error) }
    }
    if (!results[channel].ok) errors.push({ channel, error: results[channel].error })
  }
  return { config, results, errors }
}

function renderToolOutput(_args, value) {
  const lines = []
  if (value?.sent?.length) lines.push(`已发送: ${value.sent.join(', ')}`)
  if (value?.failed?.length) lines.push(`失败: ${value.failed.map((f) => `${f.channel}（${f.error}）`).join('; ')}`)
  if (!value?.sent?.length && !value?.failed?.length) lines.push('未启用任何通知渠道。')
  return [{ type: 'text', text: lines.join('\n') }]
}

// ---- loopback trust (mirrors the dsh /api fence and modlens) ----------------

function isLoopbackHost(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isTrustedRequest(req) {
  const host = req.headers?.host
  if (typeof host !== 'string' || host === '') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHost(hostUrl.hostname)) return false
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('payload too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// ---- apply -----------------------------------------------------------------

export function apply(ctx, config = {}) {
  // One live config handle for the whole plugin. Settings owns the durable
  // value; the tool and the loopback test route read through this handle.
  const configHandle = { value: CONFIG_DEFAULTS }

  // The model tool: require `tools`, which every agent runtime provides.
  ctx.tools.register({
    name: 'send_notification',
    description:
      '通过 dsh-notifier 已启用的渠道（NotifyX、企业微信应用通知、企业微信机器人、邮件、飞书机器人）发送一条通知。使用场景：用户要求“通知我”“发个提醒”“推送结果”等。发送目标与渠道在 DSH 设置 → 通知 页面配置。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '通知标题。' },
        content: { type: 'string', description: '通知正文。' },
      },
      required: ['title', 'content'],
    },
    output: {
      schema: TOOL_OUTPUT_SCHEMA,
      render: renderToolOutput,
    },
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: 'send_notification',
      rawInput: typeof args?.title === 'string' ? args.title : '',
    }),
    async execute(args) {
      if (typeof args?.title !== 'string' || args.title.trim() === '') {
        throw new Error('send_notification 需要非空字符串 title。')
      }
      if (typeof args?.content !== 'string') {
        throw new Error('send_notification 需要字符串 content。')
      }
      const { results, errors } = await sendToAllChannels(args.title, args.content, configHandle.value)
      return {
        sent: Object.entries(results).filter(([, r]) => r.ok).map(([channel]) => channel),
        failed: errors,
        summary: errors.length === 0 ? '全部渠道发送成功' : `${errors.length} 个渠道发送失败`,
      }
    },
  })

  // Settings seam: register the typed namespace and mirror changes into the
  // live handle. This closure never runs on hosts without a settings service.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (scope) => {
      try {
        const settingsScope = scope.settings.register(SETTINGS_NS, NotifierConfig, {
          base: CONFIG_DEFAULTS,
          applies: 'live',
        })
        const adopt = () => {
          configHandle.value = settingsScope.get()
        }
        adopt()
        scope.effect(() => settingsScope.watch(adopt), 'dsh-notifier: config mirror')
      } catch (error) {
        console.error(`[dsh-notifier] settings namespace skipped: ${error}`)
      }
    })
  }

  // Web seam: loopback-only test route for the settings page's test buttons.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => {
      try {
        scope.webServer.register({
          name: 'dsh-notifier-test',
          kind: 'exact',
          path: '/dsh-notifier/test',
          handler: async (req, res) => {
            if (!isTrustedRequest(req)) {
              json(res, 403, { error: 'request refused: loopback same-origin only' })
              return
            }
            if (req.method !== 'POST') {
              json(res, 405, { error: 'method not allowed' })
              return
            }
            try {
              const body = await readJsonBody(req)
              const channel = body?.channel
              if (!CHANNELS.includes(channel)) {
                json(res, 400, { error: 'unknown channel' })
                return
              }
              const title = typeof body?.title === 'string' && body.title.trim() ? body.title : 'dsh-notifier 测试通知'
              const content = typeof body?.content === 'string' ? body.content : '这是一条来自 dsh-notifier 的测试通知。'
              const result = await sendToChannel(channel, title, content, normalizeConfig(configHandle.value))
              json(res, result.ok ? 200 : 502, { ok: result.ok, error: result.ok ? undefined : result.error })
            } catch (error) {
              json(res, 400, { error: error?.message ?? String(error) })
            }
          },
        })
      } catch (error) {
        console.error(`[dsh-notifier] web routes skipped: ${error}`)
      }
    })
  }

  // Auto-notify on goal completion: the session event firehose carries a
  // durable `goal/change` event whose `operation` is 'complete' when a tracked
  // goal is marked complete. When the user opted in via `notifyOnGoalComplete`,
  // fan out a notification to every enabled channel (fire-and-forget).
  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'goal/change') return
    const change = event?.data
    if (!change || change.operation !== 'complete') return
    const cfg = normalizeConfig(configHandle.value)
    if (cfg.notifyOnGoalComplete !== true) return
    const objective = typeof change.goal?.objective === 'string' && change.goal.objective ? change.goal.objective : '未命名目标'
    sendToAllChannels('✅ 任务完成', `目标「${objective}」已完成。`, configHandle.value).catch(() => {})
  })
}
