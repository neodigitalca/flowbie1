#!/usr/bin/env node
/**
 * Post-deploy smoke checks for flowbie.ca headless deploy.
 */

const BASE = (process.env.FLOWBIE_CA_BASE || "https://flowbie.ca").replace(/\/+$/, "");

/** @type {{ name: string, url: string, method?: string, expectStatus?: number | number[], expectJson?: (data: unknown) => boolean }[]} */
const CHECKS = [
  { name: "SPA index", url: `${BASE}/flowbie/`, expectStatus: 200 },
  {
    name: "Manager cloud settings status",
    url: `${BASE}/api/manager-cloud-settings/status`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null && /** @type {{ supabaseConfigured?: boolean }} */ (d).supabaseConfigured === true,
  },
  {
    name: "GSC service account email",
    url: `${BASE}/api/gsc/service-account-email`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null && "email" in /** @type {object} */ (d),
  },
  {
    name: "GMB config status",
    url: `${BASE}/api/gmb/config-status`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null,
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
    name: "Grid local maps SERP batch",
    url: `${BASE}/api/grid-local/maps-serp-batch`,
    method: "POST",
    expectStatus: [400, 502],
    expectJson: (d) => typeof d === "object" && d !== null,
  },
  {
    name: "Maps exec probe",
    url: `${BASE}/api/diagnostics/maps-exec`,
    expectStatus: 200,
    expectJson: (d) => typeof d === "object" && d !== null && "execAllowed" in /** @type {object} */ (d),
  },
];

async function runCheck(check) {
  const method = check.method || "GET";
  const res = await fetch(check.url, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({}) : undefined,
  });
  const allowed = Array.isArray(check.expectStatus)
    ? check.expectStatus
    : [check.expectStatus ?? 200];
  if (!allowed.includes(res.status)) {
    throw new Error(`expected HTTP ${allowed.join("|")}, got ${res.status}`);
  }
  if (check.expectJson) {
    const data = await res.json();
    if (!check.expectJson(data)) {
      throw new Error("JSON body failed assertion");
    }
  }
}

async function main() {
  console.log("Flowbie.ca smoke:", BASE);
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
