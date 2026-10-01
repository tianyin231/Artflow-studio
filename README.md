# Artflow-studio

Artflow 的前端工作台（Web / Electron / PWA），用于管理 Pixiv 素材抓取、AI 工作流、视频生成、BGM、定时任务和多平台发布。

> English summary: Artflow-studio is the React + Ant Design frontend for [Artflow-core](https://github.com/tianyin231/Artflow-core). It talks to the core HTTP API, ships as a web app, an installable PWA and a (preview) Electron desktop shell. English docs: [README_EN.md](./README_EN.md) (legacy).

**独立前端项目**：后端 API 由 **[Artflow-core](https://github.com/tianyin231/Artflow-core)** 提供，前端只通过 HTTP API 与后端通信，不包含任何后端依赖。

## 平台支持状态

| 平台 | 状态 | 说明 |
|---|---|---|
| 🌐 Web UI | ✅ 可用 | 推荐使用 |
| 📲 PWA | ✅ 可用 | 生产构建自带 manifest + Service Worker，可“安装到桌面” |
| 🖥️ Electron | 🧪 预览 | 加固的外壳（见下文），目前加载运行中的 studio 服务，Linux `--dir` 构建 |
| 🤖 Android / 📱 iOS | ❌ 未完成 | Capacitor 脚本保留，见 [docs/MOBILE_QUICK_START.md](docs/MOBILE_QUICK_START.md) |

## 页面一览

| 路由 | 页面 | 说明 |
|---|---|---|
| `/dashboard` | 仪表盘 | 自然语言创建 AI 工作流，查看规划/BGM/镜头/文案日志 |
| `/accounts` | 账号与连接 | Pixiv PKCE 登录、refresh token 导入（经 core 调用 pixiv-cli）、多账号切换、代理测试 |
| `/video` | 视频工作台 | 素材预过滤、封面确认、视频审核与重渲染（转场 / 封面模板 / 字幕选项） |
| `/publish-platforms` | 发布平台 | 各平台（B站、YouTube、Telegram、Steam Workshop、抖音、小红书、Discord、Wallpaper Engine、本地导出）状态与 dry-run |
| `/publish` | 发布任务 | 工作流生成的发布包与提交 |
| `/templates` | 模板库 / 编辑器 | 基于 @xyflow 的工作流模板编辑器（环检测、保存回读）* |
| `/calendar` | 发布日历 | 排期视图 * |
| `/plugins` | 插件 | 插件清单与启停 * |
| `/ai` | AI 集成 | OpenAI 兼容提供商预设、Prompt 版本、token 用量 |
| `/schedules` `/collection` `/presets` | 定时任务 / 素材 / 预设 | |
| `/download` `/url-download` `/history` `/files` `/logs` `/config` | 下载、按 URL 下载、历史、文件、日志、配置 | 继承自 PixivFlow WebUI |

\* 标注页面目前为前端实现（本地数据），对应的 core 模块（`workflow/templates`、`workflow/calendar`、`plugins-sdk`）已就绪，HTTP API 尚待接入。

## 技术栈

React 18 · TypeScript · Ant Design 5 · React Router 6 · React Query · Axios · i18next（中/英）· Vite 7 · vite-plugin-pwa · @xyflow/react · Electron · Jest + Testing Library · Playwright

## 快速开始

### 前置要求

- Node.js 18+（推荐 20/22 LTS）和 npm
- 运行中的 Artflow-core（见其 README；或使用下方的一键 fixture 全栈）

### 开发

```bash
git clone https://github.com/tianyin231/Artflow-studio.git
cd Artflow-studio
npm install
npm run dev                 # http://127.0.0.1:5373，/api 代理到 127.0.0.1:3300
```

后端不在默认端口时：`VITE_DEV_API_PORT=3000 npm run dev`（主机用 `VITE_DEV_API_HOST`）。
在 core 侧可用 `PORT=3300 npm run webui` 匹配默认代理端口。

### 一键离线全栈（fixture，无需 Pixiv 账号）

把 Artflow-core 克隆到同级目录后：

```bash
cd ../Artflow-core
npm run dev:stack:fixture   # mock + core(3300) + studio(5373)，就绪后打开 http://127.0.0.1:5373
```

脚本位于 Artflow-core 的 `scripts/dev/`，studio 位置可用 `ARTFLOW_STUDIO_DIR` 指定。

### 生产构建

```bash
npm run build               # tsc + vite build，产物在 dist/
npm run preview             # 本地预览
VITE_API_BASE_URL=http://127.0.0.1:3000 npm run build   # 指定生产 API 地址
npm run check:pwa           # 校验 PWA 产物（manifest / service worker）
```

生产构建把 react / react-dom / antd / @ant-design/icons 作为预构建 ESM 放在 `public/vendor/`，通过 `index.html` 的 import map 加载（修复了此前的生产白屏，并把单个 chunk 控制在 ~274KB）。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_DEV_API_PORT` / `VITE_DEV_API_HOST` | `3300` / `127.0.0.1` | 开发服务器 `/api` 代理目标 |
| `VITE_API_BASE_URL` | 同源 | 生产构建的 API 地址（构建时注入） |
| `VITE_USE_EMBEDDED_BACKEND` | — | `false` = 不使用内嵌后端模式 |
| `ARTFLOW_CORE_DIR` | `../Artflow-core` | E2E 启动全栈时的 core 位置 |
| `ARTFLOW_E2E_BASE_URL` | `http://127.0.0.1:5373` | E2E / Electron 加载的地址 |
| `ARTFLOW_FORK_CORE` / `ARTFLOW_CORE_ENTRY` | — | Electron：`1` = 由主进程 fork core（默认 `../Artflow-core/dist/webui/index.js`） |

## 测试

```bash
npm run lint                # eslint，0 warning
npm test                    # Jest + Testing Library（单元/页面/集成/a11y/Electron 安全配置/PWA 产物）
npm run check-translations  # i18n 键检查
```

### E2E（Playwright）

```bash
npx playwright install chromium     # 首次
npx playwright test                 # 自动启动 ../Artflow-core/scripts/dev/dev-stack.sh --fixture --prod
npx playwright test -c playwright.reuse.local.ts   # 复用已运行的全栈
```

- core 不在同级目录时设置 `ARTFLOW_CORE_DIR=/path/to/Artflow-core`。
- 覆盖：smoke、导航、登录、账号页、发布鉴权、错误处理、工作流。
- 一键全量验证（core + studio + E2E + 密钥扫描）：在 Artflow-core 运行 `npm run verify:all`。

## Electron（预览）

- 安全配置：`contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`，preload 仅暴露白名单 IPC。
- 捕获 `pixiv://` OAuth 回调并转交 core 登录 API。
- 运行：`npm run electron:dev`；打包：`npm run electron:build:linux:dir`（输出到 `dist_electron/`，**不入库**）。
- 当前 `electron-builder.yml` 只配置了 Linux `dir` 目标；Windows / macOS / AppImage 目标待恢复。桌面 CI 草稿在 `docs/ci/desktop.workflow.yml`（未启用；复制到 `.github/workflows/` 即可手动触发）。

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
