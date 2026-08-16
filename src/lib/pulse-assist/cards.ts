import { stripStructuredFieldLeaks } from "@/lib/platform-data/card-sanitize";
import { normalizeAssistDisplayMarkdown, normalizeAssistTopicLabel } from "./display-markdown";
import { ASSIST_HISTORY_BODY_MAX } from "./storage";
import type { AssistCard, AssistCardLink, AssistSubmode } from "./types";

export { stripStructuredFieldLeaks };

export function normalizeSubmodeSwitchTopic(text: string): AssistSubmode | "" {
  const t = text.trim().toLowerCase();
  if (t === "switch to build mode" || t === "switch to build") return "build";
  if (t === "switch to plan mode" || t === "switch to plan") return "plan";
  if (t === "switch to ask mode" || t === "switch to ask") return "ask";
  return "";
}

export function relatedTopicsFromCard(card: AssistCard | null | undefined): string[] {
  if (!card) return [];
  if (Array.isArray(card.relatedTopics) && card.relatedTopics.length) {
    return card.relatedTopics
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => normalizeAssistTopicLabel(x))
      .filter(Boolean);
  }
  if (Array.isArray(card.suggested_actions) && card.suggested_actions.length) {
    return card.suggested_actions
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => normalizeAssistTopicLabel(x))
      .filter(Boolean);
  }
  return [];
}

export function snapshotCardForHistory(card: AssistCard | null | undefined): AssistCard | null {
  if (!card || typeof card !== "object") return null;
  const snap: AssistCard = {
    type: card.type ? String(card.type).slice(0, 40) : "",
    title: card.title ? String(card.title).slice(0, 120) : "",
    body: card.body
      ? normalizeAssistDisplayMarkdown(stripStructuredFieldLeaks(String(card.body))).slice(
          0,
          ASSIST_HISTORY_BODY_MAX,
        )
      : "",
    confidence: card.confidence ? String(card.confidence).slice(0, 20) : "",
    cta: card.cta || null,
    submode_switch: card.submode_switch || "",
    links: Array.isArray(card.links) ? card.links.slice(0, 6) : undefined,
    relatedTopics: relatedTopicsFromCard(card).slice(0, 8),
  };
  if (card.action_result?.post_id) {
    snap.action_result = {
      post_id: card.action_result.post_id,
      title: card.action_result.title ? String(card.action_result.title).slice(0, 120) : "",
    };
  }
  if (card.details_drawer) {
    snap.details_drawer = card.details_drawer;
  }
  return snap;
}

export function cardAssistantText(card: AssistCard | null | undefined): string {
  if (!card) return "";
  const body = card.body ? normalizeAssistDisplayMarkdown(stripStructuredFieldLeaks(card.body ?? "")) : "";
  const parts = [card.title, body].filter(Boolean);
  return parts.join("\n\n").trim();
}

/** Prefer navigation links that appear in body markdown (stale persisted cards). */
export function filterLinksToBodyScope(
  links: AssistCardLink[] | undefined,
  body: string,
): AssistCardLink[] | undefined {
  if (!links?.length) return undefined;
  const scoped = links.filter((link) => link.url && body.includes(`](${link.url})`));
  if (scoped.length > 0) return scoped.slice(0, 2);
  return links.slice(0, 2);
}
