/**
 * Client fetch for POST /api/proposal/site-audit
 */

import type { ProposalSiteAuditResult } from "@/lib/research/proposal-site-audit-types";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";

export type FetchProposalSiteAuditResult =
  | { ok: true; audit: ProposalSiteAuditResult }
  | { ok: false; error: string };

export async function fetchProposalSiteAudit(
  urls: string[],
  options?: { signal?: AbortSignal },
): Promise<FetchProposalSiteAuditResult> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  if (!base) {
    return { ok: false, error: "Backend API base is not configured" };
  }

  try {
    const res = await fetch(`${base}/api/proposal/site-audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
      signal: options?.signal,
    });

    const j = (await res.json()) as {
      success?: boolean;
      error?: string;
      pages?: ProposalSiteAuditResult["pages"];
      performance?: ProposalSiteAuditResult["performance"];
      faq?: ProposalSiteAuditResult["faq"];
      errors?: ProposalSiteAuditResult["errors"];
    };

    if (!res.ok || j.success === false) {
      const err = typeof j.error === "string" && j.error.trim() ? j.error.trim() : `HTTP ${res.status}`;
      return { ok: false, error: err };
    }

    const audit: ProposalSiteAuditResult = {
      pages: Array.isArray(j.pages) ? j.pages : [],
      performance: j.performance ?? {
        desktop: { sampleSize: 0, performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null, fcpMs: null, lcpMs: null, cls: null, tbtMs: null, speedIndexMs: null },
        mobile: { sampleSize: 0, performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null, fcpMs: null, lcpMs: null, cls: null, tbtMs: null, speedIndexMs: null },
        worstPages: [],
      },
      faq: j.faq ?? { sampleSize: 0, pagesWithFaq: 0, totalQaPairs: 0, pageSummaries: [] },
      errors: Array.isArray(j.errors) ? j.errors : [],
    };

    return { ok: true, audit };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Site audit request failed" };
  }
}

export function siteAuditToWire(
  audit: ProposalSiteAuditResult,
): { perf: import("@/lib/research/proposal-site-audit-types").ProposalSiteAuditWire; faq: import("@/lib/research/proposal-site-audit-types").ProposalFaqAuditWire } {
  return {
    perf: {
      sampleSize: audit.pages.length,
      desktop: audit.performance.desktop,
      mobile: audit.performance.mobile,
      worstPages: audit.performance.worstPages,
      methodologyNote:
        "DataForSEO Lighthouse on a sample of top site pages (GSC-weighted when Search Console is connected). Desktop and mobile averages.",
    },
    faq: {
      sampleSize: audit.faq.sampleSize,
      pagesWithFaq: audit.faq.pagesWithFaq,
      totalQaPairs: audit.faq.totalQaPairs,
      pageSummaries: audit.faq.pageSummaries.slice(0, 10),
    },
  };
}
