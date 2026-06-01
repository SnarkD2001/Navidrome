# 构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 运行阶段
FROM node:20-alpine

WORKDIR /app

# 安装后端依赖
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# 复制后端代码
COPY server/ ./server/

# 复制前端构建产物
COPY --from=frontend-builder /app/dist ./public

# 安装 nginx
RUN apk add --no-cache nginx

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/http.d/default.conf

# 创建上传目录
RUN mkdir -p /app/uploads /music

# 暴露端口
EXPOSE 80

# 启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
