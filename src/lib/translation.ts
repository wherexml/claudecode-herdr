import type { TranslationRequest, TranslationResponse } from "../../shared/protocol.ts";

export async function translateText(text: string, target: TranslationRequest["target"], session: string, signal?: AbortSignal): Promise<string> {
  const body: TranslationRequest = { text, target, session };
  const response = await fetch("/api/translation", { method: "POST", headers: { "content-type": "application/json", "x-herdr-translation": "1" }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(95_000)]) : AbortSignal.timeout(95_000) });
  const result = await response.json() as TranslationResponse & { error?: { code: string; message: string } };
  if (!response.ok || typeof result.text !== "string" || !result.text.trim()) throw new Error(result.error?.code ?? "translation_unavailable");
  return result.text;
}

/** Translate a document sequentially within the API limit; fenced code stays byte-for-byte. */
export async function translateDocument(text: string, session: string, signal: AbortSignal): Promise<string> {
  const sections = text.split(/(^ {0,3}(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}(?:`{3,}|~{3,})[^\n]*(?:\n|$))/gm);
  const result: string[] = [];
  for (const section of sections) {
    signal.throwIfAborted();
    if (!section.trim() || /^ {0,3}(?:`{3,}|~{3,})/.test(section)) { result.push(section); continue; }
    let rest = section;
    while (rest.length) {
      let end = Math.min(rest.length, 18000);
      if (end < rest.length) {
        const paragraph = rest.lastIndexOf("\n\n", end);
        const line = rest.lastIndexOf("\n", end);
        if (paragraph > 0) end = paragraph + 2;
        else if (line > 0) end = line + 1;
        else if (/[\uD800-\uDBFF]/.test(rest[end - 1]!)) end--;
      }
      const chunk = rest.slice(0, end);
      const leading = chunk.match(/^\s*/)?.[0] ?? "";
      const trailing = chunk.match(/\s*$/)?.[0] ?? "";
      result.push(chunk.trim() ? leading + (await translateText(chunk.trim(), "zh-CN", session, signal)).trim() + trailing : chunk);
      rest = rest.slice(end);
    }
  }
  return result.join("");
}
