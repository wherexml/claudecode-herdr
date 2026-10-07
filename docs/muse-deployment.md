# 远程主机部署示例（Muse）

本文将远程主机的 SSH 别名示例设为 `muse`，用户名示例为 `USER`；部署时替换为自己的配置。

## 访问与认证

本机访问 `http://127.0.0.1:17319`，通过 SSH config 的 `muse` 主机（用户自己的跳板与密钥认证）转发到 Muse 的 `127.0.0.1:17317`。无需 Tailscale，不开放公网 Web 端口。浏览器本身不读取 SSH config；SSH 隧道负责连接认证。任何能访问本机回环端口的程序都能使用该入口。

Web UI 连接 Muse 的 `muse-herdr` 会话；模型认证来自 Muse 上实际运行的 Agent 配置，不会自动使用 Mac 的模型配置。翻译服务优先使用设置页保存的加密配置，回退读取部署目录的私有 `.env`；禁止输出或提交凭据。

## 服务位置

- 源码：Muse `/home/USER/Projects/herdr-web-ui`（本地定制源码快照，无 Git 自动更新）。
- Bun：`/home/USER/.local/share/herdr-web-ui/runtime/bun-linux-x64/bun`。
- socket：`/home/USER/.config/herdr/sessions/muse-herdr/herdr.sock`。
- 状态：`/home/USER/.local/state/herdr-web-ui`。
- 服务：`~/.config/systemd/user/herdr-web-ui.service`；用户 linger 已启用。
- Mac 隧道：`~/Library/LaunchAgents/com.steve.herdr-muse-web-tunnel.plist`，登录启动、掉线重连。
- 隧道日志：`~/.local/state/herdr-web-ui-muse/`。

## 运维与复验

```sh
ssh muse 'systemctl --user status herdr-web-ui --no-pager'
ssh muse 'journalctl --user -u herdr-web-ui -n 50 --no-pager'
ssh muse 'systemctl --user restart herdr-web-ui'
curl --fail http://127.0.0.1:17319/api/health
curl --fail http://127.0.0.1:17319/api/translation
```

更新时同步明确选择的源码文件、在 Muse 用上述 Bun 执行 `bun install --frozen-lockfile` 和 `bun run build`，再重启 Web 服务。不要重启现有 Herdr 或改动其他 Agent。`.env` 单独通过 SSH 传输并保持 0600，不放入源码归档。

本机原预览 `127.0.0.1:17317` 与 Muse 入口 `127.0.0.1:17319` 相互独立。Mac 休眠或离线时本机入口不可用，但 Muse 后台服务及 Agent 不依赖该隧道存活。
