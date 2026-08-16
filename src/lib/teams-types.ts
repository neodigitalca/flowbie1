export type TeamAccessRole = "owner" | "admin" | "lead" | "editor" | "viewer" | "custom";

export type TeamPermissionArea =
  | "properties"
  | "api-keys"
  | "master-rules"
  | "ai-generation"
  | "google"
  | "content-optimizer"
  | "generator"
  | "gsc-report"
  | "sitemap"
  | "communication"
  | "teams";

export type AreaPermission = { read: boolean; write: boolean };

export type TeamPermissions = Partial<Record<TeamPermissionArea, AreaPermission>>;

export type MemberProfile = {
  bio?: string;
  phone?: string;
  location?: string;
  notes?: string;
};

export type TeamMember = {
  userId: number;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  accessRole: TeamAccessRole;
  jobTitle: string;
  permissions: TeamPermissions;
  profile: MemberProfile;
  joinedAt: string;
  lastActiveAt?: string | null;
  isBot?: boolean;
};

export type TeamSummary = {
  id: number;
  name: string;
  slug: string;
  seatLimit: number;
  seatsUsed: number;
  accessRole: TeamAccessRole;
  jobTitle: string;
  permissions: TeamPermissions;
  createdAt: string;
};

export type TeamInvite = {
  id: number;
  email: string;
  accessRole: TeamAccessRole;
  jobTitle: string;
  expiresAt: string;
  createdAt: string;
};

export type JobTitlePreset = {
  title: string;
  sortOrder: number;
};

export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
};

export const DEFAULT_TEAM_NAME = "Neo Digital Inc.";
export const DEFAULT_OWNER_JOB_TITLE = "Lead SEO/AI Developer";

export const FALLBACK_JOB_TITLE_PRESETS = [
  "Lead SEO/AI Developer",
  "Lead",
  "SEO Specialist",
  "Content Writer",
  "Account Director",
  "Account Manager",
] as const;

export const ACCESS_ROLE_OPTIONS: { value: TeamAccessRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "lead", label: "Lead" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];
