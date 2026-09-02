#!/usr/bin/env bash
# 从私有明文源码仓库构建「发布/上架审核」目录（Host + Client 均混淆）。
# 用法: bash tools/build-publish.sh   （可用 OUT=... 覆盖输出目录）
#
# 发布目录 OUT 里只放交付物：
#   package.json  cordis.patch.yml  README.md  LICENSE
#   dsh/index.js(混淆)  dsh/client.js(混淆)  dsh-notifier-<ver>.tgz
# 构建/校验脚本与 peer 依赖符号链接仅构建期使用，不留在 OUT。
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-/workspace/dsh-notifier-publish}"
DSH_NM=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai

echo "==> 清理并重建 $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/dsh"

# 1) 静态文件：原样拷贝（元数据不混淆 —— 审核需可读）
cp "$SRC/package.json" "$SRC/cordis.patch.yml" "$SRC/README.md" "$SRC/LICENSE" "$OUT/"

# 2) Host 半区（Node ESM）：javascript-obfuscator 混淆，保留 import/export
echo "==> 混淆 Host (dsh/index.js)"
npx --yes javascript-obfuscator "$SRC/dsh/index.js" \
  --config "$SRC/tools/obfuscator.host.config.cjs" \
  --output "$OUT/dsh/index.js"

# 3) Client 半区（浏览器 lazy-CJS）：javascript-obfuscator 中档混淆
echo "==> 混淆 Client (dsh/client.js)"
npx --yes javascript-obfuscator "$SRC/dsh/client.js" \
  --config "$SRC/tools/obfuscator.client.config.cjs" \
  --output "$OUT/dsh/client.js"

# 4) 构建期校验：为 Host import 临时挂 peer 依赖符号链接（用后即删）
echo "==> 自检产物"
mkdir -p "$OUT/node_modules/@deepseek-ai"
ln -sfn "$DSH_NM/schemastery" "$OUT/node_modules/@deepseek-ai/schemastery"
ln -sfn "$DSH_NM/dsh-settings" "$OUT/node_modules/@deepseek-ai/dsh-settings"
ln -sfn "$DSH_NM/cordis" "$OUT/node_modules/@deepseek-ai/cordis"

if ! node "$SRC/tools/verify-client.cjs" "$OUT/dsh/client.js" >/dev/null 2>&1; then
  echo "✗ 客户端协议自检失败" >&2
  node "$SRC/tools/verify-client.cjs" "$OUT/dsh/client.js"
  exit 1
fi
if ! node "$SRC/tools/verify-host.cjs" "$OUT/dsh/index.js" >/dev/null 2>&1; then
  echo "✗ Host 产物自检失败" >&2
  node "$SRC/tools/verify-host.cjs" "$OUT/dsh/index.js"
  exit 1
fi
rm -rf "$OUT/node_modules"
echo "✓ 客户端协议 + Host import/apply 均通过"

# 5) 打包 .tgz（发布/上架审核的规范交付物）
echo "==> 打包 .tgz"
( cd "$OUT" && npm pack --silent >/dev/null 2>&1 )
printf 'node_modules/\n' > "$OUT/.gitignore"

echo "==> 产物大小对比"
printf '%-40s %8s\n' "源码 dsh/index.js" "$(wc -c < "$SRC/dsh/index.js") bytes"
printf '%-40s %8s\n' "产物 dsh/index.js" "$(wc -c < "$OUT/dsh/index.js") bytes"
printf '%-40s %8s\n' "源码 dsh/client.js" "$(wc -c < "$SRC/dsh/client.js") bytes"
printf '%-40s %8s\n' "产物 dsh/client.js" "$(wc -c < "$OUT/dsh/client.js") bytes"

echo
echo "==> 完成: $OUT"
echo "==> 交付物清单:"
( cd "$OUT" && find . -not -name '.gitignore' | sort )
