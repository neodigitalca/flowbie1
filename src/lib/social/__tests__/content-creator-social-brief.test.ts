import { describe, expect, it } from "vitest";
import {
  buildContentCreatorContextBlock,
  CONTENT_CREATOR_PLATFORM_LIMITS_PROMPT,
} from "@/lib/social/content-creator-prompt-builder";
import {
  buildContentCreatorSocialBriefUserPayload,
  contentCreatorSocialBriefMarkdown,
  parseContentCreatorSocialBrief,
  type ContentCreatorSocialBrief,
} from "@/lib/social/content-creator-social-brief";
import {
  clampInstagramCaption,
  clampLinkedinCaption,
  CONTENT_CREATOR_IG_MAX_CHARS,
  CONTENT_CREATOR_LINKEDIN_MAX_CHARS,
  normalizeHashtags,
} from "@/lib/social/content-creator-social-copy-limits";
import { getContentCreatorSocialBestPractices } from "@/lib/social/load-content-creator-social-best-practices";
import {
  formatContentCreatorChecklistFeedback,
  type ContentCreatorSocialCopyChecklistItem,
} from "@/lib/social/content-creator-agents/content-calendar-social-copy-checklist-agent";

const SAMPLE_BRIEF: ContentCreatorSocialBrief = {
  strategyStatement: "Promote the window coverings marketing guide to owners who want more leads.",
  captionHook: "More local leads start with a site that ranks.",
  postAngle: "Marketing guide for window covering businesses",
  ctaLine: "Link in bio for the full guide.",
  hashtags: ["#WindowCoverings", "#SmallBusiness", "#MarketingTips"],
};

describe("parseContentCreatorSocialBrief", () => {
  it("parses valid brief JSON", () => {
    const brief = parseContentCreatorSocialBrief({
      strategyStatement: SAMPLE_BRIEF.strategyStatement,
      captionHook: SAMPLE_BRIEF.captionHook,
      postAngle: SAMPLE_BRIEF.postAngle,
      ctaLine: SAMPLE_BRIEF.ctaLine,
      hashtags: ["WindowCoverings", "#SmallBusiness", "#MarketingTips"],
    });
    expect(brief.captionHook).toBe(SAMPLE_BRIEF.captionHook);
    expect(brief.hashtags.every((tag) => tag.startsWith("#"))).toBe(true);
  });

  it("rejects incomplete brief", () => {
    expect(() => parseContentCreatorSocialBrief({ captionHook: "Only hook" })).toThrow(
      /incomplete brief/i,
    );
  });

  it("rejects too few hashtags", () => {
    expect(() =>
      parseContentCreatorSocialBrief({
        strategyStatement: "A",
        captionHook: "B",
        postAngle: "C",
        ctaLine: "D",
        hashtags: ["#One"],
      }),
    ).toThrow(/too few hashtags/i);
  });
});

describe("contentCreatorSocialBriefMarkdown", () => {
  it("formats brief for details drawer", () => {
    const md = contentCreatorSocialBriefMarkdown(SAMPLE_BRIEF);
    expect(md).toContain("## Caption hook");
    expect(md).toContain(SAMPLE_BRIEF.captionHook);
    expect(md).toContain("#WindowCoverings");
  });
});

describe("buildContentCreatorContextBlock", () => {
  it("omits Event context when events cell is empty", () => {
    const block = buildContentCreatorContextBlock({
      keyword: "window coverings marketing",
    });
    expect(block).not.toContain("Event context:");
  });

  it("includes Event context only when user provided events", () => {
    const block = buildContentCreatorContextBlock({
      keyword: "test",
      events: "Labour Day promo",
    });
    expect(block).toContain("Event context: Labour Day promo");
  });
});

describe("buildContentCreatorSocialBriefUserPayload", () => {
  it("leaves eventContext empty when no events", () => {
    const payload = JSON.parse(
      buildContentCreatorSocialBriefUserPayload({
        keyword: "seo",
      }),
    );
    expect(payload.eventContext).toBe("");
  });
});

describe("clampInstagramCaption", () => {
  it("clamps total caption at 300 characters", () => {
    const longBody = "A".repeat(280);
    const caption = clampInstagramCaption(`${longBody}\nMore text here.\n#One #Two #Three #Four #Five`);
    expect(caption.length).toBeLessThanOrEqual(CONTENT_CREATOR_IG_MAX_CHARS);
  });

  it("keeps hook-first short captions intact", () => {
    const caption = clampInstagramCaption(
      "More local leads start with a site that ranks.\nLink in bio.\n#WindowCoverings #SmallBusiness #MarketingTips",
      SAMPLE_BRIEF.hashtags,
    );
    expect(caption).toContain("More local leads");
    expect(caption).toContain("#windowcoverings");
    expect(caption.length).toBeLessThanOrEqual(CONTENT_CREATOR_IG_MAX_CHARS);
  });
});

describe("clampLinkedinCaption", () => {
  it("clamps LinkedIn copy at 1300 characters", () => {
    const long = "Word ".repeat(400);
    const caption = clampLinkedinCaption(long);
    expect(caption.length).toBeLessThanOrEqual(CONTENT_CREATOR_LINKEDIN_MAX_CHARS);
  });
});

describe("normalizeHashtags", () => {
  it("dedupes and caps hashtag count", () => {
    expect(
      normalizeHashtags(["#Seo", "#seo", "#Marketing", "#Local", "#Tips", "#Extra"], 5),
    ).toHaveLength(5);
  });
});

describe("formatContentCreatorChecklistFeedback", () => {
  it("formats checklist items for retry prompt", () => {
    const items: ContentCreatorSocialCopyChecklistItem[] = [
      { id: "length", label: "Caption too long", detail: "Max 300 characters." },
    ];
    expect(formatContentCreatorChecklistFeedback(items)).toContain("Caption too long");
  });
});

describe("platform limits prompt", () => {
  it("documents Instagram and LinkedIn targets", () => {
    expect(CONTENT_CREATOR_PLATFORM_LIMITS_PROMPT).toContain("125");
    expect(CONTENT_CREATOR_PLATFORM_LIMITS_PROMPT).toContain("1300");
  });
});

describe("content-creator-social-best-practices.md", () => {
  it("loads organic social best practices", () => {
    const md = getContentCreatorSocialBestPractices();
    expect(md).toContain("Never reference holidays");
    expect(md).toContain("Hard max 300 characters");
  });
});

describe("anti-spam patterns", () => {
  it("rejects long multi-paragraph emoji-heavy copy via clamp", () => {
    const spam = `Hey there! 👋👋👋\n\nAt Neo Digital, we know the ins and outs of making your window covering business shine online. From creating simple, stunning websites that capture attention to optimizing them to rank high in search results across North America and beyond, we've got you covered!\n\nWondering how to attract more customers?\n\n#One #Two #Three #Four #Five #Six #Seven #Eight #Nine #Ten`;
    const clamped = clampInstagramCaption(spam, SAMPLE_BRIEF.hashtags);
    expect(clamped.length).toBeLessThanOrEqual(CONTENT_CREATOR_IG_MAX_CHARS);
    expect(clamped.split("\n\n").length).toBeLessThanOrEqual(3);
  });
});
