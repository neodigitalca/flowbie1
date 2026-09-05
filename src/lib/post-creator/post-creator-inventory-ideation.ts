import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { runPostCreatorGscIdeationAgent } from "@/lib/post-creator/post-creator-gsc-ideation-agent";

export async function runPostCreatorInventoryFirstIdeation(args: {
  apiKey: string;
  siteId?: string;
  siteName: string;
  postCount: number;
  optionalPrompt?: string;
  bucketJson: string;
  siteKwJsonText: string;
  onProgress?: (message: string) => void;
}): Promise<CSVRow[]> {
  return runPostCreatorGscIdeationAgent(args);
}
