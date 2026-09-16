import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import authRouter from './routes/auth.js'
import publicRouter from './routes/public.js'
import adminRouter from './routes/admin.js'
import { db } from './db/database.js'
import { fail } from './utils/response.js'
import { HttpError } from './utils/response.js'
import { seedNavIfEmpty } from './db/seed.js'

export function createApp() {
  // 应用创建时确保默认导航存在（幂等），测试环境同样生效
  seedNavIfEmpty()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  // API 响应禁止浏览器缓存：站点标题/菜单等设置修改后必须立即生效
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  app.use('/api/auth', authRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api', publicRouter)

  app.use('/api', (_req, res) => {
    fail(res, 404, '接口不存在')
  })

  // 生产模式：若存在前端构建产物则托管静态资源，并支持 SPA 回退
  const webDist =
    process.env.WEB_DIST ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/dist')
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    // index.html 由下方回退处理器注入站点设置，静态服务不直接返回它
    app.use(express.static(webDist, { index: false }))

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    // 仅替换 meta description 为站点副标题；<title> 一律以 index.html 原文为准（标签页标题控制权在源文件）
    const renderIndex = (): string => {
      const settings = db
        .prepare("SELECT key, value FROM site_settings WHERE key IN ('site_title','site_subtitle')")
        .all() as Array<{ key: string; value: string }>
      const map = Object.fromEntries(settings.map((r) => [r.key, r.value]))
      return fs
        .readFileSync(path.join(webDist, 'index.html'), 'utf8')
        .replace(
          /(name="description" content=")[^"]*(")/,
          `$1${esc(map.site_subtitle || '代码与文字的栖息地，记录前端工程、后端架构与设计思考')}$2`,
        )
    }

    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => {
      try {
        res.set('Cache-Control', 'no-store')
        res.type('html').send(renderIndex())
      } catch {
        res.set('Cache-Control', 'no-store')
        res.sendFile(path.join(webDist, 'index.html'))
      }
    })
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      fail(res, err.status, err.message)
      return
    }
    if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
      fail(res, 400, '请求体格式错误')
      return
    }
    console.error('[error]', err)
    fail(res, 500, '服务器内部错误')
  })

  return app
}
