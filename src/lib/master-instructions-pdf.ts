import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  workerConfigured = true;
}

/**
 * Extract plain text from a PDF in the browser using pdf.js.
 * Scanned/image-only PDFs may return empty or sparse text.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  ensurePdfWorker();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const line = textContent.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    if (line.trim()) {
      parts.push(line.trim());
    }
  }

  return parts.join("\n\n").trim();
}
