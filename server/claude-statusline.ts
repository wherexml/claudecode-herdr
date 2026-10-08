import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { ClaudeStatusLine } from "../shared/protocol.ts";

/** Only read the snapshot belonging to the already resolved native transcript. */
export function readClaudeStatusLine(transcript: string): ClaudeStatusLine | undefined {
  const session = basename(transcript, ".jsonl");
  if (!/^[a-zA-Z0-9-]+$/.test(session)) return;
  const config = dirname(dirname(dirname(transcript)));
  const file = join(config, "herdr-statusline", `${session}.json`);
  try {
    if (statSync(file).size > 8192) return;
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (data.session_id !== session || typeof data.updated_at !== "number" || !Number.isFinite(data.updated_at) || data.updated_at <= 0 || data.updated_at > Date.now() + 60000) return;
    const number = (v: unknown, max = Infinity): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
    const status: ClaudeStatusLine = { updated_at: data.updated_at };
    if (typeof data.model === "string" && data.model.length <= 200) status.model = data.model;
    if (number(data.context_percent, 100)) status.context_percent = data.context_percent;
    if (number(data.cost_usd)) status.cost_usd = data.cost_usd;
    for (const key of ["five_hour", "seven_day"] as const) {
      const value = data[key];
      if (value && number(value.used_percentage, 100)) status[key] = {
        used_percentage: value.used_percentage,
        ...(number(value.resets_at) ? { resets_at: value.resets_at } : {}),
      };
    }
    return status;
  } catch { return; }
}
