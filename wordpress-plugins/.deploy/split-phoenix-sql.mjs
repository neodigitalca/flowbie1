/**
 * Split giant INSERT rows so WP Engine PHP can import in small statements.
 */
import { createReadStream, createWriteStream } from "fs";
import { createInterface } from "readline";
import { createGzip } from "zlib";
import { join } from "path";

const src = join(
  process.env.USERPROFILE || "C:/Users/Sean Craig",
  "wp-local",
  "phoenix-to-flowbie",
  "wp-content",
  "mysql.sql",
);
const dest = src.replace(/mysql\.sql$/, "mysql.split.sql");
const gz = dest + ".gz";
const ROWS = 25;

const out = createWriteStream(dest);
const rl = createInterface({ input: createReadStream(src), crlfDelay: Infinity });
let inserts = 0;
let statements = 0;

function write(s) {
  statements += 1;
  return new Promise((resolve, reject) => {
    if (out.write(s)) resolve();
    else out.once("drain", resolve);
    out.once("error", reject);
  });
}

for await (const line of rl) {
  const trimmed = line.trim();
  if (trimmed.startsWith("INSERT INTO") && trimmed.includes("),(")) {
    const prefixEnd = trimmed.indexOf("VALUES");
    if (prefixEnd === -1) {
      await write(line + "\n");
      continue;
    }
    const prefix = trimmed.slice(0, prefixEnd + 6);
    let values = trimmed.slice(prefixEnd + 6).trim();
    if (values.endsWith(";")) values = values.slice(0, -1);
    const rows = [];
    let buf = "";
    let depth = 0;
    let quote = "";
    let esc = false;
    for (let i = 0; i < values.length; i++) {
      const ch = values[i];
      buf += ch;
      if (quote) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        const row = buf.slice(0, -1).trim();
        if (row) rows.push(row);
        buf = "";
      }
    }
    const last = buf.trim();
    if (last) rows.push(last);
    for (let i = 0; i < rows.length; i += ROWS) {
      const chunk = rows.slice(i, i + ROWS);
      await write(`${prefix} ${chunk.join(",")};\n`);
      inserts += 1;
    }
  } else {
    await write(line + "\n");
  }
}

await new Promise((resolve) => out.end(resolve));
const gzip = createGzip({ level: 9 });
const input = createReadStream(dest);
const output = createWriteStream(gz);
input.pipe(gzip).pipe(output);
await new Promise((resolve, reject) => {
  output.on("finish", resolve);
  output.on("error", reject);
});
console.log(JSON.stringify({ dest, gz, inserts, statements }));
