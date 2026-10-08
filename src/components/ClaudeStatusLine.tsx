import type { ClaudeStatusLine as Status } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";
import "./ClaudeStatusLine.css";

export function ClaudeStatusLine({ status }: { status?: Status }) {
  const t = useT();
  if (!status) return null;
  const updated = new Date(status.updated_at).toLocaleString();
  return <div className="claude-statusline" role="status" aria-label={t("Session status")}>
    {status.model && <span>{status.model}</span>}
    {status.context_percent !== undefined && <span>{t("Context used")} {Math.round(status.context_percent)}%</span>}
    {status.cost_usd !== undefined && <span>{t("Estimated session cost")} ${status.cost_usd.toFixed(2)}</span>}
    {([status.five_hour, status.seven_day] as const).map((window, i) => window && <span key={i} title={window.resets_at ? `${t("Resets at")} ${new Date(window.resets_at * 1000).toLocaleString()}` : undefined}>
      {i === 0 ? t("5-hour usage") : t("Weekly usage")} {Math.round(window.used_percentage)}%
      {window.resets_at !== undefined && <> · {t("Resets at")} {new Date(window.resets_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
    </span>)}
    <span className="claude-statusline-updated" title={updated}>{t("Updated at")} {new Date(status.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
  </div>;
}
