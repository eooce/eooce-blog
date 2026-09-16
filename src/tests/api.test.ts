import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { createApp } from '../app.js'
import { db, now } from '../db/database.js'

const DB_PATH = process.env.BLOG_DB_PATH!
try {
  fs.rmSync(DB_PATH, { force: true })
} catch {
  // 旧库文件被占用时忽略（路径本身每次运行都不同）
}
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

afterAll(() => {
  db.close()
})

const app = createApp()
let token = ''

beforeAll(() => {
  db.exec('DELETE FROM comments; DELETE FROM post_tags; DELETE FROM posts; DELETE FROM tags; DELETE FROM categories; DELETE FROM users;')
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', bcrypt.hashSync('admin123', 4))
  db.prepare("INSERT INTO site_settings (key, value) VALUES ('site_title', 'Test Blog')")
})

function insertPost(overrides: Partial<Record<string, unknown>> = {}): number {
  const row = {
    title: 'Untitled',
    slug: `post-${Math.random().toString(36).slice(2, 8)}`,
    summary: '',
    content: 'hello world content',
    category_id: null as number | null,
    status: 'published',
    pinned: 0,
    reading_minutes: 1,
    published_at: now(),
    ...overrides,
  }
  const result = db
    .prepare(
      `INSERT INTO posts (title, slug, summary, content, category_id, status, pinned, reading_minutes, published_at)
       VALUES (@title, @slug, @summary, @content, @category_id, @status, @pinned, @reading_minutes, @published_at)`,
    )
    .run(row)
  return Number(result.lastInsertRowid)
}

/** 带验证码的登录请求 */
async function loginRequest(username: string, password: string) {
  const cap = await request(app).get('/api/auth/captcha')
  return request(app)
    .post('/api/auth/login')
    .send({ username, password, captcha_id: cap.body.data.id, captcha_code: cap.body.data.code })
}

async function login(): Promise<string> {
  // 前面的账号测试可能已把用户名改为 editor，两种都尝试
  for (const username of ['admin', 'editor']) {
    const res = await loginRequest(username, 'admin123')
    if (res.status === 200) return res.body.data.token as string
  }
  const fallback = await loginRequest('editor', 'newpass456')
  expect(fallback.status).toBe(200)
  return fallback.body.data.token as string
}

describe('auth captcha', () => {
  it('rejects login with wrong captcha', async () => {
    const cap = await request(app).get('/api/auth/captcha')
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123', captcha_id: cap.body.data.id, captcha_code: 'XXXX' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('验证码不正确或已过期')
  })

  it('consumes captcha after a single use', async () => {
    const cap = await request(app).get('/api/auth/captcha')
    const first = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123', captcha_id: cap.body.data.id, captcha_code: cap.body.data.code })
    expect(first.status).toBe(200)
    const replay = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123', captcha_id: cap.body.data.id, captcha_code: cap.body.data.code })
    expect(replay.status).toBe(400)
  })
})

describe('auth', () => {
  it('rejects wrong password with 401', async () => {
    const res = await loginRequest('admin', 'wrong')
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('用户名或密码错误')
  })

  it('issues token for valid credentials', async () => {
    const res = await loginRequest('admin', 'admin123')
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeTruthy()
  })
})

describe('admin auth guard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/stats')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
  })

  it('allows access with valid token', async () => {
    token = await login()
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.posts).toHaveProperty('total')
  })
})

describe('public posts visibility', () => {
  it('exposes only published posts', async () => {
    insertPost({ title: 'Published A', slug: 'pub-a', status: 'published' })
    insertPost({ title: 'Draft B', slug: 'draft-b', status: 'draft', published_at: null })

    const res = await request(app).get('/api/posts')
    expect(res.status).toBe(200)
    const slugs = res.body.data.list.map((p: { slug: string }) => p.slug)
    expect(slugs).toContain('pub-a')
    expect(slugs).not.toContain('draft-b')
    expect(res.body.data.total).toBeGreaterThanOrEqual(1)
  })

  it('hides draft after creation and reveals it after publish', async () => {
    const created = await request(app)
      .post('/api/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fresh Draft', content: 'draft body', status: 'draft', tag_ids: [] })
    expect(created.status).toBe(201)
    const { id, slug } = created.body.data

    const hidden = await request(app).get('/api/posts')
    expect(hidden.body.data.list.map((p: { slug: string }) => p.slug)).not.toContain(slug)

    const detail404 = await request(app).get(`/api/posts/${slug}`)
    expect(detail404.status).toBe(404)

    const published = await request(app)
      .patch(`/api/admin/posts/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' })
    expect(published.status).toBe(200)

    const visible = await request(app).get('/api/posts')
    expect(visible.body.data.list.map((p: { slug: string }) => p.slug)).toContain(slug)

    const detail = await request(app).get(`/api/posts/${slug}`)
    expect(detail.status).toBe(200)
  })

  it('increments views atomically on detail access', async () => {
    const id = insertPost({ title: 'Viewed Post', slug: 'viewed-post' })
    const before = request(app).get('/api/posts/viewed-post')
    const after = request(app).get('/api/posts/viewed-post')
    const [first, second] = await Promise.all([before, after])
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const stored = db.prepare('SELECT views FROM posts WHERE id = ?').get(id) as { views: number }
    expect(stored.views).toBe(2)
  })
})

describe('post management', () => {
  it('rejects post without title or content', async () => {
    const res = await request(app)
      .post('/api/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', content: '' })
    expect(res.status).toBe(400)
  })

  it('generates unique slugs for same titles', async () => {
    const a = await request(app)
      .post('/api/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Duplicate Title Here', content: 'a', tag_ids: [] })
    const b = await request(app)
      .post('/api/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Duplicate Title Here', content: 'b', tag_ids: [] })
    expect(a.body.data.slug).not.toBe(b.body.data.slug)
  })

  it('supports pagination with total', async () => {
    for (let i = 0; i < 3; i++) insertPost({ title: `Page Post ${i}`, slug: `page-${i}` })
    const res = await request(app).get('/api/posts?page=1&pageSize=2')
    expect(res.body.data.list.length).toBe(2)
    expect(res.body.data.total).toBeGreaterThanOrEqual(5)
  })

  it('deletes a post', async () => {
    const id = insertPost({ title: 'Doomed', slug: 'doomed' })
    const res = await request(app).delete(`/api/admin/posts/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const gone = await request(app).get('/api/posts/doomed')
    expect(gone.status).toBe(404)
  })
})

describe('comment workflow', () => {
  it('keeps new comment hidden until approved', async () => {
    insertPost({ title: 'Comment Target', slug: 'comment-target' })
    const created = await request(app)
      .post('/api/posts/comment-target/comments')
      .send({ nickname: '访客', email: 'guest@example.com', content: '好文章！' })
    expect(created.status).toBe(201)

    const publicList = await request(app).get('/api/posts/comment-target/comments')
    expect(publicList.body.data).toHaveLength(0)

    const adminList = await request(app)
      .get('/api/admin/comments?status=pending')
      .set('Authorization', `Bearer ${token}`)
    expect(adminList.body.data.list.length).toBeGreaterThanOrEqual(1)
    const commentId = adminList.body.data.list[0].id

    const approved = await request(app)
      .patch(`/api/admin/comments/${commentId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' })
    expect(approved.status).toBe(200)

    const visible = await request(app).get('/api/posts/comment-target/comments')
    expect(visible.body.data.some((c: { content: string }) => c.content === '好文章！')).toBe(true)
  })

  it('rejects comment with invalid email', async () => {
    const res = await request(app)
      .post('/api/posts/comment-target/comments')
      .send({ nickname: '访客', email: 'not-an-email', content: 'hi' })
    expect(res.status).toBe(400)
  })
})

describe('categories and tags integrity', () => {
  it('rejects duplicate category name with 409 semantics', async () => {
    await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '前端开发', slug: 'fe' })
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '前端开发', slug: 'fe2' })
    expect(res.status).toBe(409)
    expect(res.body.message).toBe('名称已存在')
  })

  it('keeps posts when category deleted and clears relation', async () => {
    const cat = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '临时分类', slug: 'temp-cat' })
    const catId = cat.body.data.id

    const post = await request(app)
      .post('/api/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Orphan Watch', content: 'x', status: 'published', category_id: catId, tag_ids: [] })

    const del = await request(app)
      .delete(`/api/admin/categories/${catId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)

    const stored = db.prepare('SELECT category_id FROM posts WHERE id = ?').get(post.body.data.id) as {
      category_id: number | null
    }
    expect(stored.category_id).toBeNull()
  })

  it('removes tag relations when tag deleted but keeps posts', async () => {
    const tag = await request(app)
      .post('/api/admin/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '临时标签' })
    const tagId = tag.body.data.id

    const post = await request(app)
      .post('/api/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tag Orphan Watch', content: 'x', status: 'published', tag_ids: [tagId] })

    const relations = db.prepare('SELECT COUNT(*) AS c FROM post_tags WHERE tag_id = ?').get(tagId) as { c: number }
    expect(relations.c).toBe(1)

    const del = await request(app).delete(`/api/admin/tags/${tagId}`).set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)

    const stillThere = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE id = ?').get(post.body.data.id) as { c: number }
    expect(stillThere.c).toBe(1)
    const relationsAfter = db.prepare('SELECT COUNT(*) AS c FROM post_tags WHERE tag_id = ?').get(tagId) as { c: number }
    expect(relationsAfter.c).toBe(0)
  })
})

describe('site logo', () => {
  it('stores and serves custom logo', async () => {
    const token = await login()
    const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')
    const res = await request(app)
      .put('/api/admin/site')
      .set('Authorization', `Bearer ${token}`)
      .send({ site_title: 'Test Blog', site_subtitle: '', about_content: '', site_logo: logo })
    expect(res.status).toBe(200)

    const site = await request(app).get('/api/site')
    expect(site.status).toBe(200)
    expect(site.body.data.site_logo).toBe(logo)
  })

  it('rejects invalid logo payload', async () => {
    const token = await login()
    const res = await request(app)
      .put('/api/admin/site')
      .set('Authorization', `Bearer ${token}`)
      .send({ site_title: 'Test Blog', site_subtitle: '', about_content: '', site_logo: 'javascript:alert(1)' })
    expect(res.status).toBe(400)
  })
})

describe('admin account', () => {
  it('rejects account update with wrong current password', async () => {
    const token = await login()
    const res = await request(app)
      .put('/api/admin/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'wrong', username: 'editor' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('当前密码不正确')
  })

  it('no-ops when username is unchanged', async () => {
    const token = await login()
    const res = await request(app)
      .put('/api/admin/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'admin123', username: 'admin' })
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe('admin')
  })

  it('updates username and returns fresh token', async () => {
    const token = await login()
    const res = await request(app)
      .put('/api/admin/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'admin123', username: 'editor' })
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe('editor')
    expect(res.body.data.token).toBeTruthy()

    const oldLogin = await loginRequest('admin', 'admin123')
    expect(oldLogin.status).toBe(401)
    const newLogin = await loginRequest('editor', 'admin123')
    expect(newLogin.status).toBe(200)
  })

  it('updates password and new password works', async () => {
    const res = await loginRequest('editor', 'admin123')
    const token = res.body.data.token as string
    const upd = await request(app)
      .put('/api/admin/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'admin123', new_password: 'newpass456' })
    expect(upd.status).toBe(200)

    const reLogin = await loginRequest('editor', 'newpass456')
    expect(reLogin.status).toBe(200)
    const oldPw = await loginRequest('editor', 'admin123')
    expect(oldPw.status).toBe(401)
  })
})

describe('nav menus & custom pages', () => {
  it('seeds default nav menus', async () => {
    const res = await request(app).get('/api/nav')
    expect(res.status).toBe(200)
    const labels = res.body.data.map((n: { label: string }) => n.label)
    expect(labels).toContain('首页')
    expect(labels).toContain('归档')
  })

  it('creates a page menu and serves it in nav and page detail', async () => {
    const token = await login()
    const create = await request(app)
      .post('/api/admin/menus')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: '友链',
        type: 'page',
        page: { title: '友情链接', slug: 'friends', content: '欢迎交换友链' },
      })
    expect(create.status).toBe(201)

    const nav = await request(app).get('/api/nav')
    const item = nav.body.data.find((n: { label: string }) => n.label === '友链')
    expect(item.to).toBe('/page/friends')

    const page = await request(app).get('/api/pages/friends')
    expect(page.status).toBe(200)
    expect(page.body.data.title).toBe('友情链接')
    expect(page.body.data.content).toBe('欢迎交换友链')
  })

  it('rejects invalid external link and accepts valid one', async () => {
    const token = await login()
    const bad = await request(app)
      .post('/api/admin/menus')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: '博客', type: 'link', url: 'javascript:alert(1)' })
    expect(bad.status).toBe(400)

    const good = await request(app)
      .post('/api/admin/menus')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: '博客', type: 'link', url: 'https://example.com' })
    expect(good.status).toBe(201)

    const nav = await request(app).get('/api/nav')
    const item = nav.body.data.find((n: { label: string }) => n.label === '博客')
    expect(item.url).toBe('https://example.com')
    expect(item.open_new_tab).toBe(true)
  })

  it('creates a group menu and moves a menu within siblings', async () => {
    const token = await login()
    const group = await request(app)
      .post('/api/admin/menus')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: '更多', type: 'group' })
    expect(group.status).toBe(201)

    const nav1 = await request(app).get('/api/nav')
    const first = nav1.body.data[0]
    const second = nav1.body.data[1]
    const move = await request(app)
      .patch(`/api/admin/menus/${second.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'up' })
    expect(move.status).toBe(200)
    const nav2 = await request(app).get('/api/nav')
    expect(nav2.body.data[0].id).toBe(second.id)
    expect(nav2.body.data[1].id).toBe(first.id)
  })

  it('deletes a page menu together with its page', async () => {
    const token = await login()
    const nav = await request(app).get('/api/nav')
    const item = nav.body.data.find((n: { label: string }) => n.label === '友链')
    const del = await request(app).delete(`/api/admin/menus/${item.id}`).set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
    const page = await request(app).get('/api/pages/friends')
    expect(page.status).toBe(404)
    const nav2 = await request(app).get('/api/nav')
    expect(nav2.body.data.find((n: { label: string }) => n.label === '友链')).toBeUndefined()
  })
})

describe('category slug', () => {
  it('generates english pinyin slug for chinese names', async () => {
    const token = await login()
    const create = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '生活随笔' })
    expect(create.status).toBe(201)
    const list = await request(app).get('/api/admin/categories').set('Authorization', `Bearer ${token}`)
    const cat = list.body.data.find((c: { name: string }) => c.name === '生活随笔')
    expect(cat.slug).toBe('sheng-huo-sui-bi')
  })

  it('allows custom slug on create and updates slug on edit', async () => {
    const token = await login()
    const create = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '自定义分类', slug: 'my-custom-cat' })
    expect(create.status).toBe(201)
    const list = await request(app).get('/api/admin/categories').set('Authorization', `Bearer ${token}`)
    const cat = list.body.data.find((c: { name: string }) => c.name === '自定义分类')
    expect(cat.slug).toBe('my-custom-cat')

    const upd = await request(app)
      .put(`/api/admin/categories/${cat.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '自定义分类', slug: 'renamed-cat', description: '' })
    expect(upd.status).toBe(200)
    const list2 = await request(app).get('/api/admin/categories').set('Authorization', `Bearer ${token}`)
    const cat2 = list2.body.data.find((c: { id: number }) => c.id === cat.id)
    expect(cat2.slug).toBe('renamed-cat')
  })
})

describe('tag honeycomb center', () => {
  it('sets exactly one center tag and exposes it via public tags API', async () => {
    const token = await login()
    await request(app).post('/api/admin/tags').set('Authorization', `Bearer ${token}`).send({ name: 'C位标签' })
    const list = await request(app).get('/api/admin/tags').set('Authorization', `Bearer ${token}`)
    const target = list.body.data[0]
    const res = await request(app)
      .patch(`/api/admin/tags/${target.id}/center`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const after = await request(app).get('/api/admin/tags').set('Authorization', `Bearer ${token}`)
    const centers = after.body.data.filter((x: { is_center: number }) => x.is_center === 1)
    expect(centers.length).toBe(1)
    expect(centers[0].id).toBe(target.id)
    const pub = await request(app).get('/api/tags')
    const pubCenter = pub.body.data.find((x: { id: number }) => x.id === target.id)
    expect(pubCenter.is_center).toBe(1)
  })

  it('rejects center setting for missing tag', async () => {
    const token = await login()
    const res = await request(app)
      .patch('/api/admin/tags/99999/center')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('guestbook', () => {
  it('accepts a message as pending and hides it from public list', async () => {
    const res = await request(app)
      .post('/api/guestbook')
      .send({ nickname: '访客', email: 'g@example.com', content: '第一条留言' })
    expect(res.status).toBe(201)
    const pub = await request(app).get('/api/guestbook')
    expect(pub.body.data.find((m: { content: string }) => m.content === '第一条留言')).toBeUndefined()
  })

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/guestbook')
      .send({ nickname: '访客', email: 'not-an-email', content: 'hi' })
    expect(res.status).toBe(400)
  })

  it('supports admin moderation flow', async () => {
    const token = await login()
    const list = await request(app).get('/api/admin/guestbook').set('Authorization', `Bearer ${token}`)
    const msg = list.body.data.list.find((m: { content: string }) => m.content === '第一条留言')
    expect(msg).toBeTruthy()
    const appr = await request(app)
      .patch(`/api/admin/guestbook/${msg.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' })
    expect(appr.status).toBe(200)
    const pub = await request(app).get('/api/guestbook')
    expect(pub.body.data.some((m: { content: string }) => m.content === '第一条留言')).toBe(true)
    const del = await request(app).delete(`/api/admin/guestbook/${msg.id}`).set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
  })
})

describe('friend links', () => {
  it('rejects invalid url', async () => {
    const token = await login()
    const res = await request(app)
      .post('/api/admin/links')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '坏链接', url: 'javascript:alert(1)' })
    expect(res.status).toBe(400)
  })

  it('supports create, visibility toggle and delete', async () => {
    const token = await login()
    const create = await request(app)
      .post('/api/admin/links')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '友链A', url: 'https://a.example.com', description: 'A 站' })
    expect(create.status).toBe(201)
    const id = create.body.data.id

    let pub = await request(app).get('/api/links')
    expect(pub.body.data.some((l: { name: string }) => l.name === '友链A')).toBe(true)

    const hide = await request(app)
      .put(`/api/admin/links/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '友链A', url: 'https://a.example.com', description: 'A 站', visible: false })
    expect(hide.status).toBe(200)
    pub = await request(app).get('/api/links')
    expect(pub.body.data.some((l: { name: string }) => l.name === '友链A')).toBe(false)

    const del = await request(app).delete(`/api/admin/links/${id}`).set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
  })
})
