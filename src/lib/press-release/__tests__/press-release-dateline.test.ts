import { describe, expect, it } from "vitest";
import {
  buildPressReleaseWireDateline,
  finishPressReleaseMarkdown,
  resolvePressReleasePlace,
  stripRepeatedPressReleaseDatePrefixes,
} from "../press-release-dateline";

describe("press-release-dateline", () => {
  it("builds dateline from default location", () => {
    const line = buildPressReleaseWireDateline(
      {
        name: "Acme",
        locations: [
          {
            id: "1",
            name: "HQ",
            address: "",
            city: "Edmonton",
            state: "Alberta",
            zip: "",
            phone: "",
            isDefault: true,
          },
        ],
      },
      new Date("2026-05-15T12:00:00"),
    );
    expect(line).toBe("EDMONTON, Alberta, May 15, 2026");
  });

  it("parses city/state from nap address when no locations array", () => {
    const place = resolvePressReleasePlace({
      napInfo: { address: "100 Main St, Calgary, AB T2P 1A1" },
    });
    expect(place).toEqual({ city: "Calgary", state: "AB" });
  });

  it("keeps date prefix only in the first section", () => {
    const md = [
      "## Head one",
      "",
      "May 15, 2026 - First lead.",
      "",
      "## Head two",
      "",
      "May 15, 2026 - Second body.",
    ].join("\n");
    const out = stripRepeatedPressReleaseDatePrefixes(md, "May 15, 2026");
    expect(out).toContain("May 15, 2026 - First lead.");
    expect(out).toContain("Second body.");
    expect(out).not.toMatch(/## Head two[\s\S]*May 15, 2026 -/);
  });

  it("strips bracket dateline templates and empty bold", () => {
    const out = finishPressReleaseMarkdown(
      "**[CITY (STATE)], [Month DD, YYYY]**\n\n## Real headline\n\nLead text.",
    );
    expect(out).not.toContain("[CITY");
    expect(out).not.toContain("[Month DD");
    expect(out).toContain("## Real headline");
    expect(out).toContain("Lead text.");
  });
});
