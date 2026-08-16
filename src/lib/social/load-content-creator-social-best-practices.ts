import bestPracticesRaw from "@/lib/social/content-creator-social-best-practices.md?raw";

export function getContentCreatorSocialBestPractices(): string {
  return bestPracticesRaw.replace(/^\s+|\s+$/g, "");
}

export function appendContentCreatorSocialBestPractices(systemPrompt: string): string {
  const block = getContentCreatorSocialBestPractices();
  if (!block) return systemPrompt;
  return `${systemPrompt}\n\nOrganic social best practices:\n${block}`;
}
