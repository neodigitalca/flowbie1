import {
  countSectionHeadingsInHtml,
  countVisibleWordsInHtml,
} from "@/lib/overview/overview-blog-links-extract";

/** One internal link add per this many body words. */
export const WORDS_PER_LINK_ADD = 100;

export type BlogLinksBudget = {
  wordCount: number;
  sectionHeadings: number;
  linksToAdd: number;
};

export function computeBlogLinksBudget(html: string): BlogLinksBudget {
  const wordCount = countVisibleWordsInHtml(html);
  const sectionHeadings = countSectionHeadingsInHtml(html);
  const byWords = wordCount > 0 ? Math.ceil(wordCount / WORDS_PER_LINK_ADD) : 0;
  const linksToAdd = Math.max(sectionHeadings, byWords);
  return { wordCount, sectionHeadings, linksToAdd };
}
