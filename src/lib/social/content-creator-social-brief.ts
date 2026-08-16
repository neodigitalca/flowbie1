import { META_FOCUS_KEYWORD_GRAMMAR_RULES } from "@/lib/ppc/meta-ad-focus-keyword-grammar";
import {
  META_INSTAGRAM_CAPTION_RULES,
  META_VALUE_PROPOSITION_RULES,
  resolveMetaAdvertiserLabel,
} from "@/lib/ppc/meta-ad-prompt-builder";
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

export type ContentCreatorSocialBrief = {
  strategyStatement: string;
  captionHook: string;
  postAngle: string;
  ctaLine: string;
  hashtags: string[];
  platformNotes?: string;
};

export function buildContentCreatorSocialBriefSystemPrompt(siteName?: string): string {
  const advertiser = resolveMetaAdvertiserLabel(siteName);
  return `You are a senior organic social strategist for ${advertiser}.

Plan the post strategy before any platform copy is written. Lock captionHook, CTA, and hashtags.
${META_VALUE_PROPOSITION_RULES}
${META_FOCUS_KEYWORD_GRAMMAR_RULES}
${META_INSTAGRAM_CAPTION_RULES}
${CONTENT_CREATOR_EVENTS_RULE}

Platform character targets:
- Instagram/Facebook shared caption: hook target ${CONTENT_CREATOR_IG_TARGET_CHARS} chars, hard max ${CONTENT_CREATOR_IG_MAX_CHARS} total with hashtags (${CONTENT_CREATOR_IG_HASHTAG_MIN} to ${CONTENT_CREATOR_IG_HASHTAG_MAX} tags)
- Facebook cross-post note: body target ${CONTENT_CREATOR_FB_TARGET_CHARS} chars, max ${CONTENT_CREATOR_FB_MAX_CHARS}, up to ${CONTENT_CREATOR_FB_HASHTAG_MAX} hashtags
- LinkedIn: target ${CONTENT_CREATOR_LINKEDIN_TARGET_CHARS} chars, max ${CONTENT_CREATOR_LINKEDIN_MAX_CHARS}, up to ${CONTENT_CREATOR_LINKEDIN_HASHTAG_MAX} hashtags

Return ONLY valid JSON matching outputSchema.`;
}

export function buildContentCreatorSocialBriefUserPayload(options: {
  siteName?: string;
  siteUrl?: string;
  keyword: string;
  landingPageUrl?: string;
  events?: string;
  pageContext?: string;
}): string {
  return JSON.stringify({
    task: "content_creator_social_brief",
    siteName: options.siteName ?? "",
    siteUrl: options.siteUrl ?? "",
    keyword: options.keyword,
    landingPageUrl: options.landingPageUrl ?? "",
    eventContext: options.events ?? "",
    pageContext: options.pageContext ?? "",
    outputSchema: {
      strategyStatement: "string, 2 to 3 sentences internal strategy",
      captionHook: "string, sentence 1 hook with outcome or next step (not keyword paste)",
      postAngle: "string, one-line angle for this calendar slot",
      ctaLine: "string, short CTA (link in bio, read more, etc.)",
      hashtags: "array of 3 to 5 strings with # prefix",
      platformNotes: "optional string, LinkedIn angle if different from IG",
    },
  });
}

export function parseContentCreatorSocialBrief(raw: unknown): ContentCreatorSocialBrief {
  const root = raw as Record<string, unknown>;
  const strategyStatement = typeof root.strategyStatement === "string" ? root.strategyStatement : "";
  const captionHook = typeof root.captionHook === "string" ? root.captionHook : "";
  const postAngle = typeof root.postAngle === "string" ? root.postAngle : "";
  const ctaLine = typeof root.ctaLine === "string" ? root.ctaLine : "";
  const platformNotes =
    typeof root.platformNotes === "string" && root.platformNotes.length > 0
      ? root.platformNotes
      : undefined;

  if (!strategyStatement || !captionHook || !postAngle || !ctaLine) {
    throw new Error("Social strategy brief agent returned incomplete brief.");
  }

  const rawTags = Array.isArray(root.hashtags) ? root.hashtags : [];
  const hashtags = rawTags
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

  if (hashtags.length < CONTENT_CREATOR_IG_HASHTAG_MIN) {
    throw new Error("Social strategy brief agent returned too few hashtags.");
  }

  return {
    strategyStatement,
    captionHook,
    postAngle,
    ctaLine,
    hashtags: hashtags.slice(0, CONTENT_CREATOR_IG_HASHTAG_MAX),
    platformNotes,
  };
}

export function contentCreatorSocialBriefMarkdown(brief: ContentCreatorSocialBrief): string {
  const lines = [
    "## Strategy",
    brief.strategyStatement,
    "",
    "## Caption hook",
    brief.captionHook,
    "",
    "## Post angle",
    brief.postAngle,
    "",
    "## CTA",
    brief.ctaLine,
    "",
    "## Hashtags",
    brief.hashtags.join(" "),
  ];
  if (brief.platformNotes) {
    lines.push("", "## LinkedIn notes", brief.platformNotes);
  }
  return lines.join("\n");
}
