# 多阶段构建 - 基础镜像
FROM node:20-alpine AS base

# 安装pnpm
RUN npm install -g pnpm@8

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm相关文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/*/

# 安装依赖阶段
FROM base AS deps
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建所有packages
RUN pnpm build

# 生产运行时镜像
FROM node:20-alpine AS runner

# 安装必要的系统依赖（用于whisper转录）
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    git \
    make \
    g++

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app

# 复制package.json文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/*/package.json ./packages/*/

# 安装pnpm
RUN npm install -g pnpm@8

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/dist ./packages/web/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/ui/dist ./packages/ui/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/whisper-engine ./packages/whisper-engine

# 复制其他必要文件
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 创建数据目录
RUN mkdir -p /app/data /app/uploads /app/logs
RUN chown -R nextjs:nodejs /app/data /app/uploads /app/logs

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000 5173

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动命令
CMD ["pnpm", "start"] 