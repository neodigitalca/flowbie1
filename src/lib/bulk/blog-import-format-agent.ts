import {
  htmlTextFingerprint,
  reformatExistingHtmlHeadings,
} from "@/lib/bulk/blog-import-format-blocks";

export async function formatDirectImportHtmlWithAgent(args: {
  html: string;
  postTitle: string;
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const sourceHtml = args.html.trim();
  if (!sourceHtml) throw new Error("Direct import has no HTML to format");
  const html = reformatExistingHtmlHeadings(sourceHtml);
  if (htmlTextFingerprint(html) !== htmlTextFingerprint(sourceHtml)) {
    throw new Error("Direct format changed wording");
  }
  return html;
}
