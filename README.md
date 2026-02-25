# 💬 知识论坛

全栈问答论坛项目，技术栈：**Vue3 + Element Plus + Node.js + PostgreSQL**

---

## 📁 项目结构

```
forum-project/
├── backend/                        # Node.js 后端
│   ├── src/
│   │   ├── app.js                  # 入口文件，路由挂载
│   │   ├── db.js                   # PostgreSQL 连接池
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT 认证中间件
│   │   └── routes/
│   │       ├── auth.js             # 注册 / 登录
│   │       ├── posts.js            # 帖子 CRUD + 点赞
│   │       ├── comments.js         # 评论 CRUD + 点赞 + 精选
│   │       ├── users.js            # 用户信息 + 管理员接口
│   │       ├── notifications.js    # 消息通知
│   │       ├── upload.js           # 图片上传
│   │       └── admin_comments.js   # 管理员评论列表
│   ├── uploads/                    # 上传图片存储目录（自动创建）
│   ├── init.sql                    # 数据库初始化 SQL
│   ├── .env.example                # 环境变量示例
│   └── package.json
│
└── frontend/                       # Vue3 前端
    ├── src/
    │   ├── api/index.js            # Axios 接口统一封装
    │   ├── store/auth.js           # Pinia 用户认证状态
    │   ├── router/index.js         # Vue Router 路由配置
    │   ├── assets/styles/
    │   │   └── global.css          # 全局样式 / CSS 变量
    │   ├── components/
    │   │   ├── layout/
    │   │   │   └── AppLayout.vue   # 主布局 + 顶部导航栏
    │   │   └── common/
    │   │       ├── RichEditor.vue  # 富文本编辑器（含图片上传）
    │   │       ├── PostCard.vue    # 帖子列表卡片
    │   │       └── CommentItem.vue # 评论组件（嵌套回复 + 精选）
    │   └── views/
    │       ├── auth/
    │       │   ├── LoginView.vue   # 登录页
    │       │   └── RegisterView.vue# 注册页
    │       ├── forum/
    │       │   ├── HomeView.vue    # 主页（帖子列表）
    │       │   ├── PostDetail.vue  # 帖子详情 + 评论区
    │       │   └── CreatePost.vue  # 发帖 / 编辑帖子
    │       ├── user/
    │       │   ├── MyProfile.vue   # 个人资料编辑
    │       │   ├── UserProfile.vue # 他人主页
    │       │   └── Notifications.vue # 消息通知
    │       └── admin/
    │           └── AdminPanel.vue  # 管理后台
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 快速启动

### 第一步：准备数据库

```bash
# 登录 PostgreSQL 创建数据库
psql -U postgres
CREATE DATABASE forum_db;
\c forum_db
\i backend/init.sql
\q
```

> 如果数据库已存在需要升级，执行 `init.sql` 末尾注释中的迁移语句：
> ```sql
> ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
> ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
> ALTER TABLE comments ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP DEFAULT NULL;
> ```

### 第二步：启动后端

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 用编辑器打开 .env，填写数据库信息和 JWT_SECRET

# 开发模式启动（需安装 nodemon）
npm run dev

# 或直接启动
npm start
```

后端运行在：`http://localhost:3000`

### 第三步：启动前端

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

前端运行在：`http://localhost:5173`，已配置代理自动转发 `/api` 到后端。

---

## ⚙️ 环境变量说明（backend/.env）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 后端监听端口 | `3000` |
| `DB_HOST` | 数据库地址 | `localhost` |
| `DB_PORT` | 数据库端口 | `5432` |
| `DB_NAME` | 数据库名称 | `forum_db` |
| `DB_USER` | 数据库用户名 | `postgres` |
| `DB_PASSWORD` | 数据库密码 | — |
| `JWT_SECRET` | JWT 签名密钥（生产环境请改为随机长字符串） | — |
| `JWT_EXPIRES_IN` | Token 有效期 | `7d` |
| `MAX_FILE_SIZE` | 图片上传大小限制（字节） | `5242880`（5MB） |

---

## 🔑 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123` | 管理员 |

---

## ✨ 功能清单

### 用户系统
- ✅ 用户名 + 密码注册 / 登录（JWT 认证，无需邮箱）
- ✅ 修改用户名、个人简介
- ✅ 上传头像或填写头像链接
- ✅ 修改密码
- ✅ 查看自己发布的帖子列表
- ✅ 查看他人公开主页

### 帖子功能
- ✅ 富文本发帖（支持加粗、斜体、标题、引用、代码块、有序/无序列表）
- ✅ 编辑区直接粘贴图片，自动上传
- ✅ 点击工具栏按钮不会意外触发表单提交（已修复 bug）
- ✅ 编辑 / 删除自己的帖子（管理员可操作所有帖子）
- ✅ 帖子点赞 / 取消点赞
- ✅ 浏览量自动统计
- ✅ 首页按「最新」或「热门」排序
- ✅ 关键词搜索帖子
- ✅ 分页浏览

### 评论功能
- ✅ 富文本评论（支持粘贴图片）
- ✅ 对评论进行嵌套回复（@ 对方用户名）
- ✅ 评论点赞 / 取消点赞
- ✅ 删除自己的评论（管理员可删除任意评论）
- ✅ 普通评论分页（每页 10 条）
- ✅ 嵌套子回复分页（每次显示 5 条）
- ✅ **精选回复**：帖子作者可将评论设为精选，精选评论置顶展示并高亮标识，支持取消精选

### 消息通知
- ✅ 帖子被评论时通知作者
- ✅ 评论被回复时通知被回复者
- ✅ 帖子 / 评论被点赞时通知
- ✅ 导航栏实时显示未读消息数（每 30 秒轮询）
- ✅ 点击通知跳转对应帖子
- ✅ 一键全部标为已读

### 管理员功能
- ✅ 管理后台入口（导航栏齿轮图标）
- ✅ 查看 / 编辑 / 删除所有帖子
- ✅ 查看 / 删除所有评论
- ✅ 查看用户列表
- ✅ 可对任意帖子的评论设置精选

---

## 📡 API 接口一览

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（username + password） |
| POST | `/api/auth/login` | 登录（username + password） |
| GET  | `/api/auth/me` | 获取当前登录用户信息 |

### 帖子
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/posts` | 帖子列表（支持 page / limit / search / sort） |
| POST | `/api/posts` | 创建帖子 🔒 |
| GET  | `/api/posts/:id` | 帖子详情（自动+1浏览量） |
| PUT  | `/api/posts/:id` | 编辑帖子 🔒 |
| DELETE | `/api/posts/:id` | 删除帖子 🔒 |
| POST | `/api/posts/:id/like` | 点赞 / 取消点赞 🔒 |

### 评论
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/comments/post/:postId` | 获取帖子评论（精选置顶 + 普通分页） |
| POST | `/api/comments` | 发表评论或回复 🔒 |
| DELETE | `/api/comments/:id` | 删除评论 🔒 |
| POST | `/api/comments/:id/like` | 点赞 / 取消点赞评论 🔒 |
| PUT  | `/api/comments/:id/feature` | 设置 / 取消精选（仅帖子作者）🔒 |

### 用户
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/users/:id` | 获取用户公开信息 |
| GET  | `/api/users/:id/posts` | 获取用户发布的帖子 |
| PUT  | `/api/users/profile/update` | 更新个人资料 🔒 |
| PUT  | `/api/users/password/change` | 修改密码 🔒 |
| GET  | `/api/users/admin/list` | 用户列表（仅管理员）🔒 |

### 通知
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/notifications` | 通知列表 🔒 |
| GET  | `/api/notifications/unread-count` | 未读数量 🔒 |
| PUT  | `/api/notifications/read-all` | 全部标为已读 🔒 |
| PUT  | `/api/notifications/:id/read` | 单条标为已读 🔒 |

### 上传
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload/image` | 上传单张图片 🔒 |
| POST | `/api/upload/images` | 批量上传图片 🔒 |

> 🔒 需要登录（请求头携带 `Authorization: Bearer <token>`）

---

## 🛠️ 技术要点

- **认证**：JWT 无状态认证，Token 存于 localStorage，7天有效
- **图片上传**：multer 存储到本地 `uploads/` 目录，通过静态文件服务访问；富文本内支持粘贴图片直接上传
- **富文本**：基于原生 `contenteditable` + `document.execCommand` 实现，工具栏使用 `mousedown.prevent` 防止失焦导致选区丢失
- **精选评论**：后端查询时精选与普通分离返回，前端独立渲染精选区块置于普通评论之上
- **分页策略**：帖子列表、普通评论均服务端分页；嵌套子回复在前端切片分页
- **通知轮询**：登录后每 30 秒请求一次未读数量，显示在导航栏角标
