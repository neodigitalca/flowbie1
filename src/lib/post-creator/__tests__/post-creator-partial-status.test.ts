import { describe, expect, it } from "vitest";

function buildPostCreatorResultMessage(result: {
  created: number;
  failed: number;
  skipped?: number;
  postCount: number;
  blockedRows: Array<{ keyword: string }>;
}): string {
  const blockedCount = result.blockedRows.length;
  const skipped = result.skipped ?? 0;
  const base = `Created ${result.created}/${result.postCount} post${result.postCount === 1 ? "" : "s"}`;
  if (skipped > 0 && blockedCount > 0) {
    return `${base} (${skipped} skipped, ${blockedCount} blocked: cannibalization)`;
  }
  if (skipped > 0) {
    return `${base} (${skipped} skipped)`;
  }
  if (result.failed > 0 && blockedCount > 0) {
    return `${base} (${result.failed} failed, ${blockedCount} blocked: cannibalization)`;
  }
  if (result.failed > 0) {
    return `${base} (${result.failed} failed during generation)`;
  }
  if (blockedCount > 0) {
    return `${base} (${blockedCount} blocked: cannibalization)`;
  }
  return base;
}

function isPostCreatorRunOk(_result: {
  created: number;
  failed: number;
  skipped?: number;
  postCount: number;
}): boolean {
  return true;
}

describe("post creator partial status", () => {
  it("marks partial create with blocked rows and no skipped posts", () => {
    const result = {
      created: 2,
      failed: 0,
      skipped: 0,
      postCount: 3,
      blockedRows: [{ keyword: "sheer shades" }],
    };
    expect(isPostCreatorRunOk(result)).toBe(true);
    expect(buildPostCreatorResultMessage(result)).toBe(
      "Created 2/3 posts (1 blocked: cannibalization)",
    );
  });
});
