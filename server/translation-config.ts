import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { TranslationSettings, TranslationSettingsUpdate } from "../shared/protocol.ts";

type Config = Omit<TranslationSettingsUpdate, "api_key"> & { api_key: string };
export class TranslationConfig {
  private value: Config;
  constructor(private dir: string | undefined, env: Record<string, string | undefined>) {
    this.value = { protocol: env.HERDR_TRANSLATION_PROTOCOL === "anthropic" ? "anthropic" : "openai", base_url: env.HERDR_TRANSLATION_BASE_URL ?? "", model: env.HERDR_TRANSLATION_MODEL ?? "", api_key: env.HERDR_TRANSLATION_API_KEY ?? "" };
    if (dir && existsSync(join(dir, "translation.enc"))) {
      const bytes = readFileSync(join(dir, "translation.enc"));
      const decipher = createDecipheriv("aes-256-gcm", readFileSync(join(dir, "translation.key")), bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      this.value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    }
  }
  current(): Config { return { ...this.value }; }
  status(): TranslationSettings {
    const { api_key, ...config } = this.value;
    return { ...config, has_key: Boolean(api_key), configured: Boolean(api_key && config.base_url && config.model) };
  }
  save(body: unknown): TranslationSettings {
    if (!body || typeof body !== "object") throw Error("invalid");
    const b = body as Record<string, unknown>;
    if (!["openai", "anthropic"].includes(String(b.protocol)) || typeof b.base_url !== "string" || typeof b.model !== "string" || !b.model.trim() || b.model.length > 256 || b.base_url.length > 2048 || (b.api_key !== undefined && (typeof b.api_key !== "string" || b.api_key.length > 8192 || /[\r\n]/.test(b.api_key)))) throw Error("invalid");
    const url = new URL(b.base_url.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error("invalid");
    const base_url = url.toString().replace(/\/+$/, "").replace(/\/(?:chat\/completions|messages)$/, "");
    const key = typeof b.api_key === "string" && b.api_key.trim() ? b.api_key.trim() : this.value.api_key;
    // Never silently reuse an old provider's secret at a different endpoint.
    if (key && base_url !== this.value.base_url.replace(/\/+$/, "") && !(typeof b.api_key === "string" && b.api_key.trim())) throw Error("key_required");
    if (!key) throw Error("key_required");
    const next: Config = { protocol: b.protocol as Config["protocol"], base_url, model: b.model.trim(), api_key: key };
    if (this.dir) {
      mkdirSync(this.dir, { recursive: true, mode: 0o700 });
      const keyPath = join(this.dir, "translation.key");
      if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", readFileSync(keyPath), iv);
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(next)), cipher.final()]);
      const dest = join(this.dir, "translation.enc"), temp = dest + "." + randomBytes(6).toString("hex");
      writeFileSync(temp, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
      renameSync(temp, dest);
    }
    this.value = next;
    return this.status();
  }
}
