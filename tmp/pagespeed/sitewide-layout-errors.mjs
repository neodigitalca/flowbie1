/**
 * Puppeteer every public neodigital.ca URL as guest and logged-in.
 * Fails on Speed CSS/JS 404s, Swiper/waypoint errors, or tall empty sections.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import SftpClient from "ssh2-sftp-client";
import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";
import { neodigitalCatalogRow } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

function loadUrls() {
  const report = JSON.parse(readFileSync(join(import.meta.dirname, "sitewide-repair.json"), "utf8"));
  const urls = Array.isArray(report.urls) ? report.urls.filter((u) => String(u).startsWith("https://neodigital.ca/")) : [];
  if (!urls.includes("https://neodigital.ca/")) urls.unshift("https://neodigital.ca/");
  return [...new Set(urls)];
}

async function mintLoggedInCookies() {
  const site = neodigitalCatalogRow();
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
$expiration = time() + 900;
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
  const bad = [];
  const errors = [];
  const onRes = (res) => {
    const u = res.url();
    if (u.includes("/cache/neo-pulse-speed/") && res.status() >= 400) {
      bad.push(`${res.status()} ${u}`);
    }
  };
  const onConsole = (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("Uncaught") || text.includes("is not defined") || text.includes("is not a function")) {
      errors.push(text.slice(0, 220));
    }
  };
  page.on("response", onRes);
  page.on("console", onConsole);
  page.on("pageerror", (err) => errors.push(String(err).slice(0, 220)));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 6_000 }).catch(() => {});
  } catch (err) {
    errors.push(`NAV ${String(err).slice(0, 120)}`);
  }
  page.off("response", onRes);
  page.off("console", onConsole);
  const report = await page.evaluate(() => {
    const admin = Boolean(document.getElementById("wpadminbar"));
    const speedCss = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((el) => el.href)
      .filter((h) => h.includes("/cache/neo-pulse-speed/"));
    const empty = [...document.querySelectorAll("section, .elementor-section, .e-con")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 480 && el.innerText.trim().length < 8;
    }).length;
    return {
      title: document.title,
      admin,
      empty,
      speedCss: speedCss.length,
      swiper: typeof window.Swiper,
      jq: typeof window.jQuery,
    };
  });
  const failReasons = [];
  if (bad.length) failReasons.push(`speed404=${bad.length}`);
  if (label === "logged-in" && !report.admin) failReasons.push("no-admin-bar");
  if (report.empty > 2) failReasons.push(`emptySections=${report.empty}`);
  const fatal = errors.filter((e) => e.includes("Swiper") || e.includes("waypoint") || e.includes("speed404") || e.includes("NAV"));
  if (fatal.length) failReasons.push(`js=${fatal.length}`);
  console.log(label, failReasons.length ? "FAIL" : "OK", url, report.title, failReasons.join(",") || `empty=${report.empty}`);
  for (const b of bad.slice(0, 6)) console.log("  404", b);
  for (const e of errors.slice(0, 6)) console.log("  ERR", e);
  return failReasons.length > 0;
}

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const urls = loadUrls();
console.log("pages", urls.length);

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});

let failed = 0;
try {
  console.log("=== guest ===");
  for (const url of urls) {
    if (await inspectPage(page, url, "guest")) failed += 1;
  }

  console.log("=== logged-in ===");
  const cookieUrl = await mintLoggedInCookies();
  await page.goto(cookieUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const raw = await page.evaluate(() => (document.body ? document.body.innerText : ""));
  let minted;
  try {
    minted = JSON.parse(raw);
  } catch {
    console.log("cookie mint failed", raw.slice(0, 240));
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
      })),
    );
    console.log("logged in as", minted.user);
    for (const url of urls) {
      if (await inspectPage(page, url, "logged-in")) failed += 1;
    }
  }
} finally {
  await browser.close();
}

console.log("done failed_pages", failed, "of", urls.length * 2);
process.exit(failed > 0 ? 1 : 0);
