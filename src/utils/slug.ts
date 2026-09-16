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

const RESERVED_SLUGS = new Set(['admin', 'api', 'assets', 'static', 'favicon.ico'])

export function assertValidSlug(slug: string): void {
  if (RESERVED_SLUGS.has(slug)) {
    throw new HttpError(409, '该 slug 为系统保留名称')
  }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
