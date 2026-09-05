#!/usr/bin/env npx tsx
/**
 * Verify optimize output for blindmagic Smart Blinds post (or any HTML path arg).
 * Usage: npx tsx scripts/verify-optimize-blindmagic-post.ts [path/to/content.html]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_LEGACY_PINNED_BLOG_H2S } from "../src/lib/content-optimization/serp-h2-outline";
import {
  assertOptimizeOutputDiffersFromLive,
  containsLegacyPinnedBlogH2,
  extractH2Titles,
} from "../src/lib/content-optimization/optimize-output-verification";

const SAMPLE_LIVE = `<h2>Overview</h2><p>Intro.</p><h2>Criteria That Decide The Winner</h2><p>Body.</p>`;
const SAMPLE_UPLOAD = `<h2>Overview</h2><p>New intro.</p><h2>Motorization Features For Smart Blinds</h2><p>New body.</p>`;

function assertNoPinnedInHtml(label: string, html: string): void {
  const pinned = containsLegacyPinnedBlogH2(html);
  if (pinned) {
    throw new Error(`${label} contains legacy pinned H2: ${pinned}`);
  }
  const h2s = extractH2Titles(html);
  console.log(`${label} H2s (${h2s.length}):`, h2s.join(" | "));
}

function main(): void {
  const target = process.argv[2]?.trim();
  if (target) {
    const html = readFileSync(resolve(target), "utf8");
    assertNoPinnedInHtml(resolve(target), html);
    console.log("OK: no legacy pinned blog H2s in file.");
    return;
  }

  assertOptimizeOutputDiffersFromLive(SAMPLE_LIVE, SAMPLE_UPLOAD);
  assertNoPinnedInHtml("sample upload", SAMPLE_UPLOAD);

  const badUpload = `<h2>Overview</h2><h2>${ALL_LEGACY_PINNED_BLOG_H2S[0]}</h2>`;
  if (!containsLegacyPinnedBlogH2(badUpload)) {
    throw new Error("Expected legacy pinned detection to match BLOG_PINNED_H2S string");
  }

  console.log("OK: optimize verification helpers reject live copy and legacy pinned H2s.");
  console.log(`Tracked legacy pinned titles: ${ALL_LEGACY_PINNED_BLOG_H2S.length}`);
}

main();
