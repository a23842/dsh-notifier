# @czf1995/dsh-notifier

DSH 多渠道通知插件：为 DeepSeek Harness 增加 `send_notification` 模型工具、运行状态/阻塞事件自动通知，以及「通知 / Notifications」设置页。

支持的渠道：

- **NotifyX**（默认启用）
- **企业微信应用通知**（通用 Webhook）
- **企业微信机器人**
- **邮件通知**（Resend）
- **SMTP 私人邮件**（用自己的邮箱服务器发信，可发给自己或他人）
- **钉钉机器人**（Webhook + 可选加签 + @所有人）
- **飞书机器人**（自定义机器人 Webhook，可选加签 + @所有人）

## 安装

```bash
dsh plugin --profile web add @czf1995/dsh-notifier
```

或手动：

1. 将本包安装到 `/opt/dsh/profiles/web/node_modules/@czf1995/dsh-notifier`；
2. 在 profile 的 `package.json` 增加依赖 `@czf1995/dsh-notifier`，并把它加入 `dsh.profile.bundles`。

`cordis.patch.yml` 提供 bundle patch 行（`id: notifier` → 包名 `@czf1995/dsh-notifier`）。

## 功能

### 1. 浏览器本地通知（v0.2.0+，默认关闭）

页面在后台（失焦或隐藏标签页）时，通过浏览器系统通知提醒你：

- **运行结束**：会话从 running → idle 时，附带结果文案（已完成 / 失败 / 中止 / token 上限 / 被阻塞 / 被中断）；
- **提问 / 审批**：会话需要你回答或批准时即时提醒（正文带上问题或工具名）；
- **前台抑制**：页面可见且聚焦时不打扰，切走才弹；
- **子代理会话**不产生通知；
- 首次启用时点击「发送测试通知」即可触发浏览器授权（需要用户手势）。

### 2. 外部渠道通知（Host 半区）

由 Host 进程直接投递，不依赖浏览器页面：

- 会话运行结束自动推送（running → idle）；
- 阻塞事件（提问 / 审批）自动推送；
- **目标完成**（`goal/change` → `complete`）自动推送（默认关闭，见下方开关）。

### 3. 模型工具

`send_notification`：参数 `title`（标题）、`content`（正文），向所有已启用渠道发送。

## 设置页

DSH Web 设置 → 「通知」页。

### 通知设置

| 开关 | 默认 | 说明 |
| --- | --- | --- |
| 启用通知 | 开 | 总开关 |
| 浏览器本地通知 | 关 | 页面在后台时弹系统通知 |
| 运行结束时通知 | 开 | 运行结束提醒（仅浏览器通知有效） |
| 提问时通知 | 开 | 需要回答时提醒 |
| 审批请求时通知 | 开 | 需要批准时提醒 |
| 声音 | 开 | 通知是否发声 |

### 启用渠道

- 勾选要使用的渠道；未勾选的渠道不发送通知。
- 「目标完成时自动通知」默认关闭，勾选后目标达成会推送。

### 各渠道配置

- 密钥类字段（API Key / Webhook URL / 飞书加签密钥）标记为 secret：不会写回设置接口返回值，输入留空即保持原值，另有「清除密钥」按钮。
- 其他字段通过 DSH 标准 settings wire 持久化。
- 每个渠道卡片右上角有「测试 XX 通知」按钮；测试使用**已保存**的配置，改完请先点「保存」再测试。

## 安全

- Host 侧 `/dsh-notifier/test` 与 `/api/dsh-notifier/deliver` 路由仅接受本机回环同源请求（与 DSH `/api` 相同的信任判定）。
- 各渠道密钥不写回设置接口，只在 Host 进程内持有。
- 浏览器通知仅在页面后台时发送，内容不含密钥。

## HTTP 主动投递

除了模型工具，外部脚本、cron 或同 Host 的其它插件可以直接向本机投递端点 POST 一条 JSON（loopback-only，无需鉴权头；与 DSH `/api` 同一信任边界）：

```bash
curl --request POST http://127.0.0.1:3080/api/dsh-notifier/deliver \
  --header 'Content-Type: application/json' \
  --data '{
    "channel": "smtp",
    "title": "构建完成",
    "content": "pipeline 已结束。",
    "to": "ops@example.com"
  }'
```

- `channel`：`notifyx` | `webhook` | `wechatbot` | `email` | `smtp` | `dingtalk` | `feishu`
- `to`：可选，仅 SMTP 生效（临时收件人覆盖默认收件人）。
- 成功 `200`：`{ "ok": true, "value": { "channel", "sent": true } }`
- 失败 `502`（或 400/403/405 参数错误）：`{ "ok": false, "error": { "code", "message", "details": { "channel", "message" } } }`

错误码固定一套：`loopback-only` / `method-not-allowed` / `bad-request` / `unknown-channel` / `not-configured` / `invalid-config` / `http-error` / `api-error` / `request-failed` / `delivery-failed`。每个渠道的网络请求都有 10s 超时上限，单个渠道失败不会阻塞其它渠道。

## 变更记录

- **v0.3.1**：学 dsh-im —— 新增 HTTP 主动投递端点 `/api/dsh-notifier/deliver`（设置页/工具/HTTP 共用同一投递核心）、渠道请求统一 10s 超时（`AbortSignal.timeout`）、固定投递错误码与 `{ok,value|error}` 响应形状。
- **v0.3.0**：SMTP 私人邮件 + 钉钉机器人渠道。
- **v0.2.1**：开关改为 dshmarket 同款绿色按钮式 switch。
- **v0.2.0**：新增浏览器本地通知（默认关）、分层开关（运行结束/提问/审批）、前台抑制、子代理排除。
- **v0.1.2**：去掉「已配置」徽标误报；新增目标完成自动通知开关（默认关）。
- **v0.1.1**：修复 secret 未配置误报「已配置」；仅渲染已勾选渠道的配置卡片。

## License

MIT
