# Project instructions

Read [AGENTS.md](AGENTS.md) and the applicable `src/AGENTS.md` or `server/AGENTS.md` before editing.

The local chat translation extension is specified in [docs/translation.md](docs/translation.md). The translation provider is configured through encrypted server settings with ignored `.env` fallback; never read its key into logs, frontend bundles, commits or screenshots.

Muse deployment and SSH access: see [docs/muse-deployment.md](docs/muse-deployment.md). Keep the Web listener on loopback and preserve the existing `muse-herdr` session.

File preview behavior: see [docs/file-viewer.md](docs/file-viewer.md); Markdown defaults to rendered reading with an optional source toggle.

Translation settings use the encrypted server-side config described in docs/translation.md; GET must never reveal API keys. Preserve env fallback and both provider protocols.

公开仓库为 `wherexml/claudecode-herdr`，保留上游归属，README 使用简体中文；发布边界见 AGENTS.md。

CI socket 路径长度约束见 AGENTS.md 和 docs/publishing.zh.md。

Claude 原生状态同步见 [docs/statusline.md](docs/statusline.md)。只读取已绑定会话的指标快照，保留原 statusLine 输出，不采集完整输入，不将缺失额度推算为零。
