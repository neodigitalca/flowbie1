import { describe, expect, it } from "vitest";
import { metaVisualPlanIncludesDeviceUi } from "@/lib/ppc/meta-ad-device-ui-context";

describe("meta-ad-device-ui-context", () => {
  it("detects device elements in the visual plan", () => {
    expect(
      metaVisualPlanIncludesDeviceUi([
        {
          id: "1",
          label: "Layout",
          kind: "layout",
          googleImageQuery: "instagram feed ad",
          acceptanceBrief: "Layout",
        },
      ]),
    ).toBe(false);
    expect(
      metaVisualPlanIncludesDeviceUi([
        {
          id: "2",
          label: "Laptop",
          kind: "device",
          googleImageQuery: "2026 laptop workspace",
          acceptanceBrief: "Device",
        },
      ]),
    ).toBe(true);
  });
});
