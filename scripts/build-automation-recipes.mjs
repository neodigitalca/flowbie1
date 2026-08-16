/**
 * Generates wordpress-plugins/neo-pulse-app/recipes/*.json from catalog defs.
 * Run: node scripts/build-automation-recipes.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "wordpress-plugins/neo-pulse-app/recipes");
mkdirSync(outDir, { recursive: true });

function trigger(conditions, match = "any", overrides = {}) {
  return {
    sources: ["gsc"],
    match,
    conditions,
    lookbackDays: 28,
    compareDays: 28,
    pollHours: 24,
    cooldownHours: 72,
    maxUrls: 5,
    ...overrides,
  };
}

function action(keyword, title, executionKind, targetBucket, triggerConfig) {
  return {
    keyword,
    title,
    status: "todo",
    assignPulse: true,
    scheduleMode: "trigger",
    executionKind,
    executionPayload: { targetBucket, updateMode: "update" },
    triggerConfig,
  };
}

const POLL = "Polls Google Search Console every 24 hours.";
const COOLDOWN = "Same URL waits 72 hours before it can run again.";
const SIG_IMPR_UP_CTR_DOWN =
  "Impressions rose vs the prior 28 days AND click-through rate fell (Google shows the page more often, but fewer searchers click).";
const SIG_CLICKS = (pct, min) =>
  `Total clicks from Google Search fell at least ${pct}% vs the prior 28 days, with at least ${min} impressions.`;
const SIG_CTR = (pct, min) =>
  `Click-through rate fell at least ${pct}% vs the prior 28 days (similar visibility, fewer clicks), with at least ${min} impressions.`;
const SIG_POSITION = (spots, min) =>
  `Average ranking position worsened by at least ${spots} spots, with at least ${min} impressions.`;
const SIG_QUICK_WIN =
  "The URL left positions 4–10 (where small ranking gains are easiest).";
const PAGES_META_ACTION =
  "Updates title, meta description, and SEO extra text. Page body content is not rewritten.";

const recipes = [
  {
    keyword: "seo-autopilot-flywheel",
    name: "SEO Autopilot Flywheel",
    description: "Meta-optimize pages and run full AISEO on posts when GSC metrics slip.",
    notes: [
      POLL,
      "Covers static pages and blog posts in one installed automation.",
      "Pages: updates title, meta, and SEO extra text when ranking worsens 3+ spots or the URL leaves positions 4–10.",
      "Posts: full rewrite when click-through rate falls 15%+ vs the prior 28 days (snippet or body no longer matches what searchers want).",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "meta", "posts", "pages", "multi"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta", "content_optimizer"],
      targetBuckets: ["pages", "posts"],
      triggerSignals: ["position_drop", "quick_win_slipped", "ctr_drop"],
      actionCount: 2,
    },
    defaultTasks: [
      action(
        "meta-pages",
        "Meta optimize pages on trigger",
        "content_optimizer_meta",
        "pages",
        trigger(
          [
            { signal: "position_drop", operator: "gte", value: 3, minImpressions: 100 },
            { signal: "quick_win_slipped", operator: "gte", value: 0, minImpressions: 50 },
          ],
          "any",
        ),
      ),
      action(
        "aiseo-posts",
        "Full AISEO on posts on trigger",
        "content_optimizer",
        "posts",
        trigger([{ signal: "ctr_drop", operator: "gte", value: 15, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "intent-decay-radar",
    name: "Intent Decay Radar",
    description: "Meta and extra text on pages when Google shows them more often but fewer people click.",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Runs when " + SIG_IMPR_UP_CTR_DOWN.toLowerCase(),
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general", "editorial"],
    tags: ["gsc", "pages", "decay", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["impressions_up_ctr_down"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "intent-decay-pages",
        "Meta + extra text on decaying pages",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 }], "all"),
      ),
    ],
  },
  {
    keyword: "entity-sap-guardian",
    name: "Entity SAP Guardian",
    description: "Full AISEO on entity/service-area pages when rankings drop.",
    notes: [
      POLL,
      "Scope: entity and service-area pages in the SAP (entity sitemap) bucket.",
      "Runs when " + SIG_POSITION(3, 50).toLowerCase(),
      "NEO Pulse rewrites the full page, not just title and meta.",
      "Requires an entity sitemap so SAP URLs are in scope.",
      COOLDOWN,
    ],
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["gsc", "entity", "sap", "position"],
    prerequisites: ["gsc", "wordpress", "entity-sitemap"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["sap"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "sap-position-guard",
        "Refresh entity pages on position drop",
        "content_optimizer",
        "sap",
        trigger([{ signal: "position_drop", operator: "gte", value: 3, minImpressions: 50 }]),
      ),
    ],
  },
  {
    keyword: "sap-quick-win-recovery",
    name: "SAP Quick Win Recovery",
    description: "Meta-only fix when entity pages leave positions 4–10.",
    notes: [
      POLL,
      "Scope: entity/service-area pages (SAP bucket).",
      "Runs when " + SIG_QUICK_WIN.toLowerCase(),
      "Updates title and meta description only (faster and cheaper than a full rewrite).",
      COOLDOWN,
    ],
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["gsc", "sap", "meta", "quick-win"],
    prerequisites: ["gsc", "wordpress", "entity-sitemap"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["sap"],
      triggerSignals: ["quick_win_slipped"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "sap-quick-win",
        "Meta optimize SAP pages on quick win slip",
        "content_optimizer_meta",
        "sap",
        trigger([{ signal: "quick_win_slipped", operator: "gte", value: 0, minImpressions: 30 }]),
      ),
    ],
  },
  {
    keyword: "sap-ctr-rescue",
    name: "SAP CTR Rescue",
    description: "Full AISEO on entity pages when click-through rate falls.",
    notes: [
      POLL,
      "Scope: entity/service-area pages (SAP bucket).",
      "Runs when " + SIG_CTR(15, 50).toLowerCase(),
      "NEO Pulse rewrites title, meta, headings, and body on the entity page.",
      COOLDOWN,
    ],
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["gsc", "sap", "ctr"],
    prerequisites: ["gsc", "wordpress", "entity-sitemap"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["sap"],
      triggerSignals: ["ctr_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "sap-ctr-rescue",
        "Full AISEO on SAP pages when CTR drops",
        "content_optimizer",
        "sap",
        trigger([{ signal: "ctr_drop", operator: "gte", value: 15, minImpressions: 50 }]),
      ),
    ],
  },
  {
    keyword: "sap-clicks-recovery",
    name: "SAP Clicks Recovery",
    description: "Full AISEO on entity pages when total search clicks decline.",
    notes: [
      POLL,
      "Scope: entity/service-area pages (SAP bucket).",
      "Runs when " + SIG_CLICKS(15, 50).toLowerCase(),
      "Useful when rankings look stable but traffic from Google is still slipping.",
      COOLDOWN,
    ],
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["gsc", "sap", "clicks"],
    prerequisites: ["gsc", "wordpress", "entity-sitemap"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["sap"],
      triggerSignals: ["clicks_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "sap-clicks",
        "Refresh SAP pages on clicks drop",
        "content_optimizer",
        "sap",
        trigger([{ signal: "clicks_drop", operator: "gte", value: 15, minImpressions: 50 }]),
      ),
    ],
  },
  {
    keyword: "pages-position-guard",
    name: "Pages Position Guard",
    description: "Meta and extra text on static pages when average ranking position worsens.",
    notes: [
      POLL,
      "Scope: static pages (services, about, landing pages).",
      "Runs when " + SIG_POSITION(3, 100).toLowerCase(),
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "position", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "pages-position",
        "Meta + extra text on pages when position drops",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "position_drop", operator: "gte", value: 3, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "pages-meta-first",
    name: "Pages Meta First",
    description: "Meta and extra text upkeep on pages when ranking or click-through rate slips.",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Runs when " + SIG_POSITION(3, 100).toLowerCase() + " OR when " + SIG_CTR(10, 100).toLowerCase(),
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "maintenance",
    verticals: ["general"],
    tags: ["gsc", "pages", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["position_drop", "ctr_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "pages-meta",
        "Meta optimize pages on position or CTR drop",
        "content_optimizer_meta",
        "pages",
        trigger(
          [
            { signal: "position_drop", operator: "gte", value: 3, minImpressions: 100 },
            { signal: "ctr_drop", operator: "gte", value: 10, minImpressions: 100 },
          ],
          "any",
        ),
      ),
    ],
  },
  {
    keyword: "pages-intent-decay",
    name: "Pages Intent Decay",
    description: "Meta and extra text on static pages when Google shows them more but fewer people click.",
    notes: [
      POLL,
      "Scope: static pages only (Pages bucket).",
      "Runs when " + SIG_IMPR_UP_CTR_DOWN.toLowerCase(),
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "decay", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["impressions_up_ctr_down"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "pages-intent-decay",
        "Meta + extra text on pages on intent decay signal",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 }], "all"),
      ),
    ],
  },
  {
    keyword: "pages-clicks-drop",
    name: "Pages Clicks Drop",
    description: "Meta and extra text on static pages when total search clicks fall.",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Runs when " + SIG_CLICKS(15, 100).toLowerCase(),
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "clicks", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["clicks_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "pages-clicks",
        "Meta + extra text on pages on clicks drop",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "clicks_drop", operator: "gte", value: 15, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "posts-ctr-rescue",
    name: "Posts CTR Rescue",
    description: "Full AISEO on blog posts when click-through rate falls.",
    notes: [
      POLL,
      "Scope: blog posts (Posts bucket).",
      "Runs when " + SIG_CTR(15, 100).toLowerCase(),
      "NEO Pulse rewrites title, meta, headings, and body when the snippet underperforms.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["editorial", "general"],
    tags: ["gsc", "posts", "ctr"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts"],
      triggerSignals: ["ctr_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "posts-ctr",
        "Full AISEO on posts when CTR drops",
        "content_optimizer",
        "posts",
        trigger([{ signal: "ctr_drop", operator: "gte", value: 15, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "posts-position-recovery",
    name: "Posts Position Recovery",
    description: "Full AISEO on blog posts when average ranking position worsens.",
    notes: [
      POLL,
      "Scope: blog posts (Posts bucket).",
      "Runs when " + SIG_POSITION(3, 100).toLowerCase(),
      "NEO Pulse rewrites the full post to compete for the keyword again.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["editorial", "general"],
    tags: ["gsc", "posts", "position"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "posts-position",
        "Full AISEO on posts when position drops",
        "content_optimizer",
        "posts",
        trigger([{ signal: "position_drop", operator: "gte", value: 3, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "posts-meta-quick-fix",
    name: "Posts Meta Quick Fix",
    description: "Meta-only fixes on posts when click-through rate slips.",
    notes: [
      POLL,
      "Scope: blog posts (Posts bucket).",
      "Runs when " + SIG_CTR(10, 80).toLowerCase(),
      "Updates title and meta only (does not rewrite post body).",
      COOLDOWN,
    ],
    category: "maintenance",
    verticals: ["editorial", "general"],
    tags: ["gsc", "posts", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["posts"],
      triggerSignals: ["ctr_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "posts-meta",
        "Meta optimize posts on CTR drop",
        "content_optimizer_meta",
        "posts",
        trigger([{ signal: "ctr_drop", operator: "gte", value: 10, minImpressions: 80 }]),
      ),
    ],
  },
  {
    keyword: "posts-quick-win-slipped",
    name: "Posts Quick Win Slipped",
    description: "Full AISEO when blog posts leave positions 4–10.",
    notes: [
      POLL,
      "Scope: blog posts (Posts bucket).",
      "Runs when " + SIG_QUICK_WIN.toLowerCase(),
      "NEO Pulse rewrites the post to push it back toward page one.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["editorial", "general"],
    tags: ["gsc", "posts", "quick-win"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts"],
      triggerSignals: ["quick_win_slipped"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "posts-quick-win",
        "Full AISEO on posts when quick win slips",
        "content_optimizer",
        "posts",
        trigger([{ signal: "quick_win_slipped", operator: "gte", value: 0, minImpressions: 50 }]),
      ),
    ],
  },
  {
    keyword: "blog-freshness-radar",
    name: "Blog Freshness Radar",
    description: "Full AISEO on blog posts when total search clicks decline.",
    notes: [
      POLL,
      "Scope: blog posts (Posts bucket).",
      "Runs when " + SIG_CLICKS(20, 150).toLowerCase(),
      "Higher click-drop threshold (20%) for noisier post-level GSC data.",
      COOLDOWN,
    ],
    category: "maintenance",
    verticals: ["editorial"],
    tags: ["gsc", "posts", "clicks", "blog"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts"],
      triggerSignals: ["clicks_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "blog-freshness",
        "Refresh blog posts on clicks drop",
        "content_optimizer",
        "posts",
        trigger([{ signal: "clicks_drop", operator: "gte", value: 20, minImpressions: 150 }]),
      ),
    ],
  },
  {
    keyword: "sitewide-meta-sweep",
    name: "Sitewide Meta Sweep",
    description: "Meta-only sweep across all content types when ranking worsens.",
    notes: [
      POLL,
      "Scope: pages, posts, and entity URLs (all buckets).",
      "Runs when " + SIG_POSITION(4, 80).toLowerCase(),
      "Updates title and meta only, capped at 3 URLs per cycle.",
      COOLDOWN,
    ],
    category: "maintenance",
    verticals: ["general"],
    tags: ["gsc", "meta", "all"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["all"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "sitewide-meta",
        "Meta sweep all buckets on position drop",
        "content_optimizer_meta",
        "all",
        trigger([{ signal: "position_drop", operator: "gte", value: 4, minImpressions: 80 }], "any", {
          maxUrls: 3,
        }),
      ),
    ],
  },
  {
    keyword: "sitewide-decay-radar",
    name: "Sitewide Decay Radar",
    description: "Full AISEO on posts and entity pages when impressions rise but clicks fall.",
    notes: [
      POLL,
      "Scope: blog posts and entity/service-area pages (Posts + SAP buckets). Static pages are not in scope.",
      "Runs when " + SIG_IMPR_UP_CTR_DOWN.toLowerCase(),
      "NEO Pulse rewrites matched posts and entity URLs, capped at 3 per bucket per cycle.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "posts", "sap", "decay", "multi"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts", "sap"],
      triggerSignals: ["impressions_up_ctr_down"],
      actionCount: 2,
    },
    defaultTasks: [
      action(
        "sitewide-decay-posts",
        "Full AISEO on posts on intent decay",
        "content_optimizer",
        "posts",
        trigger([{ signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 }], "all", {
          maxUrls: 3,
        }),
      ),
      action(
        "sitewide-decay-sap",
        "Full AISEO on entity pages on intent decay",
        "content_optimizer",
        "sap",
        trigger([{ signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 }], "all", {
          maxUrls: 3,
        }),
      ),
    ],
  },
  {
    keyword: "strict-position-alert",
    name: "Strict Position Alert",
    description: "Meta and extra text on pages when ranking falls 5+ spots (major slips only).",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Runs when " + SIG_POSITION(5, 100).toLowerCase(),
      PAGES_META_ACTION,
      "Ignores small daily ranking noise.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "meta", "strict"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "strict-position",
        "Meta optimize pages on major position drop",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "position_drop", operator: "gte", value: 5, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "local-pages-watch",
    name: "Local Pages Watch",
    description: "Meta and extra text on high-traffic local landing pages when ranking slips.",
    notes: [
      POLL,
      "Scope: local landing pages in the Pages bucket (not SAP entity grids).",
      "Runs when " + SIG_POSITION(2, 200).toLowerCase(),
      "Lower position threshold (2 spots) because local SERPs move quickly.",
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["gsc", "pages", "local", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "local-pages",
        "Meta + extra text on local pages on position drop",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "position_drop", operator: "gte", value: 2, minImpressions: 200 }]),
      ),
    ],
  },
  {
    keyword: "dual-signal-pages",
    name: "Dual Signal Pages",
    description: "Static pages must show dual GSC decay signals before meta and extra text updates run.",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Both checks below must pass on the same URL before anything runs:",
      SIG_IMPR_UP_CTR_DOWN,
      SIG_CLICKS(10, 100),
      PAGES_META_ACTION + " Up to 5 pages per cycle.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "multi-signal", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["impressions_up_ctr_down", "clicks_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "dual-signal",
        "Meta + extra text on pages on dual GSC decay signals",
        "content_optimizer_meta",
        "pages",
        trigger(
          [
            { signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 },
            { signal: "clicks_drop", operator: "gte", value: 10, minImpressions: 100 },
          ],
          "all",
        ),
      ),
    ],
  },
];

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
  const config = task.triggerConfig ?? {
    sources: ["gsc"],
    match: "any",
    conditions: [],
    lookbackDays: 28,
    compareDays: 28,
    pollHours: 24,
    cooldownHours: 72,
    maxUrls: 5,
  };
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

function attachBlocks(recipe) {
  const tasks = recipe.defaultTasks ?? [];
  if (tasks.length === 0) return recipe;
  const triggerBlock = taskToTriggerBlock(tasks[0]);
  const actionBlock = taskToActionBlock(tasks[0]);
  const actionBlocks = tasks.length > 1 ? tasks.map(taskToActionBlock) : undefined;
  return { ...recipe, triggerBlock, actionBlock, ...(actionBlocks ? { actionBlocks } : {}) };
}

for (const recipe of recipes) {
  for (const task of recipe.defaultTasks ?? []) {
    if (
      task.executionPayload?.targetBucket === "pages" &&
      task.executionKind !== "content_optimizer_meta"
    ) {
      throw new Error(`${recipe.keyword}: pages bucket must use content_optimizer_meta`);
    }
  }

  const payload = {
    ...attachBlocks(recipe),
    isAutomation: true,
    kind: "template",
  };
  const path = join(outDir, `${recipe.keyword}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("wrote", path);
}

console.log(`Generated ${recipes.length} recipes.`);
