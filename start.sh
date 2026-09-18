#!/bin/bash
# 一键启动：检测/安装 Node.js → 构建前端 → 安装后端依赖 → 启动服务（单端口）
set -euo pipefail

cd "$(dirname "$0")"

NODE_MIN_MAJOR=22
FNm_INSTALL_URL="https://fnm.vercel.app/install"

log()  { printf '\033[1;32m[start]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[start]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[start]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 1. 检测 Node.js，缺失或版本过低则用 fnm 安装 24 ----------
needs_node=0
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  current="$(node -v | sed 's/^v//')"
  major="${current%%.*}"
  if [ "${major:-0}" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null; then
    log "已安装 Node.js v${current} / npm $(npm -v)"
  else
    warn "Node.js v${current} 版本过低（要求 ≥ ${NODE_MIN_MAJOR}），改用 fnm 安装 Node.js 24"
    needs_node=1
  fi
else
  warn "未检测到 Node.js，开始安装"
  needs_node=1
fi

if [ "$needs_node" -eq 1 ]; then
  if ! command -v fnm >/dev/null 2>&1; then
    command -v curl >/dev/null 2>&1 || die "缺少 curl，无法安装 fnm，请先安装 curl 或手动安装 Node.js 24"
    log "安装 fnm"
    curl -o- "$FNm_INSTALL_URL" | bash
    # 官方脚本把 fnm 装在 ~/.local/share/fnm（旧版为 ~/.fnm），当前 shell 需手动加入 PATH
    export PATH="$HOME/.local/share/fnm:$HOME/.fnm:$PATH"
  fi
  command -v fnm >/dev/null 2>&1 || die "fnm 安装失败（服务器缺少 unzip 等依赖时请先补装），或手动安装 Node.js 24 后重试"

  eval "$(fnm env --shell bash)"
  log "通过 fnm 安装 Node.js 24"
  fnm install 24
  fnm use 24
  fnm default 24 >/dev/null 2>&1 || true

  command -v node >/dev/null 2>&1 || die "Node.js 安装后仍不可用，请检查 fnm 配置"
  log "Node.js 版本: $(node -v)"
  log "npm 版本:    $(npm -v)"
fi

# ---------- 2. 构建前端（web/ → web/dist） ----------
log "安装前端依赖（web/）"
cd web
npm install
log "构建前端产物"
npm run build
cd ..

# ---------- 3. 安装后端依赖 ----------
log "安装后端依赖"
npm install

# ---------- 4. 启动服务 ----------
export PORT="${PORT:-3001}"
log "启动服务：http://localhost:${PORT}（Ctrl+C 退出）"
exec npm run start
