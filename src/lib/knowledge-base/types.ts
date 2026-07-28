export interface StoredFile {
  name: string;
  size: number;
  content: string;
  starred: boolean;
  timestamp: number;
  isProcessing?: boolean;
  sourceUrl?: string;
  sourceDomain?: string;
}

export interface KnowledgeProfile {
  id: string;
  name: string;
  content: string;
}

export type KnowledgeBaseSectionId = "text" | "upload" | "manager" | "scraper";

export const KNOWLEDGE_BASE_SECTION_LABELS: Record<KnowledgeBaseSectionId, string> = {
  text: "Text",
  upload: "Upload",
  manager: "Files",
  scraper: "Scraper",
};

export type ScraperLogEntry = {
  url: string;
  title: string;
  index: number;
  total: number;
};
