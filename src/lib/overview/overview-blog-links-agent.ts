export type BlogLinksReplaceAction = {
  action: "replace";
  index: number;
  proposedUrl: string;
  rationale: string;
};

export type BlogLinksAddAction = {
  action: "add";
  paragraphIndex: number;
  anchorText: string;
  proposedUrl: string;
  rationale: string;
};

export type BlogLinksLinkAction = BlogLinksReplaceAction | BlogLinksAddAction;

export type BlogLinksPlanResult = {
  linkActions: BlogLinksLinkAction[];
};

export type BlogLinksAgentOptions = {
  apiKey: string;
  model: string;
  siteId?: string | null;
  siteUrl?: string;
  signal?: AbortSignal;
};
