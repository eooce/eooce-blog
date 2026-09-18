# 老王Blog

一个前后端分离的个人博客系统。前台简洁大气，支持深色模式、音乐播放器、自定义菜单与单页；后台提供文章、分类、标签、评论、菜单与站点设置的全功能管理。

**技术栈**：Vue 3 + TypeScript + Vite + Tailwind CSS ｜ Express + better-sqlite3 (SQLite) + JWT

## 功能特性

**前台**

- 文章列表（首篇特色卡片）、归档时间轴、分类/标签聚合页
- 文章详情：目录侧边栏、代码高亮、代码块一键复制、阅读进度条
- 全局：明暗主题切换（圆形扩散动画）、滚动进入动画、音乐播放器（在线歌单）
- 评论（审核通过后展示）、文章搜索、自定义单页、外链菜单（新标签打开）

**后台**（入口路径：`/home`，默认账号 `admin / admin123`）

- 仪表盘（文章/评论/浏览量统计与 7 日趋势）
- 文章管理（Markdown 编辑、置顶、发布/草稿）、分类管理、标签管理
- 评论管理（审核/删除）
- 菜单管理：单页 / 多页分组 / 直接跳转（新标签打开）三种菜单类型，支持排序与显隐
- 站点设置：站点标题、副标题、Logo 上传、关于页内容；修改管理员用户名与密码

## 项目结构

```
blog/
├── src/                # 后端源码（Express API）
│   ├── routes/         # public / auth / admin 路由
│   ├── db/             # SQLite 初始化与种子数据
│   ├── middleware/     # JWT 认证
│   └── tests/          # API 测试（vitest）
├── data/               # SQLite 数据库文件（运行时生成，建议挂载卷）
├── web/                # 前端（Vue 3 + Vite）
│   ├── src/
│   └── dist/           # 前端构建产物（生产模式由后端托管）
├── start.sh            # 一键启动（后端 + 前端 dev）
└── Dockerfile
```

## 源代码一键部署

或使用一键脚本
```
git clone https://github.com/eooce/eooce-blog.git
cd eooce-blog
bash start.sh
```

登录后台：`/home`，默认账号 `admin / admin123`（登录后请在「站点设置 → 账号安全」修改）。

## Docker 部署

容器内不运行 Vite 开发服务器：前端在构建阶段编译为静态产物，由 Express 托管，**单端口对外提供整站**（API + 页面）。默认端口 `3001`，与 `start.sh` 的端口约定保持一致。

```bash
# 运行（数据卷持久化 SQLite）
docker run -d \
  --name blog \
  -p 3001:3001 \
  -e JWT_SECRET="请替换为随机长字符串" \
  -v blog-data:/app/data \
  ghcr.io/eooce/blog:latest
```

访问 `http://localhost:3001` 即为博客首页，后台在 `/home`。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 容器内服务监听端口 |
| `JWT_SECRET` | 内置开发密钥 | 登录令牌签名密钥，**生产必须修改** |
| `BLOG_DB_PATH` | `/app/data/blog.db` | SQLite 数据库文件路径 |
| `WEB_DIST` | `web/dist` | 前端构建产物目录 |

### docker-compose 示例

```yaml
services:
  blog:
    image: ghcr.io/eooce/blog:latest
    container_name: blog
    ports:
      - "3001:3001"
    environment:
      JWT_SECRET: "abc1234567" # 请替换为随机长字符串
    volumes:
      - blog-data:/app/data
    restart: unless-stopped

volumes:
  blog-data:
```

## API 概览

| 分组 | 说明 |
| --- | --- |
| `GET /api/site` `GET /api/nav` `GET /api/pages/:slug` | 站点信息、导航菜单、自定义单页 |
| `GET /api/posts` `GET /api/posts/:slug` `GET /api/archives` | 文章列表/详情/归档，支持分类、标签、搜索参数 |
| `GET /api/categories` `GET /api/tags` | 分类与标签（含文章计数） |
| `POST /api/auth/login` | 登录，返回 JWT |
| `POST /api/posts/:slug/comments` | 提交评论（待审核） |
| `/api/admin/*` | 管理接口：文章/分类/标签/评论/菜单/站点设置/账号，需 `Authorization: Bearer <token>` |

响应统一为 `{ code, data, message }` 结构；错误语义：400 参数、401 未登录、404 不存在、409 冲突。
