import { describe, expect, it, vi } from "vitest";
import { driveDateSegments } from "../lib/drive-date-segments.mjs";
import {
  CHANGELOG_CLIENT_FOLDER,
  CHANGELOG_PURPOSE_FOLDER,
  CHANGELOG_WORKSPACE_FOLDER,
  EMPTY_WEEK_MESSAGE,
  changelogDriveLabel,
  changelogDriveSegments,
  changelogFileName,
  parseGitLog,
  weekWindow,
} from "../lib/repo-changelog-collect.mjs";
import { renderChangelogMarkdown, validateChangelogDoc } from "../lib/repo-changelog-openrouter.mjs";
import { publishRepoChangelog } from "../publish-repo-changelog.mjs";

const septemberMonday = new Date("2026-09-21T15:00:00.000Z");

describe("changelog Drive path", () => {
  it("uses Neo Pulse One / Changelog / year / month in America/Edmonton", () => {
    expect(driveDateSegments(septemberMonday)).toEqual(["2026", "September"]);
    expect(changelogDriveSegments(septemberMonday)).toEqual([
      CHANGELOG_WORKSPACE_FOLDER,
      CHANGELOG_CLIENT_FOLDER,
      CHANGELOG_PURPOSE_FOLDER,
      "2026",
      "September",
    ]);
    expect(changelogDriveLabel(septemberMonday)).toBe(
      "NEO Pulse / Neo Pulse One / Changelog / 2026 / September",
    );
  });

  it("keeps the Edmonton month across a UTC month boundary", () => {
    const lateSeptemberEdmonton = new Date("2026-10-01T05:00:00.000Z");
    expect(changelogDriveSegments(lateSeptemberEdmonton)).toEqual([
      "NEO Pulse",
      "Neo Pulse One",
      "Changelog",
      "2026",
      "September",
    ]);
  });
});

describe("empty week skip", () => {
  it("prints No commits this week and does not upload", async () => {
    const log = vi.fn();
    const writeDoc = vi.fn();
    const fetchImpl = vi.fn();
    const result = await publishRepoChangelog({
      collect: () => [],
      writeDoc,
      fetchImpl,
      log,
      now: septemberMonday,
      env: {
        OPENROUTER_API_KEY: "or-key",
        NEO_PULSE_USERNAME: "user@example.com",
        NEO_PULSE_PASSWORD: "secret",
      },
    });
    expect(result).toEqual({ skipped: true, reason: "empty-week" });
    expect(log).toHaveBeenCalledWith(EMPTY_WEEK_MESSAGE);
    expect(writeDoc).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("publisher happy path", () => {
  it("uploads the week-ending Google Doc into the Changelog month folder", async () => {
    const { weekEnd } = weekWindow(septemberMonday);
    const log = vi.fn();
    const writeDoc = vi.fn(async () =>
      validateChangelogDoc({
        title: "Weekly changelog",
        weekLabel: "Week ending 2026-09-21",
        summary: "Shipped Drive changelog publishing.",
        highlights: ["Weekly changelog uploads to Google Drive"],
        fixes: [],
        chores: ["Added GitHub Action"],
      }),
    );
    const fetchImpl = vi.fn(async (url, init) => {
      const path = String(url);
      const body = JSON.parse(String(init.body ?? "{}"));
      if (path.endsWith("/auth/login")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ ok: true, sessionToken: "session-token" }),
        };
      }
      if (path.endsWith("/google-mcp/resolve-folder-path")) {
        expect(body.segments).toEqual([
          "NEO Pulse",
          "Neo Pulse One",
          "Changelog",
          "2026",
          "September",
        ]);
        expect(body.createMissing).toBe(true);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              success: true,
              folderId: "folder-changelog-september",
              webViewLink: "https://drive.google.com/drive/folders/folder-changelog-september",
            }),
        };
      }
      if (path.endsWith("/google-mcp/upload-deliverable")) {
        expect(body.fileName).toBe(changelogFileName(weekEnd));
        expect(body.folderId).toBe("folder-changelog-september");
        expect(body.convertToGoogleDoc).toBe(true);
        expect(String(body.content)).toContain("Weekly changelog");
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              success: true,
              fileId: "doc-1",
              webViewLink: "https://drive.google.com/file/d/doc-1/view",
            }),
        };
      }
      throw new Error(`Unexpected fetch ${path}`);
    });

    const result = await publishRepoChangelog({
      collect: () => [
        {
          sha: "abc123",
          date: "2026-09-18T12:00:00-06:00",
          author: "Sean",
          subject: "Add weekly changelog publisher",
        },
      ],
      writeDoc,
      fetchImpl,
      log,
      now: septemberMonday,
      env: {
        OPENROUTER_API_KEY: "or-key",
        NEO_PULSE_USERNAME: "user@example.com",
        NEO_PULSE_PASSWORD: "secret",
      },
    });

    expect(result.skipped).toBe(false);
    expect(result.folderLabel).toBe("NEO Pulse / Neo Pulse One / Changelog / 2026 / September");
    expect(result.webViewLink).toBe("https://drive.google.com/file/d/doc-1/view");
    expect(log).toHaveBeenCalledWith("https://drive.google.com/file/d/doc-1/view");
    expect(writeDoc).toHaveBeenCalledTimes(1);
  });
});

describe("git log and markdown", () => {
  it("parses fixed git log fields", () => {
    expect(parseGitLog("")).toEqual([]);
    expect(
      parseGitLog("abc\t2026-09-18T12:00:00-06:00\tSean\tAdd Drive upload"),
    ).toEqual([
      {
        sha: "abc",
        date: "2026-09-18T12:00:00-06:00",
        author: "Sean",
        subject: "Add Drive upload",
      },
    ]);
  });

  it("renders validated changelog markdown", () => {
    const markdown = renderChangelogMarkdown(
      validateChangelogDoc({
        title: "Weekly changelog",
        weekLabel: "Week of 2026-09-14 to 2026-09-21",
        summary: "One summary.",
        highlights: ["Feature A"],
        fixes: ["Fix B"],
        chores: [],
      }),
    );
    expect(markdown).toContain("# Weekly changelog");
    expect(markdown).toContain("## Highlights");
    expect(markdown).toContain("- Feature A");
    expect(markdown).toContain("## Fixes");
    expect(markdown).not.toContain("## Chores");
  });

  it("fails fast on a missing changelog field", () => {
    expect(() =>
      validateChangelogDoc({
        title: "Weekly changelog",
        weekLabel: "Week",
        summary: "",
        highlights: [],
        fixes: [],
        chores: [],
      }),
    ).toThrow(/summary is required/);
  });
});
