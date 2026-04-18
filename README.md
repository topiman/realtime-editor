# 实时协同文本编辑器

多端实时同步的纯文本编辑器。前端 Vercel，后端 Railway。

## 目录结构

```
realtime-editor/
├── backend/        ← 部署到 Railway
│   ├── server.js
│   ├── package.json
│   └── Procfile
└── frontend/       ← 部署到 Vercel
    ├── index.html
    └── vercel.json
```

---

## 第一步：部署后端到 Railway

1. 去 [railway.app](https://railway.app) 注册/登录
2. 点击 **New Project → Deploy from GitHub Repo**
3. 把 `backend/` 目录推到一个 GitHub 仓库，选择该仓库
4. Railway 会自动检测 Node.js 并运行 `npm start`
5. 部署成功后，点击 **Settings → Networking → Generate Domain**
6. 记下你的域名，格式类似：`https://xxx.up.railway.app`

---

## 第二步：修改前端配置

打开 `frontend/index.html`，找到这一行：

```js
const BACKEND_URL = 'https://YOUR_RAILWAY_APP.up.railway.app';
```

把 `YOUR_RAILWAY_APP` 替换为你第一步拿到的 Railway 域名。

---

## 第三步：部署前端到 Vercel

1. 去 [vercel.com](https://vercel.com) 注册/登录
2. 点击 **New Project → Import Git Repository**
3. 把 `frontend/` 目录推到 GitHub，选择该仓库
4. Framework Preset 选 **Other**，直接部署
5. 部署完成后拿到 Vercel 域名

---

## 使用方式

- 打开 Vercel 给的网址
- 首次访问时，浏览器会自动生成 AES-GCM 256-bit 密钥，URL 末尾多出 `#k=...`
- **把包含 `#k=...` 的完整链接**发给协作者（点 header 上的"复制链接"按钮即可）
- 任何人在 textarea 里输入，其他人实时看到

### 端到端加密说明

- 所有内容在浏览器里用 AES-GCM 加密后才发到服务器，服务器只看到密文
- 密钥存放在 URL `#` 之后的 fragment，浏览器从不会把它发给服务器（也不会写进 HTTP Referer）
- 链接 = 密钥：谁拿到完整链接都能加入并解密；链接丢失则无法恢复历史内容
- 如果有人用错误的密钥进入同一个房间，会看到红色提示 "无法解密"，textarea 变为只读，不会污染其他人的视图

> ⚠️ 临时用：内容只在内存里，服务器重启后清空。

---

## 本地测试

```bash
# 后端
cd backend
npm install
node server.js   # 监听 3001 端口

# 前端：把 index.html 里 BACKEND_URL 改为 http://localhost:3001
# 直接用浏览器打开 frontend/index.html
```
