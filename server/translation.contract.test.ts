import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "./index.ts";
import { TranslationService } from "./translation.ts";

test("translation HTTP contract: auth, validation, provider failures and protected code", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "herdr-translation-contract-"));
  let calls = 0;
  let fail = false;
  const translation = new TranslationService({ env: { HERDR_TRANSLATION_API_KEY: "test-only", HERDR_TRANSLATION_BASE_URL: "https://example.invalid/v1", HERDR_TRANSLATION_MODEL: "test" }, fetch: async (_input, init) => {
    calls++;
    expect(new Headers(init?.headers).get("x-opencode-session")).toBeTruthy();
    if (fail) return new Response("private provider details", { status: 500 });
    const body = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: body.messages[1].content.replace("你好", "Hello") } }] });
  } });
  const server = createServer({ port: 0, hostname: "127.0.0.1", token: "test-token", stateDir, translation, machines: false });
  const base = `http://127.0.0.1:${server.port}`;
  const send = (body: unknown, auth = true, origin = base) => fetch(`${base}/api/translation`, { method: "POST", headers: { "content-type": "application/json", "x-herdr-translation": "1", origin, ...(auth ? { authorization: "Bearer test-token" } : {}) }, body: JSON.stringify(body) });
  try {
    const input = { text: "你好 `npm run build`", target: "en", session: "contract:p1" };
    expect((await send(input, false)).status).toBe(401);
    expect((await send(input, true, "https://evil.invalid")).status).toBe(403);
    expect((await send({ ...input, text: "" })).status).toBe(400);
    expect((await send({ ...input, target: "fr" })).status).toBe(400);
    expect((await send({ ...input, text: "x".repeat(24001) })).status).toBe(400);
    const good = await send(input);
    expect(good.status).toBe(200);
    expect((await good.json()).text).toBe("Hello `npm run build`");
    await send(input); expect(calls).toBe(1);
    fail = true;
    const failed = await send({ ...input, text: "other" });
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("private provider details");
  } finally { await server.stop(); rmSync(stateDir, { recursive: true, force: true }); }
});
