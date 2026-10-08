# claudecode-herdr：中文聊天与阅读定制版

本仓库是 [devswha/herdr-web-ui](https://github.com/devswha/herdr-web-ui) 的定制分支，由 Steve 用于中文聊天与文档阅读场景，发布于 [wherexml/claudecode-herdr](https://github.com/wherexml/claudecode-herdr)。保留上游 MIT 许可与原作者 devswha 的归属。底层 herdr 引擎来自独立项目 [herdrdev/herdr](https://github.com/herdrdev/herdr)。

通过浏览器查看和操作已有 herdr 窗格，在聊天记录与实时终端之间切换。本版在上游能力上增加双向聊天翻译、翻译服务设置、Markdown 默认渲染、文档中文翻译和美西时钟。安装本定制版请使用下方源码步骤；上游安装脚本、插件安装入口和发布包不代表本仓库的定制版本。

## 各层负责什么

| 层次 | 职责 | 认证与配置 |
| --- | --- | --- |
| Herdr 引擎 | 持有终端、滚动历史、工作区和 Agent 状态 | Web 后端通过指定的 Unix socket 连接已有会话 |
| Web 界面与后端 | 展示聊天、终端、文件和审批交互，桥接浏览器与 Herdr | 浏览器访问控制属于 Web 层；SSH 隧道只提供访问通道 |
| Agent | Claude Code、Codex 等在 Herdr 窗格中运行，调用各自模型 | 使用各自的登录、订阅或 API 配置，需单独完成认证 |
| 翻译服务 | 把聊天文本译为英文、回复与文档译为简体中文 | 使用单独的协议、URL、API Key 和模型设置 |

配置翻译 API 不会替 Claude Code 或 Codex 登录，也不会改变 Agent 使用的模型。语音转写同样使用浏览器或既有转写服务的配置。

## 本版新增能力

- **双向聊天翻译**：默认关闭。开启后，普通输入以及语音转写得到的文字在发送时译为英文；已完成且进入可见区域的 Agent 正文译为简体中文，可展开原文。译文不覆盖原始会话记录。
- **保留交互语义**：终端输入、审批操作、工具输出和斜杠命令不翻译；代码围栏、内联代码、URL 与附件路径有保护处理。排队消息保留原文，只有明确点击“立即发送”才按当前模式处理。翻译失败保留草稿；切换窗格或断线会取消待发送的翻译。
- **可配置翻译协议**：设置页支持 OpenAI 的聊天补全协议和 Anthropic 的消息协议，可填写服务地址及模型，不绑定某个模型供应商。
- **Markdown 默认渲染**：文件阅读器打开 `.md`、`.markdown`、`.mdown`、`.mkd` 时默认排版阅读，可切换源码；普通文本仍按原文预览。Markdown 不执行原始 HTML。
- **文档中文翻译**：点击文件标题栏的翻译图标，翻译当前文本预览，再次点击可切回原文。它与聊天翻译开关独立，共用翻译服务配置；长文按段顺序处理，代码围栏保留原文，不改写文件或下载内容。
- **美西时钟**：聊天输入区显示 `America/Los_Angeles` 时间，自动处理夏令时。绿色表示 08:00–18:59，黄色表示 06:00–07:59 和 19:00–次日 00:59，红色表示 01:00–05:59。表情只提示时段，不限制发送或调度 Agent。

文本文件预览上限为 **256 KiB**；超限时显示截断提示，文档翻译只处理当前预览部分。单次翻译请求上限为 24,000 字符，服务端最长等待 90 秒，同时最多处理 4 个请求。

语音输入复用浏览器语音识别或已有转写服务，先得到文字，再由文本翻译接口处理；翻译 API 不直接识别音频。需要主动点击麦克风，识别准确度取决于转写服务。

## 从源码运行

以下以 Linux 或 macOS、**Bun 1.4.2、Node.js 22、Herdr 0.9.3** 为运行前提。Node.js 用于终端连接的独立进程。先安装这些依赖，并在 Herdr 中准备好已有会话和需要使用的 Agent；Agent 的模型认证需自行配置。

```bash
git clone https://github.com/wherexml/claudecode-herdr.git
cd claudecode-herdr
bun install --frozen-lockfile
bun run build
```

指定要连接的**已有会话** socket。以下为通用 Linux 示例，`user` 和 `existing-session` 都是占位值；请替换为实际用户名和已有会话名。macOS 或设置了 `XDG_CONFIG_HOME` 的环境应使用对应的实际 socket 路径。

```bash
export HERDR_SOCKET=/home/user/.config/herdr/sessions/existing-session/herdr.sock
HOST=127.0.0.1 PORT=17317 HERDR_WEB_AUTO_UPDATE=0 bun run server/index.ts
```

在运行 Web 后端的机器上打开 [本地界面](http://127.0.0.1:17317)。后端使用构建好的 `dist/`，并连接所指定的 Herdr 会话；上述步骤不创建或终止用户的 Herdr 会话。

此启动方式直接运行源码后端，不经过自动更新管理进程；同时显式关闭自动更新。更新本定制版应检查本仓库改动后重新安装依赖、构建并重启 Web 进程，不要用上游更新入口替换定制代码。

## 配置翻译

推荐打开设置页的翻译区域，填写协议、API 基础 URL、API Key 和模型 ID，保存后再开启聊天翻译。

| 设置 | 填写说明 |
| --- | --- |
| 协议 | 按服务商接口选择 OpenAI 或 Anthropic |
| API 基础 URL | OpenAI 地址应包含服务商要求的路径，例如 `/v1`，后端追加 `/chat/completions`；Anthropic 后端补齐 `/v1/messages`，已有 `/v1` 时不重复追加 |
| API Key | 首次配置时填写；已有密钥时留空表示保持不变；修改 URL 必须重新填写密钥 |
| 模型 ID | 填入该服务实际支持、且当前账户可用的文本模型标识 |

保存立即生效并清理翻译缓存，重启后保留。设置以 AES-256-GCM 加密保存于后端状态目录的 `translation.enc`，本机解密密钥为 `translation.key`；文件权限为 `0600`，目录为 `0700`。读取设置只返回是否配置密钥，不回传已保存的 API Key。

已有 `.env` 可继续作为回退，变量为 `HERDR_TRANSLATION_PROTOCOL`、`HERDR_TRANSLATION_BASE_URL`、`HERDR_TRANSLATION_API_KEY`、`HERDR_TRANSLATION_MODEL`；协议值为 `openai` 或 `anthropic`，默认 `openai`。已保存的设置优先于环境变量，保存设置不会改写 `.env`。凭据只供后端使用，不使用 `VITE_` 前缀，也不要提交到 Git。

开启聊天翻译或主动翻译文档时，相应文本会发送到配置的翻译服务，可能产生费用。Agent 自身的模型调用与语音转写有各自独立的数据流和计费。

## 通过 SSH 访问远端

远端 Web 服务仍监听 `127.0.0.1:17317`。在本机终端建立隧道：

```bash
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:17319:127.0.0.1:17317 user@server.example.com
```

将 `user@server.example.com` 替换为自己的远端账户与地址，保持此命令运行，再在本机浏览器打开 [隧道入口](http://127.0.0.1:17319)。此方式无需 Tailscale；SSH 客户端负责连接和转发，浏览器只访问本机端口，不直接读取 SSH 配置。

## 验证范围与开发检查

[翻译说明](docs/translation.md)记录了双向文本翻译、失败保留草稿、切换窗格取消、原文切换等浏览器验收，以及设置保存和协议接口检查。**Anthropic 协议的隔离 HTTP 验证已通过，但尚未完成真实 Anthropic 账户验收；真人麦克风录音也未验收。** 这些记录不代表所有服务商、模型或语音环境均已兼容。

常用开发检查：

```bash
bun run typecheck
bun run build
bun run test:unit
UI_EVIDENCE_DIR=evidence/ui bun run test:ui
UI_EVIDENCE_DIR=evidence/file-viewer bun scripts/file-viewer-regression.ts
```

浏览器检查需要可用的 Chrome，可通过 `CHROME_PATH` 指定可执行文件；文件阅读器回归不包含在 `test:ui` 中，因此单独列出。浏览器脚本使用构建产物，`UI_EVIDENCE_DIR` 指定截图证据目录。测试只能使用隔离测试会话及其自行创建的窗格，不要设置 `HERDR_TEST_LIVE=1` 指向用户会话。复杂交互优先用端到端验证，并保留复现步骤、结果和截图；本版翻译与文档阅读的重验步骤见对应文档。

## 相关文档

- [翻译行为、配置与验收](docs/translation.md)
- [文件阅读器与文档翻译](docs/file-viewer.md)
- [使用指南](docs/guide.md)与[远端机器说明](docs/remote-pcs.md)
- [开发与测试说明](docs/development.md)
- [贡献约定](CONTRIBUTING.md)、[审查规则](.github/REVIEW.md)与[项目约束](AGENTS.md)
- [界面设计约定](DESIGN.md)与[变更记录](CHANGELOG.md)

部分通用文档沿用上游说明；其中的上游安装、发布和更新入口不用于安装本定制版，运行方式以本页为准。

## 许可与致谢

本项目遵循 [MIT 许可证](LICENSE)，保留原作者归属：版权所有 © 2026 devswha。

感谢 [devswha/herdr-web-ui](https://github.com/devswha/herdr-web-ui) 的原作者和贡献者，以及提供底层引擎的 [herdrdev/herdr](https://github.com/herdrdev/herdr)。界面与服务使用 React、xterm.js、Bun 和 Lucide 等项目。

## 会话状态同步

聊天输入框下方可显示 Claude Code 原生状态：翻译模式同一行右侧的 5h 与 7d 额度进度条及美西重置时间。按会话匹配；缺失指标不显示。安装与验收见[会话状态说明](docs/statusline.md)。
