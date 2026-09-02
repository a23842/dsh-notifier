module.exports = {
  // 浏览器端混淆配置：中档强度，且不破坏 DSH 模块加载协议。
  // 必须保留的对外契约（id 运行时值 / factory / exports.apply / exports.inject）
  // 由「不重命名属性、不重命名全局、不 selfDefending、不 debugProtection」保证。
  target: 'browser',
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
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
