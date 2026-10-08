import type { ClaudeStatusLine as Status } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";
import "./ClaudeStatusLine.css";

const pacific = "America/Los_Angeles";
const resetTime = new Intl.DateTimeFormat("en-US", { timeZone: pacific, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const resetDay = new Intl.DateTimeFormat("en-US", { timeZone: pacific, weekday: "short" });
const resetFull = new Intl.DateTimeFormat("en-US", { timeZone: pacific, dateStyle: "full", timeStyle: "long" });

export function ClaudeStatusLine({ status }: { status?: Status }) {
  const t = useT();
  if (!status || (status.cost_usd === undefined && !status.five_hour && !status.seven_day)) return null;
  return <div className="claude-statusline" role="status" aria-label={t("Session status")}>
    {status.cost_usd !== undefined && <span>{t("Estimated session cost")} ${status.cost_usd.toFixed(2)}</span>}
    {([status.five_hour, status.seven_day] as const).map((window, i) => {
      if (!window) return null;
      const label = i === 0 ? t("5-hour usage") : t("Weekly usage");
      const reset = window.resets_at === undefined ? null : new Date(window.resets_at * 1000);
      return <span className="claude-statusline-window" key={i} title={`${label}: ${window.used_percentage}%${reset ? ` · ${resetFull.format(reset)}` : ""}`}>
        <span>{i === 0 ? "5h" : "7d"}</span>
        <span className="claude-statusline-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={window.used_percentage}>
          <span style={{ width: `${window.used_percentage}%` }} />
        </span>
        {reset && <span>reset at {(i === 0 ? resetTime : resetDay).format(reset)}</span>}
      </span>;
    })}
    {(status.five_hour || status.seven_day) && <span className="claude-statusline-zone">{t("Pacific time")}</span>}
  </div>;
}
