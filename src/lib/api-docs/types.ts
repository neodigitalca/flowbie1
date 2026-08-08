export type ApiDocAuth =
  | "public"
  | "session"
  | "session-team"
  | "team-rbac-communication"
  | "open";

export type ApiDocFrontmatter = {
  title: string;
  slug: string;
  section: string;
  method?: string;
  path?: string;
  auth?: ApiDocAuth | string;
  order?: number;
  related?: string[];
};

export type ApiDocArticle = ApiDocFrontmatter & {
  body: string;
  raw: string;
};

export type ApiDocNavItem = {
  slug: string;
  title: string;
  method?: string;
  path?: string;
  auth?: string;
  order: number;
};

export type ApiDocNavSection = {
  id: string;
  label: string;
  items: ApiDocNavItem[];
};

export type ApiDocManifest = {
  version: number;
  generatedAt: string;
  routeCount: number;
  sections: ApiDocNavSection[];
};

export type TocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};
