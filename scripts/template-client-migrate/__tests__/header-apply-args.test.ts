import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFlags, parseHeaderApplyArgs } from "../lib/header-apply-args.mjs";

describe("parseHeaderApplyArgs", () => {
  it("reads flags over defaults", () => {
    const root = "B:/Neo Pulse";
    const args = parseHeaderApplyArgs(
      {},
      [
        "--dest-site",
        "example.com",
        "--from-host",
        "template.example",
        "--header-id",
        "88",
        "--menu-id",
        "12",
        "--logo-id",
        "9",
        "--phone",
        "(555) 010-0100",
      ],
      root,
    );
    expect(args.destSite).toBe("example.com");
    expect(args.headerId).toBe(88);
    expect(args.menuId).toBe(12);
    expect(args.logoId).toBe(9);
    expect(args.phone).toBe("(555) 010-0100");
    expect(args.sourcePath).toBe(
      path.join(root, "var/template-client-migrate", "template.example", "header-source.json"),
    );
    expect(args.remoteName).toBe("tcm-example-com-header-once.php");
  });
});

describe("parseFlags", () => {
  it("pairs dashed flags with the next value", () => {
    expect(parseFlags(["--menu-id", "39", "--phone", "(780) 484-2390"])).toEqual({
      "menu-id": "39",
      phone: "(780) 484-2390",
    });
  });
});
