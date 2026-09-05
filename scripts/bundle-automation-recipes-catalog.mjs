/**
 * Bundles wordpress-plugins/neo-pulse-app/recipes/*.json for the Forge Agents catalog.
 * Merged in fetchAutomationRecipes so new recipes appear before WP plugin deploy.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const recipesDir = join(root, "wordpress-plugins/neo-pulse-app/recipes");
const outPath = join(root, "src/lib/automation-recipes-catalog.bundle.json");

function isValidRecipe(data) {
  if (!data?.keyword?.trim() || !data?.name?.trim()) return false;
  const tasks = Array.isArray(data.defaultTasks) ? data.defaultTasks : [];
  const kind = data.kind ?? "template";
  const blocks = Array.isArray(data.actionBlocks) ? data.actionBlocks : [];
  if (tasks.length > 0) return true;
  return kind === "workflow_template" && blocks.length > 0;
}

function catalogItemFromRecipe(data) {
  const item = {
    keyword: data.keyword,
    name: data.name,
    description: data.description ?? "",
    notes: data.notes ?? [],
    isAutomation: true,
    category: data.category ?? "maintenance",
    verticals: data.verticals ?? [],
    tags: data.tags ?? [],
    prerequisites: data.prerequisites ?? [],
    filters: data.filters ?? {},
  };
  if (Array.isArray(data.defaultTasks) && data.defaultTasks.length > 0) {
    item.defaultTasks = data.defaultTasks;
  }
  if (data.triggerBlock) item.triggerBlock = data.triggerBlock;
  if (data.actionBlock) item.actionBlock = data.actionBlock;
  if (data.actionBlocks) item.actionBlocks = data.actionBlocks;
  if (data.kind) item.kind = data.kind;
  return item;
}

const recipes = [];
for (const file of readdirSync(recipesDir).filter((f) => f.endsWith(".json")).sort()) {
  const raw = readFileSync(join(recipesDir, file), "utf8");
  const data = JSON.parse(raw);
  if (!isValidRecipe(data)) {
    console.warn("skip invalid recipe", file);
    continue;
  }
  recipes.push(catalogItemFromRecipe(data));
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");
console.log(`Bundled ${recipes.length} automation recipes → ${outPath}`);
