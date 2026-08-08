import type { TeamMember } from "@/lib/teams-types";

export const FLO_DISPLAY_NAME = "FLO";
export const FLO_EMAIL = "flo@flowbie.system";

export function isFloMember(member: Pick<TeamMember, "email" | "isBot" | "displayName">): boolean {
  return Boolean(member.isBot) || member.email === FLO_EMAIL || member.displayName === FLO_DISPLAY_NAME;
}

export function sortMembersWithFloFirst(members: TeamMember[]): TeamMember[] {
  const flo = members.filter(isFloMember);
  const rest = members.filter((m) => !isFloMember(m));
  return [...flo, ...rest];
}
