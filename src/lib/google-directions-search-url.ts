/** Google search link: "{entity} directions to {siteName}". */
export function googleDirectionsSearchUrl(entity: string, siteName: string): string {
  const entityLabel = entity.trim();
  const siteLabel = siteName.trim();
  if (!entityLabel || !siteLabel) return "";
  const query = `${entityLabel} directions to ${siteLabel}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
