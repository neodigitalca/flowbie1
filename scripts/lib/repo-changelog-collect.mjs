import { execFileSync } from "node:child_process";
import { driveDateSegments } from "./drive-date-segments.mjs";

export const EDMONTON_TZ = "America/Edmonton";
export const CHANGELOG_WORKSPACE_FOLDER = "NEO Pulse";
export const CHANGELOG_CLIENT_FOLDER = "Neo Pulse One";
export const CHANGELOG_PURPOSE_FOLDER = "Changelog";
export const TEAM_SHARED_DRIVE_FOLDER_ID = "0AHAVAVW8TixdUk9PVA";
export const REPO_NAME = "neodigitalca/flowbie1";
export const EMPTY_WEEK_MESSAGE = "No commits this week";
export const GIT_LOG_SINCE = "7.days";

export function edmontonDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function weekWindow(now = new Date()) {
  const weekEnd = edmontonDateKey(now);
  const weekStart = edmontonDateKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return { weekStart, weekEnd };
}

export function changelogDriveSegments(date = new Date()) {
  return [
    CHANGELOG_WORKSPACE_FOLDER,
    CHANGELOG_CLIENT_FOLDER,
    CHANGELOG_PURPOSE_FOLDER,
    ...driveDateSegments(date),
  ];
}

export function changelogDriveLabel(date = new Date()) {
  return changelogDriveSegments(date).join(" / ");
}

export function changelogFileName(weekEndDate) {
  return `NEO Pulse One weekly changelog ${weekEndDate}`;
}

export function parseGitLog(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha = "", date = "", author = "", ...subjectParts] = line.split("\t");
      return {
        sha: sha.trim(),
        date: date.trim(),
        author: author.trim(),
        subject: subjectParts.join("\t").trim(),
      };
    })
    .filter((commit) => commit.sha && commit.subject);
}

export function collectCommits(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const since = options.since ?? GIT_LOG_SINCE;
  const stdout = execFileSync(
    "git",
    ["log", `--since=${since}`, "--pretty=format:%H%x09%aI%x09%an%x09%s"],
    { cwd, encoding: "utf8" },
  );
  return parseGitLog(stdout);
}
