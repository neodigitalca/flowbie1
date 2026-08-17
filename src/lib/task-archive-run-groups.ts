import type { TaskFile } from "@/lib/tasks-types";

export type TaskArchiveRunGroup = {
  key: string;
  createdAt: string;
  label: string;
  files: TaskFile[];
};

function runBucketKey(createdAt: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return createdAt;
  return String(Math.floor(parsed / 60_000));
}

function archiveRunLabel(files: TaskFile[]): string {
  const markdown = files.find((file) => file.fileName.toLowerCase().endsWith(".md"));
  if (markdown) {
    const name = markdown.fileName.toLowerCase();
    if (name.includes("gsc-report-mom-")) return "GSC MoM report";
    if (name.includes("gsc-report-yoy-")) return "GSC YoY report";
    return markdown.fileName.replace(/\.md$/i, "");
  }
  return "Archived run";
}

function sortArchiveFiles(files: TaskFile[]): TaskFile[] {
  return [...files].sort((a, b) => {
    const aMd = a.fileName.toLowerCase().endsWith(".md") ? 0 : 1;
    const bMd = b.fileName.toLowerCase().endsWith(".md") ? 0 : 1;
    if (aMd !== bMd) return aMd - bMd;
    return a.fileName.localeCompare(b.fileName);
  });
}

export function groupTaskArchiveFilesByRun(files: TaskFile[]): TaskArchiveRunGroup[] {
  const buckets = new Map<string, TaskFile[]>();
  for (const file of files) {
    const key = runBucketKey(file.createdAt);
    const list = buckets.get(key) ?? [];
    list.push(file);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .map(([key, groupFiles]) => {
      const sorted = sortArchiveFiles(groupFiles);
      return {
        key,
        createdAt: sorted[0]?.createdAt ?? "",
        label: archiveRunLabel(sorted),
        files: sorted,
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
