#!/usr/bin/env node
/** Fix invalid param names in notify-messages helper functions. */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const dir = join(ROOT, "src/lib/notify-messages");

function sanitizeParam(expr) {
  const e = expr.trim();
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(e)) return e;
  const parts = e.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "value";
  const camel = parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
  return camel.slice(0, 40) || "value";
}

function fixFile(text) {
  const fnRe = /export function (notify[A-Za-z0-9_]+)\(([^)]*)\): string \{\n  return `([^`]*)`;\n\}/g;
  return text.replace(fnRe, (_full, fnName, paramsRaw, body) => {
    const rawParams = paramsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (rawParams.length === 0) return _full;

    const mappings = [];
    const newParams = [];
    for (const p of rawParams) {
      const nameMatch = p.match(/^(.+?):\s*string \| number$/);
      const rawName = nameMatch ? nameMatch[1].trim() : p.replace(/:\s*string \| number$/, "").trim();
      const safe = sanitizeParam(rawName);
      let finalName = safe;
      let n = 2;
      while (newParams.some((x) => x.startsWith(finalName + ":"))) {
        finalName = `${safe}${n++}`;
      }
      mappings.push({ raw: rawName, safe: finalName });
      newParams.push(`${finalName}: string | number`);
    }

    let newBody = body;
    for (const { raw, safe } of mappings) {
      if (raw === safe) continue;
      newBody = newBody.split(`\${${raw}}`).join(`\${${safe}}`);
    }

    return `export function ${fnName}(${newParams.join(", ")}): string {\n  return \`${newBody}\`;\n}`;
  });
}

const files = (await readdir(dir)).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "core-helpers.ts");
for (const f of files) {
  const path = join(dir, f);
  const text = await readFile(path, "utf8");
  const fixed = fixFile(text);
  if (fixed !== text) {
    await writeFile(path, fixed);
    console.log("Fixed", f);
  }
}
