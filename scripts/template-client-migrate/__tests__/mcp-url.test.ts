import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hostFromUrl, jobSlugFromTemplate, pointEmcpUrl } from "../lib/mcp-url.mjs";

describe("pointEmcpUrl", () => {
  it("rewrites emcp-neodigital-ca url and keeps other servers", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tcm-mcp-"));
    const file = path.join(dir, "mcp.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        mcpServers: {
          github: { command: "npx" },
          "emcp-neodigital-ca": {
            url: "https://old.example/wp-json/mcp/emcp-tools-server",
            headers: {},
          },
        },
      }),
    );
    const next = "https://new.example/wp-json/mcp/emcp-tools-server";
    expect(pointEmcpUrl(file, next)).toBe(next);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(parsed.mcpServers.github.command).toBe("npx");
    expect(parsed.mcpServers["emcp-neodigital-ca"].url).toBe(next);
  });

  it("fails when mcp.json is missing", () => {
    expect(() => pointEmcpUrl(path.join(os.tmpdir(), "no-such-mcp.json"), "https://x.com/wp-json/mcp/emcp-tools-server")).toThrow(
      /not found/,
    );
  });
});

describe("job slug", () => {
  it("uses the template hostname", () => {
    expect(hostFromUrl("https://blindswebsitet.wpenginepowered.com/")).toBe("blindswebsitet.wpenginepowered.com");
    expect(jobSlugFromTemplate("https://blindswebsitet.wpenginepowered.com/foo")).toBe(
      "blindswebsitet.wpenginepowered.com",
    );
  });
});
