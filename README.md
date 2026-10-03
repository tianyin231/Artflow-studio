# Artflow-studio

Artflow 的前端工作台（Web / Electron / PWA），用于管理 Pixiv 素材抓取、AI 工作流、视频生成、BGM、定时任务和多平台发布。

> English summary: Artflow-studio is the React + Ant Design frontend for [Artflow-core](https://github.com/tianyin231/Artflow-core). Web and PWA builds share the core HTTP API. The Electron preview serves its bundled frontend and connects to a separately running core service. Templates, calendar drafts, and plugin preferences are local browser data; execution APIs are pending. English docs: [README_EN.md](./README_EN.md) (legacy).

**独立前端项目**：后端 API 由 **[Artflow-core](https://github.com/tianyin231/Artflow-core)** 提供，前端只通过 HTTP API 与后端通信，不包含任何后端依赖。

## 平台支持状态

| 平台 | 状态 | 说明 |
|---|---|---|
| 🌐 Web UI | ✅ 可用 | 推荐使用 |
| 📲 PWA | ✅ 可用 | 生产构建的 manifest + Service Worker；在 HTTPS 或 localhost 安全上下文安装，离线缓存应用外壳，API 操作仍需联网 |
| 🖥️ Electron | 🧪 预览 | 打包版提供内置前端与 loopback API 代理；core 服务单独运行或可选 fork；Linux `dir` 构建 |
| 🤖 Android / 📱 iOS | ❌ 未完成 | Capacitor 脚本保留，见 [docs/MOBILE_QUICK_START.md](docs/MOBILE_QUICK_START.md) |

## 页面一览

| 路由 | 页面 | 说明 |
|---|---|---|
| `/dashboard` | 仪表盘 | 自然语言创建 AI 工作流，查看规划/BGM/镜头/文案日志 |
| `/accounts` | 账号与连接 | Pixiv PKCE 登录、refresh token 导入（经 core 调用 pixiv-cli）、多账号切换、代理测试 |
| `/video` | 视频工作台 | 素材预过滤、封面确认、视频审核与重渲染（转场 / 封面模板 / 时长）；SRT/ASS 字幕文件单独下载 |
| `/publish-platforms` | 发布平台 | 各平台（B站、YouTube、Telegram、Steam Workshop、抖音、小红书、Discord、Wallpaper Engine、本地导出）状态与 dry-run |
| `/publish` | 发布任务 | 工作流生成的发布包与提交 |
| `/templates` | 模板库 / 编辑器 | @xyflow 图编辑、环检测、保存/复制（浏览器 localStorage）；执行接口待接入 * |
| `/calendar` | 发布日历 | 本地草稿/示例排期，可保存与取消；RRULE 为展示，自动发布与重复规则未接入 * |
| `/plugins` | 插件 | 示例插件清单、本地启用偏好；运行和权限执行尚未接入 * |
| `/ai` | AI 集成 | OpenAI 兼容/Ollama 预设、模型探测、测试与保存后端设置；Prompt 版本和 token/费用统计 API 尚未提供 |
| `/schedules` `/collection` `/presets` | 定时任务 / 素材 / 预设 | |
| `/download` `/url-download` `/history` `/files` `/logs` `/config` | 下载、按 URL 下载、历史、文件、日志、配置 | 继承自 PixivFlow WebUI |

\* 本地编辑结果存于当前浏览器的 localStorage，清除站点数据会删除这些结果。对应 core 模块为独立库；这些页面尚未接入后端执行或同步接口。

## 技术栈

React 18 · TypeScript · Ant Design 5 · React Router 6 · React Query · Axios · i18next（中/英）· Vite 7 · vite-plugin-pwa · @xyflow/react · Electron · Jest + Testing Library · Playwright

## 快速开始

### 前置要求

- Node.js 22.12+（推荐 22/24 LTS）和 npm；Vite 7 也支持 Node 20.19+（20.x），不支持 Node 18
- 运行中的 Artflow-core（见其 README；或使用下方的一键 fixture 全栈）

### 开发

```bash
git clone https://github.com/tianyin231/Artflow-studio.git
cd Artflow-studio
npm ci
npm run dev                 # http://127.0.0.1:5373，/api 代理到 127.0.0.1:3300
```

后端不在默认端口时：`VITE_DEV_API_PORT=3000 npm run dev`（主机用 `VITE_DEV_API_HOST`）。
在 core 侧可用 `PORT=3300 npm run webui` 匹配默认代理端口。

### 一键离线全栈（fixture，无需 Pixiv 账号）

把 Artflow-core 克隆到同级目录并在其中运行 `npm ci` 后：

```bash
cd ../Artflow-core
npm run dev:stack:fixture   # mock + core(3300) + studio(5373)，就绪后打开 http://127.0.0.1:5373
```

脚本位于 Artflow-core 的 `scripts/dev/`，studio 位置可用 `ARTFLOW_STUDIO_DIR` 指定。模拟账号与素材审核无需真实凭据；继续到视频合成仍需要 core 的 Python/MoviePy 与 ffmpeg 环境（见 core README）。

### 生产构建

```bash
npm run build               # tsc + vite build，产物在 dist/
npm run preview             # 本地预览
VITE_API_BASE_URL=http://127.0.0.1:3000 npm run build   # 指定生产 API 地址
npm run check:pwa           # 校验 PWA 产物（manifest / service worker）
```

生产构建通过 `index.html` 的 import map 加载 `public/vendor/` 中的 React、Ant Design 等预构建 ESM；发布时需连同这些 vendor 文件一起部署。`preview` 提供本地 API 代理；正式静态部署需配置 `/api`、`/socket.io` 反向代理，或使用构建时的 API 地址。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_DEV_API_PORT` / `VITE_DEV_API_HOST` | `3300` / `127.0.0.1` | dev/preview 的 `/api`、`/socket.io` 代理目标 |
| `VITE_API_BASE_URL` | 同源 | 构建时注入的 API 服务地址，末尾不含 `/api` |
| `VITE_USE_EMBEDDED_BACKEND` | — | `false` = 不使用内嵌后端模式 |
| `ARTFLOW_CORE_DIR` | `../Artflow-core` | E2E 启动全栈时的 core 位置 |
| `ARTFLOW_E2E_BASE_URL` | `http://127.0.0.1:5373` | E2E 的 Studio 地址；Electron 开发地址覆盖；自动 E2E 启动使用本机 HTTP 地址 |
| `ARTFLOW_E2E_CORE_PORT` / `ARTFLOW_E2E_MOCK_PORT` | `3300` / `3302` | 自动 E2E 全栈端口；API 请求经 Studio 代理 |
| `ARTFLOW_CORE_URL` | `http://127.0.0.1:3300` | Electron 的 core API 与打包版代理目标 |
| `ARTFLOW_FORK_CORE` / `ARTFLOW_CORE_ENTRY` | — | Electron：`1` = 由主进程 fork core（默认 `../Artflow-core/dist/webui/index.js`） |

## 测试

```bash
npm run lint                # eslint，0 warning
npm test -- --runInBand      # Jest + Testing Library（单元/页面/集成/a11y）
npm run test:electron        # Node 运行时回归：模拟 Electron IPC、窗口与本地静态服务
npm run test:pwa             # 生产应用外壳/离线缓存回归
npm run check-translations  # i18n 键检查
```

### E2E（Playwright）

```bash
npx playwright install chromium     # 首次
npx playwright test                 # 自动启动 ../Artflow-core/scripts/dev/dev-stack.sh --fixture --prod
npx playwright test -c playwright.reuse.local.ts   # 复用已运行的全栈
```

- core 不在同级目录时设置 `ARTFLOW_CORE_DIR=/path/to/Artflow-core`。
- 覆盖实际页面渲染、导航、PKCE/模拟账号导入、错误状态、UI 创建工作流/素材审核与精确 dry-run 返回；真实上传需单独验证。
- 独立端口：设置 `ARTFLOW_E2E_BASE_URL=http://127.0.0.1:15373`、`ARTFLOW_E2E_CORE_PORT=13300`、`ARTFLOW_E2E_MOCK_PORT=13302`；复用配置另支持 `ARTFLOW_E2E_MOCK_URL`。
- 一键全量验证（core + studio + E2E + 密钥扫描）：在 Artflow-core 运行 `npm run verify:all`。

## Electron（预览）

- 安全配置：`contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`，preload 仅暴露白名单 IPC。
- 捕获 `pixiv://account/login` OAuth 回调并转交 core；账号页通过限定的 desktop bridge 登录/导入，Web 使用粘贴回调流程。
- 开发：先运行 `npm run dev` 与 core（默认 `3300`），再运行 `npm run electron:dev`。
- 打包：`npm run electron:build:linux:dir`（先构建前端，输出到 `dist_electron/`，**不入库**）。打包版通过随机 loopback 端口提供内置 `dist/`，代理 API/WebSocket 到 core，无需独立 Studio 服务。core 默认仍须单独运行；`ARTFLOW_FORK_CORE=1` 可启动指定的已编译 core 入口。
- 当前 `electron-builder.yml` 只配置 Linux `dir` 目标；Windows / macOS / AppImage 尚未验证。桌面 CI 草稿在 `docs/ci/desktop.workflow.yml`（未启用，启用前需按实际 runner 和依赖调整）。

PWA 仅在生产构建启用。应用外壳可离线访问；账号、素材下载、AI 与发布仍依赖可达的 core，Service Worker 不缓存 API 响应或令牌。

## 项目结构

```
Artflow-studio/
├── src/
│   ├── pages/          # 页面（Accounts、VideoStudio、PublishPlatforms、TemplateEditor …）
│   ├── components/     # 组件
│   ├── services/api/   # Artflow-core API 客户端
│   ├── hooks/ stores/ utils/ locales/
│   └── __tests__/      # Jest 测试
├── electron/           # Electron 主进程 / preload / 安全配置
├── e2e/                # Playwright 用例与 Electron 冒烟脚本
├── public/vendor/      # 预构建 ESM 依赖（import map）
├── scripts/            # check-pwa 等
└── docs/               # 开发 / 构建 / 移动端文档
```

不要提交本地产物：`node_modules/`、`dist/`、`dist_electron/`、`test-results/`、`playwright-report/`、`.env*.local`。

## 文档

[开发指南](docs/DEVELOPMENT_GUIDE.md) · [组件](docs/COMPONENT_GUIDE.md) · [E2E](docs/E2E_TESTING_GUIDE.md) · [构建选项](docs/BUILD_OPTIONS.md) · [性能](docs/PERFORMANCE_GUIDE.md) · [移动端](docs/MOBILE_QUICK_START.md)

## 许可证与致谢

本项目采用 MIT 许可证（见 [LICENSE](LICENSE)）。项目基于 PixivFlow WebUI（[PixivFlow](https://github.com/zoidberg-xgd/PixivFlow) 的前端）二次开发，保留原作者署名。

- [Ant Design](https://ant.design/) · [React Query](https://tanstack.com/query) · [i18next](https://www.i18next.com/) · [Vite](https://vitejs.dev/) · [React Flow / @xyflow](https://reactflow.dev/)

问题与建议请在 GitHub 提交 Issue。
