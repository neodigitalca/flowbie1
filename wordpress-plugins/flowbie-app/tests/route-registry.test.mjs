import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FLOWBIE_APP_DISPATCHER_MARKERS, FLOWBIE_APP_VISIBLE_TAB_ROUTES } from "./route-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dispatcherPath = join(__dirname, "../includes/router/class-api-dispatcher.php");
const dispatcherSource = readFileSync(dispatcherPath, "utf8");

describe("flowbie-app route registry", () => {
  it("registers visible-tab handlers in the dispatcher", () => {
    for (const marker of FLOWBIE_APP_DISPATCHER_MARKERS) {
      expect(dispatcherSource).toContain(marker.split("::")[0]);
    }
  });

  it("lists expected visible-tab paths", () => {
    expect(FLOWBIE_APP_VISIBLE_TAB_ROUTES.length).toBeGreaterThanOrEqual(8);
    const gmb = FLOWBIE_APP_VISIBLE_TAB_ROUTES.find((r) => r.path === "gmb/config-status");
    expect(gmb?.method).toBe("GET");
  });
});
