import { describe, expect, it } from "vitest";
import { buildWordPressSitesCsv } from "@/lib/export-wordpress-sites-csv";
import type { WordPressSite } from "@/components/integrations/types";

function site(overrides: Partial<WordPressSite> = {}): WordPressSite {
  return {
    id: "wp-1",
    name: "In the Shade",
    siteUrl: "https://intheshadeflorida.com",
    username: "admin",
    appPassword: "pass",
    connectedAt: 0,
    locations: [
      {
        id: "loc-1",
        name: "Primary",
        address: "",
        city: "Stuart",
        state: "Florida",
        country: "United States",
        zip: "",
        phone: "",
        isDefault: true,
      },
    ],
    ...overrides,
  };
}

describe("buildWordPressSitesCsv", () => {
  it("puts city, country, and state after name and siteUrl", () => {
    const csv = buildWordPressSitesCsv([site()]);
    const [header, row] = csv.split("\r\n");
    const headers = header.split(",");
    expect(headers.slice(0, 5)).toEqual([
      "name",
      "siteUrl",
      "serviceCity",
      "serviceCountry",
      "serviceState",
    ]);
    const cells = row.split(",");
    expect(cells.slice(0, 5)).toEqual([
      "In the Shade",
      "https://intheshadeflorida.com",
      "Stuart",
      "United States",
      "Florida",
    ]);
  });
});
