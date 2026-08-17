import { describe, expect, it } from "vitest";
import { groupTaskArchiveFilesByRun } from "@/lib/task-archive-run-groups";
import type { TaskFile } from "@/lib/tasks-types";

function file(id: number, fileName: string, createdAt: string): TaskFile {
  return {
    id,
    teamId: 1,
    taskId: 2,
    storagePath: "",
    createdAt,
    payload: {},
    fileName,
    mime: "text/plain",
    uploadedBy: 1,
    keyword: fileName,
  };
}

describe("groupTaskArchiveFilesByRun", () => {
  it("groups files uploaded in the same minute and labels GSC runs", () => {
    const createdAt = "2026-08-17 04:17:07";
    const groups = groupTaskArchiveFilesByRun([
      file(1, "mom-Queries-MoM.csv", createdAt),
      file(2, "gsc-report-mom-advance-blinds-1786918624071.md", createdAt),
      file(3, "mom-Pages-MoM.csv", createdAt),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("GSC MoM report");
    expect(groups[0]?.files.map((entry) => entry.id)).toEqual([2, 3, 1]);
  });

  it("sorts newest runs first", () => {
    const groups = groupTaskArchiveFilesByRun([
      file(1, "older.csv", "2026-08-16 10:00:00"),
      file(2, "newer.csv", "2026-08-17 10:00:00"),
    ]);

    expect(groups.map((group) => group.files[0]?.id)).toEqual([2, 1]);
  });
});
