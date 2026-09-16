import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../db/database.js'
import { signToken } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'
import { issueCaptcha, verifyCaptcha } from '../utils/captcha.js'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  captcha_id: z.string().min(1, '请填写验证码'),
  captcha_code: z.string().min(1, '请填写验证码'),
})

/** 获取验证码（SVG 图片，5 分钟有效、一次性；测试环境附带明文供自动化断言） */
router.get('/captcha', (_req, res) => {
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
  ok(res, issueCaptcha(isTest))
})

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, '请输入用户名、密码与验证码')
    return
  }
  const { username, password, captcha_id, captcha_code } = parsed.data
  if (!verifyCaptcha(captcha_id, captcha_code)) {
    fail(res, 400, '验证码不正确或已过期')
    return
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | { id: number; username: string; password_hash: string }
    | undefined
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    fail(res, 401, '用户名或密码错误')
    return
  }
  ok(res, { token: signToken({ uid: user.id, username: user.username }), username: user.username })
})

export default router
