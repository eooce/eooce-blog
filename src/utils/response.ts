import type { Response } from 'express'

export function ok<T>(res: Response, data: T, code = 200) {
  return res.status(code).json({ code, data, message: 'ok' })
}

export function fail(res: Response, code: number, message: string) {
  return res.status(code).json({ code, data: null, message })
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
