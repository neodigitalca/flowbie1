import { readFileSync } from "fs";

const j = JSON.parse(
  readFileSync(
    "C:/Users/Sean Craig/.cursor/browser-logs/cdp-response-CSS.getMatchedStylesForNode-2026-08-31T17-36-28-032Z.json",
    "utf8",
  ),
);
const root = j.result || j;
const rules = root.matchedCSSRules || [];
const out = [];
for (const r of rules) {
  const rule = r.rule || r;
  const style = rule.style;
  if (!style || !style.cssProperties) continue;
  const disp = style.cssProperties.find((p) => p.name === "display");
  if (!disp) continue;
  out.push({
    matching: r.matchingSelectors,
    sel: rule.selectorList && rule.selectorList.text,
    display: disp.value,
    origin: rule.origin,
    sourceURL: (rule.styleSheetHeader && rule.styleSheetHeader.sourceURL) || rule.origin,
  });
}
console.log("matched", rules.length, "display", out.length);
for (const row of out) {
  if (row.display && /block|flex|inline/.test(row.display)) {
    console.log(JSON.stringify(row));
  }
}
