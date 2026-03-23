# X-tapnow

X-tapnow 是一个基于节点的 AI 创作工作台，提供无限画布来组织图像、视频与文本工作流。

## 主页面预览

![X-tapnow 主页面](./docs/images/main-page-preview.png)

## 功能特性

- 支持节点/分组编辑的无限画布
- 支持图像生成与文本生成提供商
- 支持视频生成与任务轮询
- 本地持久化（IndexedDB + localStorage）
- 支持工作流 JSON 导入/导出

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS
- 使用 idb-keyval 做 IndexedDB 持久化

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

从模板创建本地环境文件：

```bash
cp .env.example .env.local
```

PowerShell：

```powershell
Copy-Item .env.example .env.local
```

启动不是必须配置该变量。你可以直接在前端「设置」页面填写 API Key。
如需预置，也可以在环境变量中填写：

```env
VITE_GEMINI_API_KEY=your_key_here
```

说明：`GEMINI_API_KEY` 仍兼容（用于历史配置）。

### 3. 本地启动

```bash
npm run dev
```

### 4. 构建生产包

```bash
npm run build
```

## 环境变量

- `VITE_GEMINI_API_KEY`：可选；也可直接在前端设置页面配置
- `VITE_UPLOAD_PROXY_TARGET`：可选，`/api/upload` 的开发代理目标地址
- `VITE_SORA_API_BASE_URL`：可选，角色接口默认 Base URL
- `VITE_SORA_CHARACTER_TOKEN`：可选，角色接口默认 Token（不建议在共享/公开部署中使用）
- `VITE_DEV_SERVER_PORT`：可选，开发服务器端口（默认 `3000`）
- `VITE_DEV_SERVER_HOST`：可选，开发服务器地址（默认 `0.0.0.0`）

## 安全说明

- 不要提交 `.env`、`.env.local` 或任何真实密钥/令牌
- 项目导出默认会对提供商 `apiKey` 做脱敏
- 项目导出默认不包含角色 Token

## Docker

```bash
docker compose up --build
```

## 贡献

提交 Issue 或 PR 之前，请先阅读 `CONTRIBUTING.md`。

## 安全漏洞报告

请阅读 `SECURITY.md` 了解负责任漏洞披露流程。

## 许可证

本项目采用 MIT License，详见 `LICENSE`。
