#!/usr/bin/env python3
"""Run as statusLine.command with the original command as the sole argument.
Failure modes: malformed/missing input, invalid session, missing fields, full disk,
original command failure, concurrent writers. Capture failure must not alter stdout.
Only allowlisted metrics are persisted; no prompt, transcript or credentials.
"""
import json, os, pathlib, re, subprocess, sys, tempfile, time
raw = sys.stdin.buffer.read()
try:
    data = json.loads(raw)
    session = data.get("session_id", "")
    transcript = pathlib.Path(data["transcript_path"])
    if not re.fullmatch(r"[a-zA-Z0-9-]+", session) or transcript.stem != session:
        raise ValueError("invalid session")
    config = transcript.parent.parent.parent
    if transcript.parent.parent.name != "projects":
        raise ValueError("unexpected transcript location")
    metrics = {"session_id": session, "updated_at": int(time.time()*1000)}
    model = data.get("model") or {}
    metrics["model"] = model.get("display_name") or model.get("id")
    metrics["context_percent"] = (data.get("context_window") or {}).get("used_percentage")
    metrics["cost_usd"] = (data.get("cost") or {}).get("total_cost_usd")
    for key in ("five_hour", "seven_day"):
        value = (data.get("rate_limits") or {}).get(key)
        if isinstance(value, dict):
            metrics[key] = {k: value.get(k) for k in ("used_percentage", "resets_at")}
    folder = config / "herdr-statusline"
    folder.mkdir(mode=0o700, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=folder, prefix=".status-")
    try:
        with os.fdopen(fd, "w") as out:
            json.dump(metrics, out, allow_nan=False)
        os.replace(temp, folder / (session + ".json"))
    finally:
        if os.path.exists(temp): os.unlink(temp)
except Exception:
    pass
if len(sys.argv) > 1:
    sys.exit(subprocess.run(sys.argv[1], shell=True, input=raw).returncode)
