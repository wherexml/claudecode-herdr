/** Isolated E2E fixture; run with HERDR_TEST_SESSION=herdr-web-ui-test-translation.
 * Serves the real UI/API at 17318, captures input in cat (never a model), logs no credentials.
 */
import "./test-herdr.ts";
import { createServer } from "../server/index.ts";
import { herdrRpc, workspaceCreate, workspaceClose } from "../server/herdr/client.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve("evidence/translation"); mkdirSync(dir, { recursive: true });
const panes: string[] = []; const workspaces: string[] = [];
for (const label of ["Translation QA A", "Translation QA B"]) {
  const created = await workspaceCreate({ cwd: dir, label });
  const pane = created.root_pane.pane_id; panes.push(pane); workspaces.push(created.workspace.workspace_id);
  await herdrRpc("pane.send_text", { pane_id: pane, text: "cat" });
  await herdrRpc("pane.send_keys", { pane_id: pane, keys: ["Enter"] });
  await herdrRpc("pane.report_agent", { pane_id: pane, source: "manual", agent: "claude", state: "idle" });
}
const server = createServer({ port: 17318, hostname: "127.0.0.1", token: "", stateDir: resolve(dir, "state") });
writeFileSync(resolve(dir, "fixture.json"), JSON.stringify({ origin: "http://127.0.0.1:17318", panes, workspaces, socket: process.env.HERDR_SOCKET }, null, 2));
console.log(JSON.stringify({ origin: "http://127.0.0.1:17318", panes }));
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await server.stop(); for (const id of workspaces) await workspaceClose(id); process.exit(0); }
process.on("SIGINT", () => void stop()); process.on("SIGTERM", () => void stop());
