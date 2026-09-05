import { hostIsProxyFirst, isMultiPageAuditInstructions, extractMaxPagesFromInstructions } from "./tools/tool-packs.mjs";

function instructionsLower(text) {
  return String(text ?? "").trim().toLowerCase();
}

function canonicalHost(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** @param {string} targetUrl @param {{ hostCategory?: string, route?: string } | null | undefined} browsePolicy */
export function isClientSiteTarget(targetUrl, browsePolicy) {
  if (hostIsProxyFirst(targetUrl)) return false;
  const host = canonicalHost(targetUrl);
  if (!host) return false;
  if (browsePolicy?.hostCategory === "client_web") return true;
  if (browsePolicy?.route === "browser_direct") return true;
  return true;
}

/** @param {string} instructionsText */
export function taskNeedsVision(instructionsText) {
  const text = instructionsLower(instructionsText);
  return (
    /\bclick\b|\bbutton\b|\blogin\b|\bsign in\b|\bcheckout\b|\bcaptcha\b|\bmodal\b|\bdropdown\b|\btype into\b|\bform field\b/.test(
      text,
    ) || /\bfill form\b|\bportal\b/.test(text)
  );
}

export { isMultiPageAuditInstructions, extractMaxPagesFromInstructions };

/** @param {string} instructionsText */
export function taskIsProgrammaticSiteAudit(instructionsText) {
  return isMultiPageAuditInstructions(instructionsText);
}

/**
 * @param {{ instructionsText?: string, targetUrl?: string, browsePolicy?: { hostCategory?: string, route?: string } | null }} input
 */
export function resolveExecutionMode(input) {
  const clientSite = isClientSiteTarget(input.targetUrl ?? "", input.browsePolicy ?? null);
  const needsVision = taskNeedsVision(input.instructionsText ?? "");
  const siteAudit = taskIsProgrammaticSiteAudit(input.instructionsText ?? "");

  if (clientSite && siteAudit && !needsVision) {
    return {
      mode: "programmatic_first",
      includeVisionTools: false,
      bootstrapTool: "audit_site_pages",
      suggestedFirstTool: "audit_site_pages",
      reason: "Multi-page client site check; run programmatic site audit and save CSV.",
    };
  }

  if (clientSite && !needsVision) {
    return {
      mode: "programmatic_first",
      includeVisionTools: false,
      bootstrapTool: null,
      suggestedFirstTool: "get_page_info",
      reason: "Client site task; prefer navigate and DOM tools over pixel clicks.",
    };
  }

  if (clientSite && needsVision) {
    return {
      mode: "hybrid",
      includeVisionTools: true,
      bootstrapTool: null,
      suggestedFirstTool: "list_page_links",
      reason: "Client site with form or UI interaction; try programmatic tools first, vision when needed.",
    };
  }

  if (hostIsProxyFirst(input.targetUrl ?? "")) {
    return {
      mode: "vision_first",
      includeVisionTools: true,
      bootstrapTool: null,
      suggestedFirstTool: "get_page_info",
      reason: "Sensitive third-party platform; vision interaction may be required.",
    };
  }

  return {
    mode: "hybrid",
    includeVisionTools: true,
    bootstrapTool: null,
    suggestedFirstTool: null,
    reason: "Default hybrid; programmatic when sufficient, vision for complex UI.",
  };
}

/** @param {Array<{ tool?: string, result?: Record<string, unknown> }>} actionLog @param {string} targetUrl */
export function detectVisionNavStuck(actionLog, targetUrl) {
  if (!isClientSiteTarget(targetUrl, { route: "browser_direct" })) return null;
  const recent = actionLog.slice(-4).filter((entry) => entry.tool === "click_at");
  if (recent.length < 3) return null;
  const anyNavigated = recent.some((entry) => entry.result?.navigated === true);
  if (anyNavigated) return null;
  return recent[0];
}
