export type WorkflowRagDownloadableFile = {
  name: string;
  href: string;
  outputKey: string;
  sizeBytes: number | null;
};

/** Keep the last file per name so streaming audit CSV updates do not flood the run archive. */
export function dedupeWorkflowRagFilesByName(
  files: WorkflowRagDownloadableFile[],
): WorkflowRagDownloadableFile[] {
  const byName = new Map<string, WorkflowRagDownloadableFile>();
  for (const file of files) {
    const name = file.name.trim();
    if (!name) continue;
    byName.set(name, file);
  }
  return files.filter((file) => {
    const name = file.name.trim();
    return name && byName.get(name) === file;
  });
}
