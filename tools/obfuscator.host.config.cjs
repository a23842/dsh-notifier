module.exports = {
  // Host 半区（Node ESM）混淆配置。
  // 关键：ignoreImports=true 保留 import/export 语句原样，
  // 确保 bare specifier（node:crypto / @deepseek-ai/*）与 export const inject /
  // export function apply 不被改写，Node ESM 能正常加载。
  // 不重命名属性、不重命名全局、不 selfDefending，避免破坏 schemastery/dsh-settings
  // 通过属性链访问（settingsNamespace / z.object / role('secret') 等）。
  target: 'node',
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  ignoreImports: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 1,
  rotateStringArray: true,
  shuffleStringArray: true,
  stringArrayWrappersCount: 1,
  splitStrings: true,
  splitStringsChunkLength: 5,
  numbersToExpressions: true,
  simplify: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  seed: 20260901,
}
