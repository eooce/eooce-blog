import { randomUUID } from 'node:crypto'

interface CaptchaEntry {
  code: string
  expires: number
}

const TTL = 5 * 60 * 1000
const captchas = new Map<string, CaptchaEntry>()

// 排除易混淆字符（0/O、1/I/L 等）
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const COLORS = ['#185a56', '#fd742d', '#0f766e', '#b45309', '#475569']

function prune(): void {
  const now = Date.now()
  for (const [k, v] of captchas) if (v.expires < now) captchas.delete(k)
}

export interface IssuedCaptcha {
  id: string
  svg: string
  /** 仅测试环境返回明文，供自动化断言 */
  code?: string
}

export function issueCaptcha(includeCode = false): IssuedCaptcha {
  prune()
  let code = ''
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
  const id = randomUUID()
  captchas.set(id, { code: code.toLowerCase(), expires: Date.now() + TTL })

  const width = 120
  const height = 44
  let glyphs = ''
  for (let i = 0; i < code.length; i++) {
    const x = 16 + i * 24 + (Math.random() * 6 - 3)
    const y = 31 + (Math.random() * 6 - 3)
    const rot = (Math.random() * 36 - 18).toFixed(1)
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    glyphs += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${color}" font-size="26" font-weight="700" font-family="monospace" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`
  }
  let noise = ''
  for (let i = 0; i < 3; i++) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    noise += `<line x1="${(Math.random() * width).toFixed(0)}" y1="${(Math.random() * height).toFixed(0)}" x2="${(Math.random() * width).toFixed(0)}" y2="${(Math.random() * height).toFixed(0)}" stroke="${color}" stroke-width="1" opacity="0.45"/>`
  }
  for (let i = 0; i < 8; i++) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    noise += `<circle cx="${(Math.random() * width).toFixed(0)}" cy="${(Math.random() * height).toFixed(0)}" r="1.2" fill="${color}" opacity="0.4"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="验证码"><rect width="100%" height="100%" rx="8" fill="#f1f5f9"/>${noise}${glyphs}</svg>`

  return includeCode ? { id, svg, code } : { id, svg }
}

/** 校验并消费验证码（一次性） */
export function verifyCaptcha(id: string, code: string): boolean {
  const entry = captchas.get(id)
  if (!entry) return false
  captchas.delete(id)
  return entry.code === code.trim().toLowerCase()
}
