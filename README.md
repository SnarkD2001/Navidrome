# Navidrome Player

一个现代化的 Navidrome 音乐播放器，使用 Canvas 2D 渲染和 macOS Dock 效果。

![GitHub stars](https://img.shields.io/github/stars/SnarkD2001/Navidrome?style=social)
![License](https://img.shields.io/github/license/SnarkD2001/Navidrome)

## ✨ 特性

- 🎨 **Canvas 2D 高性能渲染** - 流畅的卡片墙动画
- 🎯 **macOS Dock 效果** - 鼠标悬停放大效果
- 🎲 **Poisson 随机分布** - 自然散落的卡片布局
- 🖼️ **自定义壁纸** - 支持上传背景图片
- ❤️ **红心按钮** - 快速添加到"我喜欢"歌单
- 🎵 **音乐上传** - 直接上传音乐文件到服务器
- 🔧 **后台管理** - 完整的管理界面
- 🎭 **毛玻璃 UI** - Apple 风格设计

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 克隆仓库
git clone git@github.com:SnarkD2001/Navidrome.git
cd Navidrome

# 修改 docker-compose.yml 中的音乐路径
# 将 /path/to/music 改为你的音乐文件夹路径

# 启动服务
docker-compose up -d

# 访问 http://localhost:3000
```

### 手动部署

```bash
# 克隆仓库
git clone git@github.com:SnarkD2001/Navidrome.git
cd Navidrome

# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 构建前端
npm run build

# 启动后端
cd server && node server.js &

# 使用 nginx 或其他 web 服务器托管 dist 目录
```

## 📁 项目结构

```
Navidrome/
├── src/                    # 前端源码
│   ├── api/               # Subsonic API
│   ├── components/        # React 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── pages/             # 页面组件
│   └── store/             # Zustand 状态管理
├── server/                # 后端服务
│   ├── server.js          # Express 服务器
│   └── package.json
├── public/                # 静态资源
├── Dockerfile             # Docker 配置
├── docker-compose.yml     # Docker Compose
└── nginx.conf             # Nginx 配置
```

## ⚙️ 配置

### 服务器配置

在后台管理页面（/admin）配置：

| 配置项 | 说明 |
|--------|------|
| 音乐文件夹 | 服务器上存储音乐的路径 |
| Navidrome URL | Navidrome 服务器地址 |
| 用户名 | Navidrome 登录用户名 |
| Token | Navidrome API Token |
| Salt | Navidrome API Salt |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 后端服务端口 |

## 🛠️ 开发

```bash
# 启动前端开发服务器
npm run dev

# 启动后端开发服务器
cd server && npm run dev
```

前端：http://localhost:5173  
后端：http://localhost:3001

## 📝 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/config` | GET | 获取配置 |
| `/api/config` | PUT | 更新配置 |
| `/api/upload` | POST | 上传音乐文件 |
| `/api/music` | GET | 获取音乐列表 |
| `/api/music/:filename` | DELETE | 删除音乐文件 |
| `/api/scan` | POST | 触发 Navidrome 扫描 |
| `/api/stats` | GET | 获取统计信息 |

## 🐳 Docker

### 构建镜像

```bash
docker build -t navidrome-player .
```

### 运行容器

```bash
docker run -d \
  --name navidrome-player \
  -p 3000:80 \
  -v /path/to/music:/music \
  navidrome-player
```

### Docker Compose

```bash
docker-compose up -d
```

## 📄 许可证

MIT License

## 🔗 相关项目

- [Navidrome](https://github.com/navidrome/navidrome) - 音乐服务器
- [Subsonic API](http://www.subsonic.org/pages/api.jsp) - API 文档

## 💖 致谢

- React
- Vite
- Tailwind CSS
- Zustand
- Express
