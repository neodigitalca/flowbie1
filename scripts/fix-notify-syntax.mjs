#!/usr/bin/env node
/** Fix broken notify migration syntax: helper param names and missing closing parens. */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

function sanitizeParamName(raw) {
  const e = raw.replace(/:\s*string\s*\|\s*number\s*$/, "").trim();
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(e)) return e;
  const parts = e.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "value";
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("")
    .slice(0, 40) || "value";
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      files.push(...(await walk(p)));
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
  }
  return files;
}

function fixHelperSignatures(text) {
  return text.replace(
    /export function (notify[A-Za-z0-9_]+)\(([^)]*)\): string \{\n  return `([^`]*)`;\n\}/g,
    (_full, fnName, paramsRaw, body) => {
      const rawParams = paramsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (rawParams.length === 0) return _full;
      const mappings = [];
      const newParams = [];
      for (const p of rawParams) {
        const rawName = p.replace(/:\s*string\s*\|\s*number\s*$/, "").trim();
        const safe = sanitizeParamName(rawName);
        let finalName = safe;
        let n = 2;
        while (newParams.some((x) => x.startsWith(`${finalName}:`))) finalName = `${safe}${n++}`;
        mappings.push({ raw: rawName, safe: finalName });
        newParams.push(`${finalName}: string | number`);
      }
      let newBody = body;
      for (const { raw, safe } of mappings) {
        if (raw !== safe) newBody = newBody.split(`\${${raw}}`).join(`\${${safe}}`);
      }
      return `export function ${fnName}(${newParams.join(", ")}): string {\n  return \`${newBody}\`;\n}`;
    }
  );
}

function fixCallSites(text) {
  return text
    .split("\n")
    .map((line) => {
      if (!line.includes("notify.") || !line.includes("(notify")) return line;
      const trimmed = line.trimEnd();
      if (trimmed.endsWith("));")) return line;
      if (/notify\.(success|error|info|warning|loading|message)\(notify/.test(line) && trimmed.endsWith(");")) {
        return line.replace(/\);(\s*)$/, "));$1");
      }
      return line;
    })
    .join("\n");
}

// Fix notify-messages modules
const notifyDir = join(ROOT, "src/lib/notify-messages");
const modFiles = (await readdir(notifyDir)).filter((f) => f.endsWith(".ts"));
for (const f of modFiles) {
  const path = join(notifyDir, f);
  let text = await readFile(path, "utf8");
  const fixed = fixHelperSignatures(text);
  if (fixed !== text) {
    await writeFile(path, fixed);
    console.log("Fixed signatures:", f);
  }
}

// Fix call sites
const files = await walk(join(ROOT, "src"));
let callFixes = 0;
for (const file of files) {
  if (file.includes("notify-messages")) continue;
  const text = await readFile(file, "utf8");
  const fixed = fixCallSites(text);
  if (fixed !== text) {
    await writeFile(file, fixed);
    callFixes++;
  }
}
console.log(`Fixed call sites in ${callFixes} files`);
