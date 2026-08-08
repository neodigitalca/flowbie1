import type { TeamMember } from "@/lib/teams-types";

export function parseMentionUserIds(text: string, members: TeamMember[]): number[] {
  const ids = new Set<number>();
  for (const member of members) {
    const name = member.displayName || member.email;
    if (!name) continue;
    const token = `@${name}`;
    if (text.includes(token)) {
      ids.add(member.userId);
    }
  }
  return [...ids];
}
