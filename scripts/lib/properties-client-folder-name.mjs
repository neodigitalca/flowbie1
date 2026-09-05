export function isLikelyTruncatedStoredName(name) {
  return / \.\.\.$/.test(String(name ?? "").trim());
}

/** Match Properties rows (wordpressSiteDisplayName). */
export function propertiesClientFolderName(site) {
  const stored = String(site.name ?? "").trim();
  const nap = String(site.napInfo?.name ?? "").trim();
  if (nap) {
    if (isLikelyTruncatedStoredName(stored)) return nap;
    const storedCore = stored.replace(/ \.\.\.$/, "").trim();
    if (nap.length > storedCore.length) return nap;
  }
  if (isLikelyTruncatedStoredName(stored)) {
    return stored.replace(/ \.\.\.$/, "").trim();
  }
  return stored;
}

export function sortSitesByDisplayName(sites) {
  return [...sites].sort((a, b) =>
    propertiesClientFolderName(a).localeCompare(propertiesClientFolderName(b), undefined, {
      sensitivity: "base",
    }),
  );
}
