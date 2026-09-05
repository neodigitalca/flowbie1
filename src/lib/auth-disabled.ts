import type { AuthUser, TeamSummary } from "@/lib/teams-types";
import { DEFAULT_OWNER_JOB_TITLE, DEFAULT_TEAM_NAME } from "@/lib/teams-types";

/** Auth gate on for team SaaS. Set true only for local UI work without neodigital.ca backend. */
export const AUTH_DISABLED = false;

export const LOCAL_DEMO_EMAIL = "sean@neodigital.ca";
export const LOCAL_DEMO_PASSWORD = "LocalDemo2026!";

export const LOCAL_DEMO_USER: AuthUser = {
  id: 1,
  email: LOCAL_DEMO_EMAIL,
  displayName: "NEO Pulse",
};

export const LOCAL_DEMO_TEAM: TeamSummary = {
  id: 1,
  name: DEFAULT_TEAM_NAME,
  slug: "neo-digital-inc",
  seatLimit: 50,
  seatsUsed: 1,
  accessRole: "owner",
  jobTitle: DEFAULT_OWNER_JOB_TITLE,
  permissions: {},
  createdAt: "2026-01-01T00:00:00.000Z",
};
