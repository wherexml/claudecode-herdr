# 聊天页会话状态

输入框下方读取当前 Claude Code 会话的原生 statusLine 数据，显示会话估算费用，以及 5h、7d 额度进度条。模型、上下文和更新时间不展示。重置时间固定为 America/Los_Angeles，自动处理夏令时：5h 显示 `reset at 20:00`，7d 显示 `reset at Wed`；悬停查看占用百分比及完整美西日期；额度没有返回就不显示，不推算、不跨会话复用。费用是 Claude Code 的客户端估算，不代表实际账单。

## 数据链路

`Claude Code → scripts/claude-statusline-bridge.py → <Claude 配置目录>/herdr-statusline/<session_id>.json → 当前会话 conversation API → 状态栏`。

桥接脚本的唯一参数为原 statusLine 命令。脚本从标准输入读取 JSON，仅保存白名单指标，然后把同一份输入交回原命令。快照目录 0700、文件 0600，以临时文件原子替换，不保存对话、密钥或完整原始输入。读取端验证会话、数值范围和文件大小。原生记录及终端输入保持原状。

在运行 Claude Code 的机器上安装 Python 3，将脚本复制到私有配置目录；备份 `settings.json`，仅修改 `statusLine.command`，例如：

```json
{"statusLine":{"type":"command","command":"python3 ~/.claude/herdr-statusline-bridge.py '~/.claude/statusline.sh'"}}
```

保留已有 statusLine 其他选项。运行中的 Claude Code 重新加载设置后生成快照；没有快照时网页沿用原来的模型显示。自定义配置目录通过原生 `transcript_path` 绑定。需要停用时恢复原命令即可。

快照变更加入 conversation ETag，因此原生对话文件没有新增消息时，网页仍可在现有轮询中刷新状态。此功能不增加 Herdr 状态订阅、不请求模型、不执行 `/status`。数据仅在 Claude Code 刷新 statusLine 时更新；结束的会话保留最后一次记录，时间戳仍保留在接口中，界面不展示。更早历史分页不携带实时指标。

## 验收

运行 `bun run build`，然后 `HERDR_TEST_SESSION=herdr-web-ui-test-status bun scripts/statusline-fixture.ts`。fixture 使用独立 Herdr 会话和临时 Claude 存储，不调用真实模型。打开输出 URL，切到聊天视图，检查电脑和窄屏：仅显示 $3.46、61% 五小时和18%周额度进度条，不出现模型、上下文和更新时间；重置标签为美西时区的时间与星期。横向滚动仅发生在状态栏，页面不溢出。

脚本验证原命令输出保留、快照权限、字段白名单、缺失与非法值隐藏、会话错配拒绝、ETag 随快照改变。接口证据写入忽略的 `evidence/statusline/api.json`，浏览器截图也保存于该目录。结束时停止 fixture 并关闭独立测试会话。
