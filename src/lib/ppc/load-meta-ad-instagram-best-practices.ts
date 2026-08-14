import bestPracticesRaw from "@/lib/ppc/meta-ad-instagram-best-practices.md?raw";

export function getMetaAdInstagramBestPractices(): string {
  return bestPracticesRaw.trim();
}

export function appendMetaInstagramBestPractices(systemPrompt: string): string {
  const block = getMetaAdInstagramBestPractices();
  if (!block) return systemPrompt;
  return `${systemPrompt}\n\nInstagram ad best practices:\n${block}`;
}
