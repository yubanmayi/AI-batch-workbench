# AI批量工作台

一个基于 React + Vite 的 Flow2API 前端工作台，支持批量图片生成、模型切换、历史管理和随机图鉴浏览。

## 功能特性

- 批量任务面板：默认 10 个并行任务槽位。
- 多图输入：每个槽位最多上传 6 张图片，支持拖拽上传与图片顺序调整。
- 模型管理：从 `Base URL/v1/models` 拉取可用模型并快速切换。
- 生成能力：调用 `Base URL/v1/chat/completions`，支持流式与非流式请求。
- 比例控制：内置常见宽高比（如 `1:1`、`16:9`、`9:16` 等）。
- 历史记录：基于 IndexedDB 本地持久化，支持导出/导入 JSON 备份。
- 结果预览：支持图片/视频预览、放大和下载。
- 随机图鉴：内置分类随机图源浏览页。

## 技术栈

- React 19
- Vite 7
- lucide-react
- IndexedDB（浏览器端）
- Tailwind（通过 CDN 注入）

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

## 快速开始（本地部署）

### 1. 安装依赖

```bash
npm install
```

Windows PowerShell 如果出现脚本策略限制，请使用：

```powershell
npm.cmd install
```

### 2. 启动开发环境

```bash
npm run dev
```

Windows PowerShell 可使用：

```powershell
npm.cmd run dev
```

默认访问地址：

- http://127.0.0.1:5173

### 3. 生产构建与本地预览

```bash
npm run build
npm run preview
```

预览地址：

- http://127.0.0.1:4173

## 使用配置（连接 Flow2API）

启动后在页面右上角进入设置，配置以下信息：

- `API Key`
- `Base URL`（例如 `http://localhost:8000`）
- 并发数
- 是否启用流式传输（Stream）

保存后点击“刷新模型”，确认能拉取到模型列表。

## 部署教程（线上）

## 方案一：Vercel 部署

1. 将代码推送到 GitHub。
2. 登录 Vercel，选择 `New Project` 并导入该仓库。
3. Framework 选择 `Vite`（通常自动识别）。
4. Build Command: `npm run build`。
5. Output Directory: `dist`。
6. 点击 Deploy。

说明：本项目不依赖构建时环境变量，API 地址在页面设置中填写即可。

## 方案二：Netlify 部署

1. 将代码推送到 GitHub。
2. 登录 Netlify，选择 `Add new site` -> `Import an existing project`。
3. 选择仓库后设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 点击 Deploy。

## 方案三：Nginx 静态部署（自托管）

### 1. 本地构建

```bash
npm run build
```

### 2. 上传 `dist` 目录到服务器

例如上传到：`/var/www/ai-batch-workbench`

### 3. Nginx 配置示例

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

### 4. 重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 常见问题

- PowerShell 执行 `npm` 报脚本策略错误：改用 `npm.cmd`。
- 拉取不到模型：检查 `Base URL`、`API Key` 和后端是否可访问。
- 生成失败提示 reCAPTCHA：可先关闭流式传输，查看后端日志排查。
- 跨域报错：需要在后端（Flow2API 网关）允许当前前端域名的 CORS。

## 许可

当前仓库未附带开源许可证。若你计划公开发布，建议补充 `MIT` 或 `Apache-2.0` 许可证。