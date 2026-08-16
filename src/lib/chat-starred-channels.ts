/** Toggle a channel id in the starred list (Slack layout). */
export function toggleStarredChannelId(starredChannelIds: number[], channelId: number): number[] {
  if (starredChannelIds.includes(channelId)) {
    return starredChannelIds.filter((id) => id !== channelId);
  }
  return [...starredChannelIds, channelId];
}

export function isChannelStarred(starredChannelIds: number[], channelId: number): boolean {
  return starredChannelIds.includes(channelId);
}

export function normalizeStarredChannelIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((v) => Number(v))
    .filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set(ids)];
}
