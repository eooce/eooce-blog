import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'

const JWT_SECRET = process.env.JWT_SECRET ?? 'blog-dev-secret-change-me'

export interface AuthPayload {
  uid: number
  username: string
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    fail(res, 401, '未登录或凭据缺失')
    return
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload
    req.auth = payload
    next()
  } catch {
    fail(res, 401, '凭据无效或已过期，请重新登录')
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}
