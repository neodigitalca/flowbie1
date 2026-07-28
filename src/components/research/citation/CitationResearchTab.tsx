import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CitationWorkspaceHeader } from "@/components/research/citation/CitationWorkspaceHeader";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_SHELL_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COPIED, NOTIFY_OPENROUTER_KEY, NOTIFY_SEED_SITE_URL_EXAMPLE, NOTIFY_SELECT_SITE_URL } from "@/lib/notify-messages";
import { fetchLocalStrategyGmbDfsRaw } from "@/lib/local-strategy-research/local-strategy-gmb-fetch";
import {
  flattenBusinessListingItems,
  getLocationCoordinateForWebsiteUrl,
  pickListingForSiteHostname,
  postBusinessListingsSearch,
  type BusinessListingItem,
} from "@/lib/citation-research/dfs-business-listings-client";
import {
  buildBusinessListingsTitleQuery,
  buildGmbKeywordFromListingAndContext,
  formatCitationHoursVertical,
  type CitationRecord,
} from "@/lib/citation-research/citation-from-gmb-item";
import { extractCitationRecordWithOpenRouter } from "@/lib/citation-research/citation-extract-openrouter";
import { fetchCitationSerpBundle } from "@/lib/citation-research/citation-serp-social";
import { getPrimaryCityStateLabel } from "@/lib/primary-location-from-site";
import { buildTempLocalAnalysisSite } from "@/lib/temp-local-analysis-site";
import { fetchLocationDiscovery } from "@/lib/fetch-location-discovery";
import type { WordPressSite } from "@/components/integrations/types";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import { cn } from "@/lib/utils";
import { useManagerSeedWorkspace } from "@/contexts/manager-seed-workspace-context";

const DFS_ABORT_MS = 180_000;

const citationInputClass =
  "h-8 border-border/60 bg-black/25 text-sm text-foreground placeholder:text-foreground";

/** One keyword per line for paste-friendly lists (comma / newline separated input). */
function formatKeywordsStacked(keywords: string): string {
  const raw = keywords.trim();
  if (!raw) return " - ";
  const parts = raw
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  if (parts.length === 0) return " - ";
  return parts.join("\n");
}

type CitationRow = { label: string; value: string };

function buildCitationRows(record: CitationRecord): CitationRow[] {
  return [
    { label: "Business Name", value: record.businessName },
    { label: "Address", value: record.address },
    { label: "Phone Number", value: record.phone },
    { label: "Website URL", value: record.websiteUrl },
    { label: "GMB URL", value: record.gmbUrl },
    { label: "Description", value: record.description },
    { label: "Keywords", value: formatKeywordsStacked(record.keywords) },
    { label: "Logo wide", value: record.logoWide },
    { label: "Logo Square", value: record.logoSquare },
    { label: "Instagram", value: record.instagramUrl },
    { label: "LinkedIn", value: record.linkedinUrl },
    { label: "Facebook", value: record.facebookUrl },
    { label: "Hours", value: formatCitationHoursVertical(record) },
  ];
}

/** Escape cell for GFM pipe tables; newlines become `<br>` so hours/keywords stay readable. */
function escapeMdTableCell(s: string): string {
  const t = s.trim() || " - ";
  return t
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br>");
}

function buildCitationMarkdownTable(rows: CitationRow[]): string {
  const lines = [
    "| Field | Details |",
    "| :--- | :--- |",
    ...rows.map((r) => `| ${escapeMdTableCell(`${r.label}:`)} | ${escapeMdTableCell(r.value)} |`),
  ];
  return lines.join("\n");
}

function buildCitationClipboardText(record: CitationRecord): string {
  return buildCitationMarkdownTable(buildCitationRows(record));
}

function listingBizTitle(listing: BusinessListingItem | null): string {
  if (!listing) return "";
  const t = listing.title;
  const n = listing.name;
  const a = typeof t === "string" ? t.trim() : "";
  const b = typeof n === "string" ? n.trim() : "";
  return a || b;
}

export function CitationResearchTab() {
  const { mode: workspaceMode, tempSeedUrl, connectedSite: site } = useManagerSeedWorkspace();

  const effectiveSite = useMemo((): WordPressSite => {
    if (workspaceMode === "temp") {
      return buildTempLocalAnalysisSite(tempSeedUrl);
    }
    return site ?? buildTempLocalAnalysisSite("");
  }, [workspaceMode, tempSeedUrl, site]);

  const publicWebUrl = useMemo(() => getPublicSiteUrl(effectiveSite), [effectiveSite]);

  const [seedKeyword, setSeedKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<CitationRecord | null>(null);

  useEffect(() => {
    setRecord(null);
  }, [workspaceMode, tempSeedUrl, site?.id]);

  const runGenerate = useCallback(async () => {
    if (!effectiveSite.siteUrl.trim()) {
      notify.error(workspaceMode === "temp" ? NOTIFY_SEED_SITE_URL_EXAMPLE : NOTIFY_SELECT_SITE_URL);
      return;
    }
    const apiKey = loadApiKey()?.trim();
    if (!apiKey) {
      notify.error(NOTIFY_OPENROUTER_KEY);
      return;
    }

    setLoading(true);
    setRecord(null);
    const signal = AbortSignal.timeout(DFS_ABORT_MS);

    try {
      let cityRegion = getPrimaryCityStateLabel(effectiveSite) ?? "";
      if (!cityRegion.trim() && publicWebUrl.trim()) {
        try {
          const disc = await fetchLocationDiscovery(publicWebUrl.trim());
          cityRegion =
            disc.primarySuggestion?.trim() ||
            disc.primaryAreaLabel?.trim() ||
            (Array.isArray(disc.areaLabels) && disc.areaLabels[0]
              ? String(disc.areaLabels[0]).trim()
              : "") ||
            "";
        } catch {
          /* ignore */
        }
      }

      const titleQuery = buildBusinessListingsTitleQuery(effectiveSite, seedKeyword);
      const locCoord = getLocationCoordinateForWebsiteUrl(publicWebUrl);
      const blJson = await postBusinessListingsSearch({
        title: titleQuery,
        locationCoordinate: locCoord,
        limit: 40,
        signal,
      });
      const items = flattenBusinessListingItems(blJson);
      const listing = pickListingForSiteHostname(items, publicWebUrl);

      const bizTitle =
        listingBizTitle(listing) ||
        effectiveSite.napInfo?.name?.trim() ||
        effectiveSite.name.trim() ||
        "";

      const gmbKw = buildGmbKeywordFromListingAndContext({
        listing,
        businessTitleFallback: bizTitle,
        cityRegionLine: cityRegion,
        seedKeyword: seedKeyword.trim() || undefined,
      });

      let gmbJson: unknown | null = null;
      try {
        const gmbLocName = cityRegion.trim() || undefined;
        gmbJson = await fetchLocalStrategyGmbDfsRaw({
          keyword: gmbKw,
          websiteUrl: publicWebUrl,
          locationName: gmbLocName,
          locationCoordinate: gmbLocName ? undefined : locCoord,
          signal,
        });
      } catch {
        gmbJson = null;
      }

      let serpOrganicUrls: string[] = [];
      let serpSocialFromDfs = {
        linkedinUrl: "",
        instagramUrl: "",
        facebookUrl: "",
      };
      try {
        const serpBundle = await fetchCitationSerpBundle({
          businessName: bizTitle,
          websiteUrl: publicWebUrl,
          signal,
        });
        serpOrganicUrls = serpBundle.serpOrganicUrls;
        serpSocialFromDfs = serpBundle.serpSocialFromDfs;
      } catch {
        serpOrganicUrls = [];
      }

      const model = getResearchModel(workspaceMode === "temp" ? undefined : site?.id);
      const rec = await extractCitationRecordWithOpenRouter({
        apiKey,
        model,
        site: effectiveSite,
        businessListingsSearchResponse: blJson,
        googleBusinessInfoLiveResponse: gmbJson,
        pickedBusinessListingRow: listing,
        serpOrganicUrls,
        serpSocialFromDfs,
        seedKeyword: seedKeyword.trim() || undefined,
        signal,
      });

      setRecord(rec);
      notify.success(gmbJson ? "Citation ready" : "Citation ready (no live GBP)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify.error(msg.length > 120 ? "Citation failed" : msg);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveSite, publicWebUrl, workspaceMode, site?.id, seedKeyword]);

  const copyAll = useCallback(() => {
    if (!record) return;
    void navigator.clipboard.writeText(buildCitationClipboardText(record));
    notify.success(NOTIFY_COPIED);
  }, [record]);

  const canOpenDetails = useMemo(
    () => loading || Boolean(record) || Boolean(publicWebUrl.trim()) || Boolean(seedKeyword.trim()),
    [loading, record, publicWebUrl, seedKeyword],
  );

  const siteReady = Boolean(effectiveSite.siteUrl?.trim());

  return (
    <div className={SEO_WORKSPACE_SHELL_CLASS}>
      {workspaceMode === "connected" && (!site || !site.siteUrl?.trim()) ? (
        <div className="flowbie-zone-tile--data px-2 py-3 text-base leading-normal text-muted-foreground">
          {!site
            ? "Connect a WordPress site and select it in the header, or switch to Temp seed."
            : "This site has no URL saved."}
        </div>
      ) : (
        <>
          <div className={SEO_WORKSPACE_HEADER_CLASS}>
            <CitationWorkspaceHeader
              busy={loading}
              canOpenDetails={canOpenDetails}
              toolbarProps={{
                busy: loading,
                canGenerate: siteReady,
                canCopy: Boolean(record),
                seedKeyword,
                onSeedKeywordChange: setSeedKeyword,
                onGenerate: () => void runGenerate(),
                onCopy: copyAll,
              }}
              detailsProps={{
                workspaceMode,
                siteUrl: publicWebUrl.trim() || null,
                seedKeyword,
                hasRecord: Boolean(record),
              }}
            />
          </div>

          <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, "space-y-2")}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-black/15 px-4 py-8 text-base text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Fetching listings, GBP, SERP (site: social), model…
              </div>
            ) : null}

            {record ? (
          <div className="rounded-xl border border-border/50 bg-black/20 p-3 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <CitationField ro placeholder="Business name" value={record.businessName} />
              <CitationField ro placeholder="Address" value={record.address} />
              <CitationField ro placeholder="Phone" value={record.phone} />
              <CitationField ro placeholder="Website" value={record.websiteUrl} isUrl />
              <CitationField ro placeholder="GMB URL" value={record.gmbUrl} isUrl />
              <CitationField ro placeholder="Logo wide" value={record.logoWide} isUrl />
              <CitationField ro placeholder="Logo square" value={record.logoSquare} isUrl />
              <CitationField ro placeholder="Instagram" value={record.instagramUrl} isUrl />
              <CitationField ro placeholder="LinkedIn" value={record.linkedinUrl} isUrl />
              <CitationField ro placeholder="Facebook" value={record.facebookUrl} isUrl />
            </div>
            <Textarea
              readOnly
              value={formatCitationHoursVertical(record)}
              placeholder="Hours"
              aria-label="Hours"
              rows={8}
              className="mt-2 resize-y whitespace-pre-wrap border-border/60 bg-black/25 font-mono text-xs leading-relaxed text-foreground placeholder:text-foreground"
            />
            <Textarea
              readOnly
              value={record.description}
              placeholder="Description"
              aria-label="Description"
              rows={4}
              className="mt-2 resize-y border-border/60 bg-black/25 text-sm text-foreground placeholder:text-foreground"
            />
            <Textarea
              readOnly
              value={record.keywords}
              placeholder="Keywords"
              aria-label="Keywords"
              rows={2}
              className="mt-2 resize-y border-border/60 bg-black/25 text-sm text-foreground placeholder:text-foreground"
            />
          </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function CitationField({
  ro,
  placeholder,
  value,
  isUrl,
  className,
}: {
  ro?: boolean;
  placeholder: string;
  value: string;
  isUrl?: boolean;
  className?: string;
}) {
  const href =
    isUrl && value.trim().startsWith("http") ? value.trim() : undefined;
  if (href) {
    return (
      <div className={cn("min-w-0", className)}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 items-center gap-1 rounded-md border border-border/60 bg-black/25 px-2 text-sm text-primary hover:underline"
        >
          <span className="min-w-0 flex-1 truncate">{value}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </a>
      </div>
    );
  }
  return (
    <Input
      readOnly={ro}
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(citationInputClass, className)}
    />
  );
}
