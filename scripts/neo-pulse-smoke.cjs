#!/usr/bin/env node
/**
 * Post-deploy smoke checks for neodigital.ca headless deploy.
 */

const BASE = (process.env.NEO_PULSE_CA_BASE || "https://neodigital.ca").replace(/\/+$/, "");

/** @type {{ name: string, url: string, method?: string, expectStatus?: number | number[], expectJson?: (data: unknown) => boolean, expectRedirectLocation?: RegExp, expectBodyIncludes?: string[], expectBodyMatches?: RegExp }[]} */
const CHECKS = [
  { name: "SPA index", url: `${BASE}/app/`, expectStatus: 200 },
  {
    name: "Mobile entry auto-version stamp",
    url: `${BASE}/mobile/?_=${Date.now()}`,
    expectStatus: [200, 302],
    expectRedirectLocation: /^https:\/\/neodigital\.ca\/mobile\/\?v=\d+$/,
    expectBodyIncludes: ["function go(v)", "build-info.json"],
    expectBodyMatches: /embedded="\d{10,}"/,
  },
  {
    name: "Manager cloud settings status",
    url: `${BASE}/api/manager-cloud-settings/status`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null && /** @type {{ workspaceConfigured?: boolean }} */ (d).workspaceConfigured === true,
  },
  {
    name: "GSC service account email",
    url: `${BASE}/api/gsc/service-account-email`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null && "email" in /** @type {object} */ (d),
  },
  {
    name: "GMB config status",
    url: `${BASE}/api/gmb/config-status?_=${Date.now()}`,
    expectStatus: 200,
    expectJson: (d) =>
      typeof d === "object" &&
      d !== null &&
      typeof /** @type {{ redirectUri?: string, frontendUrl?: string }} */ (d).redirectUri === "string" &&
      /** @type {{ redirectUri?: string }} */ (d).redirectUri.includes("neodigital.ca") &&
      typeof /** @type {{ frontendUrl?: string }} */ (d).frontendUrl === "string" &&
      /** @type {{ frontendUrl?: string }} */ (d).frontendUrl.includes("neodigital.ca"),
  },
  {
    name: "GA credentials status",
    url: `${BASE}/api/ga/credentials-status`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null,
  },
  {
    name: "Vertical benchmarks taxonomy",
    url: `${BASE}/api/vertical-benchmarks/taxonomy`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null,
  },
  {
    name: "WordPress properties mirror",
    url: `${BASE}/api/manager-wordpress-properties/load`,
    expectStatus: 200,
    expectJson: (d) =>
      typeof d === "object" &&
      d !== null &&
      /** @type {{ ok?: boolean, sites?: unknown[] }} */ (d).ok === true &&
      Array.isArray(/** @type {{ sites?: unknown[] }} */ (d).sites) &&
      /** @type {{ sites?: unknown[] }} */ (d).sites.length >= 1,
  },
  {
    name: "Entity maps image validation",
    url: `${BASE}/api/entity-maps-image/generate`,
    method: "POST",
    expectStatus: 200,
    expectJson: (d) =>
      typeof d === "object" &&
      d !== null &&
      /** @type {{ success?: boolean }} */ (d).success === false,
  },
];

async function runCheck(check) {
  const method = check.method || "GET";
  const res = await fetch(check.url, {
    method,
    redirect: check.expectRedirectLocation ? "manual" : "follow",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({}) : undefined,
  });
  const allowed = Array.isArray(check.expectStatus)
    ? check.expectStatus
    : [check.expectStatus ?? 200];
  if (!allowed.includes(res.status)) {
    throw new Error(`expected HTTP ${allowed.join("|")}, got ${res.status}`);
  }
  if (check.expectRedirectLocation && res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") ?? "";
    if (!check.expectRedirectLocation.test(location)) {
      throw new Error(`unexpected Location header: ${location || "(missing)"}`);
    }
    return;
  }
  const needsBody = Boolean(check.expectBodyIncludes || check.expectBodyMatches || check.expectJson);
  const bodyText = needsBody ? await res.text() : "";
  if (check.expectBodyIncludes) {
    for (const needle of check.expectBodyIncludes) {
      if (!bodyText.includes(needle)) {
        throw new Error(`response body missing: ${needle}`);
      }
    }
  }
  if (check.expectBodyMatches && !check.expectBodyMatches.test(bodyText)) {
    throw new Error("response body failed version stamp pattern");
  }
  if (check.expectJson) {
    const data = JSON.parse(bodyText || "{}");
    if (!check.expectJson(data)) {
      throw new Error("JSON body failed assertion");
    }
  }
}

async function main() {
  console.log("NEO Pulse.ca smoke:", BASE);
  let failed = 0;
  for (const check of CHECKS) {
    process.stdout.write(`  ${check.name} ... `);
    try {
      await runCheck(check);
      console.log("ok");
    } catch (err) {
      failed += 1;
      console.log("FAIL");
      console.error(`    ${err.message}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
