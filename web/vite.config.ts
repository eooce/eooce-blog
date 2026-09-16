import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发模式下从根目录数据库读取站点设置，注入 index.html 的标题与描述
// （与生产环境 Express 的注入行为一致，避免首屏标题闪烁）
const nodeRequire = createRequire(import.meta.url)
const rootDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

let cachedTitle = ''
let cachedSubtitle = ''
let cachedAt = 0

function getSiteMeta(): { title: string; subtitle: string } {
  if (Date.now() - cachedAt < 3000) return { title: cachedTitle, subtitle: cachedSubtitle }
  try {
    const Database = nodeRequire('better-sqlite3')
    const db = new Database(path.join(rootDir, 'data', 'blog.db'), { readonly: true, fileMustExist: false })
    const rows = db
      .prepare("SELECT key, value FROM site_settings WHERE key IN ('site_title','site_subtitle')")
      .all() as Array<{ key: string; value: string }>
    db.close()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    cachedTitle = map.site_title || '老王Blog'
    cachedSubtitle = map.site_subtitle || ''
    cachedAt = Date.now()
  } catch {
    cachedTitle = ''
    cachedSubtitle = ''
  }
  return { title: cachedTitle, subtitle: cachedSubtitle }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function injectSiteMeta(): Plugin {
  return {
    name: 'inject-site-meta',
    transformIndexHtml(html) {
      // 仅注入 meta description；<title> 以 index.html 原文为准
      const { subtitle } = getSiteMeta()
      if (subtitle) return html.replace(/(name="description" content=")[^"]*(")/, `$1${esc(subtitle)}$2`)
      return html
    },
  }
}

export default defineConfig({
  plugins: [vue(), injectSiteMeta()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // true = 允许任意域名访问开发服务器（默认仅允许 localhost 与 IP）
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
