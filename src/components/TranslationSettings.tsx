import { useEffect, useState } from "react";
import type { TranslationSettings as Config, TranslationSettingsUpdate } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";
import { useSettings } from "../lib/settings.ts";
import "./TranslationSettings.css";

export function TranslationSettings() {
  const t = useT();
  const { settings, update } = useSettings();
  const [config, setConfig] = useState<Config | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"saved" | "failed" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/translation/settings", { signal: controller.signal }).then(async r => { if (!r.ok) throw Error(); return r.json() as Promise<Config>; })
      .then(setConfig).catch(() => { if (!controller.signal.aborted) setNotice("failed"); });
    return () => controller.abort();
  }, []);
  async function save() {
    if (!config) return;
    setBusy(true); setNotice(null);
    const body: TranslationSettingsUpdate = { protocol: config.protocol, base_url: config.base_url, model: config.model, ...(key.trim() ? { api_key: key.trim() } : {}) };
    try {
      const response = await fetch("/api/translation/settings", { method: "POST", headers: { "content-type": "application/json", "x-herdr-translation": "1" }, body: JSON.stringify(body) });
      if (!response.ok) throw Error();
      setConfig(await response.json() as Config); setKey(""); setNotice("saved");
      window.dispatchEvent(new Event("herdr-translation-config"));
    } catch { setNotice("failed"); }
    finally { setBusy(false); }
  }
  return <section className="settings-section translation-settings">
    <h3>{t("Translation settings")}</h3>
    <div className="voice-group">
      <h4 className="voice-group-title">{t("Translation mode")}</h4>
      <div className="voice-group-body">
        <div className="settings-row"><div><span className="settings-label">{t("Translation mode")}</span><span className="settings-description">{t("Send in English · Read in Chinese")}</span></div>
          <button type="button" className="settings-toggle" role="switch" aria-label={t("Translation mode")} aria-checked={settings.translationMode} onClick={() => update({ translationMode: !settings.translationMode })}><span className="settings-toggle-thumb" /></button>
        </div>
      </div>
    </div>
    <div className="voice-group">
      <h4 className="voice-group-title">{t("Translation service")}</h4>
      <form className="voice-group-body" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {config && <fieldset disabled={busy} className="translation-fields">
          <label className="translation-field"><span>{t("API protocol")}</span><select className="input" value={config.protocol} onChange={(event) => setConfig({ ...config, protocol: event.target.value as Config["protocol"] })}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label>
          <label className="translation-field"><span>URL</span><input className="input" type="url" required value={config.base_url} onChange={(event) => setConfig({ ...config, base_url: event.target.value })} placeholder="https://api.example.com/v1" spellCheck={false} /></label>
          <label className="translation-field"><span>API Key</span><input className="input" type="password" value={key} required={!config.has_key} onChange={(event) => setKey(event.target.value)} placeholder={config.has_key ? t("Key configured; leave blank to keep") : "sk-…"} autoComplete="new-password" spellCheck={false} /></label>
          <label className="translation-field"><span>{t("Model ID")}</span><input className="input" required value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} spellCheck={false} /></label>
          <p className="settings-hint">{t("Use the API base URL. Changing the URL requires entering the key again.")}</p>
          <button type="submit" className="btn">{t("Save translation settings")}</button>
        </fieldset>}
        {notice && <p className="settings-hint" role="status">{notice === "saved" ? t("Translation settings saved") : t("Could not save or load translation settings. Check the URL, model and key.")}</p>}
      </form>
    </div>
  </section>;
}
