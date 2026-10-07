import { useEffect, useRef, useState } from "react";
import { Code, Download, ExternalLink, Eye, Languages, X } from "lucide-react";

import "./FileViewer.css";
import { Markdown } from "./Markdown.tsx";
import { OpenFileContext } from "../lib/filePaths.ts";
import { DirectoryBrowser } from "./DirectoryBrowser.tsx";

import type { FileInfo } from "../../shared/protocol.ts";
import { ApiError } from "../lib/api.ts";
import { formatBytes } from "../lib/bridgeProgress.ts";
import { LOCAL_MACHINE } from "../../shared/machines.ts";
import { useMachineApi, useMachineId } from "../lib/machineContext.tsx";
import { translateDocument } from "../lib/translation.ts";
import { useT } from "../lib/i18n.ts";

/** Bigger images are offered as a download: a phone decodes an image whole. */
const MAX_INLINE_IMAGE_BYTES = 20 * 1024 * 1024;
/** Text shows its first part: the rest is a download away. */
const TEXT_PREVIEW_BYTES = 256 * 1024;

export interface FileViewerProps {
  /** absolute, `~/…`, or relative to the pane's folder */
  path: string;
  paneId: string | null;
  onClose: () => void;
  /** a file chosen in a folder's listing: opened as the preview, so history and a reload keep it */
  onOpen?: (path: string) => void;
}

/**
 * A file an agent wrote, opened in the browser: images, video and audio (streamed, so they
 * play and seek at once), PDFs, and the start of a text file. Anything can be downloaded.
 */
export function FileViewer({ path: asked, paneId, onClose, onOpen }: FileViewerProps) {
  const t = useT();
  const { fetchFileInfo, fileUrl, fetchDirectories } = useMachineApi();
  // a remote PC's bridge reads a relative folder from the pane's folder only from its next bundle
  // on; until then it would list the bridge's own folder, so only an absolute or ~/ one is listed there
  const machineId = useMachineId();
  const remote = machineId !== LOCAL_MACHINE;
  const [directory, setDirectory] = useState<string | null>(null);
  // the path as given, until a choice among files of that name replaces it
  const [path, setPath] = useState(asked);
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const translationRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    translationRequest.current?.abort();
    setTranslated(null); setShowTranslation(false); setTranslating(false); setTranslationError(false);
    return () => { translationRequest.current?.abort(); };
  }, [path, asked, paneId, machineId]);

  async function toggleTranslation() {
    if (translationRequest.current && translating) return;
    if (translated !== null) { setShowTranslation((value) => !value); return; }
    if (!text?.trim()) return;
    const controller = new AbortController();
    translationRequest.current = controller;
    setTranslating(true); setTranslationError(false);
    try {
      const result = await translateDocument(text, `file:${machineId}:${paneId ?? ""}`, controller.signal);
      if (!controller.signal.aborted) { setTranslated(result); setShowTranslation(true); }
    } catch {
      if (!controller.signal.aborted) setTranslationError(true);
    } finally {
      if (!controller.signal.aborted) setTranslating(false);
    }
  }
  const displayText = showTranslation && translated !== null ? translated : text;
  const isMarkdown = info?.kind === "text" && /\.(?:md|markdown|mdown|mkd)$/i.test(info.name);

  useEffect(() => setPath(asked), [asked]);

  useEffect(() => {
    let cancelled = false;
    setShowSource(false); setInfo(null); setCandidates(null); setError(null); setText(null); setDirectory(null);
    fetchFileInfo(path, paneId).then(async (next) => {
      if (cancelled) return;
      if ("candidates" in next) { setCandidates(next.candidates); return; }
      setInfo(next);
      if (next.kind !== "text") return;
      // only the first part of a text file travels: a range, whatever the file's size
      const response = await fetch(fileUrl(next.path, paneId), { headers: { range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } });
      const body = await response.text();
      if (!cancelled) setText(body);
    }).catch(async (reason: unknown) => {
      if (cancelled) return;
      // a folder is listed from the pane's folder, as a file is found from it
      if (reason instanceof ApiError && reason.status === 404 && (!remote || /^(?:\/|~(?:\/|$)|[A-Za-z]:[\\/])/.test(path))) {
        try {
          const listing = await fetchDirectories(path, false, true, paneId);
          if (!cancelled) setDirectory(listing.path);
          return;
        } catch { /* retain the file error when the target is not a readable directory */ }
      }
      if (cancelled) return;
      setError(reason instanceof ApiError && reason.status === 404 ? t("No readable file at this path.") : t("The file could not be opened."));
    });
    return () => { cancelled = true; };
  }, [path, paneId, fetchFileInfo, fileUrl, fetchDirectories, remote]);

  useEffect(() => {
    // the FilesDialog beneath listens on window too (and stands down while this is open); this
    // one is the topmost overlay, so it takes the key
    const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // the file found (a bare name may have been found deeper in the folder), else as asked
  const url = fileUrl(info?.path ?? path, paneId);
  const body = (() => {
    if (directory !== null) return <DirectoryBrowser key={directory} start={directory} onOpenFile={onOpen ?? setPath} />;
    if (error !== null) return <p className="file-viewer-note" role="alert">{error}</p>;
    if (candidates !== null) return <div className="file-viewer-choices">
      <p className="file-viewer-note">Several files are named {path.split("/").pop()}:</p>
      <ul>{candidates.map((candidate) => <li key={candidate}><button type="button" className="btn btn-ghost" onClick={() => setPath(candidate)}>{candidate}</button></li>)}</ul>
    </div>;
    if (info === null) return <p className="file-viewer-note">{t("Opening…")}</p>;
    switch (info.kind) {
      case "image":
        return info.size > MAX_INLINE_IMAGE_BYTES
          ? <p className="file-viewer-note">This image is {formatBytes(info.size)}; download it to view.</p>
          : <img className="file-viewer-media" src={url} alt={info.name} />;
      case "video":
        return <video className="file-viewer-media" src={url} controls playsInline preload="metadata" />;
      case "audio":
        return <audio className="file-viewer-audio" src={url} controls preload="metadata" />;
      case "pdf":
        return <iframe className="file-viewer-pdf" src={url} title={info.name} />;
      case "text":
        return text === null ? <p className="file-viewer-note">{t("Opening…")}</p> : <>
          {isMarkdown && !showSource ? <OpenFileContext.Provider value={(linked) => {
            const target = /^(?:\/|~\/|[A-Za-z]:[\\/])/.test(linked)
              ? linked : `${info.path.slice(0, info.path.lastIndexOf("/") + 1)}${linked}`;
            (onOpen ?? setPath)(target);
          }}><Markdown className="file-viewer-markdown">{displayText!}</Markdown></OpenFileContext.Provider>
            : <pre className="file-viewer-text">{displayText}</pre>}
          {info.size > TEXT_PREVIEW_BYTES && <p className="file-viewer-note">{t("Showing the first {shown} of {total}.", { shown: formatBytes(TEXT_PREVIEW_BYTES), total: formatBytes(info.size) })}</p>}
        </>;
      default:
        return <p className="file-viewer-note">{info.mime}, {formatBytes(info.size)}. This file can't be shown here; download it instead.</p>;
    }
  })();

  return (
    <div className="modal-scrim file-viewer-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal file-viewer" role="dialog" aria-modal="true" aria-label={info?.name ?? path}>
        <header className="modal-header file-viewer-header">
          <div className="file-viewer-title">
            <h2 className="modal-title">{info?.name ?? path.split("/").pop()}</h2>
            <p className="file-viewer-meta" title={info?.path ?? path}>
              {info && <span className="file-viewer-size">{formatBytes(info.size)}</span>}
              <span className="file-viewer-path"><span dir="ltr">{info?.path ?? path}</span></span>
            </p>
          </div>
          {info?.kind === "text" && <button type="button" className="icon-button file-viewer-translate"
            disabled={translating || !text?.trim()} aria-pressed={showTranslation} aria-busy={translating}
            aria-label={translating ? t("Translating…") : showTranslation ? t("Show original document") : t("Translate document to Chinese")}
            title={translating ? t("Translating…") : showTranslation ? t("Show original document") : t("Translate document to Chinese")}
            onClick={() => { void toggleTranslation(); }}><Languages aria-hidden="true" /></button>}
          {isMarkdown && <button type="button" className="icon-button" aria-pressed={showSource}
            aria-label={showSource ? t("Show rendered Markdown") : t("Show Markdown source")}
            title={showSource ? t("Show rendered Markdown") : t("Show Markdown source")}
            onClick={() => setShowSource((value) => !value)}>
            {showSource ? <Eye aria-hidden="true" /> : <Code aria-hidden="true" />}
          </button>}
          <a className="icon-button" href={url} target="_blank" rel="noopener" aria-label={t("Open in a new tab")} title={t("Open in a new tab")}><ExternalLink aria-hidden="true" /></a>
          <a className="icon-button" href={fileUrl(info?.path ?? path, paneId, true)} download={info?.name ?? true} aria-label={t("Download")} title={t("Download")}><Download aria-hidden="true" /></a>
          <button type="button" className="icon-button" aria-label={t("Close file")} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <div className="file-viewer-body">
          {translating && <p className="file-viewer-note" role="status">{t("Translating…")}</p>}
          {translationError && <p className="file-viewer-note" role="status">{t("Translation failed; original shown.")}</p>}
          {body}
        </div>
      </section>
    </div>
  );
}
