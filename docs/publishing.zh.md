# 定制仓库发布说明

公开仓库：[wherexml/claudecode-herdr](https://github.com/wherexml/claudecode-herdr)。本仓库是 [devswha/herdr-web-ui](https://github.com/devswha/herdr-web-ui) 的正式 Fork，保留完整上游提交历史及 MIT 许可。

本次定制基于上游提交 `54e5a1f67090cb09552d182e7e30dd0ecc314918`。主要差异为双向聊天翻译、可配置翻译协议与加密存储、文档阅读/翻译，以及美西时间提示。README 由 codeagent 编写，说明文字使用简体中文。

## 仓库与运行边界

- `origin` 指向本定制仓库，`upstream` 指向上游项目。
- 当前以源码形式发布。不要通过上游安装器或自动更新把本地定制覆盖为上游版本；按 README 使用直接服务入口启动。
- 保留上游自动化文件，但网站部署、版本发布和远程二进制包工作流仅在上游运行。定时 Windows 安装验收也只在上游运行；定制仓库保留正常 CI。
- `.env`、状态目录、私有加密设置、截图和会话验收数据不进入 Git。示例文件必须没有真实密钥。
- 每次修改先检查 diff 和引用文档，验证相关功能，再使用中文提交说明发布。不得将定制仓库测试失败伪装为上游已验收。

## 本次验证入口

构建与类型检查：`bun run typecheck`、`bun run build`。
翻译接口与语言覆盖：`bun test ./server/translation.contract.test.ts ./src/lib/i18n.test.ts`（接口测试使用隔离临时状态，不操作用户窗格）。
完整自动化以本仓库 GitHub Actions 的具体提交结果为准；本地受平台影响的失败应与 CI 分开记录。
