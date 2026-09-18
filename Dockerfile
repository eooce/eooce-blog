# ---------- 阶段 1：构建前端 ----------
FROM node:24-alpine AS web-build
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
RUN npm run build

# ---------- 阶段 2：后端依赖（better-sqlite3 需要 native 编译工具） ----------
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 阶段 3：运行时 ----------
# 容器内不运行 Vite：前端构建产物由 Express 托管，单端口对外提供整站
# 默认 PORT=3001 与 start.sh 的端口约定一致，可用 -e PORT=xxxx 覆盖
FROM node:24-alpine

ENV NODE_ENV=production 

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src
COPY --from=deps /app/node_modules ./node_modules
COPY --from=web-build /build/dist ./web/dist

# SQLite 数据目录（建议挂载卷持久化）
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/site >/dev/null 2>&1 || exit 1

CMD ["npm", "run", "start"]
