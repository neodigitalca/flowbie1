import { describe, expect, it } from "vitest";
import { buildTeamContext } from "@/lib/pulse-assist/context";
import type { TeamSummary } from "@/lib/teams-types";
import type { TaskProject } from "@/lib/tasks-types";

describe("buildTeamContext", () => {
  it("returns undefined without team", () => {
    expect(buildTeamContext({ team: null, teamMembers: [], taskProjects: [] })).toBeUndefined();
  });

  it("builds capped team context payload", () => {
    const team: TeamSummary = {
      id: 7,
      name: "Neo Digital Inc.",
      slug: "neo-digital",
      seatLimit: 10,
      seatsUsed: 3,
      accessRole: "owner",
      jobTitle: "Lead",
      permissions: {},
      createdAt: "2026-01-01",
    };
    const projects: TaskProject[] = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1,
      title: `Project ${i + 1}`,
      keyword: `project-${i + 1}`,
      status: "active",
      sortOrder: i,
    }));

    const ctx = buildTeamContext({
      team,
      teamMembers: [
        {
          userId: 42,
          email: "pio@example.com",
          displayName: "PIO",
          accessRole: "editor",
          jobTitle: "SEO Specialist",
          permissions: {},
          profile: {},
          joinedAt: "2026-01-01",
        },
      ],
      taskProjects: projects,
      activeTaskProjectId: 12,
      activeTaskProjectTitle: "Advance Blinds",
    });

    expect(ctx).toMatchObject({
      teamId: 7,
      teamName: "Neo Digital Inc.",
      activeProjectId: 12,
      activeProjectTitle: "Advance Blinds",
    });
    expect(ctx?.members).toHaveLength(1);
    expect(ctx?.members[0]?.userId).toBe(42);
    expect(ctx?.projects).toHaveLength(30);
  });

  it("infers active project from site display name when Tasks tab is closed", () => {
    const team: TeamSummary = {
      id: 1,
      name: "Neo Digital Inc.",
      slug: "neo-digital-inc",
      seatLimit: 10,
      seatsUsed: 1,
      accessRole: "owner",
      jobTitle: "",
      permissions: {},
      createdAt: "2026-01-01",
    };
    const projects: TaskProject[] = [
      { id: 1, title: "dsfasdf", keyword: "", status: "active", sortOrder: 0 },
      { id: 9, title: "Advance Blinds", keyword: "advance-blinds", status: "active", sortOrder: 1 },
    ];

    const ctx = buildTeamContext({
      team,
      teamMembers: [],
      taskProjects: projects,
      siteDisplayName: "Advance Blinds",
    });

    expect(ctx?.activeProjectId).toBe(9);
    expect(ctx?.activeProjectTitle).toBe("Advance Blinds");
  });
});
