// 仿真 DSH 客户端模块加载协议 + 真实调用 apply()，验证（混淆后）产物契约。
// 用法: node tools/verify-client.cjs <path/to/client.js>
//
// 1) 用 vm 沙箱执行脚本顶层（只调用 window.__ModuleLoader__.load(...)）。
// 2) 取出 factory，用 require stub 注入 react，得到模块导出。
// 3) 校验 inject/apply 形状，并用 mock ctx 真实调用 apply()，
//    捕获 settings.section / settings.notifier.item 的槽位注册，
//    确保混淆后运行时不抛错、且注册 id 未断裂。
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const target = path.resolve(process.argv[2] || '')
if (!target) {
  console.error('usage: node tools/verify-client.js <client.js>')
  process.exit(2)
}

const ReactStub = {
  createElement: (...a) => ({ kind: 'el', args: a }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useSyncExternalStore: (_sub, getSnap) => getSnap(),
}

let captured = null
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(spec) {
        captured = spec
      },
    },
  },
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)

let code
try {
  code = fs.readFileSync(target, 'utf8')
} catch (error) {
  console.error('READ ERROR:', error && error.message)
  process.exit(1)
}

try {
  vm.runInContext(code, sandbox, { filename: target })
} catch (error) {
  console.error('RUN ERROR:', error && error.message)
  process.exit(1)
}

if (!captured) {
  console.error('FAIL: window.__ModuleLoader__.load 未被调用（协议丢失）')
  process.exit(1)
}

console.log('id        =', captured.id)
console.log('hasFactory=', typeof captured.factory === 'function')

if (typeof captured.factory !== 'function') {
  console.error('FAIL: factory 不是函数')
  process.exit(1)
}

let mod
try {
  mod = captured.factory((name) => {
    if (name === 'react') return ReactStub
    throw new Error('unexpected require: ' + name)
  })
} catch (error) {
  console.error('FACTORY RUN ERROR:', error && error.message)
  process.exit(1)
}

const inject = mod && mod.inject
const apply = mod && mod.apply
console.log('inject    =', JSON.stringify(inject))
console.log('apply     =', typeof apply)

const expectInject = ['slots', 'settingsScope']
const expectId = '@a23842/dsh-notifier'
const injectOk = Array.isArray(inject) && expectInject.every((n) => inject.includes(n))
const applyOk = typeof apply === 'function'
const idOk = captured.id === expectId

if (!idOk) {
  console.error(`FAIL: 模块 id 应为 ${expectId}，实际 ${captured.id}`)
  process.exit(1)
}

if (!injectOk) {
  console.error('FAIL: inject 不符合预期，期望包含', expectInject)
  process.exit(1)
}
if (!applyOk) {
  console.error('FAIL: apply 不是函数')
  process.exit(1)
}

// 真实调用 apply()：mock ctx 跑一遍槽位注册，捕获运行期错误与注册 id。
const registrations = []
const ctx = {
  settingsScope: {
    bind() {
      return {
        getSnapshot: () => ({ status: 'ready', value: {}, base: {}, writable: true }),
        subscribe: () => () => {},
        set: async () => {},
        unset: async () => {},
      }
    },
    describe() {
      return {
        getSnapshot: () => ({ view: { namespaces: [] } }),
        subscribe: () => () => {},
      }
    },
  },
  slots: {
    inject(_name, factory) {
      registrations.push(factory())
      return () => {}
    },
    register(config, component) {
      return { name: config.name, id: config.id, component }
    },
  },
}

try {
  apply(ctx)
} catch (error) {
  console.error('APPLY ERROR:', error && error.message)
  process.exit(1)
}

const ids = registrations.map((r) => r && r.id)
console.log('registered=', JSON.stringify(ids))

const sectionOk = ids.includes('notifier')
const itemOk = ids.includes('notifier-page')
if (!sectionOk || !itemOk) {
  console.error('FAIL: 槽位注册 id 缺失 (期望 notifier + notifier-page)')
  process.exit(1)
}

console.log('RESULT: OK — 模块加载协议 + apply() 运行 + 槽位注册均保留')
