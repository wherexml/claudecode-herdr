/** Repeatable E2E fixture: bridge stdin -> private snapshot -> real conversation HTTP -> UI.
 * Failure cases: missing/invalid metrics, wrong session, failed capture, unchanged transcript
 * with a new snapshot (ETag), absent snapshot, narrow viewport. Never invokes a model.
 * Run after build; use Ego at the printed URL and stop with Ctrl-C afterward.
 */
import "./test-herdr.ts";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { TranslationService } from "../server/translation.ts";
import { createServer } from "../server/index.ts";
import { herdrRpc, workspaceCreate, workspaceClose } from "../server/herdr/client.ts";
const root = mkdtempSync(join(tmpdir(), "herdr-status-"));
const session = "6c0b9e85-7d7c-49a9-a198-abb120bedeee";
const project = join(root, ".claude/projects/fixture");
mkdirSync(project, { recursive: true });
const transcript = join(project, `${session}.jsonl`);
writeFileSync(transcript, JSON.stringify({ type: "user", uuid: "u1", message: { role: "user", content: "Status fixture — no live model" } }) + "\n" + JSON.stringify({ type: "assistant", uuid: "a1", message: { role: "assistant", model: "fixture", content: [{ type: "text", text: "Status fixture ready." }] } }) + "\n");
const created = await workspaceCreate({ cwd: root, label: "Status E2E fixture" });
const pane = created.root_pane.pane_id;
await herdrRpc("pane.report_agent", { pane_id: pane, source: "manual", agent: "claude", state: "idle" });
await herdrRpc("pane.report_agent_session", { pane_id: pane, source: "herdr:claude", agent: "claude", seq: Date.now(), agent_session_id: session });
process.env.HOME = root;
delete process.env.CLAUDE_CONFIG_DIR;
const server = createServer({ port: 17318, hostname: "127.0.0.1", token: "", stateDir: join(root, "state"), translation: new TranslationService({ stateDir: join(root, "state"), env: {} }) });
const url = `http://127.0.0.1:17318/api/pane/conversation?pane_id=${pane}`;
const snapshot = join(root, ".claude/herdr-statusline", session + ".json");
const checks: string[] = [];
const capture = (metrics: object) => {
 const result = spawnSync("python3", ["scripts/claude-statusline-bridge.py", "printf preserved"], { input: JSON.stringify({ session_id: session, transcript_path: transcript, ...metrics }), encoding: "utf8" });
 assert.equal(result.stdout, "preserved"); assert.equal(result.status, 0);
};
try {
 let response = await fetch(url); assert.equal(response.status, 200); const first = response.headers.get("etag");
 assert.equal((await response.json()).metadata.status_line, undefined); checks.push("missing snapshot omitted");
 capture({ model: { display_name: "Fixture Opus" }, context_window: { used_percentage: 42 }, cost: { total_cost_usd: 3.46 }, rate_limits: { five_hour: { used_percentage: 61, resets_at: Math.floor(Date.now()/1000)+3600 }, seven_day: { used_percentage: 18, resets_at: Math.floor(Date.now()/1000)+86400 } }, secret: "must-not-be-captured" });
 assert.equal(statSync(snapshot).mode & 0o777, 0o600); assert(!readFileSync(snapshot,"utf8").includes("must-not-be-captured")); checks.push("allowlist and private mode; terminal stdout preserved");
 response = await fetch(url, { headers: { "if-none-match": first! } }); assert.equal(response.status, 200); assert.notEqual(response.headers.get("etag"), first);
 const full = await response.json(); assert.equal(full.metadata.status_line.context_percent, 42); checks.push("native capture reaches real HTTP; ETag refreshes without transcript change");
 const saved = readFileSync(snapshot, "utf8");
 writeFileSync(snapshot, JSON.stringify({ ...JSON.parse(saved), session_id: "wrong" })); assert.equal((await (await fetch(url)).json()).metadata.status_line, undefined); checks.push("wrong session rejected");
 capture({ context_window: { used_percentage: 999 }, cost: { total_cost_usd: -1 } }); const invalid = (await (await fetch(url)).json()).metadata.status_line; assert.equal(invalid.context_percent, undefined); assert.equal(invalid.cost_usd, undefined); checks.push("invalid metrics omitted");
 writeFileSync(snapshot, saved);
 mkdirSync(resolve("evidence/statusline"), { recursive: true });
 writeFileSync(resolve("evidence/statusline/api.json"), JSON.stringify({ checks, fixture: true, url: `http://127.0.0.1:17318/?pane=${pane}` }, null, 2));
 console.log(JSON.stringify({ checks, url: `http://127.0.0.1:17318/?pane=${pane}` }));
} catch (e) { await server.stop(); await workspaceClose(created.workspace.workspace_id); rmSync(root,{recursive:true,force:true}); throw e; }
const stop = async () => { await server.stop(); await workspaceClose(created.workspace.workspace_id); rmSync(root,{recursive:true,force:true}); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
