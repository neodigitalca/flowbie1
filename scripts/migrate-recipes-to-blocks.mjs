/**
 * Migrates recipe JSON files to include triggerBlock + actionBlock.
 * Run: node scripts/migrate-recipes-to-blocks.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const recipesDir = join(root, "wordpress-plugins/neo-pulse-app/recipes");

function inferGscKeyword(config) {
  if (config.match === "all" && config.conditions.length > 1) return "gsc-dual-decay";
  const signal = config.conditions[0]?.signal;
  if (signal === "ctr_drop") return "gsc-ctr-drop";
  if (signal === "position_drop") return "gsc-position-drop";
  if (signal === "clicks_drop") return "gsc-clicks-drop";
  if (signal === "quick_win_slipped") return "gsc-quick-win-slipped";
  if (signal === "impressions_up_ctr_down") return "gsc-impressions-ctr-decay";
  return "gsc-custom";
}

function inferActionKeyword(kind, payload = {}) {
  if (kind === "content_optimizer_meta") return "content-optimizer-meta";
  if (kind === "content_optimizer") return "content-optimizer-full";
  if (kind === "post_creator") return "post-creator-monthly";
  if (kind === "gsc_reporting") return payload.comparePreset === "yoy" ? "gsc-report-yoy" : "gsc-report-mom";
  return `action-${kind || "custom"}`;
}

function taskToTriggerBlock(task) {
  if (task.scheduleMode === "calendar") {
    const rule = task.recurrenceRule ?? "none";
    const frequency = rule === "none" ? "once" : rule;
    return {
      keyword: `schedule-${frequency}`,
      kind: "calendar",
      frequency,
      startDate: (task.dueDate ?? "").slice(0, 10) || "2026-09-01",
      time: (task.dueTime ?? "09:00").slice(0, 5),
      ...(task.executionPayload?.targetBucket ? { targetBucket: task.executionPayload.targetBucket } : {}),
    };
  }
  const config = task.triggerConfig ?? { sources: ["gsc"], match: "any", conditions: [], lookbackDays: 28, compareDays: 28, pollHours: 24, cooldownHours: 72, maxUrls: 5 };
  if (config.sources?.[0] === "schedule") {
    return {
      keyword: "schedule-poll",
      kind: "poll",
      pollHours: config.pollHours ?? 24,
      targetBucket: task.executionPayload?.targetBucket,
      triggerConfig: config,
    };
  }
  return {
    keyword: inferGscKeyword(config),
    kind: "gsc",
    source: config.sources?.[0] ?? "gsc",
    targetBucket: task.executionPayload?.targetBucket,
    triggerConfig: config,
  };
}

function taskToActionBlock(task) {
  return {
    keyword: inferActionKeyword(task.executionKind, task.executionPayload),
    executionKind: task.executionKind,
    executionPayload: task.executionPayload ?? {},
    title: task.title,
  };
}

function compileTaskFromBlocks(recipe, actionBlock, triggerBlock) {
  const base = {
    keyword: actionBlock.title ? `${recipe.keyword}-run` : `${recipe.keyword}-task`,
    title: actionBlock.title ?? recipe.name,
    status: "todo",
    assignPulse: true,
    executionKind: actionBlock.executionKind,
    executionPayload: { ...actionBlock.executionPayload },
  };
  if (triggerBlock.kind === "calendar") {
    return {
      ...base,
      scheduleMode: "calendar",
      dueDate: triggerBlock.startDate,
      dueTime: triggerBlock.time,
      recurrenceRule: triggerBlock.frequency === "once" ? "none" : triggerBlock.frequency,
    };
  }
  return {
    ...base,
    scheduleMode: "trigger",
    recurrenceRule: "none",
    triggerConfig: triggerBlock.triggerConfig,
  };
}

const files = readdirSync(recipesDir).filter((f) => f.endsWith(".json"));
let updated = 0;

for (const file of files) {
  const path = join(recipesDir, file);
  const recipe = JSON.parse(readFileSync(path, "utf8"));
  const tasks = recipe.defaultTasks ?? [];
  if (!tasks.length) continue;

  const triggerBlock = taskToTriggerBlock(tasks[0]);
  const actionBlocks = tasks.map((t) => taskToActionBlock(t));
  const defaultTasks = actionBlocks.map((ab, i) =>
    compileTaskFromBlocks(recipe, ab, triggerBlock, i),
  );
  defaultTasks.forEach((t, i) => {
    t.keyword = tasks[i].keyword ?? t.keyword;
    t.title = tasks[i].title ?? t.title;
  });

  const next = {
    ...recipe,
    triggerBlock,
    actionBlock: actionBlocks[0],
    ...(actionBlocks.length > 1 ? { actionBlocks } : {}),
    defaultTasks,
  };

  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  updated++;
  console.log(`Updated ${file}`);
}

console.log(`Done. ${updated} recipes migrated.`);
