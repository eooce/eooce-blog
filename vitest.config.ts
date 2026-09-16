import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// 每次运行使用独立临时目录，避免残留进程的文件锁影响测试
export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    env: {
      BLOG_DB_PATH: path.join(os.tmpdir(), `blog-test-${Date.now()}`, 'blog.db'),
      JWT_SECRET: 'test-secret',
    },
  },
})
