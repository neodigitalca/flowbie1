import json
import re
from pathlib import Path

ROOT = Path(r"C:\Users\Sean Craig\.cursor\projects\b-USE-THIS\agent-tools")


def walk_elementor(data, findings):
    if isinstance(data, dict):
        wt = data.get("widgetType", "")
        settings = data.get("settings", {})
        if wt == "icon-list":
            items = settings.get("icon_list", [])
            row = {"widget": "icon-list", "items": []}
            for item in items:
                dyn = {k: v for k, v in item.items() if str(k).startswith("__dynamic__")}
                row["items"].append(
                    {
                        "text": item.get("text", ""),
                        "link": (item.get("link") or {}).get("url", ""),
                        "dynamic": dyn,
                    }
                )
            findings.append(row)
        if wt == "image":
            dyn = settings.get("__dynamic__")
            if dyn:
                findings.append({"widget": "image", "dynamic": dyn})
        for v in data.values():
            walk_elementor(v, findings)
    elif isinstance(data, list):
        for v in data:
            walk_elementor(v, findings)


for name in ["heritage-header-11434.json", "heritage-footer-11314.json", "heritage-header-81.json"]:
    path = ROOT / name
    if not path.exists():
        continue
    doc = json.loads(path.read_text(encoding="utf-8"))
    findings = []
    walk_elementor(json.loads(doc["meta"]["_elementor_data"]), findings)
    print(f"\n=== {name} conditions={doc['meta'].get('_elementor_conditions')} ===")
    print(json.dumps(findings, indent=2)[:5000])

html = (ROOT / "heritage-home.html").read_text(encoding="utf-8", errors="ignore")
print("\n=== LIVE ICON LIST ===")
for chunk in re.findall(r"elementor-icon-list-item[\s\S]{0,700}?</li>", html):
    if re.search(r"call|email|direction", chunk, re.I):
        text = re.search(r"elementor-icon-list-text[^>]*>([^<]+)", chunk)
        href = re.search(r'href="([^"]*)"', chunk)
        print("-", (text.group(1).strip() if text else "?"), "|", (href.group(1)[:120] if href else "NO HREF"))

print("\n=== LIVE IMAGES (header area) ===")
for m in re.finditer(r'<img[^>]+src="([^"]+)"[^>]*>', html):
    src = m.group(1)
    if any(x in src.lower() for x in ["logo", "placeholder", "heritage", "uploads/202"]):
        print(src[:150])

# search for elementor-tag in raw html (broken dynamic render)
if "elementor-tag" in html:
    print("\nWARNING: raw elementor-tag shortcodes in HTML")
if "LIST ITEM" in html:
    print("\nWARNING: LIST ITEM placeholder text in HTML")
