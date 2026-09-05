import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { taskExecutionKindToRecipe } from "@/lib/agent-runs-types";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const registryPath = path.join(
  repoRoot,
  "wordpress-plugins/neo-pulse-app/includes/agent-runs/class-agent-runs-recipe-registry.php",
);

function phpRecipeKeys(): string[] {
  const source = fs.readFileSync(registryPath, "utf8");
  const keys = [...source.matchAll(/^\s*'([a-z0-9_]+)'\s*=>\s*array\(/gm)].map((match) => match[1]);
  return keys;
}

describe("content_gap_check agent recipe registry", () => {
  it("maps execution kind to a PHP-registered recipe key", () => {
    expect(taskExecutionKindToRecipe("content_gap_check")).toBe("content_gap_check");
    expect(phpRecipeKeys()).toContain("content_gap_check");
  });
});
