import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";
import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

const pages = [
  "https://neodigital.ca/",
  "https://neodigital.ca/elementor-help/",
  "https://neodigital.ca/about/",
];

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../wordpress-plugins/.deploy/wpengine-sftp-catalog.json"), "utf8"),
);
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);

async function mintLoggedInCookies() {
  const token = randomBytes(16).toString("hex");
  const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! isset( $admins[0] ) ) { http_response_code(500); exit('{"error":"no admin"}'); }
$uid = (int) $admins[0]->ID;
$expiration = time() + 600;
$logged = wp_generate_auth_cookie( $uid, $expiration, 'logged_in' );
$domain = defined( 'COOKIE_DOMAIN' ) && COOKIE_DOMAIN ? COOKIE_DOMAIN : '.neodigital.ca';
$path = defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/';
echo wp_json_encode( array(
  'user' => $admins[0]->user_login,
  'cookies' => array(
    array( 'name' => LOGGED_IN_COOKIE, 'value' => $logged, 'domain' => $domain, 'path' => $path ),
  ),
) );
@unlink( __FILE__ );
`;
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 45000,
    algorithms: {
      serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
      kex: [
        "curve25519-sha256",
        "ecdh-sha2-nistp256",
        "diffie-hellman-group14-sha256",
        "diffie-hellman-group-exchange-sha256",
      ],
    },
  });
  await sftp.put(Buffer.from(php, "utf8"), "./wp-content/plugins/neo-pulse-wp/nd-login-cookie-once.php");
  await sftp.end();
  return `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-login-cookie-once.php?key=${token}`;
}

async function inspectPage(page, url, label) {
  const errors = [];
  const onError = (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("Uncaught") || text.includes("SyntaxError")) {
      errors.push(text.slice(0, 240));
    }
  };
  page.on("console", onError);
  page.on("pageerror", (err) => errors.push(String(err).slice(0, 240)));
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
  } catch (err) {
    console.log("NAV", label, url, String(err).slice(0, 120));
  }
  page.off("console", onError);
  const report = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll("script[src]")].map((el) => el.src);
    const speedJs = scripts.filter((s) => s.includes("/cache/neo-pulse-speed/"));
    const admin = Boolean(document.getElementById("wpadminbar"));
    const bodyH = document.body ? document.body.scrollHeight : 0;
    const empty = [...document.querySelectorAll("section, .elementor-section, .e-con")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 400 && el.innerText.trim().length < 8;
    }).length;
    return {
      title: document.title,
      admin,
      bodyH,
      empty,
      speedJs: speedJs.length,
      speedSample: speedJs.slice(0, 4),
      swiper: typeof window.Swiper,
      jq: typeof window.jQuery,
    };
  });
  console.log("PAGE", label, url, report.title);
  console.log("  admin", report.admin, "jQuery", report.jq, "Swiper", report.swiper, "bodyH", report.bodyH, "emptySections", report.empty, "speedJs", report.speedJs);
  for (const e of errors.slice(0, 10)) {
    console.log("  ERR", e);
  }
  for (const s of report.speedSample) {
    console.log("  JS", s);
  }
  return { errors, report };
}

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});

let failed = 0;
try {
  console.log("=== guest ===");
  for (const url of pages) {
    const { errors, report } = await inspectPage(page, url, "guest");
    if (errors.length || report.jq !== "function" || report.empty > 2) failed += 1;
  }

  console.log("=== logged-in ===");
  const cookieUrl = await mintLoggedInCookies();
  await page.goto(cookieUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const raw = await page.evaluate(() => (document.body ? document.body.innerText : ""));
  let minted;
  try {
    minted = JSON.parse(raw);
  } catch {
    console.log("cookie mint failed", raw.slice(0, 200));
    failed += 1;
    minted = null;
  }
  if (minted?.cookies) {
    await page.setCookie(
      ...minted.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: String(c.domain || ".neodigital.ca").replace(/^\./, ""),
        path: c.path || "/",
      }))
    );
    console.log("logged in as", minted.user);
    for (const url of pages) {
      const { errors, report } = await inspectPage(page, url, "logged-in");
      if (!report.admin) failed += 1;
      if (errors.length || report.jq !== "function" || report.speedJs > 0) failed += 1;
    }
  }
} finally {
  await browser.close();
}

process.exit(failed > 0 ? 1 : 0);
