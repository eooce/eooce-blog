import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { seedIfEmpty, seedNavIfEmpty } from './db/seed.js'

seedIfEmpty()
seedNavIfEmpty()

const app = createApp()
const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`[blog] API server listening on http://localhost:${PORT}`)

  const webDist =
    process.env.WEB_DIST ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/dist')
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    console.log(`[blog] frontend served from ${webDist}`)
  } else {
    console.warn('[blog] 未检测到前端构建产物 (web/dist)，当前仅提供 /api 接口，前台页面无法访问。')
    console.warn('[blog] 请先执行: npm run setup（首次安装依赖）然后 npm run build（构建前端），或使用 Docker 部署。')
  }
})
