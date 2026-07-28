#!/usr/bin/env python3
"""Rebuild class-flowbie-wp-overseer.php from agent transcript Write/StrReplace history."""

import json
from pathlib import Path

TARGET = "class-flowbie-wp-overseer.php"
ROOT = Path(__file__).resolve().parents[3] / ".cursor/projects/b-USE-THIS/agent-transcripts"
if not ROOT.exists():
    ROOT = Path(r"C:\Users\Sean Craig\.cursor\projects\b-USE-THIS\agent-transcripts")

OUT = Path(__file__).resolve().parents[1] / "tools/overseer-monolith-source.php"
START = OUT if OUT.is_file() else Path(__file__).resolve().parents[1] / "includes/class-flowbie-wp-overseer.monolith-recovery.php"


def main() -> None:
    content = START.read_text(encoding="utf-8")
    events: list[tuple] = []
    for p in sorted(ROOT.rglob("*.jsonl")):
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = o.get("timestamp") or 0
            msg = o.get("message") or {}
            for part in msg.get("content") or []:
                if part.get("type") != "tool_use":
                    continue
                name = part.get("name", "")
                inp = part.get("input") or {}
                path = str(inp.get("path", "")).replace("\\", "/").lower()
                if not path.endswith(TARGET):
                    continue
                if name in ("Write", "write"):
                    events.append((ts, "write", inp.get("contents", ""), p.name))
                elif name in ("StrReplace", "search_replace"):
                    events.append((ts, "patch", inp, p.name))

    events.sort(key=lambda x: str(x[0]))
    applied = failed = 0
    for _ts, kind, data, _src in events:
        if kind == "write":
            if len(data) > len(content):
                content = data
                applied += 1
        else:
            old = data.get("old_string") or data.get("oldString") or ""
            new = data.get("new_string", data.get("newString"))
            if new is None:
                new = ""
            if old and old in content:
                content = content.replace(old, new, 1)
                applied += 1
            elif old:
                failed += 1

    OUT.write_text(content, encoding="utf-8")
    lines = content.count("\n") + 1
    print(f"applied={applied} failed={failed} lines={lines}")
    print("aggregate_summary:", "aggregate_summary" in content)
    print("TABLE_VERSION 2.2:", "TABLE_VERSION            = '2.2'" in content)


if __name__ == "__main__":
    main()
