import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/database.js'
import { ok, fail, HttpError } from '../utils/response.js'
import { likePattern } from '../utils/search.js'

const router = Router()

interface PostRow {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  cover_image: string
  category_id: number | null
  status: string
  pinned: number
  views: number
  reading_minutes: number
  published_at: string | null
  created_at: string
  updated_at: string
  category_name: string | null
  category_slug: string | null
}

function attachTags(posts: PostRow[]): Array<PostRow & { tags: Array<{ name: string; slug: string }> }> {
  if (posts.length === 0) return []
  const ids = posts.map((p) => p.id)
  const placeholders = ids.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT pt.post_id, t.name, t.slug FROM post_tags pt
       JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id IN (${placeholders}) ORDER BY t.name`,
    )
    .all(...ids) as Array<{ post_id: number; name: string; slug: string }>
  const map = new Map<number, Array<{ name: string; slug: string }>>()
  for (const r of rows) {
    const list = map.get(r.post_id) ?? []
    list.push({ name: r.name, slug: r.slug })
    map.set(r.post_id, list)
  }
  return posts.map((p) => ({ ...p, tags: map.get(p.id) ?? [] }))
}

const POST_LIST_FIELDS = `p.id, p.title, p.slug, p.summary, p.cover_image, p.category_id,
  p.status, p.pinned, p.views, p.reading_minutes, p.published_at, p.created_at, p.updated_at,
  c.name AS category_name, c.slug AS category_slug`

router.get('/posts', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 9))
  const { category, tag } = req.query
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''

  const where: string[] = ["p.status = 'published'"]
  const params: unknown[] = []

  if (typeof category === 'string' && category) {
    where.push('c.slug = ?')
    params.push(category)
  }
  if (typeof tag === 'string' && tag) {
    where.push(
      'p.id IN (SELECT pt.post_id FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE t.slug = ?)',
    )
    params.push(tag)
  }
  if (search) {
    const like = likePattern(search)
    where.push(
      `(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\' OR p.summary LIKE ? ESCAPE '\\')`,
    )
    params.push(like, like, like)
  }

  const whereSql = where.join(' AND ')
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`,
      )
      .get(...params) as { c: number }
  ).c

  const rows = db
    .prepare(
      `SELECT ${POST_LIST_FIELDS} FROM posts p LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${whereSql}
       ORDER BY p.pinned DESC, p.published_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as PostRow[]

  ok(res, { list: attachTags(rows), total, page, pageSize })
})

router.get('/posts/:slug', (req, res) => {
  const post = db
    .prepare(
      `SELECT ${POST_LIST_FIELDS}, p.content FROM posts p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.status = 'published'`,
    )
    .get(req.params.slug) as PostRow | undefined

  if (!post) {
    throw new HttpError(404, '文章不存在或未发布')
  }

  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id)
  post.views += 1

  const tags = db
    .prepare(
      'SELECT t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.name',
    )
    .all(post.id) as Array<{ name: string; slug: string }>

  const prev = db
    .prepare(
      `SELECT title, slug FROM posts WHERE status = 'published' AND published_at < ?
       ORDER BY published_at DESC LIMIT 1`,
    )
    .get(post.published_at) as { title: string; slug: string } | undefined
  const next = db
    .prepare(
      `SELECT title, slug FROM posts WHERE status = 'published' AND published_at > ?
       ORDER BY published_at ASC LIMIT 1`,
    )
    .get(post.published_at) as { title: string; slug: string } | undefined

  ok(res, { ...post, tags, prev: prev ?? null, next: next ?? null })
})

router.get('/posts/:slug/comments', (req, res) => {
  const post = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published'")
    .get(req.params.slug) as { id: number } | undefined
  if (!post) {
    throw new HttpError(404, '文章不存在或未发布')
  }
  const list = db
    .prepare(
      `SELECT id, nickname, content, created_at FROM comments
       WHERE post_id = ? AND status = 'approved' ORDER BY created_at DESC`,
    )
    .all(post.id)
  ok(res, list)
})

const commentSchema = z.object({
  nickname: z.string().trim().min(1, '昵称不能为空').max(30),
  email: z.string().trim().email('邮箱格式不正确').max(100),
  content: z.string().trim().min(1, '评论内容不能为空').max(1000),
})

router.post('/posts/:slug/comments', (req, res) => {
  const post = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published'")
    .get(req.params.slug) as { id: number } | undefined
  if (!post) {
    throw new HttpError(404, '文章不存在或未发布')
  }
  const parsed = commentSchema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '评论信息不完整')
    return
  }
  const { nickname, email, content } = parsed.data
  db.prepare('INSERT INTO comments (post_id, nickname, email, content) VALUES (?, ?, ?, ?)').run(
    post.id,
    nickname,
    email,
    content,
  )
  ok(res, { message: '评论提交成功，审核通过后将展示' }, 201)
})

/* ---------------- guestbook ---------------- */

router.get('/guestbook', (_req, res) => {
  const list = db
    .prepare(
      `SELECT id, nickname, content, created_at FROM guestbook_messages
       WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`,
    )
    .all()
  ok(res, list)
})

router.post('/guestbook', (req, res) => {
  const parsed = commentSchema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? '留言信息不完整')
    return
  }
  const { nickname, email, content } = parsed.data
  db.prepare('INSERT INTO guestbook_messages (nickname, email, content) VALUES (?, ?, ?)').run(
    nickname,
    email,
    content,
  )
  ok(res, { message: '留言提交成功，审核通过后将展示' }, 201)
})

/* ---------------- friend links ---------------- */

router.get('/links', (_req, res) => {
  const list = db
    .prepare('SELECT id, name, url, description FROM friend_links WHERE visible = 1 ORDER BY sort_order, id')
    .all()
  ok(res, list)
})

router.get('/categories', (_req, res) => {
  const list = db
    .prepare(
      `SELECT c.id, c.name, c.slug, c.description, c.sort_order, COUNT(p.id) AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
       GROUP BY c.id ORDER BY c.sort_order, post_count DESC, c.name`,
    )
    .all()
  ok(res, list)
})

router.get('/tags', (_req, res) => {
  const list = db
    .prepare(
      `SELECT t.id, t.name, t.slug, t.is_center, COUNT(pt.post_id) AS post_count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       LEFT JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
       GROUP BY t.id ORDER BY post_count DESC, t.name`,
    )
    .all()
  ok(res, list)
})

router.get('/archives', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.title, p.slug, p.published_at, p.views,
        substr(p.published_at, 1, 7) AS month
       FROM posts p WHERE p.status = 'published'
       ORDER BY p.published_at DESC`,
    )
    .all() as Array<{ title: string; slug: string; published_at: string; views: number; month: string }>
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = groups.get(r.month) ?? []
    list.push(r)
    groups.set(r.month, list)
  }
  ok(res, {
    total: rows.length,
    groups: Array.from(groups.entries()).map(([month, posts]) => ({ month, posts })),
  })
})

router.get('/site', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{
    key: string
    value: string
  }>
  const site: Record<string, string> = {}
  for (const r of rows) site[r.key] = r.value
  ok(res, site)
})

router.get('/nav', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.parent_id, m.label, m.type, m.system_path, m.url, p.slug AS page_slug
       FROM nav_menus m LEFT JOIN custom_pages p ON p.id = m.page_id
       WHERE m.visible = 1
       ORDER BY m.parent_id IS NULL DESC, m.sort_order, m.id`,
    )
    .all() as Array<{
    id: number
    parent_id: number | null
    label: string
    type: string
    system_path: string
    url: string
    page_slug: string | null
  }>

  interface NavNode {
    id: number
    label: string
    type: string
    to: string
    url: string
    open_new_tab: boolean
    children: NavNode[]
  }
  const map = new Map<number, NavNode>()
  const roots: NavNode[] = []
  for (const r of rows) {
    const node: NavNode = {
      id: r.id,
      label: r.label,
      type: r.type,
      to: r.type === 'page' ? `/page/${r.page_slug ?? ''}` : r.type === 'system' ? r.system_path : '',
      url: r.type === 'link' ? r.url : '',
      open_new_tab: r.type === 'link',
      children: [],
    }
    map.set(r.id, node)
    const parent = r.parent_id ? map.get(r.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  ok(res, roots)
})

router.get('/pages/:slug', (req, res) => {
  const page = db.prepare('SELECT title, content, updated_at FROM custom_pages WHERE slug = ?').get(
    req.params.slug,
  ) as { title: string; content: string; updated_at: string } | undefined
  if (!page) throw new HttpError(404, '页面不存在')
  ok(res, page)
})

export default router
