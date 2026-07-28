import mammoth from "mammoth";
import { extractTextFromPdf } from "@/lib/master-instructions-pdf";

const ACCEPT_EXT = new Set(["txt", "md", "markdown", "docx", "pdf"]);

export function isInstructionFileAccepted(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPT_EXT.has(ext);
}

export async function extractTextFromInstructionFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    return extractTextFromPdf(file);
  }

  if (ext === "docx") {
    const ab = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: ab });
    return (result.value || "").trim();
  }

  if (ext === "txt" || ext === "md" || ext === "markdown") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").trim());
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  throw new Error(`Unsupported file type: .${ext}`);
}
