/**
 * Reproduce: open workflow 7, click insert + after Schedule, pick GSC MoM agent.
 */
import fs from "node:fs";
import puppeteer from "puppeteer";

const APP_BASE = process.env.VERIFY_APP_BASE ?? "http://localhost:8080";
const loginPath = ".cursor-tmp-login.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login() {
  const { email, password } = JSON.parse(fs.readFileSync(loginPath, "utf8"));
  const res = await fetch(`${APP_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, email, password }),
  });
  const data = await res.json();
  if (!data.ok || !data.sessionToken) throw new Error(`Login failed: ${data.error ?? res.status}`);
  const me = await fetch(`${APP_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${data.sessionToken}` },
  });
  const meData = await me.json();
  const teamId = meData.activeTeam?.id ?? meData.teams?.[0]?.id;
  if (!teamId) throw new Error("No team id");
  return { token: data.sessionToken, teamId, email, password };
}

async function fetchWorkflow(teamId, token, workflowId) {
  const res = await fetch(`${APP_BASE}/api/teams/${teamId}/workflows/${workflowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.workflow;
}

async function main() {
  const auth = await login();
  const workflowId = Number(process.env.WORKFLOW_ID ?? 7);
  if (Number.isNaN(workflowId) || workflowId <= 0) {
    throw new Error("Set WORKFLOW_ID to a valid workflow id");
  }
  const before = await fetchWorkflow(auth.teamId, auth.token, workflowId);
  const beforeAgents = (before?.nodes ?? []).filter((n) => n.kind === "action_agent").length;
  console.log("[insert] before action_agent count:", beforeAgents);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const patchResponses = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes(`/workflows/${workflowId}`) && response.request().method() === "PATCH") {
        let body = "";
        try {
          body = await response.text();
        } catch {
          body = "";
        }
        patchResponses.push({ status: response.status(), body: body.slice(0, 400) });
      }
    });
    await page.goto(`${APP_BASE}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.evaluate(({ token, email, password }) => {
      sessionStorage.setItem("neo_pulse_session_token", token);
      localStorage.setItem(
        "neo-pulse_device_auth",
        JSON.stringify({ email, password, sessionToken: token }),
      );
    }, auth);

    await page.goto(`${APP_BASE}/#/pulse-forge/workflows/${workflowId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForFunction(
      () => {
        const labels = [...document.querySelectorAll("button")]
          .map((btn) => btn.getAttribute("aria-label"))
          .filter(Boolean);
        return labels.some((label) => label.startsWith("Add step after"));
      },
      { timeout: 120_000 },
    );

    const insertTarget = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")].filter((btn) =>
        btn.getAttribute("aria-label")?.startsWith("Add step after"),
      );
      const scheduleInsert =
        buttons.find((btn) => btn.getAttribute("aria-label")?.includes("Schedule")) ?? buttons[0];
      if (!scheduleInsert) return { ok: false, labels: buttons.map((btn) => btn.getAttribute("aria-label")) };
      scheduleInsert.click();
      return { ok: true, label: scheduleInsert.getAttribute("aria-label"), count: buttons.length };
    });
    console.log("[insert] opened from:", insertTarget);
    await page.waitForFunction(() => document.body.innerText.includes("Add to workflow"), {
      timeout: 30_000,
    });
    const dialogText = await page.evaluate(() => {
      const modal = document.querySelector("[role=dialog]");
      return modal?.textContent?.slice(0, 500) ?? document.body.innerText.slice(0, 500);
    });
    console.log("[insert] dialog snippet:", dialogText.replace(/\s+/g, " ").trim());
    await page.waitForFunction(
      () => document.body.innerText.includes("Generate a full GSC month-over-month report"),
      { timeout: 60_000 },
    );

    const recipeResult = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const recipe = buttons.find(
        (btn) =>
          btn.textContent?.includes("GSC Monthly MoM Report")
          && btn.textContent?.includes("Generate a full GSC month-over-month report"),
      );
      if (!recipe) {
        return {
          ok: false,
          gscButtons: buttons
            .map((btn) => btn.textContent?.trim())
            .filter((text) => text?.includes("GSC")),
        };
      }
      recipe.click();
      return { ok: true };
    });
    console.log("[insert] recipe click:", recipeResult);
    await sleep(5000);

    const uiAfter = await page.evaluate(() => ({
      dialogOpen: document.body.innerText.includes("Add to workflow"),
      mentions: (document.body.innerText.match(/GSC Monthly MoM Report/g) ?? []).length,
      stepLabels: [...document.querySelectorAll("button")]
        .map((btn) => btn.getAttribute("aria-label"))
        .filter((label) => label?.startsWith("Add step after")),
      saveError: [...document.querySelectorAll("p")]
        .map((el) => el.textContent?.trim())
        .find((text) => text?.includes("agent step") || text?.includes("Could not save")),
    }));
    console.log("[insert] ui after click:", uiAfter);
    console.log("[insert] patch responses:", patchResponses);
  } finally {
    await browser.close();
  }

  const after = await fetchWorkflow(auth.teamId, auth.token, workflowId);
  const afterAgents = (after?.nodes ?? []).filter((n) => n.kind === "action_agent").length;
  const kinds = (after?.nodes ?? []).map((n) => `${n.kind}:${n.label}`);
  console.log("[insert] after action_agent count:", afterAgents);
  console.log("[insert] nodes:", kinds.join(" | "));

  if (afterAgents <= beforeAgents) {
    console.error("[insert] FAILED — agent step not persisted");
    process.exitCode = 1;
  } else {
    console.log("[insert] PASSED");
  }
}

main().catch((err) => {
  console.error("[insert]", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
