import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { uploadNeodigitalPhp } from "./sftp-oneshot.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const php = readFileSync(join(dir, "oneshot-semrush-404-redirects.php"), "utf8");
const { url } = await uploadNeodigitalPhp(php, "oneshot-semrush-404-redirects");
const res = await fetch(url, { cache: "no-store" });
const text = await res.text();
console.log("status", res.status);
console.log(text);
if (!res.ok) {
  process.exit(1);
}
