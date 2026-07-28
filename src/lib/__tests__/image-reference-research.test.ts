import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildGroundedImagePromptSuffix,
  capGoogleImagesCandidates,
  collectReferenceDataUrls,
  formatSpatialLayoutContract,
  parseImageGroundingClassification,
  parsePlaceFanOutTargets,
  parsePlaceSpatialLayout,
  parseQueryFanOutTargets,
  parseSubjectFanOutTargets,
  parseReferenceUsageGuidanceList,
  applyReferenceUsageGuidance,
  parseSoftReferenceMultiPick,
  parseSoftReferencePick,
  softPickPasses,
  parseImageEvidenceNeeds,
  evidenceNeedsToTargets,
  IMAGE_REF_CANDIDATE_LIMIT,
  IMAGE_REF_FIT_MIN,
  IMAGE_REF_QUALITY_MIN,
  allocateSoloFanOutCaps,
  IMAGE_REF_SUBJECT_WITH_PLACE_MAX,
  IMAGE_REF_PLACE_FANOUT_MAX,
} from "@/lib/image-reference-research";

describe("parseImageGroundingClassification", () => {
  it("returns abstract with empty targets", () => {
    expect(parseImageGroundingClassification({ mode: "abstract", targets: [] })).toEqual({
      mode: "abstract",
      targets: [],
    });
  });

  it("parses grounded targets and caps at 3", () => {
    const out = parseImageGroundingClassification({
      mode: "grounded",
      targets: [
        { kind: "place", query: "Edmonton downtown", role: "skyline", layer: "background" },
        { kind: "product", query: "Hunter Douglas blinds", role: "product", layer: "foreground" },
        { kind: "howto", query: "how to clean blinds", role: "task", layer: "midground" },
        { kind: "other", query: "extra", role: "x" },
      ],
    });
    expect(out.mode).toBe("grounded");
    expect(out.targets).toHaveLength(3);
    expect(out.targets[0]?.query).toBe("Edmonton downtown");
    expect(out.targets[0]?.layer).toBe("background");
    expect(out.targets[1]?.kind).toBe("product");
    expect(out.targets[1]?.layer).toBe("foreground");
  });

  it("defaults layer from kind when omitted", () => {
    const out = parseImageGroundingClassification({
      mode: "grounded",
      targets: [{ kind: "product", query: "Tesla Cybertruck", role: "vehicle" }],
    });
    expect(out.targets[0]?.layer).toBe("foreground");
  });

  it("keeps location_name on place targets", () => {
    const out = parseImageGroundingClassification({
      mode: "grounded",
      targets: [
        {
          kind: "place",
          query: "Jasper Avenue Save On Foods Edmonton",
          role: "setting",
          layer: "background",
          location_name: "Canada",
        },
      ],
    });
    expect(out.targets[0]?.location_name).toBe("Canada");
    expect(out.targets[0]?.query).toContain("Save On Foods");
    expect(out.targets[0]?.query).toContain("Jasper Avenue");
    expect(out.targets[0]?.query).not.toMatch(/\bby\b/i);
  });

  it("treats grounded with no valid queries as abstract", () => {
    expect(
      parseImageGroundingClassification({
        mode: "grounded",
        targets: [{ kind: "place", query: "  ", role: "x" }],
      }),
    ).toEqual({ mode: "abstract", targets: [] });
  });
});

describe("parseImageEvidenceNeeds", () => {
  it("parses needs with acceptanceBrief and keeps full AI list (no solo cap)", () => {
    const out = parseImageEvidenceNeeds({
      mode: "grounded",
      needs: [
        {
          kind: "product",
          layer: "foreground",
          query: "Tesla Cybertruck",
          role: "vehicle",
          location_name: "United States",
          acceptanceBrief: "Must show a Cybertruck clearly",
          pickCount: 1,
        },
        {
          kind: "place",
          layer: "background",
          query: "Jasper Avenue Save On Foods Edmonton exterior",
          role: "storefront",
          location_name: "Canada",
          acceptanceBrief:
            "Must show exterior Save On Foods storefront; shelf products alone do not satisfy",
          pickCount: 2,
        },
        {
          kind: "place",
          query: "Jasper Avenue Edmonton street",
          role: "street",
          acceptanceBrief: "Outdoor street context",
        },
        { kind: "other", query: "extra1", role: "x", acceptanceBrief: "a" },
        { kind: "other", query: "extra2", role: "x", acceptanceBrief: "b" },
        { kind: "other", query: "extra3", role: "x", acceptanceBrief: "c" },
        { kind: "other", query: "extra4", role: "x", acceptanceBrief: "d" },
        { kind: "other", query: "extra5", role: "x", acceptanceBrief: "e", pickCount: 3 },
      ],
    });
    expect(out.mode).toBe("grounded");
    expect(out.needs).toHaveLength(8);
    expect(out.needs[0]?.acceptanceBrief).toContain("Cybertruck");
    expect(out.needs[0]?.pickCount).toBe(1);
    expect(out.needs[1]?.query).toContain("Save On Foods");
    expect(out.needs[1]?.query).not.toMatch(/\bby\b/i);
    expect(out.needs[1]?.acceptanceBrief).toContain("shelf products");
    expect(out.needs[1]?.pickCount).toBe(2);
    expect(out.needs[2]?.pickCount).toBe(1);
    expect(out.needs[7]?.pickCount).toBe(3);
  });

  it("maps needs to targets with acceptanceBrief and pickCount", () => {
    const plan = parseImageEvidenceNeeds({
      mode: "grounded",
      needs: [
        {
          kind: "place",
          layer: "background",
          query: "Jasper Avenue Save On Foods Edmonton exterior",
          role: "storefront",
          location_name: "Canada",
          acceptanceBrief: "Exterior facade required",
          pickCount: 2,
        },
        {
          kind: "product",
          layer: "midground",
          query: "Evolve Strength downtown Edmonton squat rack",
          role: "rack at that gym",
          location_name: "Canada",
          acceptanceBrief: "Must show a squat rack at Evolve Strength",
          pickCount: 2,
        },
      ],
    });
    const targets = evidenceNeedsToTargets(plan.needs);
    expect(targets[0]?.acceptanceBrief).toBe("Exterior facade required");
    expect(targets[0]?.location_name).toBe("Canada");
    expect(targets[0]?.pickCount).toBe(2);
    expect(targets[1]?.query).toContain("Evolve Strength");
    expect(targets[1]?.query).toContain("squat rack");
    expect(targets[1]?.pickCount).toBe(2);
  });

  it("defaults acceptanceBrief from query when missing", () => {
    const out = parseImageEvidenceNeeds({
      mode: "grounded",
      needs: [{ kind: "product", query: "Hunter Douglas blinds", role: "product" }],
    });
    expect(out.needs[0]?.acceptanceBrief).toContain("Hunter Douglas blinds");
    expect(out.needs[0]?.pickCount).toBe(1);
  });

  it("coerces invalid pickCount to 1", () => {
    const out = parseImageEvidenceNeeds({
      mode: "grounded",
      needs: [
        { kind: "place", query: "Edmonton skyline", role: "place", pickCount: 0 },
        { kind: "place", query: "Jasper Ave", role: "street", pick_count: -2 } as Record<
          string,
          unknown
        >,
      ],
    });
    expect(out.needs[0]?.pickCount).toBe(1);
    expect(out.needs[1]?.pickCount).toBe(1);
  });
});

describe("parseSoftReferenceMultiPick", () => {
  it("parses ranked picks and caps count", () => {
    const picks = parseSoftReferenceMultiPick(
      {
        picks: [
          {
            chosenIndex: 1,
            fitScore: 0.9,
            qualityScore: 0.8,
            why: "front",
            visualDescription: "facade",
          },
          {
            chosenIndex: 3,
            fitScore: 0.85,
            qualityScore: 0.7,
            why: "side",
            visualDescription: "dome side",
          },
          {
            chosenIndex: 4,
            fitScore: 0.8,
            qualityScore: 0.7,
            why: "pool",
            visualDescription: "reflecting pool",
          },
        ],
      },
      2,
    );
    expect(picks).toHaveLength(2);
    expect(picks[0]?.chosenIndex).toBe(1);
    expect(picks[1]?.chosenIndex).toBe(3);
  });

  it("falls back to single chosenIndex", () => {
    const picks = parseSoftReferenceMultiPick(
      {
        chosenIndex: 2,
        fitScore: 0.8,
        qualityScore: 0.7,
        why: "ok",
        visualDescription: "building",
      },
      4,
    );
    expect(picks).toHaveLength(1);
    expect(picks[0]?.chosenIndex).toBe(2);
  });
});

describe("softPickPasses", () => {
  it("accepts soft fit scores", () => {
    expect(
      softPickPasses({
        chosenIndex: 0,
        why: "ok",
        fitScore: IMAGE_REF_FIT_MIN,
        qualityScore: IMAGE_REF_QUALITY_MIN,
        visualDescription: "scene",
      }),
    ).toBe(true);
  });

  it("rejects below thresholds", () => {
    expect(
      softPickPasses({
        chosenIndex: 0,
        why: "weak",
        fitScore: IMAGE_REF_FIT_MIN - 0.01,
        qualityScore: 0.9,
        visualDescription: "scene",
      }),
    ).toBe(false);
  });
});

describe("parseSoftReferencePick", () => {
  it("normalizes 0-10 scores", () => {
    const pick = parseSoftReferencePick({
      chosenIndex: 2,
      fitScore: 8,
      qualityScore: 7,
      why: "clear product",
      visualDescription: "blinds closeup",
    });
    expect(pick.chosenIndex).toBe(2);
    expect(pick.fitScore).toBe(0.8);
    expect(pick.qualityScore).toBe(0.7);
  });
});

describe("capGoogleImagesCandidates", () => {
  it("keeps at most IMAGE_REF_CANDIDATE_LIMIT", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      title: `t${i}`,
      source_url: `https://example.com/${i}`,
      image_url: `https://cdn.example.com/${i}.jpg`,
      alt: "",
      rank: i + 1,
    }));
    expect(capGoogleImagesCandidates(many)).toHaveLength(IMAGE_REF_CANDIDATE_LIMIT);
  });
});

describe("collectReferenceDataUrls + prompt suffix", () => {
  it("collects only data:image urls", () => {
    const urls = collectReferenceDataUrls([
      {
        dataUrl: "data:image/jpeg;base64,abc",
        imageUrl: "https://cdn.example.com/a.jpg",
        query: "Edmonton",
        kind: "place",
        layer: "background",
        why: "skyline",
        visualDescription: "river valley",
        fitScore: 0.8,
        qualityScore: 0.7,
      },
      {
        dataUrl: "https://not-data",
        imageUrl: "https://cdn.example.com/b.jpg",
        query: "blinds",
        kind: "product",
        layer: "foreground",
        why: "product",
        visualDescription: "blinds",
        fitScore: 0.7,
        qualityScore: 0.6,
      },
    ]);
    expect(urls).toEqual(["data:image/jpeg;base64,abc"]);
  });

  it("builds grounded prompt suffix", () => {
    const suffix = buildGroundedImagePromptSuffix([
      {
        dataUrl: "data:image/jpeg;base64,abc",
        imageUrl: "https://cdn.example.com/a.jpg",
        query: "Edmonton downtown",
        kind: "place",
        layer: "background",
        why: "skyline",
        visualDescription: "bridge and skyline",
        fitScore: 0.8,
        qualityScore: 0.7,
      },
    ]);
    expect(suffix).toContain("REFERENCE PHOTOS ATTACHED");
    expect(suffix).toContain("Foreground refs");
    expect(suffix).toContain("background / place");
    expect(suffix).toContain("Edmonton downtown");
    expect(suffix).toContain("bridge and skyline");
    expect(suffix).toContain("PLACE MATCH");
    expect(suffix).toContain("For INTERIOR place refs");
  });

  it("appends spatial layout contract to grounded suffix", () => {
    const layout = formatSpatialLayoutContract({
      settingType: "exterior",
      cameraFacing: "down Jasper Ave",
      namedBuildingSide: "right of frame",
      oppositeSide: "low rise shops",
      trafficLanes: "two-way with dashed center",
      barriersFencing: "metal rail only",
      mustMatch: ["Safeway on right"],
    });
    const suffix = buildGroundedImagePromptSuffix(
      [
        {
          dataUrl: "data:image/jpeg;base64,abc",
          imageUrl: "https://cdn.example.com/a.jpg",
          query: "Jasper Avenue Save On Foods Edmonton",
          kind: "place",
          layer: "background",
          why: "street",
          visualDescription: "Save On Foods on Jasper",
          fitScore: 0.9,
          qualityScore: 0.8,
        },
      ],
      layout,
    );
    expect(suffix).toContain("SPATIAL LAYOUT CONTRACT");
    expect(suffix).toContain("Setting type: exterior");
    expect(suffix).toContain("right of frame");
    expect(suffix).toContain("Safeway on right");
    expect(suffix).toContain("metal rail");
    expect(suffix).toContain("Ground / circulation");
    expect(suffix).toContain("jersey barriers");
    expect(suffix).toContain("keep a parking lot");
  });

  it("formats interior spatial layout for gym-like rooms", () => {
    const layout = formatSpatialLayoutContract({
      settingType: "interior",
      cameraFacing: "toward back wall",
      namedBuildingSide: "red power racks on left",
      oppositeSide: "wood plank wall on right",
      trafficLanes: "red/black turf lanes center; green turf right; rubber left",
      barriersFencing: "none",
      mustMatch: [
        "EVOLVE STRENGTH back wall branding",
        "bright red power rack row",
        "industrial ceiling with linear lights",
      ],
    });
    expect(layout).toContain("Setting type: interior");
    expect(layout).toContain("Floor zones / circulation");
    expect(layout).toContain("INTERIOR MATCH");
    expect(layout).toContain("not a generic similar venue");
    expect(layout).toContain("EVOLVE STRENGTH back wall branding");
    expect(layout).not.toContain("jersey barriers");
  });

  it("returns empty suffix when no refs", () => {
    expect(buildGroundedImagePromptSuffix([])).toBe("");
  });
});

describe("allocateSoloFanOutCaps", () => {
  it("gives place more slots than subject when both exist", () => {
    const caps = allocateSoloFanOutCaps({ hasSubject: true, hasPlace: true, maxTargets: 5 });
    expect(caps.subjectCap).toBe(IMAGE_REF_SUBJECT_WITH_PLACE_MAX);
    expect(caps.placeCap).toBe(IMAGE_REF_PLACE_FANOUT_MAX);
    expect(caps.placeCap).toBeGreaterThan(caps.subjectCap);
  });

  it("uses full place budget when subject is absent", () => {
    const caps = allocateSoloFanOutCaps({ hasSubject: false, hasPlace: true, maxTargets: 5 });
    expect(caps.subjectCap).toBe(0);
    expect(caps.placeCap).toBe(IMAGE_REF_PLACE_FANOUT_MAX);
  });
});

describe("place fan-out + spatial layout parsers", () => {
  it("keeps primary place and adds unique fan-out queries", () => {
    const out = parsePlaceFanOutTargets(
      {
        queries: [
          { query: "Jasper Avenue Edmonton Save On Foods traffic lanes", role: "lanes", layer: "midground" },
          { query: "Jasper Avenue Save On Foods Edmonton", role: "dup" },
          "Jasper Avenue Save On Foods Edmonton opposite sidewalk",
        ],
      },
      {
        kind: "place",
        query: "Jasper Avenue Save On Foods Edmonton",
        role: "setting",
        layer: "background",
        location_name: "Canada",
      },
      3,
    );
    expect(out).toHaveLength(3);
    expect(out[0]?.query).toBe("Jasper Avenue Save On Foods Edmonton");
    expect(out[1]?.query).toContain("traffic lanes");
    expect(out[1]?.location_name).toBe("Canada");
    expect(out[2]?.query).toContain("opposite sidewalk");
  });

  it("fans out subject queries preserving kind other", () => {
    const out = parseQueryFanOutTargets(
      {
        queries: [
          { query: "runner jogging toward camera outdoor", role: "front", layer: "foreground" },
        ],
      },
      {
        kind: "other",
        query: "person running jogging",
        role: "foreground runner",
        layer: "foreground",
      },
      2,
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.kind).toBe("other");
    expect(out[1]?.kind).toBe("other");
    expect(out[1]?.query).toContain("toward camera");
  });

  it("named-person subject fan-out replaces primary with identity first", () => {
    const out = parseSubjectFanOutTargets(
      {
        namedPerson: true,
        queries: [
          { query: "Steve Buscemi portrait face", role: "identity", layer: "foreground" },
          { query: "Steve Buscemi riding Segway", role: "action", layer: "foreground" },
        ],
      },
      {
        kind: "other",
        query: "Steve Buscemi riding Segway",
        role: "named person subject",
        layer: "foreground",
      },
      3,
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.query).toBe("Steve Buscemi portrait face");
    expect(out[0]?.role).toBe("identity");
    expect(out[1]?.query).toBe("Steve Buscemi riding Segway");
    expect(out.map((t) => t.query)).not.toContain("Steve Buscemi riding Segway from side profile");
  });

  it("generic subject fan-out keeps primary first when namedPerson is false", () => {
    const out = parseSubjectFanOutTargets(
      {
        namedPerson: false,
        queries: [
          { query: "runner jogging toward camera outdoor", role: "angle", layer: "foreground" },
        ],
      },
      {
        kind: "other",
        query: "person running jogging",
        role: "foreground runner",
        layer: "foreground",
      },
      2,
    );
    expect(out[0]?.query).toBe("person running jogging");
    expect(out[1]?.query).toContain("toward camera");
  });

  it("parses spatial layout fields including barriers and settingType", () => {
    const layout = parsePlaceSpatialLayout({
      settingType: "interior",
      cameraFacing: "toward facade",
      namedBuildingSide: "left",
      oppositeSide: "parked cars",
      trafficLanes: "one way eastbound",
      barriersFencing: "chain-link fence both sides",
      mustMatch: ["building left", "lanes east"],
    });
    expect(layout.settingType).toBe("interior");
    expect(layout.namedBuildingSide).toBe("left");
    expect(layout.barriersFencing).toContain("chain-link");
    expect(layout.mustMatch).toEqual(["building left", "lanes east"]);
  });

  it("parses and applies per-ref USE / DO NOT USE guidance", () => {
    const guidance = parseReferenceUsageGuidanceList(
      {
        refs: [
          {
            index: 0,
            summary: "bridge walkway structure",
            useFromImage: ["steel trusses", "wire safety fence", "yellow center line"],
            ignoreFromImage: ["watermarks", "red scribbles", "stock logo"],
          },
        ],
      },
      1,
    );
    expect(guidance[0]?.useFromImage).toContain("wire safety fence");
    expect(guidance[0]?.ignoreFromImage).not.toContain("modern cable fence");
    const applied = applyReferenceUsageGuidance(
      [
        {
          dataUrl: "data:image/jpeg;base64,abc",
          imageUrl: "https://cdn.example.com/a.jpg",
          query: "High Level Bridge Edmonton",
          kind: "place",
          layer: "background",
          why: "bridge",
          visualDescription: "old",
          fitScore: 0.9,
          qualityScore: 0.8,
        },
      ],
      guidance,
    );
    expect(applied[0]?.visualDescription).toBe("bridge walkway structure");
    expect(applied[0]?.useFromImage).toContain("wire safety fence");
    expect(applied[0]?.ignoreFromImage).toContain("watermarks");
    const suffix = buildGroundedImagePromptSuffix(applied);
    expect(suffix).toContain("USE from this photo");
    expect(suffix).toContain("wire safety fence");
    expect(suffix).toContain("DO NOT USE from this photo");
    expect(suffix).toContain("watermarks");
    expect(suffix).not.toContain("modern retrofit fences");
    expect(suffix).toContain("Features listed in any place/background/midground USE list are allowed");
    expect(suffix).toContain("FRAME BOUNDARY");
    expect(suffix).toContain("Never invent, mirror, or extend mass past the reference photo edges");
    expect(suffix).toContain("SAME SUBJECT, MULTIPLE REFS");
    expect(suffix).toContain("Never collage multiple product variants");
    expect(suffix).toContain("PLACE MATCH");
    expect(suffix).toContain("ANTI-MESH");
    expect(suffix).toContain("Do not cut, mesh, paste");
    expect(suffix).toContain("ONE CAMERA");
    expect(suffix).toContain("photo chrome");
    expect(suffix).toContain("do not globally ban authentic place geometry");
  });
});

describe("generateImage multi-ref attach", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    (globalThis as { window?: { location: { origin: string } } }).window = {
      location: { origin: "http://localhost" },
    };
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              images: [{ image_url: { url: "data:image/png;base64,AAA" } }],
            },
          },
        ],
      }),
      text: async () => "",
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("appends multiple referenceImageDataUrls as image_url parts", async () => {
    const { generateImage } = await import("@/lib/image-api");
    await generateImage({
      apiKey: "test-key",
      prompt: "draw this",
      referenceImageDataUrls: [
        "data:image/jpeg;base64,one",
        "data:image/jpeg;base64,two",
      ],
      referenceImageDataUrl: "data:image/jpeg;base64,one",
    });
    expect(globalThis.fetch).toHaveBeenCalled();
    const body = JSON.parse(
      String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body || "{}"),
    );
    const parts = body.messages?.[0]?.content;
    expect(Array.isArray(parts)).toBe(true);
    const imageParts = parts.filter((p: { type?: string }) => p.type === "image_url");
    expect(imageParts).toHaveLength(2);
  });
});
