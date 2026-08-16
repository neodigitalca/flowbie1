import type { TaskTemplateTaskDef } from "@/lib/tasks-types";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { TaskTriggerCondition, TaskTriggerSignal } from "@/lib/task-trigger-types";

export const AUTOMATION_RECIPE_BUCKET_LABELS: Record<string, string> = {
  pages: "Static pages (services, about, landing pages)",
  posts: "Blog posts",
  sap: "Entity / service-area pages (SAP sitemap)",
  all: "Pages, posts, and entity URLs",
};

export const AUTOMATION_RECIPE_PREREQUISITE_LABELS: Record<string, string> = {
  gsc: "Google Search Console connected",
  wordpress: "WordPress site linked in Integrations",
  "entity-sitemap": "Entity sitemap configured for SAP URLs",
};

export function explainTriggerSignal(
  signal: TaskTriggerSignal,
  condition: Pick<TaskTriggerCondition, "operator" | "value" | "minImpressions">,
): string {
  const min = condition.minImpressions ?? 0;
  const value = condition.value;
  switch (signal) {
    case "impressions_up_ctr_down":
      return `Impressions rose vs the prior 28 days AND click-through rate fell (Google shows the URL more often, but fewer people click)${min > 0 ? `, with at least ${min} impressions` : ""}.`;
    case "clicks_drop":
      return `Total clicks from Google Search fell at least ${value}% vs the prior 28 days${min > 0 ? `, with at least ${min} impressions` : ""}.`;
    case "ctr_drop":
      return `Click-through rate fell at least ${value}% vs the prior 28 days (similar visibility, fewer clicks)${min > 0 ? `, with at least ${min} impressions` : ""}.`;
    case "position_drop":
      return `Average ranking position worsened by at least ${value} spots (e.g. position 5 to 8)${min > 0 ? `, with at least ${min} impressions` : ""}.`;
    case "quick_win_slipped":
      return `The URL left positions 4–10 (the band where small ranking gains are easiest)${min > 0 ? `, with at least ${min} impressions` : ""}.`;
    default:
      return signal;
  }
}

export function explainExecutionKind(kind: string | undefined, bucket?: string): string {
  if (kind === "gsc_reporting") {
    return "Generates a full GSC markdown report with MoM or YoY compare and optional local download.";
  }
  if (kind === "post_creator") {
    return "Generates new blog posts with harness body, meta, FAQ, and AI featured image, then schedules them on WordPress.";
  }
  if (kind === "content_optimizer_meta") {
    if (bucket === "pages") {
      return "Updates title, meta description, and SEO extra text. Page body content is not rewritten.";
    }
    return "Updates title and meta description only (no body rewrite).";
  }
  return "Full AISEO: rewrites title, meta, headings, and body copy.";
}

function explainExecutionAction(kind: string | undefined, bucket?: string): string {
  if (kind === "gsc_reporting") {
    return "Then NEO Pulse fetches GSC data, runs the reporting pipeline, and saves markdown plus CSV bundle to your PC.";
  }
  if (kind === "post_creator") {
    return "Then NEO Pulse generates blog ideas, writes full harness content, optimizes meta, creates featured images, and publishes or schedules posts on WordPress.";
  }
  if (kind === "content_optimizer_meta") {
    if (bucket === "pages") {
      return "Then NEO Pulse updates title, meta description, and SEO extra text. Page body content is not rewritten.";
    }
    return "Then NEO Pulse updates the title and meta description (no body rewrite).";
  }
  return "Then NEO Pulse rewrites the title, meta, headings, and body copy.";
}

export function buildTaskRunSteps(task: TaskTemplateTaskDef): string[] {
  const kind = task.executionKind ?? "";
  if (kind === "gsc_reporting") {
    const preset = task.executionPayload?.comparePreset === "yoy" ? "year over year" : "month over month";
    const steps = [
      "Calendar schedule (Edmonton time).",
      `Compare preset: ${preset}.`,
    ];
    if (task.dueDate && task.dueTime) {
      steps.push(`Runs on ${task.dueDate.slice(0, 10)} at ${task.dueTime} (monthly when recurrence is set).`);
    }
    steps.push(explainExecutionAction(kind));
    return steps;
  }

  if (kind === "post_creator") {
    const count = task.executionPayload?.postCount ?? 1;
    const times = task.executionPayload?.scheduleTimesPerMonth ?? count;
    const steps = [
      "Calendar schedule (Edmonton time).",
      `Creates ${count} post${count === 1 ? "" : "s"} per run, scheduled ${times} time${times === 1 ? "" : "s"} per month.`,
    ];
    if (task.dueDate && task.dueTime) {
      steps.push(`Runs on ${task.dueDate.slice(0, 10)} at ${task.dueTime} (monthly when recurrence is set).`);
    }
    steps.push(explainExecutionAction(kind));
    return steps;
  }

  const bucket = task.executionPayload?.targetBucket ?? "pages";
  const bucketLabel = AUTOMATION_RECIPE_BUCKET_LABELS[bucket] ?? bucket;
  const trigger = task.triggerConfig;
  const steps: string[] = [
    `Watches ${bucketLabel.toLowerCase()}.`,
    "Polls Google Search Console every 24 hours and compares the last 28 days to the prior 28 days.",
  ];

  const conditions = trigger?.conditions ?? [];
  if (conditions.length > 0) {
    if (conditions.length === 1) {
      steps.push(`Runs when ${explainTriggerSignal(conditions[0].signal, conditions[0]).replace(/\.$/, "").toLowerCase()}.`);
    } else if (trigger?.match === "all") {
      steps.push("Runs only when all of these GSC checks pass on the same URL:");
      for (const condition of conditions) {
        steps.push(explainTriggerSignal(condition.signal, condition));
      }
    } else {
      steps.push("Runs when any of these GSC checks pass:");
      for (const condition of conditions) {
        steps.push(explainTriggerSignal(condition.signal, condition));
      }
    }
  }

  steps.push(explainExecutionAction(task.executionKind, bucket));

  if (trigger?.maxUrls != null && trigger.maxUrls > 0) {
    steps.push(`Up to ${trigger.maxUrls} URLs per cycle.`);
  }
  if (trigger?.cooldownHours != null && trigger.cooldownHours > 0) {
    steps.push(`Same URL waits ${trigger.cooldownHours} hours before it can run again.`);
  }

  return steps;
}

export type RecipeGuideBlock = {
  title?: string;
  steps: string[];
};

/** One semantic guide for the detail panel (no duplicate notes + what-runs). */
export function buildRecipeGuideBlocks(recipe: AutomationRecipeCatalogItem): RecipeGuideBlock[] {
  const tasks = recipe.defaultTasks ?? [];
  if (tasks.length === 0) return [];

  if (tasks.length === 1) {
    return [{ steps: buildTaskRunSteps(tasks[0]) }];
  }

  return tasks.map((task) => ({
    title: task.title,
    steps: buildTaskRunSteps(task),
  }));
}
