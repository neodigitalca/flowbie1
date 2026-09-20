import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNeodigitalPhp } from "./sftp-oneshot.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const php = readFileSync(join(dir, "oneshot-inspect-personas.php"), "utf8");
const data = await runNeodigitalPhp(php, "nd-inspect-personas");
console.log(JSON.stringify(data, null, 2));
