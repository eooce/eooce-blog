<script setup lang="ts">
import { computed, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import python from 'highlight.js/lib/languages/python'
import yaml from 'highlight.js/lib/languages/yaml'
import markdownLang from 'highlight.js/lib/languages/markdown'
import 'highlight.js/styles/github-dark.css'

export interface TocItem {
  id: string
  text: string
  level: number
}

const props = defineProps<{ content: string }>()
const emit = defineEmits<{ (e: 'toc', items: TocItem[]): void }>()

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('python', python)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdownLang)

const COPY_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
const CHECK_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
const COPY_BUTTON_HTML = `<button class="code-copy-btn" type="button" data-code-copy aria-label="复制代码">${COPY_ICON}<span>复制</span></button>`

const md: MarkdownIt = MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

let headingIndex = 0
const toc: TocItem[] = []

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const lang = (token.info || '').trim().split(/\s+/)[0]
  const language = hljs.getLanguage(lang) ? lang : ''
  let highlighted: string
  try {
    highlighted = language
      ? hljs.highlight(token.content, { language }).value
      : md.utils.escapeHtml(token.content)
  } catch {
    highlighted = md.utils.escapeHtml(token.content)
  }
  const langLabel = language ? `<span class="code-lang">${language}</span>` : ''
  const codeClass = language ? `hljs language-${language}` : 'hljs'
  return (
    `<div class="code-block">` +
    `<div class="code-toolbar">${langLabel}${COPY_BUTTON_HTML}</div>` +
    `<pre><code class="${codeClass}">${highlighted.replace(/\n+$/, '')}</code></pre>` +
    `</div>\n`
  )
}

md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const level = Number(token.tag.slice(1))
  if (level >= 2 && level <= 4) {
    headingIndex += 1
    const id = `heading-${headingIndex}`
    toc.push({ id, text: tokens[idx + 1]?.content ?? token.content, level })
    return `<${token.tag} id="${id}">`
  }
  return self.renderToken(tokens, idx, options)
}

/** 识别独占一行的视频链接（YouTube / Bilibili），转成内嵌播放器 */
function parseVideoUrl(raw: string): { provider: 'youtube' | 'bilibili'; id: string } | null {
  const url = raw.trim()
  let m = url.match(/^https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{6,20})\/?(?:\?\S*)?$/)
  if (m) return { provider: 'youtube', id: m[1] }
  m = url.match(/^https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})(?:[&?]\S*)?$/)
  if (m) return { provider: 'youtube', id: m[1] }
  m = url.match(/^https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]{8,14})\/?(?:\?\S*)?$/)
  if (m) return { provider: 'bilibili', id: m[1] }
  return null
}

md.block.ruler.before('paragraph', 'video_embed', (state, startLine, _endLine, silent) => {
  const pos = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  const line = state.src.slice(pos, max).trim()
  const embed = parseVideoUrl(line)
  if (!embed) return false
  if (silent) return true
  const token = state.push('video_embed', '', 0)
  token.block = true
  token.map = [startLine, startLine + 1]
  token.meta = embed
  state.line = startLine + 1
  return true
})

md.renderer.rules.video_embed = (tokens, idx) => {
  const meta = tokens[idx].meta as { provider: 'youtube' | 'bilibili'; id: string }
  const src =
    meta.provider === 'youtube'
      ? `https://www.youtube.com/embed/${meta.id}`
      : `https://player.bilibili.com/player.html?bvid=${meta.id}&autoplay=0&high_quality=1`
  return (
    `<div class="video-embed"><iframe src="${src}" title="视频播放器" loading="lazy" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" ` +
    `allowfullscreen frameborder="0"></iframe></div>\n`
  )
}

const html = computed(() => {
  headingIndex = 0
  toc.length = 0
  return md.render(props.content)
})

watch(
  html,
  () => {
    emit('toc', [...toc])
  },
  { immediate: true, flush: 'post' },
)

const copyTimers = new WeakMap<HTMLButtonElement, number>()

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy failed'))
    } catch (err) {
      reject(err)
    } finally {
      ta.remove()
    }
  })
}

/** 事件委托：v-html 内的复制按钮点击后复制同块代码 */
function onContentClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-code-copy]')
  if (!btn) return
  const code = btn.closest('.code-block')?.querySelector('pre > code')?.textContent ?? ''
  copyText(code)
    .then(() => {
      btn.classList.add('copied')
      btn.innerHTML = `${CHECK_ICON}<span>已复制</span>`
      window.clearTimeout(copyTimers.get(btn))
      copyTimers.set(
        btn,
        window.setTimeout(() => {
          btn.classList.remove('copied')
          btn.innerHTML = `${COPY_ICON}<span>复制</span>`
        }, 2000),
      )
    })
    .catch(() => {})
}
</script>

<template>
  <div class="article-content" v-html="html" @click="onContentClick" />
</template>
