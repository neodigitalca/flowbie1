/**
 * Upload the one-time restore PHP and run import + URL rewrite on flowbie.ca.
 *
 * Usage: node wordpress-plugins/.deploy/clone-phoenix-to-flowbie-import.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
const phpSrc = join(import.meta.dirname, "phoenix-restore-once.php");
if (!flowbie || !existsSync(phpSrc)) {
  console.error("Missing flowbie catalog row or restore PHP");
  process.exit(1);
}

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};

const token = randomBytes(16).toString("hex");
const generated = join(import.meta.dirname, "phoenix-restore-once.generated.php");
writeFileSync(generated, readFileSync(phpSrc, "utf8").replace("PHOENIX_RESTORE_TOKEN", token), "utf8");

const sftp = new SftpClient();
await sftp.connect({
  host: flowbie.host,
  port: flowbie.port,
  username: flowbie.username,
  password: flowbie.password,
  readyTimeout: 45000,
  algorithms: ALGOS,
});
const remotePhp = `./wp-content/plugins/phoenix-restore-${token.slice(0, 12)}.php`;
try {
  await sftp.put(generated, remotePhp);
  console.log("uploaded restore PHP", remotePhp);
} finally {
  await sftp.end();
}

async function call(step) {
  const url = `https://flowbie.ca/wp-content/plugins/${remotePhp.split("/").pop()}?key=${token}&step=${step}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${step} non-JSON ${res.status} ${text.slice(0, 300)}`);
  }
  if (payload.error) {
    console.log("step error", step, payload.error, payload.lastStmt || "");
  }
  if (!res.ok && !payload.offset && payload.error) {
    throw new Error(`${step} failed ${res.status} ${payload.error} ${JSON.stringify(payload).slice(0, 400)}`);
  }
  return payload;
}

console.log("status before", await call("status"));

let importRounds = 0;
let lastOffset = -1;
let stuck = 0;
while (true) {
  const r = await call("import");
  importRounds += 1;
  const pct = r.size ? ((r.offset / r.size) * 100).toFixed(1) : "0";
  console.log(`import ${importRounds} ran=${r.ran} offset=${r.offset} ${pct}% done=${r.done}`);
  if (r.error) console.log("import error", r.error, r.lastStmt || "");
  if (r.done) break;
  if (r.offset === lastOffset) {
    stuck += 1;
    if (stuck >= 3) throw new Error(`import stuck at offset ${r.offset}: ${r.error || r.lastStmt || "no advance"}`);
  } else {
    stuck = 0;
    lastOffset = r.offset;
  }
  if (importRounds > 400) throw new Error("import exceeded 400 rounds");
}

let replaceRounds = 0;
while (true) {
  const r = await call("replace");
  replaceRounds += 1;
  console.log(
    `replace ${replaceRounds} pair=${r.pair || "final"} job=${r.pairs} min=${r.page} changed=${r.changed} scanned=${r.scanned} done=${r.done}`,
  );
  if (r.done) break;
  if (replaceRounds > 2500) throw new Error("replace exceeded 2500 rounds");
}

const after = await call("status");
console.log("status after", JSON.stringify(after.opts));
await call("cleanup");
console.log("cleanup done");

const home = await fetch("https://flowbie.ca/", { redirect: "follow" });
const html = await home.text();
console.log(
  JSON.stringify({
    homeStatus: home.status,
    finalUrl: home.url,
    title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "",
    hasPhoenix: /phoenix/i.test(html),
    hasFlowbieApp: /flowbie-app/i.test(html),
  }),
);
