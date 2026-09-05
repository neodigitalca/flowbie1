import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/integrations/storage", () => ({
  getStoredSites: vi.fn(() => [
    { id: "site-a", name: "Site A", enabled: false },
    { id: "site-b", name: "Site B", enabled: true },
  ]),
}));

import { listWorkflowAvailableSiteIds } from "@/lib/workflow/workflow-available-sites";

describe("listWorkflowAvailableSiteIds", () => {
  it("includes disabled sites for all-clients workflow fan-out", () => {
    expect(listWorkflowAvailableSiteIds()).toEqual(["site-a", "site-b"]);
  });
});
