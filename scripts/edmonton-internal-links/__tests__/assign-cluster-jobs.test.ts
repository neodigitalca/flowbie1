import { describe, expect, it } from "vitest";
import {
  candidateItems,
  isExactHeadTerm,
  isStreetSap,
  validateJobs,
} from "../assign-cluster-jobs.mjs";

function item(path: string, extra: Record<string, unknown> = {}) {
  return {
    id: extra.id ?? Math.abs(path.split("").reduce((a, c) => a + c.charCodeAt(0), 0)),
    type: extra.type ?? "post",
    slug: String(extra.slug ?? path.replace(/\//g, "")),
    title: String(extra.title ?? path),
    path,
    ...extra,
  };
}

const inventory = {
  items: [
    item("/edmonton-seo", { type: "page", id: 10203, title: "Edmonton SEO" }),
    item("/local-seo", { type: "page", id: 10439, title: "Local SEO" }),
    item("/aiseo", { type: "page", id: 10023, title: "AISEO" }),
    item("/aiseo/generative-engine-optimization", { type: "page", id: 10027, title: "GEO" }),
    item("/aiseo/ai-content-optimization", { type: "page", id: 10025, title: "AI Content" }),
    item("/aiseo/ai-seo-audit", { type: "page", id: 10029, title: "AI SEO Audit" }),
    item("/blog/edmonton-seo-partner", { type: "post", id: 20, title: "Edmonton SEO Partner", slug: "edmonton-seo-partner" }),
    item("/blog/edmonton-seo", { type: "post", id: 21, title: "Edmonton SEO", slug: "edmonton-seo" }),
    item("/blog/edmonton-window-treatment-seo-near-118-avenue", {
      type: "post",
      id: 22,
      title: "Edmonton Window Treatment SEO Near 118 Avenue",
      slug: "edmonton-window-treatment-seo-near-118-avenue",
    }),
  ],
};

describe("street and head-term guards", () => {
  it("flags street SAP posts", () => {
    expect(isStreetSap(inventory.items[8])).toBe(true);
    expect(isStreetSap(inventory.items[5])).toBe(false);
  });

  it("flags the exact Edmonton SEO title", () => {
    expect(isExactHeadTerm(inventory.items[7])).toBe(true);
    expect(isExactHeadTerm(inventory.items[1])).toBe(false);
  });
});

describe("candidateItems", () => {
  it("keeps preferred pages and included posts, drops street SAP and the money page", () => {
    const classified = { posts: [{ id: 21, include: true, spoke: "edmonton-seo", suggested_anchor: "local tips path" }] };
    const rows = candidateItems(inventory, classified);
    const paths = rows.map((r) => r.path);
    expect(paths).toContain("/local-seo");
    expect(paths).toContain("/aiseo");
    expect(paths).toContain("/blog/edmonton-seo-partner");
    expect(paths).toContain("/blog/edmonton-seo");
    expect(paths).not.toContain("/edmonton-seo");
    expect(paths).not.toContain("/blog/edmonton-window-treatment-seo-near-118-avenue");
  });
});

describe("validateJobs", () => {
  const base = [
    { job: "gbp", path: "/local-seo", id: 10439, reason: "maps page", needsRetitle: false },
    { job: "citations", path: "/aiseo/ai-seo-audit", id: 10029, reason: "audit names NAP", needsRetitle: false },
    { job: "links", path: "/aiseo/ai-content-optimization", id: 10025, reason: "internal links live here", needsRetitle: false },
    { job: "content", path: "/aiseo", id: 10023, reason: "AISEO pillar", needsRetitle: false },
    { job: "tips", path: "/blog/edmonton-seo", id: 21, reason: "retitle this post", needsRetitle: true },
    { job: "smb", path: "/blog/edmonton-seo-partner", id: 20, reason: "partner post", needsRetitle: false },
  ];

  it("accepts six unique existing URLs", () => {
    const jobs = validateJobs(base, inventory);
    expect(jobs).toHaveLength(6);
    expect(jobs.find((j) => j.job === "tips")?.needsRetitle).toBe(true);
  });

  it("rejects a new slug", () => {
    const bad = base.map((j) => (j.job === "links" ? { ...j, path: "/link-building-in-edmonton", id: 99 } : j));
    expect(() => validateJobs(bad, inventory)).toThrow(/unknown path/);
  });

  it("rejects the money page", () => {
    const bad = base.map((j) => (j.job === "tips" ? { ...j, path: "/edmonton-seo", id: 10203, needsRetitle: false } : j));
    expect(() => validateJobs(bad, inventory)).toThrow(/money page/);
  });

  it("rejects street SAP", () => {
    const bad = base.map((j) =>
      j.job === "tips"
        ? { ...j, path: "/blog/edmonton-window-treatment-seo-near-118-avenue", id: 22, needsRetitle: false }
        : j,
    );
    expect(() => validateJobs(bad, inventory)).toThrow(/street SAP/);
  });
});
