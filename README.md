# dsh-notifier

DSH 多渠道通知插件：为 DeepSeek Harness 增加 `send_notification` 模型工具和「通知 / Notifications」设置页。

支持的渠道：

- **NotifyX**（默认启用）
- **企业微信应用通知**（通用 Webhook）
- **企业微信机器人**
- **邮件通知**（Resend）
- **飞书机器人**（自定义机器人 Webhook，可选加签 + @所有人）

## 安装

```bash
cd /opt/dsh/profiles/web
dsh plugin add link:/workspace/dsh-notifier
```

或手动：

1. 将本目录软链/安装到 `/opt/dsh/profiles/web/node_modules/dsh-notifier`；
2. 在 profile 的 `package.json` 增加依赖 `dsh-notifier`，并把 `dsh-notifier` 加入 `dsh.profile.bundles`。

`cordis.patch.yml` 提供 bundle patch 行（`id: notifier` → 包名 `dsh-notifier`）。

## 配置

DSH Web 设置 → 「通知 / Notifications」页，可勾选启用渠道、填写各渠道配置，并逐个点击「测试 XX 通知」按钮。

- 密钥类字段（API Key / Webhook URL / 飞书加签密钥）标记为 secret：不会写回设置接口返回值，输入留空即保持原值，另有「清除密钥」按钮。
- 其他字段通过 DSH 标准 settings wire 持久化。

## 模型工具

`send_notification`：参数 `title`（标题）、`content`（正文），向所有已启用渠道发送。

## 安全

- Host 侧 `/dsh-notifier/test` 测试路由仅接受本机回环同源请求（与 DSH `/api` 相同的信任判定）。
- 各渠道密钥不写回设置接口，只在 Host 进程内持有。

## License

MIT
