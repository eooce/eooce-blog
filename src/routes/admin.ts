import { Router } from 'express'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import { z } from 'zod'
import { db, estimateReadingMinutes, now } from '../db/database.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { ok, fail, HttpError } from '../utils/response.js'
import { autoSlug, slugify, randomSuffix, assertValidSlug } from '../utils/slug.js'
import { likePattern } from '../utils/search.js'

const router = Router()
router.use(requireAuth)

/* ---------------- stats ---------------- */

router.get('/stats', (_req, res) => {
  const posts = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
        SUM(views) AS views FROM posts`,
    )
    .get() as { total: number; published: number | null; drafts: number | null; views: number | null }
  const comments = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending FROM comments`,
    )
    .get() as { total: number; pending: number | null }

  const days: string[] = []
  for (let i = 6; i >= 0; i--) days.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))

  const postTrend = days.map((d) => ({
    date: d,
    count: (
      db
        .prepare("SELECT COUNT(*) AS c FROM posts WHERE substr(created_at, 1, 10) = ?")
        .get(d) as { c: number }
    ).c,
  }))
  const commentTrend = days.map((d) => ({
    date: d,
    count: (
      db
        .prepare('SELECT COUNT(*) AS c FROM comments WHERE substr(created_at, 1, 10) = ?')
        .get(d) as { c: number }
    ).c,
  }))

  ok(res, {
    posts: { total: posts.total, published: posts.published ?? 0, drafts: posts.drafts ?? 0 },
    comments: { total: comments.total, pending: comments.pending ?? 0 },
    views: posts.views ?? 0,
    trend: { posts: postTrend, comments: commentTrend },
  })
})

/* ---------------- posts ---------------- */

const postPayload = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120),
  slug: z.string().trim().max(140).optional(),
  summary: z.string().trim().max(500).optional(),
  content: z.string().min(1, '正文不能为空'),
  cover_image: z.string().trim().max(500).optional(),
  category_id: z.number().int().nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  pinned: z.boolean().default(false),
  tag_ids: z.array(z.number().int()).default([]),
})

function uniquePostSlug(title: string, requested: string | undefined, excludeId?: number): string {
  // 手动填写的路径按原样转写；留空则按标题自动生成短路径
  const base = requested ? slugify(requested) : autoSlug(title)
  assertValidSlug(base)
  let candidate = base
  let attempt = 0
  while (true) {
    const row = excludeId
      ? db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(candidate, excludeId)
      : db.prepare('SELECT id FROM posts WHERE slug = ?').get(candidate)
    if (!row) return candidate
    attempt += 1
    candidate = `${base}-${randomSuffix(4 + attempt)}`
  }
}

function uniqueName(table: 'categories' | 'tags', name: string, excludeId?: number): void {
  const row = excludeId
    ? db.prepare(`SELECT id FROM ${table} WHERE name = ? AND id != ?`).get(name, excludeId)
    : db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name)
  if (row) throw new HttpError(409, '名称已存在')
}

function replacePostTags(postId: number, tagIds: number[]): void {
  db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId)
  const ins = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')
  for (const tagId of tagIds) ins.run(postId, tagId)
}

router.get('/posts', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10))
  const status = typeof req.query.status === 'string' && ['draft', 'published'].includes(req.query.status)
    ? req.query.status
    : ''
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  const where: string[] = []
  const params: unknown[] = []
  if (status) {
    where.push('p.status = ?')
    params.push(status)
  }
  if (search) {
    where.push(`p.title LIKE ? ESCAPE '\\'`)
    params.push(likePattern(search))
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM posts p ${whereSql}`).get(...params) as { c: number }).c
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.slug, p.summary, p.status, p.pinned, p.views, p.reading_minutes,
        p.published_at, p.created_at, p.updated_at,
        c.name AS category_name, c.id AS category_id,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
       FROM posts p LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql} ORDER BY p.pinned DESC, p.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize)
  ok(res, { list: rows, total, page, pageSize })
})

router.get('/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined
  if (!post) throw new HttpError(404, '文章不存在')
  const tags = db
    .prepare('SELECT t.id FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ?')
    .all(post.id) as Array<{ id: number }>
  ok(res, { ...post, tag_ids: tags.map((t) => t.id) })
})

router.post('/posts', (req, res) => {
  const parsed = postPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '文章信息不完整')
    return
  }
  const p = parsed.data
  const slug = uniquePostSlug(p.title, p.slug)
  db.prepare(
    `INSERT INTO posts (title, slug, summary, content, cover_image, category_id, status, pinned, reading_minutes, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.title,
    slug,
    p.summary ?? '',
    p.content,
    p.cover_image ?? '',
    p.category_id ?? null,
    p.status,
    p.pinned ? 1 : 0,
    estimateReadingMinutes(p.content),
    p.status === 'published' ? now() : null,
  )
  const created = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug) as { id: number }
  replacePostTags(created.id, p.tag_ids)
  ok(res, { id: created.id, slug }, 201)
})

router.put('/posts/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as
    | { id: number; status: string; published_at: string | null }
    | undefined
  if (!existing) throw new HttpError(404, '文章不存在')

  const parsed = postPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '文章信息不完整')
    return
  }
  const p = parsed.data
  const slug = uniquePostSlug(p.title, p.slug, id)
  const publishedAt = existing.published_at ?? (p.status === 'published' ? now() : null)

  db.prepare(
    `UPDATE posts SET title = ?, slug = ?, summary = ?, content = ?, cover_image = ?, category_id = ?,
      status = ?, pinned = ?, reading_minutes = ?, published_at = ?, updated_at = ? WHERE id = ?`,
  ).run(
    p.title,
    slug,
    p.summary ?? '',
    p.content,
    p.cover_image ?? '',
    p.category_id ?? null,
    p.status,
    p.pinned ? 1 : 0,
    estimateReadingMinutes(p.content),
    publishedAt,
    now(),
    id,
  )
  replacePostTags(id, p.tag_ids)
  ok(res, { id })
})

router.patch('/posts/:id/status', (req, res) => {
  const id = Number(req.params.id)
  const schema = z.object({
    status: z.enum(['draft', 'published']).optional(),
    pinned: z.boolean().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '状态参数不合法')
    return
  }
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as
    | { id: number; status: string; published_at: string | null }
    | undefined
  if (!post) throw new HttpError(404, '文章不存在')

  if (parsed.data.status && parsed.data.status !== post.status) {
    const publishedAt =
      parsed.data.status === 'published' ? (post.published_at ?? now()) : post.published_at
    db.prepare('UPDATE posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?').run(
      parsed.data.status,
      publishedAt,
      now(),
      id,
    )
  }
  if (parsed.data.pinned !== undefined) {
    db.prepare('UPDATE posts SET pinned = ?, updated_at = ? WHERE id = ?').run(
      parsed.data.pinned ? 1 : 0,
      now(),
      id,
    )
  }
  ok(res, { id })
})

router.delete('/posts/:id', (req, res) => {
  const id = Number(req.params.id)
  const result = db.prepare('DELETE FROM posts WHERE id = ?').run(id)
  if (result.changes === 0) throw new HttpError(404, '文章不存在')
  ok(res, { id })
})

/* ---------------- categories ---------------- */

const categoryPayload = z.object({
  name: z.string().trim().min(1, '分类名不能为空').max(30),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(200).optional(),
})

router.get('/categories', (_req, res) => {
  // 顺序与前台一致（sort_order 优先，未设置时按文章数），后台的上移/下移才对得上
  ok(
    res,
    db
      .prepare(
        `SELECT c.*, COUNT(p.id) AS post_count
         FROM categories c
         LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
         GROUP BY c.id ORDER BY c.sort_order, post_count DESC, c.name`,
      )
      .all(),
  )
})

/** 上移 / 下移：先按当前展示顺序把 sort_order 归一化为 0..n-1，再与相邻项交换 */
router.patch('/categories/:id/move', (req, res) => {
  const id = Number(req.params.id)
  const parsed = z.object({ direction: z.enum(['up', 'down']) }).safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '方向参数不合法')
    return
  }
  const rows = db
    .prepare(
      `SELECT c.id, COUNT(p.id) AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
       GROUP BY c.id ORDER BY c.sort_order, post_count DESC, c.name`,
    )
    .all() as Array<{ id: number }>
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) throw new HttpError(404, '分类不存在')
  const target = parsed.data.direction === 'up' ? idx - 1 : idx + 1

  const move = db.transaction(() => {
    // 归一化：把当前展示顺序固化为显式 sort_order
    const setOrder = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
    rows.forEach((r, i) => setOrder.run(i, r.id))
    if (target < 0 || target >= rows.length) return
    setOrder.run(target, rows[idx].id)
    setOrder.run(idx, rows[target].id)
  })
  move()
  ok(res, { id })
})

router.post('/categories', (req, res) => {
  const parsed = categoryPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '分类信息不完整')
    return
  }
  const { name } = parsed.data
  uniqueName('categories', name)
  let slug = slugify(parsed.data.slug || name)
  while (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
    slug = `${slugify(parsed.data.slug || name)}-${randomSuffix()}`
  }
  // 新分类排在最后，避免后台调整过顺序后被插入到最前面
  const nextOrder =
    ((db.prepare('SELECT MAX(sort_order) AS m FROM categories').get() as { m: number | null }).m ?? -1) + 1
  const result = db
    .prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, slug, parsed.data.description ?? '', nextOrder)
  ok(res, { id: result.lastInsertRowid }, 201)
})

router.put('/categories/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
    | { id: number; slug: string }
    | undefined
  if (!existing) throw new HttpError(404, '分类不存在')
  const parsed = categoryPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '分类信息不完整')
    return
  }
  uniqueName('categories', parsed.data.name, id)

  // 允许自定义 slug；留空保持不变，传入值做唯一性与保留字检查
  let slug = existing.slug
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    slug = slugify(parsed.data.slug)
    assertValidSlug(slug)
    let attempt = 0
    while (db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id)) {
      attempt += 1
      slug = `${slugify(parsed.data.slug)}-${randomSuffix(4 + attempt)}`
    }
  }

  db.prepare('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?').run(
    parsed.data.name,
    slug,
    parsed.data.description ?? '',
    id,
  )
  ok(res, { id })
})

router.delete('/categories/:id', (req, res) => {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '分类不存在')
  ok(res, { deleted: result.changes })
})

/* ---------------- tags ---------------- */

const tagPayload = z.object({
  name: z.string().trim().min(1, '标签名不能为空').max(30),
})

router.get('/tags', (_req, res) => {
  const list = db
    .prepare(
      `SELECT t.*, COUNT(pt.post_id) AS post_count FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id GROUP BY t.id ORDER BY t.name`,
    )
    .all()
  ok(res, list)
})

router.post('/tags', (req, res) => {
  const parsed = tagPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '标签信息不完整')
    return
  }
  const { name } = parsed.data
  uniqueName('tags', name)
  let slug = slugify(name)
  while (db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug)) {
    slug = `${slugify(name)}-${randomSuffix()}`
  }
  const result = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(name, slug)
  ok(res, { id: result.lastInsertRowid }, 201)
})

router.put('/tags/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as
    | { id: number }
    | undefined
  if (!existing) throw new HttpError(404, '标签不存在')
  const parsed = tagPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '标签信息不完整')
    return
  }
  uniqueName('tags', parsed.data.name, id)
  db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(parsed.data.name, id)
  ok(res, { id })
})

router.delete('/tags/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '标签不存在')
  ok(res, { deleted: result.changes })
})

/** 设为首页蜂窝 C 位（独占：其余标签自动取消） */
router.patch('/tags/:id/center', (req, res) => {
  const id = Number(req.params.id)
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(id) as { id: number } | undefined
  if (!tag) throw new HttpError(404, '标签不存在')
  db.prepare('UPDATE tags SET is_center = CASE WHEN id = ? THEN 1 ELSE 0 END').run(id)
  ok(res, { id })
})

/* ---------------- comments ---------------- */

router.get('/comments', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10))
  const status = typeof req.query.status === 'string' && ['pending', 'approved', 'rejected'].includes(req.query.status)
    ? req.query.status
    : ''
  const where = status ? 'WHERE cm.status = ?' : ''
  const params: unknown[] = status ? [status] : []
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM comments cm ${where}`).get(...params) as { c: number }
  ).c
  const list = db
    .prepare(
      `SELECT cm.id, cm.post_id, cm.nickname, cm.email, cm.content, cm.status, cm.created_at,
        p.title AS post_title, p.slug AS post_slug
       FROM comments cm JOIN posts p ON p.id = cm.post_id ${where}
       ORDER BY cm.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize)
  ok(res, { list, total, page, pageSize })
})

router.patch('/comments/:id/status', (req, res) => {
  const schema = z.object({ status: z.enum(['pending', 'approved', 'rejected']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '评论状态不合法')
    return
  }
  const result = db
    .prepare('UPDATE comments SET status = ? WHERE id = ?')
    .run(parsed.data.status, Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '评论不存在')
  ok(res, { id: Number(req.params.id), status: parsed.data.status })
})

router.delete('/comments/:id', (req, res) => {
  const result = db.prepare('DELETE FROM comments WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '评论不存在')
  ok(res, { deleted: result.changes })
})

/* ---------------- guestbook ---------------- */

router.get('/guestbook', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10))
  const status = typeof req.query.status === 'string' && ['pending', 'approved', 'rejected'].includes(req.query.status)
    ? req.query.status
    : ''
  const where = status ? 'WHERE status = ?' : ''
  const params: unknown[] = status ? [status] : []
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM guestbook_messages ${where}`).get(...params) as { c: number }
  ).c
  const list = db
    .prepare(
      `SELECT id, nickname, email, content, status, created_at FROM guestbook_messages ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize)
  ok(res, { list, total, page, pageSize })
})

router.patch('/guestbook/:id/status', (req, res) => {
  const schema = z.object({ status: z.enum(['pending', 'approved', 'rejected']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '留言状态不合法')
    return
  }
  const result = db
    .prepare('UPDATE guestbook_messages SET status = ? WHERE id = ?')
    .run(parsed.data.status, Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '留言不存在')
  ok(res, { id: Number(req.params.id), status: parsed.data.status })
})

router.delete('/guestbook/:id', (req, res) => {
  const result = db.prepare('DELETE FROM guestbook_messages WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '留言不存在')
  ok(res, { deleted: result.changes })
})

/* ---------------- friend links ---------------- */

const linkPayload = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(40),
  url: z.string().trim().min(1, '链接不能为空').max(500),
  description: z.string().trim().max(120).default(''),
  visible: z.boolean().default(true),
})

router.get('/links', (_req, res) => {
  ok(res, db.prepare('SELECT * FROM friend_links ORDER BY sort_order, id').all())
})

router.post('/links', (req, res) => {
  const parsed = linkPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '链接信息不完整')
    return
  }
  assertExternalUrl(parsed.data.url)
  const max = (db.prepare('SELECT MAX(sort_order) AS m FROM friend_links').get() as { m: number | null }).m ?? 0
  const result = db
    .prepare('INSERT INTO friend_links (name, url, description, sort_order, visible) VALUES (?, ?, ?, ?, ?)')
    .run(parsed.data.name, parsed.data.url, parsed.data.description, max + 1, parsed.data.visible ? 1 : 0)
  ok(res, { id: Number(result.lastInsertRowid) }, 201)
})

router.put('/links/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT id FROM friend_links WHERE id = ?').get(id)
  if (!existing) throw new HttpError(404, '链接不存在')
  const parsed = linkPayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '链接信息不完整')
    return
  }
  assertExternalUrl(parsed.data.url)
  db.prepare('UPDATE friend_links SET name = ?, url = ?, description = ?, visible = ? WHERE id = ?').run(
    parsed.data.name,
    parsed.data.url,
    parsed.data.description,
    parsed.data.visible ? 1 : 0,
    id,
  )
  ok(res, { id })
})

router.patch('/links/:id/move', (req, res) => {
  const id = Number(req.params.id)
  const schema = z.object({ direction: z.enum(['up', 'down']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '方向参数不合法')
    return
  }
  const row = db.prepare('SELECT id, sort_order FROM friend_links WHERE id = ?').get(id) as
    | { id: number; sort_order: number }
    | undefined
  if (!row) throw new HttpError(404, '链接不存在')
  const siblings = db
    .prepare('SELECT id, sort_order FROM friend_links ORDER BY sort_order, id')
    .all() as Array<{ id: number; sort_order: number }>
  const idx = siblings.findIndex((s) => s.id === id)
  const swapWith = parsed.data.direction === 'up' ? siblings[idx - 1] : siblings[idx + 1]
  if (!swapWith) {
    ok(res, { id })
    return
  }
  const swap = db.transaction(() => {
    db.prepare('UPDATE friend_links SET sort_order = ? WHERE id = ?').run(swapWith.sort_order, row.id)
    db.prepare('UPDATE friend_links SET sort_order = ? WHERE id = ?').run(row.sort_order, swapWith.id)
  })
  swap()
  ok(res, { id })
})

router.delete('/links/:id', (req, res) => {
  const result = db.prepare('DELETE FROM friend_links WHERE id = ?').run(Number(req.params.id))
  if (result.changes === 0) throw new HttpError(404, '链接不存在')
  ok(res, { deleted: result.changes })
})

/* ---------------- site settings ---------------- */

router.put('/site', (req, res) => {
  const schema = z.object({
    site_title: z.string().trim().min(1).max(60),
    site_subtitle: z.string().trim().max(120).default(''),
    about_content: z.string().max(20000).default(''),
    site_logo: z.string().max(700000).default(''),
    icp_text: z.string().trim().max(60).default(''),
    icp_url: z.string().trim().max(300).default(''),
    icp_visible: z.boolean().default(true),
    police_text: z.string().trim().max(60).default(''),
    police_url: z.string().trim().max(300).default(''),
    police_visible: z.boolean().default(true),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '站点信息不完整')
    return
  }
  const logo = parsed.data.site_logo
  if (logo) {
    const isDataUrl = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logo)
    const isUrl = /^https?:\/\/\S+$/.test(logo)
    if (!isDataUrl && !isUrl) {
      fail(res, 400, 'Logo 仅支持图片文件或图片链接')
      return
    }
  }
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )
  upsert.run('site_title', parsed.data.site_title)
  upsert.run('site_subtitle', parsed.data.site_subtitle)
  upsert.run('about_content', parsed.data.about_content)
  upsert.run('site_logo', logo)
  // 备案信息：链接可为空（此时前台只显示文字，不可点击）
  if (parsed.data.icp_url) assertExternalUrl(parsed.data.icp_url)
  if (parsed.data.police_url) assertExternalUrl(parsed.data.police_url)
  upsert.run('icp_text', parsed.data.icp_text)
  upsert.run('icp_url', parsed.data.icp_url)
  upsert.run('icp_visible', parsed.data.icp_visible ? '1' : '0')
  upsert.run('police_text', parsed.data.police_text)
  upsert.run('police_url', parsed.data.police_url)
  upsert.run('police_visible', parsed.data.police_visible ? '1' : '0')
  ok(res, { message: '站点信息已更新' })
})

/* ---------------- account ---------------- */

router.put('/account', (req, res) => {
  const schema = z.object({
    current_password: z.string().min(1, '请输入当前密码'),
    username: z.string().trim().min(2, '用户名至少 2 个字符').max(30).optional(),
    new_password: z.string().min(6, '新密码至少 6 位').max(64).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '参数不合法')
    return
  }
  const { uid } = req.auth!
  const user = db
    .prepare('SELECT id, username, password_hash FROM users WHERE id = ?')
    .get(uid) as { id: number; username: string; password_hash: string } | undefined
  if (!user) throw new HttpError(404, '账号不存在')
  const bcryptCompare = bcrypt.compareSync(parsed.data.current_password, user.password_hash)
  if (!bcryptCompare) {
    // 用 400 而非 401：会话仍有效，避免触发前端的全局登出
    fail(res, 400, '当前密码不正确')
    return
  }

  let username = user.username
  if (parsed.data.username && parsed.data.username !== user.username) {
    const exists = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(parsed.data.username, uid)
    if (exists) {
      fail(res, 409, '用户名已被占用')
      return
    }
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(parsed.data.username, uid)
    username = parsed.data.username
  }
  if (parsed.data.new_password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(parsed.data.new_password, 10),
      uid,
    )
  }
  ok(res, { token: signToken({ uid, username }), username, message: '账号信息已更新' })
})

/* ---------------- nav menus & custom pages ---------------- */

const ALLOWED_SYSTEM_PATHS = ['/', '/archives', '/about', '/categories', '/tags', '/guestbook']

const pagePayload = z.object({
  title: z.string().trim().min(1, '页面标题不能为空').max(60),
  slug: z.string().trim().max(80).optional(),
  content: z.string().max(50000).default(''),
})

const menuCreatePayload = z.object({
  label: z.string().trim().min(1, '菜单名称不能为空').max(30),
  type: z.enum(['system', 'group', 'page', 'link']),
  parent_id: z.number().int().nullable().optional(),
  system_path: z.string().trim().max(200).optional(),
  url: z.string().trim().max(500).optional(),
  page: pagePayload.optional(),
  visible: z.boolean().default(true),
})

const menuUpdatePayload = z.object({
  label: z.string().trim().min(1, '菜单名称不能为空').max(30),
  visible: z.boolean().default(true),
  system_path: z.string().trim().max(200).optional(),
  url: z.string().trim().max(500).optional(),
  page: pagePayload.optional(),
})

function uniquePageSlug(title: string, requested: string | undefined, excludeId?: number): string {
  const base = slugify(requested || title)
  let candidate = base === 'post' ? `page-${randomSuffix()}` : base
  assertValidSlug(candidate)
  let attempt = 0
  while (true) {
    const row = excludeId
      ? db.prepare('SELECT id FROM custom_pages WHERE slug = ? AND id != ?').get(candidate, excludeId)
      : db.prepare('SELECT id FROM custom_pages WHERE slug = ?').get(candidate)
    if (!row) return candidate
    attempt += 1
    candidate = `${base}-${randomSuffix(4 + attempt)}`
  }
}

function nextSortOrder(parentId: number | null): number {
  const row = (
    parentId === null
      ? db.prepare('SELECT MAX(sort_order) AS m FROM nav_menus WHERE parent_id IS NULL').get()
      : db.prepare('SELECT MAX(sort_order) AS m FROM nav_menus WHERE parent_id = ?').get(parentId)
  ) as { m: number | null }
  return (row.m ?? 0) + 1
}

function getGroupParent(parentId: number): void {
  const parent = db.prepare('SELECT id, type FROM nav_menus WHERE id = ?').get(parentId) as
    | { id: number; type: string }
    | undefined
  if (!parent) throw new HttpError(404, '上级菜单不存在')
  if (parent.type !== 'group') throw new HttpError(400, '只有「多页分组」类型的菜单可以包含子菜单')
}

function assertSystemPath(path: string): void {
  if (!ALLOWED_SYSTEM_PATHS.includes(path)) throw new HttpError(400, '不支持的系统页面路径')
}

function assertExternalUrl(url: string): void {
  if (!/^https?:\/\/\S+$/.test(url)) throw new HttpError(400, '链接必须是 http(s):// 开头的完整地址')
}

router.get('/menus', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, p.title AS page_title, p.slug AS page_slug, p.content AS page_content
       FROM nav_menus m LEFT JOIN custom_pages p ON p.id = m.page_id
       ORDER BY m.parent_id IS NULL DESC, m.sort_order, m.id`,
    )
    .all()
  ok(res, rows)
})

router.post('/menus', (req, res) => {
  const parsed = menuCreatePayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '参数不合法')
    return
  }
  const p = parsed.data
  if (p.type === 'link') {
    if (!p.url) {
      fail(res, 400, '请填写跳转链接')
      return
    }
    assertExternalUrl(p.url)
  }
  if (p.type === 'system') {
    if (!p.system_path) {
      fail(res, 400, '请选择系统页面')
      return
    }
    assertSystemPath(p.system_path)
  }
  if (p.type === 'page' && !p.page) {
    fail(res, 400, '请填写单页内容')
    return
  }
  if (p.type === 'group' && p.parent_id) {
    fail(res, 400, '分组下不能再嵌套分组')
    return
  }
  if (p.parent_id) getGroupParent(p.parent_id)

  let pageId: number | null = null
  if (p.type === 'page' && p.page) {
    const slug = uniquePageSlug(p.page.title, p.page.slug)
    const result = db
      .prepare('INSERT INTO custom_pages (title, slug, content) VALUES (?, ?, ?)')
      .run(p.page.title, slug, p.page.content)
    pageId = Number(result.lastInsertRowid)
  }

  const result = db
    .prepare(
      'INSERT INTO nav_menus (parent_id, label, type, system_path, page_id, url, sort_order, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      p.parent_id ?? null,
      p.label,
      p.type,
      p.type === 'system' ? (p.system_path ?? '') : '',
      pageId,
      p.type === 'link' ? p.url ?? '' : '',
      nextSortOrder(p.parent_id ?? null),
      p.visible ? 1 : 0,
    )
  ok(res, { id: Number(result.lastInsertRowid) }, 201)
})

router.put('/menus/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM nav_menus WHERE id = ?').get(id) as
    | { id: number; type: string; page_id: number | null }
    | undefined
  if (!row) throw new HttpError(404, '菜单不存在')

  const parsed = menuUpdatePayload.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '参数不合法')
    return
  }
  const p = parsed.data

  if (row.type === 'link') {
    if (!p.url) {
      fail(res, 400, '请填写跳转链接')
      return
    }
    assertExternalUrl(p.url)
    db.prepare('UPDATE nav_menus SET url = ? WHERE id = ?').run(p.url, id)
  }
  if (row.type === 'system') {
    if (p.system_path) {
      assertSystemPath(p.system_path)
      db.prepare('UPDATE nav_menus SET system_path = ? WHERE id = ?').run(p.system_path, id)
    }
  }
  if (row.type === 'page') {
    if (!p.page || !row.page_id) {
      fail(res, 400, '页面内容缺失')
      return
    }
    const existing = db.prepare('SELECT id, title, slug FROM custom_pages WHERE id = ?').get(row.page_id) as
      | { id: number; slug: string }
      | undefined
    if (!existing) throw new HttpError(404, '页面不存在')
    const slug = uniquePageSlug(p.page.title, p.page.slug, existing.id)
    db.prepare("UPDATE custom_pages SET title = ?, slug = ?, content = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(
      p.page.title,
      slug,
      p.page.content,
      existing.id,
    )
  }
  db.prepare('UPDATE nav_menus SET label = ?, visible = ? WHERE id = ?').run(p.label, p.visible ? 1 : 0, id)
  ok(res, { id })
})

router.patch('/menus/:id/move', (req, res) => {
  const id = Number(req.params.id)
  const schema = z.object({ direction: z.enum(['up', 'down']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '方向参数不合法')
    return
  }
  const row = db.prepare('SELECT id, parent_id, sort_order FROM nav_menus WHERE id = ?').get(id) as
    | { id: number; parent_id: number | null; sort_order: number }
    | undefined
  if (!row) throw new HttpError(404, '菜单不存在')

  const siblings = db
    .prepare('SELECT id, sort_order FROM nav_menus WHERE parent_id IS ? ORDER BY sort_order, id')
    .all(row.parent_id) as Array<{ id: number; sort_order: number }>
  const idx = siblings.findIndex((s) => s.id === id)
  const swapWith = parsed.data.direction === 'up' ? siblings[idx - 1] : siblings[idx + 1]
  if (!swapWith) {
    ok(res, { id })
    return
  }
  const swap = db.transaction(() => {
    db.prepare('UPDATE nav_menus SET sort_order = ? WHERE id = ?').run(swapWith.sort_order, row.id)
    db.prepare('UPDATE nav_menus SET sort_order = ? WHERE id = ?').run(row.sort_order, swapWith.id)
  })
  swap()
  ok(res, { id })
})

router.delete('/menus/:id', (req, res) => {
  const row = db.prepare('SELECT id, type, page_id FROM nav_menus WHERE id = ?').get(Number(req.params.id)) as
    | { id: number; type: string; page_id: number | null }
    | undefined
  if (!row) throw new HttpError(404, '菜单不存在')
  if (row.type === 'page' && row.page_id) {
    // 删除单页会级联删除关联菜单
    db.prepare('DELETE FROM custom_pages WHERE id = ?').run(row.page_id)
  } else {
    db.prepare('DELETE FROM nav_menus WHERE id = ?').run(row.id)
  }
  ok(res, { deleted: 1 })
})

export default router
