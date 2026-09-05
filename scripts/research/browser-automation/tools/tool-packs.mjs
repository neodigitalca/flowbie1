const PROXY_FIRST_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "gemini.google.com",
  "semrush.com",
  "ahrefs.com",
  "moz.com",
  "yelp.com",
  "yellowpages.com",
  "bbb.org",
  "facebook.com",
  "linkedin.com",
  "accounts.google.com",
];

function canonicalHost(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function hostIsProxyFirst(url) {
  const host = canonicalHost(url);
  if (!host) return false;
  return PROXY_FIRST_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function instructionsLower(text) {
  return String(text ?? "").trim().toLowerCase();
}

/** @param {string} instructionsText */
export function isMultiPageAuditInstructions(instructionsText) {
  const text = instructionsLower(instructionsText);
  if (
    /\bevery page\b|\ball pages\b|\bentire site\b|\bfull site\b|\bwhole site\b|\beach url\b|\ball urls\b/.test(
      text,
    )
  ) {
    return true;
  }
  return (
    /\b\d{1,3}\s*pages?\b|\bexplore\b|\bcrawl\b|\bsite health\b|\bcheck\b.*\bpages?\b|\bresponse time\b|\bcsv\b|\bsort through\b|\bmultiple pages\b|\beach page\b|\bacross the site\b/.test(
      text,
    ) &&
    /\bhtml\b|\b200\b|\bstatus\b|\bworking\b|\bcheck\b|\baudit\b|\bhealth\b|\bcsv\b|\breport\b/.test(text)
  );
}

/** @returns {number | null} null means audit every discoverable page */
export function extractMaxPagesFromInstructions(instructionsText) {
  const text = instructionsLower(instructionsText);
  if (
    /\bevery page\b|\ball pages\b|\bentire site\b|\bfull site\b|\bwhole site\b|\beach url\b|\ball urls\b/.test(
      text,
    )
  ) {
    return null;
  }
  const patterns = [
    /\b(\d{1,3})\s*pages?\b/i,
    /\b(?:explore|check|audit|scan|sort through|review)\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s*(?:urls?|links?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = String(instructionsText ?? "").match(pattern);
    if (match) return Math.min(Math.max(Number(match[1]), 1), 500);
  }
  return 15;
}

/** @type {Record<string, string[]>} */
export const PACK_TOOLS = {
  core: ["navigate", "wait", "complete", "report_blocked"],
  navigation: ["reload_page", "go_back", "wait_for_text", "wait_for_url", "scroll_to_top", "scroll_to_bottom"],
  interaction: ["click_at", "type_at", "type", "press_key", "scroll"],
  client_qa: [
    "get_page_info",
    "extract_page_meta",
    "extract_visible_text",
    "list_page_links",
    "verify_page_contains",
    "extract_competitor_headings",
  ],
  deliverables: ["capture_screenshot", "save_text_deliverable", "save_csv_deliverable"],
  html_audit: ["audit_page_html"],
  site_audit: ["audit_site_pages"],
  research: ["search_serp", "fetch_url_status", "open_serp_result"],
  forms: ["select_option", "fill_form_fields"],
  sensitive: ["get_page_info", "capture_screenshot"],
};

/**
 * @param {{ instructionsText?: string, browsePolicy?: { route?: string, hostCategory?: string }, targetUrl?: string, executionMode?: { includeVisionTools?: boolean } }} input
 * @returns {string[]}
 */
export function resolveToolPacks(input) {
  const text = instructionsLower(input.instructionsText);
  const packs = new Set(["core", "deliverables"]);
  const clientSite = !hostIsProxyFirst(input.targetUrl ?? "");
  const includeVision = input.executionMode?.includeVisionTools !== false;

  if (hostIsProxyFirst(input.targetUrl ?? "") || input.browsePolicy?.route === "browser_proxy") {
    packs.add("sensitive");
    if (includeVision) packs.add("interaction");
    return [...packs];
  }

  const siteAuditTask = isMultiPageAuditInstructions(input.instructionsText ?? "");

  if (siteAuditTask && clientSite) {
    packs.add("site_audit");
    packs.add("client_qa");
    packs.add("navigation");
  } else if (/\baudit\b|\bmarkup\b|\bbroken html\b|\bvalidate.*html\b|\bhtml.*good\b/.test(text)) {
    packs.add("html_audit");
    packs.add("client_qa");
  }

  if (/\bsearch\b|\bgoogle\b|\blook up\b|\bfind online\b|\bserp\b/.test(text)) {
    packs.add("research");
  }

  if (/\bfill form\b|\blogin\b|\bportal\b|\bcheckout\b|\bdropdown\b/.test(text)) {
    packs.add("forms");
    if (includeVision) packs.add("interaction");
  }

  if (/\bscreenshot\b|\b200\b|\bmeta\b|\bh1\b|\bhomepage\b|\bclient site\b|\baudit\b/.test(text)) {
    packs.add("client_qa");
  }

  if (/\brefresh\b|\bgo back\b|\bwait until\b|\bscroll\b/.test(text)) {
    packs.add("navigation");
  }

  if (!packs.has("client_qa") && !packs.has("research") && !packs.has("html_audit") && !packs.has("site_audit")) {
    packs.add("client_qa");
  }

  if (packs.has("research")) {
    packs.add("navigation");
  }

  const needsVision =
    includeVision &&
    (/\bclick\b|\bbutton\b|\blogin\b|\bsign in\b|\btype into\b|\bmodal\b/.test(text) ||
      packs.has("forms") ||
      (!clientSite && !packs.has("site_audit")));

  if (needsVision) {
    packs.add("interaction");
  }

  return [...packs];
}

/**
 * @param {string[]} packIds
 * @param {Array<{ type: string, function: { name: string } }>} allTools
 */
export function filterToolsByPacks(packIds, allTools) {
  const allowed = new Set();
  for (const pack of packIds) {
    for (const name of PACK_TOOLS[pack] ?? []) {
      allowed.add(name);
    }
  }
  return allTools.filter((tool) => allowed.has(tool.function.name));
}
