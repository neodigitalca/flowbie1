import {
  fetchJobTitlePresets,
  fetchPendingInvites,
  fetchTeamMembers,
} from "@/lib/teams-api";
import type { JobTitlePreset, TeamInvite, TeamMember } from "@/lib/teams-types";

export type TeamMembersCache = {
  members: TeamMember[];
  invites: TeamInvite[];
  jobTitlePresets: JobTitlePreset[];
};

const memory = new Map<number, TeamMembersCache>();

function storageKey(teamId: number): string {
  return `neo-pulse-team-members:${teamId}`;
}

export function readTeamMembersCache(teamId: number): TeamMembersCache | null {
  const mem = memory.get(teamId);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(storageKey(teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeamMembersCache;
    if (!parsed || !Array.isArray(parsed.members)) return null;
    memory.set(teamId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeTeamMembersCache(teamId: number, data: TeamMembersCache): void {
  memory.set(teamId, data);
  try {
    sessionStorage.setItem(storageKey(teamId), JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}

export async function prefetchTeamMembers(teamId: number): Promise<void> {
  try {
    const [members, invites, jobTitlePresets] = await Promise.all([
      fetchTeamMembers(teamId),
      fetchPendingInvites(teamId),
      fetchJobTitlePresets(teamId),
    ]);
    writeTeamMembersCache(teamId, { members, invites, jobTitlePresets });
  } catch {
    /* keep existing cache */
  }
}
