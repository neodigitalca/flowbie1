import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNeodigitalPhp } from "./sftp-oneshot.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const php = readFileSync(join(dir, "oneshot-head-term-redirects.php"), "utf8");
const data = await runNeodigitalPhp(php, "nd-head-term-redirects");
console.log(JSON.stringify(data, null, 2));
if (!data.ok) process.exit(1);
