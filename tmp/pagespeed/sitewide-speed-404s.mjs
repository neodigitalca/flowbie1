/**
 * Site-wide guest + logged-in scan: neo-pulse-speed 404s and missing hashes only.
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

const DEAD = ["bc79f1542aa02f26e4a8b434c5c14bce", "df8c486568f4433810545ed91d3adc78"];

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
$logged = wp_generate_auth_cookie( (int) $admins[0]->ID, time() + 900, 'logged_in' );
echo wp_json_encode( array(
  'user' => $admins[0]->user_login,
  'cookies' => array( array( 'name' => LOGGED_IN_COOKIE, 'value' => $logged, 'domain' => '.neodigital.ca', 'path' => '/' ) ),
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
      kex: ["curve25519-sha256", "ecdh-sha2-nistp256", "diffie-hellman-group14-sha256", "diffie-hellman-group-exchange-sha256"],
    },
  });
  await sftp.put(Buffer.from(php, "utf8"), "./wp-content/plugins/neo-pulse-wp/nd-login-cookie-once.php");
  await sftp.end();
  return `https://neodigital.ca/wp-content/plugins/neo-pulse-wp/nd-login-cookie-once.php?key=${token}`;
}

async function inspectPage(page, url, label) {
  const bad = [];
  const onRes = (res) => {
    const u = res.url();
    if (u.includes("/cache/neo-pulse-speed/") && res.status() >= 400) bad.push(`${res.status()} ${u}`);
  };
  page.on("response", onRes);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 75_000 });
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 4000 }).catch(() => {});
  } catch (err) {
    console.log(label, "NAV", url, String(err).slice(0, 100));
    page.off("response", onRes);
    return true;
  }
  page.off("response", onRes);
  const html = await page.content();
  const dead = DEAD.filter((h) => html.includes(h));
  const info = await page.evaluate(() => ({
    admin: Boolean(document.getElementById("wpadminbar")),
    elementorPage: Boolean(document.body && document.body.className.includes("elementor-page")),
    elementorCss: [...document.querySelectorAll('link[rel="stylesheet"]')].filter((el) => el.href.includes("elementor")).length,
  }));
  const fail =
    bad.length > 0 ||
    dead.length > 0 ||
    (label === "logged-in" && !info.admin) ||
    (info.elementorPage && info.elementorCss < 1);
  console.log(
    label,
    fail ? "FAIL" : "OK",
    url,
    bad.length ? `404s=${bad.length}` : "",
    dead.length ? `dead=${dead.join(",")}` : "",
    info.elementorPage && info.elementorCss < 1 ? "no-elementor-css" : "",
    label === "logged-in" ? `admin=${info.admin}` : "",
  );
  for (const b of bad.slice(0, 4)) console.log("  404", b);
  return fail;
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
  await page.goto("https://neodigital.ca/", { waitUntil: "networkidle2", timeout: 90_000 });
  await page.screenshot({ path: "tmp/pagespeed/home-logged-in.png", fullPage: false });
} finally {
  await browser.close();
}
console.log("done failed_pages", failed);
process.exit(failed > 0 ? 1 : 0);
