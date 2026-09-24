import { pinyin } from 'pinyin-pro'
import { HttpError } from './response.js'

export function slugify(title: string): string {
  // 中文名称转写为拼音，保证自动生成的 slug 为英文（如「前端开发」→ qian-duan-kai-fa）
  const transliterated = pinyin(title, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('-')
  const base = transliterated
    .toLowerCase()
    .trim()
    // 剥离变音符号（拼音 ü → u），保持 URL 友好
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'post'
}

export function randomSuffix(len = 4): string {
  return Math.random().toString(36).slice(2, 2 + len)
}

/** 自动生成的路径最长长度（超出时在词边界截断），避免 URL 过长 */
const AUTO_SLUG_MAX = 48

/**
 * 文章路径的自动生成规则（未手动填写 slug 时）：
 * - 英文/数字开头：取开头的英文片段（遇到中文等字符即止），如「AWS大放水？…」→ aws
 * - 中文开头：取前两个字的拼音，如「注册最重要的环境…」→ zhu-ce
 */
export function autoSlug(title: string): string {
  const trimmed = title.trim()

  const leading = trimmed.match(/^[A-Za-z0-9][A-Za-z0-9\s._-]*/)
  if (leading) {
    const base = slugify(leading[0])
    if (base) {
      return base.length > AUTO_SLUG_MAX ? base.slice(0, AUTO_SLUG_MAX).replace(/-[^-]*$/, '') : base
    }
  }

  // 去掉开头的标点/空白后再取前两个字，避免「《前端》…」取到书名号
  const stripped = trimmed.replace(/^[\s\p{P}\p{S}]+/u, '')
  const firstTwo = Array.from(stripped).slice(0, 2).join('')
  return slugify(firstTwo || trimmed)
}

const RESERVED_SLUGS = new Set(['admin', 'api', 'assets', 'static', 'favicon.ico'])

export function assertValidSlug(slug: string): void {
  if (RESERVED_SLUGS.has(slug)) {
    throw new HttpError(409, '该 slug 为系统保留名称')
  }
}
