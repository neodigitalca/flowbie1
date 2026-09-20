import { describe, expect, it } from "vitest";
import { buildLinkMap, normPath, validateLinkMap } from "../link-map-rules.mjs";

function item(path: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    id: Math.abs(path.split("").reduce((a, c) => a + c.charCodeAt(0), 0)),
    type,
    slug: path.replace(/\//g, "") || "home",
    title: path,
    excerpt: "",
    permalink: `https://neodigital.ca${path === "/" ? "/" : `${path}/`}`,
    path,
    hrefs: [],
    text: "",
    chunks: extra.text ? [String(extra.text)] : [],
    ...extra,
  };
}

const baseItems = [
  item("/", "page"),
  item("/about", "page", { text: "Edmonton team work" }),
  item("/our-services", "page", { text: "Edmonton SEO website design AISEO contact" }),
  item("/website-design", "page", { text: "website design AISEO services contact" }),
  item("/window-coverings-marketing", "page", { text: "window coverings website design services" }),
  item("/elementor-help", "page", { text: "Elementor website design services" }),
  item("/aiseo", "page", { text: "AISEO generative audit content optimization services" }),
  item("/aiseo/what-is-aiseo", "page", { text: "AISEO content" }),
  item("/aiseo/ai-content-optimization", "page", { text: "content Edmonton generative AISEO" }),
  item("/aiseo/generative-engine-optimization", "page", { text: "generative Edmonton AISEO audit" }),
  item("/aiseo/ai-seo-audit", "page", { text: "audit Edmonton AISEO content" }),
  item("/neo-pulse", "page", { text: "AISEO platform" }),
  item("/edmonton-seo", "page", { text: "website design AI SEO audit Blind Magic contact" }),
  item("/our-work", "page", { text: "Blind Magic Edmonton SEO services" }),
  item("/our-work/blind-magic", "our-work", { text: "Edmonton website Our Work" }),
  item("/blog", "page", { text: "Edmonton SEO AISEO" }),
  item("/contact", "page"),
  item("/ai-seo-edmonton-playbook", "post", {
    id: 11,
    title: "AI SEO for Edmonton Businesses",
    text: "Edmonton AI SEO blog",
  }),
];

describe("normPath", () => {
  it("strips host and trailing slash", () => {
    expect(normPath("https://neodigital.ca/edmonton-seo/")).toBe("/edmonton-seo");
    expect(normPath("/")).toBe("/");
  });
});

describe("buildLinkMap", () => {
  const inventory = { items: baseItems };
  const classified = {
    posts: [{ id: 11, include: true, suggested_anchor: "Edmonton AI playbook", spoke: "aiseo", reason: "local" }],
  };
  const map = buildLinkMap(inventory, classified);

  it("gives Edmonton SEO the most inbound service links and unique anchors", () => {
    const errors = validateLinkMap(map, inventory);
    expect(errors).toEqual([]);
    const moneyIn = map.links.filter((l) => normPath(l.to) === "/edmonton-seo").length;
    const moneyOut = map.links.filter((l) => normPath(l.from) === "/edmonton-seo").length;
    expect(moneyIn).toBeGreaterThan(moneyOut);
  });

  it("keeps money-page outbound to design, audit, Blind Magic, and contact", () => {
    const outs = map.links.filter((l) => normPath(l.from) === "/edmonton-seo").map((l) => normPath(l.to));
    expect(outs.sort()).toEqual(
      ["/aiseo/ai-seo-audit", "/contact", "/our-work/blind-magic", "/website-design"].sort(),
    );
  });

  it("does not force window-coverings onto Edmonton SEO without local-search copy", () => {
    const forced = map.links.filter(
      (l) => normPath(l.from) === "/window-coverings-marketing" && normPath(l.to) === "/edmonton-seo",
    );
    expect(forced).toHaveLength(0);
  });

  it("links the included blog to Edmonton SEO and the AISEO spoke", () => {
    const fromBlog = map.links.filter((l) => normPath(l.from) === "/ai-seo-edmonton-playbook");
    expect(fromBlog.some((l) => normPath(l.to) === "/edmonton-seo")).toBe(true);
    expect(fromBlog.some((l) => normPath(l.to) === "/aiseo")).toBe(true);
  });

  it("adds cluster reading links from the money page when inbound stays higher", () => {
    const withLocal = {
      items: [...baseItems, item("/local-seo", "page", { id: 10439, text: "maps Edmonton Google Business Profile" })],
    };
    const clustered = buildLinkMap(inventory, classified, {
      jobs: [
        { job: "gbp", path: "/local-seo" },
        { job: "content", path: "/aiseo" },
      ],
    });
    const withBoth = buildLinkMap(withLocal, classified, {
      jobs: [
        { job: "gbp", path: "/local-seo" },
        { job: "content", path: "/aiseo" },
      ],
    });
    expect(validateLinkMap(withBoth, withLocal)).toEqual([]);
    const outs = withBoth.links.filter((l) => normPath(l.from) === "/edmonton-seo").map((l) => normPath(l.to));
    expect(outs).toContain("/local-seo");
    expect(outs).toContain("/aiseo");
    expect(clustered.clusterJobs).toHaveLength(2);
  });

  it("fails when two sources reuse the same money-page anchor", () => {
    const broken = {
      ...map,
      links: [
        ...map.links,
        { from: "/about", to: "/edmonton-seo", anchor: "local pack work in Edmonton", placement: "one_new_sentence", sentence: "x" },
      ],
    };
    expect(validateLinkMap(broken, inventory).some((e) => e.includes("duplicate money anchor"))).toBe(true);
  });
});
