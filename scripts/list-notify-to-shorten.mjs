#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const MAX_LEN = 48;
const BANNED = [/try again/i, /please try/i, /please check/i, /from the response/i, /from the model/i];
const NOTIFY_DIR = join(process.cwd(), "src/lib/notify-messages");

function extractConstants(source, file) {
  const items = [];
  const re = /export const (NOTIFY_\w+) = "((?:[^"\\]|\\.)*)";/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    items.push({
      id: m[1],
      file,
      value: m[2].replace(/\\"/g, '"'),
    });
  }
  return items;
}

const files = (await readdir(NOTIFY_DIR)).filter((f) => f.endsWith(".ts") && f !== "index.ts");
const all = [];
for (const f of files) {
  all.push(...extractConstants(await readFile(join(NOTIFY_DIR, f), "utf8"), f));
}

const needsWork = all.filter(({ value }) => {
  if (value.length <= MAX_LEN && !BANNED.some((b) => b.test(value)) && !value.endsWith("...")) return false;
  return true;
});

await writeFile("docs/notify-to-shorten.json", JSON.stringify(needsWork, null, 2));
console.log(`Wrote ${needsWork.length} items to docs/notify-to-shorten.json`);
