// 验证（混淆后）Host 产物：能被 Node ESM import，apply() 能运行，
// 且注册 send_notification 工具 + dsh-notifier settings 命名空间。
// 用法: node tools/verify-host.cjs <path/to/dsh/index.js>
'use strict'

const path = require('node:path')
const { pathToFileURL } = require('node:url')

const target = path.resolve(process.argv[2] || '')
if (!target) {
  console.error('usage: node tools/verify-host.cjs <dsh/index.js>')
  process.exit(2)
}

async function main() {
  let mod
  try {
    mod = await import(pathToFileURL(target).href + '?t=' + Date.now())
  } catch (error) {
    console.error('IMPORT ERROR:', error && error.message)
    process.exit(1)
  }

  console.log('inject =', JSON.stringify(mod.inject))
  console.log('apply  =', typeof mod.apply)

  if (!Array.isArray(mod.inject) || !mod.inject.includes('tools')) {
    console.error('FAIL: inject 缺少 tools')
    process.exit(1)
  }
  if (typeof mod.apply !== 'function') {
    console.error('FAIL: apply 不是函数')
    process.exit(1)
  }

  const tools = []
  const namespaces = []
  let settingsCb = null
  const ctx = {
    get: () => undefined,
    inject: (deps, cb) => {
      if (Array.isArray(deps) && deps.includes('settings')) settingsCb = cb
      return () => {}
    },
    effect: () => () => {},
    tools: {
      register: (spec) => {
        tools.push(spec)
        return () => {}
      },
    },
  }

  try {
    mod.apply(ctx)
  } catch (error) {
    console.error('APPLY ERROR:', error && error.message)
    process.exit(1)
  }

  if (settingsCb) {
    try {
      settingsCb({
        settings: {
          register: (ns, _schema, opts) => {
            namespaces.push({ ns, opts })
            return {
              get: () => ({}),
              watch: () => () => {},
            }
          },
        },
      })
    } catch (error) {
      console.error('SETTINGS CB ERROR:', error && error.message)
      process.exit(1)
    }
  }

  console.log('tool     =', tools.map((t) => t.name))
  console.log('settings =', namespaces.map((n) => n.ns))

  if (tools.length !== 1 || tools[0].name !== 'send_notification') {
    console.error('FAIL: 未正确注册 send_notification 工具')
    process.exit(1)
  }
  if (namespaces.length !== 1 || namespaces[0].ns !== 'dsh-notifier') {
    console.error('FAIL: 未正确注册 dsh-notifier settings 命名空间')
    process.exit(1)
  }

  console.log('RESULT: OK — Host import + apply() + 工具/命名空间注册均保留')
}

main().catch((error) => {
  console.error('FATAL:', error && error.message)
  process.exit(1)
})
