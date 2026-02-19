# AI批量工作台

基于 React + Vite 的 Flow2API 前端工作台，支持多任务批量生成、模型切换、历史管理与随机图鉴浏览。

## 功能特性

- 批量任务面板：默认 10 个并行任务槽位。
- 多图输入：每个槽位最多上传 6 张图片，支持拖拽上传和顺序调整。
- 模型管理：从 `Base URL/v1/models` 拉取可用模型并切换。
- 生成请求：调用 `Base URL/v1/chat/completions`，支持流式和非流式。
- 比例控制：支持 `1:1`、`16:9`、`9:16` 等常见比例。
- 历史记录：基于 IndexedDB 本地持久化，支持导出/导入 JSON 备份。
- 结果预览：支持图片/视频预览、放大和下载。

## 技术栈

- React 19
- Vite 7
- lucide-react
- IndexedDB
- Tailwind CSS（通过 CDN 注入）

## 目录结构

```text
.
├─ src/
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ index.css
├─ index.html
├─ package.json
└─ vite.config.js
```

## 环境要求

- Node.js 20+（建议 22+）
- npm 10+
- Git

## 本地部署教程（从克隆开始）

### 1. 克隆项目

```bash
git clone https://github.com/yubanmayi/AI-batch-workbench.git
cd AI-batch-workbench
```

### 2. 安装依赖

```bash
npm install
```

如果你在 Windows PowerShell 遇到脚本策略限制，请使用：

```powershell
npm.cmd install
```

### 3. 启动开发环境

```bash
npm run dev
```

Windows PowerShell 可使用：

```powershell
npm.cmd run dev
```

启动后访问：

- http://127.0.0.1:5173

### 4. 配置后端连接（首次使用必做）

打开页面右上角设置，填写：

- `API Key`
- `Base URL`（例如 `http://localhost:8000`）
- 并发数
- 是否启用流式传输（Stream）

保存后点击“刷新模型”，确认能拉取到模型列表。

### 5. 生产构建与预览

```bash
npm run build
npm run preview
```

预览地址：

- http://127.0.0.1:4173

### 6. 停止本地服务

在运行终端中按 `Ctrl + C`。

## 线上部署教程

### 方案一：Vercel

1. 将代码推送到 GitHub。
2. 在 Vercel 中点击 `New Project` 并导入仓库。
3. Framework 选择 `Vite`（通常会自动识别）。
4. Build Command: `npm run build`。
5. Output Directory: `dist`。
6. 点击 Deploy。

### 方案二：Netlify

1. 将代码推送到 GitHub。
2. 在 Netlify 中选择 `Add new site` -> `Import an existing project`。
3. 构建配置：
- Build command: `npm run build`
- Publish directory: `dist`
4. 点击 Deploy。

### 方案三：Nginx（自托管）

1. 构建项目：

```bash
npm run build
```

2. 上传 `dist` 到服务器，例如 `/var/www/ai-batch-workbench`。
3. Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/ai-batch-workbench;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

4. 重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 常见问题

- PowerShell 执行 `npm` 报错：改用 `npm.cmd`。
- 拉取不到模型：检查 `Base URL`、`API Key`、后端服务状态。
- 生成失败并提示 reCAPTCHA：可先关闭流式，再查看后端日志。
- 浏览器跨域报错：需要在后端网关允许前端域名的 CORS。

## License

当前仓库未附带开源许可证。若计划公开使用，建议补充 `MIT` 或 `Apache-2.0`。