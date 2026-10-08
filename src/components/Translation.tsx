import { useEffect, useRef, useState } from "react";
import { Languages, Smile, Frown, Icon } from "lucide-react";
import { pacificTime } from "../lib/pacificTime.ts";
import { useSettings } from "../lib/settings.ts";
import { useT } from "../lib/i18n.ts";
import { translateText } from "../lib/translation.ts";
import { Markdown } from "./Markdown.tsx";
import "./Translation.css";

function PacificClock() {
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { clearTimeout(timer); setNow(new Date()); timer = setTimeout(tick, 60_000 - Date.now() % 60_000); };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  const { time, mood } = pacificTime(now);
  return <span className="pacific-clock" data-mood={mood} title={t("Pacific schedule: red 01–06; yellow 06–08 and 19–01; green otherwise")}
    aria-label={`${t("Pacific time")} ${time} · ${mood === "red" ? t("Scared") : mood === "yellow" ? t("Frowning") : t("Smiling")}`}>
    {mood === "green" ? <Smile aria-hidden="true" /> : mood === "yellow" ? <Frown aria-hidden="true" /> :
      <Icon aria-hidden="true" iconNode={[
        ["circle", { cx: 12, cy: 12, r: 10, key: "face" }],
        ["circle", { cx: 8.5, cy: 10, r: 1, key: "left-eye" }],
        ["circle", { cx: 15.5, cy: 10, r: 1, key: "right-eye" }],
        ["path", { d: "M6.5 7 9 6M15 6l2.5 1", key: "brows" }],
        ["ellipse", { cx: 12, cy: 16, rx: 2, ry: 2.5, key: "mouth" }],
      ]} />}
    <span>{t("Pacific time")} <time dateTime={now.toISOString()}>{time}</time></span>
  </span>;
}

export function TranslationToggle() {
  const { settings, update } = useSettings();
  const t = useT();
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void fetch("/api/translation", { signal: controller.signal }).then(async (r) => r.ok && (await r.json()).configured === true).then(setConfigured).catch(() => { if (!controller.signal.aborted) setConfigured(false); });
    };
    refresh();
    window.addEventListener("herdr-translation-config", refresh);
    return () => { controller.abort(); window.removeEventListener("herdr-translation-config", refresh); };
  }, []);
  return <div className="translation-controls">
    <span className="translation-mode-control">
    <button type="button" className="translation-toggle" role="switch" aria-checked={settings.translationMode}
      aria-description={t("Send in English · Read in Chinese")}
      title={t("Send in English · Read in Chinese")}
      disabled={!settings.translationMode && configured !== true}
      onClick={() => update({ translationMode: !settings.translationMode })}>
      <Languages aria-hidden="true" /><span>{t("Translation mode")}</span>
      <span className="translation-switch" aria-hidden="true" />
    </button>
    <span className="translation-tooltip" role="tooltip">{t("Send in English · Read in Chinese")}</span>
    </span>
    <PacificClock />
    {configured === false && <span className="translation-hint" role="status">{t("Configure translation on the server")}</span>}
  </div>;
}

/** Only finished, visible prose is translated; the transcript and tools remain authoritative. */
export function TranslatedAnswer({ text, ready, session }: { text: string; ready: boolean; session: string }) {
  const { settings } = useSettings();
  const t = useT();
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ source: string; session: string; text: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); } });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!settings.translationMode || !ready || !visible || !text.trim()) return;
    const controller = new AbortController();
    setBusy(true); setFailed(false);
    void translateText(text, "zh-CN", session, controller.signal).then((translated) => {
      if (!controller.signal.aborted) setResult({ source: text, session, text: translated });
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [text, session, ready, visible, settings.translationMode, retry]);
  const translated = settings.translationMode && ready && result?.source === text && result.session === session ? result.text : null;
  return <div ref={element} className="translated-answer">
    <Markdown>{translated ?? text}</Markdown>
    {settings.translationMode && ready && <div className="translation-answer-status" role="status">
      {busy ? t("Translating…") : failed ? <>{t("Translation failed; original shown.")} <button type="button" className="chat-meta-btn" onClick={() => setRetry((n) => n + 1)}>{t("Retry translation")}</button></> : translated !== null ? t("Chinese translation") : null}
    </div>}
    {translated !== null && <details className="translation-original"><summary>{t("Show original")}</summary><Markdown>{text}</Markdown></details>}
  </div>;
}
