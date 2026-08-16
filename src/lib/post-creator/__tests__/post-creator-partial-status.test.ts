import { describe, expect, it } from "vitest";

function buildPostCreatorResultMessage(result: {
  created: number;
  failed: number;
  postCount: number;
  blockedRows: Array<{ keyword: string }>;
}): string {
  const blockedCount = result.blockedRows.length;
  const base = `Created ${result.created}/${result.postCount} post${result.postCount === 1 ? "" : "s"}`;
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

function isPostCreatorRunOk(result: { created: number; failed: number; postCount: number }): boolean {
  return result.created === result.postCount && result.failed === 0;
}

describe("post creator partial status", () => {
  it("marks 2/3 with one blocked as not ok", () => {
    const result = {
      created: 2,
      failed: 0,
      postCount: 3,
      blockedRows: [{ keyword: "sheer shades" }],
    };
    expect(isPostCreatorRunOk(result)).toBe(false);
    expect(buildPostCreatorResultMessage(result)).toBe(
      "Created 2/3 posts (1 blocked: cannibalization)",
    );
  });
});
