import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeNotifyText } from "@/lib/app-notifications";

const NOTIFY_DIR = join(process.cwd(), "src/lib/notify-messages");

describe("normalizeNotifyText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeNotifyText("  a   b  ")).toBe("a b");
  });

  it("replaces em and en dashes with comma space", () => {
    expect(normalizeNotifyText("a – b")).toBe("a, b");
  });

  it("returns empty for nullish", () => {
    expect(normalizeNotifyText(null)).toBe("");
    expect(normalizeNotifyText(undefined)).toBe("");
  });
});

describe("notify-messages copy catalog", () => {
  const MAX_LEN = 48;
  const BANNED = [
    /try again/i,
    /please try/i,
    /please check/i,
    /from the response/i,
    /from the model/i,
  ];

  async function readNotifyConstants(): Promise<Array<{ name: string; value: string }>> {
    const files = (await readdir(NOTIFY_DIR)).filter((f) => f.endsWith(".ts") && f !== "index.ts");
    const items: Array<{ name: string; value: string }> = [];
    const re = /export const (NOTIFY_\w+) = "((?:[^"\\]|\\.)*)";/g;
    for (const f of files) {
      const source = await readFile(join(NOTIFY_DIR, f), "utf8");
      let m;
      while ((m = re.exec(source)) !== null) {
        items.push({
          name: m[1],
          value: m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
        });
      }
    }
    return items;
  }

  it("has no trailing ellipsis or step-prefix patterns in string constants", async () => {
    const constants = await readNotifyConstants();
    for (const { name, value } of constants) {
      expect(value.endsWith("..."), `${name} ends with ellipsis`).toBe(false);
      expect(/^\d+\/\d+:/.test(value), `${name} step prefix`).toBe(false);
      expect(/^Step \d/i.test(value), `${name} Step prefix`).toBe(false);
    }
  });

  it("keeps NOTIFY_* constants at or under 48 characters with no banned filler", async () => {
    const constants = await readNotifyConstants();
    for (const { name, value } of constants) {
      expect(value.length, `${name} length ${value.length}`).toBeLessThanOrEqual(MAX_LEN);
      for (const ban of BANNED) {
        expect(ban.test(value), `${name} banned phrase: ${value}`).toBe(false);
      }
    }
  });
});
