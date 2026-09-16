import bcrypt from 'bcryptjs'
import { db, now } from './database.js'

const DEFAULT_NAV: Array<{ label: string; path: string }> = [
  { label: '首页', path: '/' },
  { label: '分类', path: '/categories' },
  { label: '标签', path: '/tags' },
  { label: '归档', path: '/archives' },
  { label: '关于', path: '/about' },
]

/** 已有数据库升级时补充默认导航（仅当菜单表为空） */
export function seedNavIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM nav_menus').get() as { c: number }).c
  if (count > 0) return
  const ins = db.prepare('INSERT INTO nav_menus (label, type, system_path, sort_order) VALUES (?, ?, ?, ?)')
  DEFAULT_NAV.forEach((n, i) => ins.run(n.label, 'system', n.path, i + 1))
  console.log(`[seed] default nav menus seeded at ${now()}`)
}

export function seedIfEmpty(): void {
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c
  if (userCount > 0) return

  const seed = db.transaction(() => {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      'admin',
      bcrypt.hashSync('admin123', 10),
    )

    const settings = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)')
    settings.run('site_title', '老王Blog')
    settings.run('site_subtitle', '老王blog — 代码与文字的栖息地，记录前端工程、后端架构与设计思考')
    settings.run('about_content', `## 关于我

你好，欢迎来到 **老王Blog**。

我是一名全栈工程师，白天写代码，晚上写字。这里记录我在前端工程、后端架构与产品设计路上的思考与实践。

### 我关注的方向

- **前端工程**：Vue 生态、TypeScript、性能优化与工程化体系
- **后端架构**：Node.js 服务、数据库设计与高可用实践
- **设计思维**：界面美学、交互细节与用户体验

### 联系方式

- 邮箱：hello\@shanyue.dev
- GitHub：[github.com/shanyue](https://github.com)

> 纸上得来终觉浅，绝知此事要躬行。`)

    const cat = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)')
    cat.run('前端开发', 'frontend', '浏览器端的一切：框架、工程化与体验优化')
    cat.run('后端架构', 'backend', '服务端设计与实践：API、数据库与稳定性')
    cat.run('设计思维', 'design', '界面美学与用户体验的思考')
    cat.run('随笔', 'essay', '生活记录与技术之外的杂谈')

    const tag = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)')
    tag.run('Vue', 'vue')
    tag.run('TypeScript', 'typescript')
    tag.run('Node.js', 'nodejs')
    tag.run('SQLite', 'sqlite')
    tag.run('UI 设计', 'ui-design')
    tag.run('工程化', 'engineering')
    tag.run('性能优化', 'performance')

    const catId = (slug: string) =>
      (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number }).id
    const tagId = (slug: string) =>
      (db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug) as { id: number }).id

    const insPost = db.prepare(`INSERT INTO posts
      (title, slug, summary, content, cover_image, category_id, status, pinned, views, reading_minutes, published_at, created_at, updated_at)
      VALUES (@title, @slug, @summary, @content, '', @category_id, @status, @pinned, @views, @reading_minutes, @published_at, @created_at, @created_at)`)
    const insPostTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')

    const posts: Array<{
      title: string
      slug: string
      summary: string
      content: string
      category: string
      tags: string[]
      status: 'published' | 'draft'
      pinned?: number
      views: number
      daysAgo: number
    }> = [
      {
        title: '从零搭建一套现代化的 Vue 3 博客系统',
        slug: 'build-modern-vue3-blog',
        summary:
          '本文以一个真实项目为例，讲解如何用 Vue 3 + Vite + Tailwind CSS 构建一个兼顾美感与性能的博客系统，涵盖架构设计、Markdown 渲染与深色主题实现。',
        content: `# 从零搭建一套现代化的 Vue 3 博客系统

写博客是工程师沉淀技术最好的方式之一。这篇文章记录我用 **Vue 3 + Vite + Tailwind CSS** 从零搭建博客的完整过程。

## 技术选型

选择技术栈时我遵循三个原则：

1. **类型安全优先**：TypeScript 从第一行代码就参与
2. **构建即体验**：Vite 的毫秒级 HMR 让开发过程愉悦
3. **样式可控**：Tailwind 的原子类让设计系统随写随用

## 项目结构

\`\`\`typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
\`\`\`

## Markdown 渲染方案

博客的核心是文章排版。我选择在后端存储原始 Markdown，在前端使用 \`markdown-it\` 渲染：

- 支持 GFM 表格与任务列表
- 代码块使用 highlight.js 高亮
- 标题自动生成锚点，侧边目录可跳转

## 深色主题

深色模式已成为现代博客的标配。实现上通过给根元素切换 \`dark\` class，配合 Tailwind 的 \`darkMode: 'class'\` 即可，用户的偏好持久化到 localStorage。

> 好的博客系统应该让作者专注写作，让读者专注阅读。`,
        category: 'frontend',
        tags: ['vue', 'typescript', 'engineering'],
        status: 'published',
        pinned: 1,
        views: 1284,
        daysAgo: 2,
      },
      {
        title: '用 better-sqlite3 打造轻量级内容服务',
        slug: 'better-sqlite3-content-service',
        summary:
          'SQLite 不只是移动端玩具。借助 better-sqlite3 的同步 API 与 WAL 模式，中小型内容站点可以获得极简部署与出色性能的双重收益。',
        content: `# 用 better-sqlite3 打造轻量级内容服务

对于个人博客、文档站这类写少读多的场景，SQLite 是被低估的选择。

## 为什么选 SQLite

- **零部署**：数据库就是一个文件，备份即复制
- **性能足够**：WAL 模式下读性能远超预期
- **类型严格**：CHECK 约束让脏数据无处藏身

## WAL 模式

\`\`\`typescript
import Database from 'better-sqlite3'

const db = new Database('blog.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
\`\`\`

## 事务与原子操作

浏览量自增这类高频写操作，直接用 SQL 表达式保证原子性：

\`\`\`typescript
db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(id)
\`\`\`

这样避免了先读后写的竞态条件，一个语句完成全部工作。`,
        category: 'backend',
        tags: ['nodejs', 'sqlite'],
        status: 'published',
        views: 862,
        daysAgo: 5,
      },
      {
        title: '博客设计的留白美学',
        slug: 'whitespace-aesthetics-in-blog-design',
        summary:
          '排版是阅读体验的一半。从行高、字距到版心宽度，聊聊那些让长文阅读变舒服的细节设计决策。',
        content: `# 博客设计的留白美学

文字是内容的主角，设计的工作是让主角登场时不被干扰。

## 版心宽度

一行文字的理想长度是 **65~75 个字符**。超过这个范围，视线换行时容易串行；过短则眼睛频繁折返，节奏被打破。

## 行高与字距

中文长文的行高建议在 1.8 左右，段间距大于行距，让段落有呼吸感。

## 层级靠对比

标题的层级感来自字号、字重与颜色的三重对比。克制使用颜色，一页内强调色不超过两种。

\`\`\`css
.article {
  max-width: 42rem;
  line-height: 1.8;
  letter-spacing: 0.01em;
}
\`\`\`

设计到最后，去掉的往往比加上的更有价值。`,
        category: 'design',
        tags: ['ui-design'],
        status: 'published',
        views: 534,
        daysAgo: 9,
      },
      {
        title: 'TypeScript 类型体操的实用边界',
        slug: 'typescript-type-gymnastics-practical-boundary',
        summary:
          '类型体操不是为了炫技。这篇文章梳理日常项目中最值得使用的五类高级类型技巧，以及应该停手的时机。',
        content: `# TypeScript 类型体操的实用边界

类型系统的价值在于把运行时错误提前到编译期。但投入要有边界。

## 值得写的类型

\`\`\`typescript
// 1. 从值推断字面量联合
const ROUTES = ['/home', '/posts', '/about'] as const
type Route = (typeof ROUTES)[number]

// 2. 模板字面量类型做路径校验
type ApiPath = \`/api/\${'posts' | 'tags'}/\${string}\`

// 3. Discriminated Union 消灭 if 判断地狱
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
\`\`\`

## 什么时候停手

当类型代码超过业务代码、当同事需要十分钟读懂一个类型签名，就是该用简单写法的时刻。

类型是工具，可维护性才是目的。`,
        category: 'frontend',
        tags: ['typescript'],
        status: 'published',
        views: 721,
        daysAgo: 14,
      },
      {
        title: '我如何用 REST API 组织博客后台',
        slug: 'organize-blog-admin-rest-api',
        summary:
          '统一的响应结构、清晰的资源划分与一致的错误语义，是后台管理系统能否顺畅协作的关键。分享我的 API 设计清单。',
        content: `# 我如何用 REST API 组织博客后台

后台管理系统 API 设计最重要的是**一致性**。

## 统一响应结构

\`\`\`json
{
  "code": 200,
  "data": { "list": [], "total": 0 },
  "message": "ok"
}
\`\`\`

前端只需要写一次拦截器，就能处理全部成功与失败分支。

## 资源划分

- 公开资源挂在 \`/api\` 下，匿名可读
- 管理资源挂在 \`/api/admin\` 下，JWT 中间件统一校验
- 状态变更用 PATCH 语义，如 \`PATCH /posts/:id/status\`

## 错误语义

400 给参数校验，401 给未登录，404 给不存在的资源，409 给唯一性冲突。语义准确比笼统的 500 有用得多。`,
        category: 'backend',
        tags: ['nodejs', 'engineering'],
        status: 'published',
        views: 445,
        daysAgo: 21,
      },
      {
        title: '山间半日：写作与代码的共同节奏',
        slug: 'mountain-half-day-essay',
        summary:
          '写代码和写文章，本质都是把混沌的想法整理成清晰的结构。周末进山走了半日，想了想这两件事的共同点。',
        content: `# 山间半日：写作与代码的共同节奏

周六清早上山，走到半山腰的茶亭坐下，什么也不做，就看着雾从谷底慢慢升起来。

写代码和写文章，本质上是一件事：**把混沌的想法整理成清晰的结构**。

## 结构先行

代码先想清楚模块边界再动手，文章先列大纲再填肉。跳过结构直接堆细节，返工只是时间问题。

## 节奏感

写代码有状态，写文章也是。状态好的时候一气呵成，状态差的时候宁可去山里走走。

> 步子放慢一点，路反而走得更远。`,
        category: 'essay',
        tags: [],
        status: 'published',
        views: 298,
        daysAgo: 30,
      },
      {
        title: '（草稿）Vite 插件机制的深度剖析',
        slug: 'vite-plugin-mechanism-deep-dive',
        summary: '从 dev server 的中间件模型到 Rollup 兼容层，逐步拆解 Vite 插件在开发与构建两条链路中的行为差异。',
        content: `# Vite 插件机制的深度剖析

> 草稿笔记，尚未完成。

## Dev 阶段

Vite dev server 本质是一个 connect 中间件栈，插件通过 \`configureServer\` 钩子介入。

## Build 阶段

构建时 Vite 切换到 Rollup 生态，插件写法需要注意兼容性差异。`,
        category: 'frontend',
        tags: ['engineering', 'performance'],
        status: 'draft',
        views: 0,
        daysAgo: 1,
      },
    ]

    for (const p of posts) {
      const published = new Date()
      published.setDate(published.getDate() - p.daysAgo)
      const dateStr = published.toISOString().replace('T', ' ').slice(0, 19)
      const result = insPost.run({
        title: p.title,
        slug: p.slug,
        summary: p.summary,
        content: p.content,
        category_id: catId(p.category),
        status: p.status,
        pinned: p.pinned ?? 0,
        views: p.views,
        reading_minutes: Math.max(1, Math.round(p.content.length / 500)),
        published_at: p.status === 'published' ? dateStr : null,
        created_at: dateStr,
      } as Record<string, unknown>)
      for (const t of p.tags) insPostTag.run(result.lastInsertRowid, tagId(t))
    }

    const postId = (slug: string) =>
      (db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug) as { id: number }).id
    const insComment = db.prepare('INSERT INTO comments (post_id, nickname, email, content, status) VALUES (?, ?, ?, ?, ?)')
    insComment.run(postId('build-modern-vue3-blog'), '晨风', 'chenfeng@example.com', '写得很有条理，深色主题部分正好解决了我的困惑，期待后续系列！', 'approved')
    insComment.run(postId('build-modern-vue3-blog'), '林间有风', 'lin@example.com', '请问 Markdown 目录锚点是如何生成的？会在下篇文章展开吗？', 'approved')
    insComment.run(postId('better-sqlite3-content-service'), '阿哲', 'zhe@example.com', 'WAL 模式的段落讲得很清楚，已在自己的项目里落地，谢谢分享。', 'approved')
    insComment.run(postId('build-modern-vue3-blog'), '过客', 'guest@example.com', '博主可以出一期评论系统的设计吗？', 'pending')
  })

  seed()
  console.log(`[seed] database seeded at ${now()}`)
}
