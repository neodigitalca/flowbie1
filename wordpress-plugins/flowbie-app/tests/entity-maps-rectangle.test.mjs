import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");
const mapFixture = join(__dirname, "fixtures/entity-maps-serp-map-rectangle.json");
const kgFixture = join(__dirname, "fixtures/entity-maps-serp-knowledge-graph-neighborhood.json");
const noMapFixture = join(__dirname, "fixtures/entity-maps-serp-no-map.json");
const multiMapFixture = join(__dirname, "fixtures/entity-maps-serp-multiple-map-rectangles.json");
const meadowlarkFixture = join(__dirname, "fixtures/entity-maps-serp-meadowlark-maps-block.json");
const phpScript = join(pluginRoot, "scripts/test-entity-maps-rectangle.php");

function runRectangleParser(fixture) {
  const out = execFileSync("php", [phpScript, fixture], { encoding: "utf8" });
  return JSON.parse(out.trim());
}

function runKeywordBuilder(entity) {
  const out = execFileSync("php", [phpScript, "--keyword", entity], { encoding: "utf8" });
  return JSON.parse(out.trim());
}

describe("entity map rectangle parser", () => {
  it("extracts the first map item rectangle from SERP JSON", () => {
    const rect = runRectangleParser(mapFixture);
    expect(rect).toEqual({
      x: 1200,
      y: 180,
      width: 420,
      height: 360,
    });
  });

  it("prefers the largest map rectangle when multiple map items exist", () => {
    const rect = runRectangleParser(multiMapFixture);
    expect(rect).toEqual({
      x: 80,
      y: 120,
      width: 1760,
      height: 520,
    });
  });

  it("selects the full SERP maps block for Meadowlark-style fixtures", () => {
    const rect = runRectangleParser(meadowlarkFixture);
    expect(rect).toEqual({
      x: 72,
      y: 168,
      width: 1776,
      height: 480,
    });
  });

  it("derives neighborhood map crop from knowledge_graph when map type is absent", () => {
    const rect = runRectangleParser(kgFixture);
    expect(rect).toEqual({
      x: 900,
      y: 222,
      width: 300,
      height: 300,
    });
  });

  it("returns null when no map item exists", () => {
    expect(runRectangleParser(noMapFixture)).toBeNull();
  });
});

describe("entity map SERP keyword builder", () => {
  it("appends maps when entity does not already include maps", () => {
    expect(runKeywordBuilder("Meadowlark Park, Edmonton, AB")).toBe(
      "Meadowlark Park, Edmonton, AB maps",
    );
  });

  it("leaves entity unchanged when maps is already present", () => {
    expect(runKeywordBuilder("Meadowlark Park, Edmonton, AB maps")).toBe(
      "Meadowlark Park, Edmonton, AB maps",
    );
  });
});
