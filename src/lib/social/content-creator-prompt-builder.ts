import { cellString } from "@/lib/social/content-creator-types";
import {
  CONTENT_CREATOR_EVENTS_RULE,
  CONTENT_CREATOR_FB_HASHTAG_MAX,
  CONTENT_CREATOR_FB_MAX_CHARS,
  CONTENT_CREATOR_FB_TARGET_CHARS,
  CONTENT_CREATOR_IG_HASHTAG_MAX,
  CONTENT_CREATOR_IG_HASHTAG_MIN,
  CONTENT_CREATOR_IG_MAX_CHARS,
  CONTENT_CREATOR_IG_TARGET_CHARS,
  CONTENT_CREATOR_LINKEDIN_HASHTAG_MAX,
  CONTENT_CREATOR_LINKEDIN_MAX_CHARS,
  CONTENT_CREATOR_LINKEDIN_TARGET_CHARS,
} from "@/lib/social/content-creator-social-copy-limits";
import type { ContentCreatorSocialBrief } from "@/lib/social/content-creator-social-brief";

export { callMetaAdJsonCompletion as callContentCreatorJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
export { CONTENT_CREATOR_EVENTS_RULE };

export const CONTENT_SOCIAL_PLATFORMS = {
  facebook: {
    label: "Facebook",
    targetChars: CONTENT_CREATOR_FB_TARGET_CHARS,
    maxChars: CONTENT_CREATOR_FB_MAX_CHARS,
    tone: "friendly and engaging",
    hashtags: true,
    hashtagMax: CONTENT_CREATOR_FB_HASHTAG_MAX,
    cta: true,
  },
  instagram: {
    label: "Instagram",
    targetChars: CONTENT_CREATOR_IG_TARGET_CHARS,
    maxChars: CONTENT_CREATOR_IG_MAX_CHARS,
    tone: "visual and aspirational",
    hashtags: true,
    hashtagMin: CONTENT_CREATOR_IG_HASHTAG_MIN,
    hashtagMax: CONTENT_CREATOR_IG_HASHTAG_MAX,
    cta: true,
  },
  linkedin: {
    label: "LinkedIn",
    targetChars: CONTENT_CREATOR_LINKEDIN_TARGET_CHARS,
    maxChars: CONTENT_CREATOR_LINKEDIN_MAX_CHARS,
    tone: "professional and authoritative",
    hashtags: true,
    hashtagMax: CONTENT_CREATOR_LINKEDIN_HASHTAG_MAX,
    cta: true,
  },
} as const;

export const CONTENT_CREATOR_PLATFORM_LIMITS_PROMPT = `Platform character targets (enforce in copy):
- Instagram/Facebook field: hook target ${CONTENT_CREATOR_IG_TARGET_CHARS} chars visible; hard max ${CONTENT_CREATOR_IG_MAX_CHARS} total with hashtags; ${CONTENT_CREATOR_IG_HASHTAG_MIN} to ${CONTENT_CREATOR_IG_HASHTAG_MAX} hashtags on last line; hook plus at most one short support line
- Facebook cross-post: target ${CONTENT_CREATOR_FB_TARGET_CHARS} chars, max ${CONTENT_CREATOR_FB_MAX_CHARS}, up to ${CONTENT_CREATOR_FB_HASHTAG_MAX} hashtags
- LinkedIn: target ${CONTENT_CREATOR_LINKEDIN_TARGET_CHARS} chars, max ${CONTENT_CREATOR_LINKEDIN_MAX_CHARS}, up to ${CONTENT_CREATOR_LINKEDIN_HASHTAG_MAX} hashtags; 2 to 3 short paragraphs`;

export function requireAgentString(value: unknown, field: string, agentLabel: string): string {
  if (typeof value !== "string") {
    throw new Error(`${agentLabel} returned invalid ${field} (expected string).`);
  }
  if (value.length === 0) {
    throw new Error(`${agentLabel} missing ${field}.`);
  }
  return value;
}

export function clampSocialCopy(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

export function buildContentCreatorContextBlock(options: {
  siteName?: unknown;
  siteUrl?: unknown;
  keyword?: unknown;
  landingPageUrl?: unknown;
  events?: unknown;
  pageContext?: unknown;
}): string {
  const parts: string[] = [];
  const siteName = cellString(options.siteName);
  const siteUrl = cellString(options.siteUrl);
  if (siteName.length > 0 || siteUrl.length > 0) {
    if (siteName.length > 0 && siteUrl.length > 0) parts.push(`Site: ${siteName} (${siteUrl})`);
    else if (siteName.length > 0) parts.push(`Site: ${siteName}`);
    else parts.push(`Site: ${siteUrl}`);
  }
  const keyword = cellString(options.keyword);
  const landingPageUrl = cellString(options.landingPageUrl);
  const events = cellString(options.events);
  const pageContext = cellString(options.pageContext);
  if (keyword.length > 0) parts.push(`Keyword: ${keyword}`);
  if (landingPageUrl.length > 0) parts.push(`Landing page: ${landingPageUrl}`);
  if (events.length > 0) parts.push(`Event context: ${events}`);
  if (pageContext.length > 0) parts.push(`Page context:\n${pageContext}`);
  return parts.join("\n");
}

export function buildContentCreatorBriefBlock(brief: ContentCreatorSocialBrief): string {
  return [
    "Social strategy brief:",
    `Strategy: ${brief.strategyStatement}`,
    `Caption hook: ${brief.captionHook}`,
    `Post angle: ${brief.postAngle}`,
    `CTA: ${brief.ctaLine}`,
    `Hashtags: ${brief.hashtags.join(" ")}`,
    brief.platformNotes ? `LinkedIn notes: ${brief.platformNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
