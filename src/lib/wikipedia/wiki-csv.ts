import Papa from "papaparse";
import type { WikipediaChunk } from "./types";

/**
 * Generates CSV content from Wikipedia chunks
 */
export function generateWikipediaCSV(chunks: WikipediaChunk[]): string {
  if (chunks.length === 0) {
    throw new Error("No chunks to convert to CSV");
  }

  const rows = chunks.map((chunk) => [
    chunk.title,
    chunk.url,
    chunk.section !== "Introduction" && chunk.section !== "Overview"
      ? `${chunk.section} - ${chunk.text}`
      : chunk.text,
  ]);

  const csv = Papa.unparse({
    fields: ["title", "url", "content"],
    data: rows,
  });

  return csv;
}
