/** True when any workspace Details gate flag is set (site ready + has content to show). */
export function workspaceDetailsCanOpen(...flags: boolean[]): boolean {
  return flags.some(Boolean);
}
