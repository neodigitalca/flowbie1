import { AlignLeft, ChevronDown, Heading2, LayoutGrid, Link, Megaphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCampaignRowGenerateButton } from "@/components/ppc/google/GoogleAdsCampaignRowGenerateButton";
import { GoogleAdsCampaignRowCompact } from "@/components/ppc/google/GoogleAdsCampaignRowCompact";
import {
  GoogleAdsDetailsSection,
  PPC_DETAILS_ACCORDION_STACK,
  PPC_DETAILS_TRIGGER,
} from "@/components/ppc/google/google-ads-details-accordion";
import { GoogleAdsCountedInputShell } from "@/components/ppc/google/GoogleAdsFieldCount";
import { PpcInlineField } from "@/components/ppc/google/PpcInlineField";
import {
  PPC_DETAIL_INPUT_CLASS,
  PPC_DETAIL_TEXTAREA_CLASS,
} from "@/components/ppc/google/google-ads-row-details-styles";
import { contentOptimizerRowStripeClass } from "@/components/overview/overview-tab/overview-tab-content-constants";
import { GoogleAdsRowEndRail } from "@/components/ppc/google/GoogleAdsRowEndRail";
import { PPC_ROW_CONTENT_SPAN_CLASS } from "@/components/ppc/google/google-ads-row-constants";
import {
  GOOGLE_ADS_FINAL_URL_MAX,
  GOOGLE_ADS_RSA_DESCRIPTION_MAX,
  GOOGLE_ADS_RSA_HEADLINE_MAX,
  GOOGLE_ADS_RSA_PATH_MAX,
} from "@/lib/ppc/google-ads-field-limits";
import { PPC_AD_GROUP_COUNT_MIN, type PpcCampaignRow, type PpcResponsiveSearchAd, type PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { cn } from "@/lib/utils";

export type GoogleAdsCampaignRowDetailsProps = {
  row: PpcCampaignRow;
  adGroupKeywords: string[];
  stripeIndex: number;
  panelId: string;
  deleteDisabled?: boolean;
  wpPages?: PpcWpPageContext[];
  wpPagesLoading?: boolean;
  landingPageReadOnly?: boolean;
  onCollapse: () => void;
  onDelete: () => void;
  onUpdateCampaign: (patch: Partial<PpcCampaignRow>) => void;
  onKeywordChange?: (keyword: string) => void;
  onLandingPageChange?: (url: string) => void;
  onLoadWpPages?: () => void;
  onAdGroupKeywordChange?: (index: number, keyword: string) => void;
  generateDisabled?: boolean;
  isRowGenerating?: boolean;
  onGenerate?: () => void;
  generatingAdGroupKey?: string | null;
  onGenerateAdGroup?: (adGroupIndex: number) => void;
};

function PpcCountedInputField({
  label,
  value,
  max,
  readOnly = false,
  onChange,
  inputId,
}: {
  label: string;
  value: string;
  max: number;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  inputId?: string;
}) {
  const padClass = max >= 1000 ? "pr-16" : "pr-12";

  return (
    <PpcInlineField label={label}>
      <GoogleAdsCountedInputShell value={value} max={max}>
        <Input
          id={inputId}
          value={value}
          readOnly={readOnly}
          className={cn(PPC_DETAIL_INPUT_CLASS, padClass)}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      </GoogleAdsCountedInputShell>
    </PpcInlineField>
  );
}

export function GoogleAdsCampaignRowDetails({
  row,
  adGroupKeywords,
  stripeIndex,
  panelId,
  deleteDisabled = false,
  wpPages = [],
  wpPagesLoading = false,
  landingPageReadOnly = false,
  onCollapse,
  onDelete,
  onUpdateCampaign,
  onKeywordChange,
  onLandingPageChange,
  onLoadWpPages,
  onAdGroupKeywordChange,
  generateDisabled = false,
  isRowGenerating = false,
  onGenerate,
  generatingAdGroupKey = null,
  onGenerateAdGroup,
}: GoogleAdsCampaignRowDetailsProps) {
  const campaign = row.campaign;
  const nameReadOnly = row.status === "generating";
  const keywordReadOnly = row.status === "generating";
  const adCopyReadOnly = row.status === "generating";
  const showIdleAdGroups = !campaign && (row.status === "idle" || row.status === "error");

  const handleNameChange = (name: string) => {
    onUpdateCampaign({
      campaignName: name,
      ...(campaign ? { campaign: { ...campaign, name } } : {}),
    });
  };

  const handleAdGroupNameChange = (agIndex: number, name: string) => {
    if (!campaign) return;
    onUpdateCampaign({
      campaign: {
        ...campaign,
        adGroups: campaign.adGroups.map((adGroup, index) =>
          index === agIndex ? { ...adGroup, name } : adGroup,
        ),
      },
    });
  };

  const updateAdAt = (agIndex: number, adIndex: number, patch: Partial<PpcResponsiveSearchAd>) => {
    if (!campaign) return;
    onUpdateCampaign({
      campaign: {
        ...campaign,
        adGroups: campaign.adGroups.map((adGroup, agIdx) =>
          agIdx === agIndex
            ? {
                ...adGroup,
                ads: adGroup.ads.map((ad, adIdx) => (adIdx === adIndex ? { ...ad, ...patch } : ad)),
              }
            : adGroup,
        ),
      },
    });
  };

  const handleAdGroupLandingPageChange = (agIndex: number, landingPageUrl: string) => {
    if (!campaign) return;
    onUpdateCampaign({
      campaign: {
        ...campaign,
        adGroups: campaign.adGroups.map((adGroup, index) =>
          index === agIndex ? { ...adGroup, landingPageUrl } : adGroup,
        ),
      },
    });
  };

  const handleAdGroupKeywordsChange = (agIndex: number, text: string) => {
    if (!campaign) return;
    onUpdateCampaign({
      campaign: {
        ...campaign,
        adGroups: campaign.adGroups.map((adGroup, index) =>
          index === agIndex ? { ...adGroup, keywords: text.split("\n") } : adGroup,
        ),
      },
    });
  };

  const renderAdGroupGenerateButton = (agIndex: number) => {
    if (!onGenerateAdGroup) return null;
    const adGroupKey = `${row.id}:${agIndex}`;
    return (
      <GoogleAdsCampaignRowGenerateButton
        busy={generatingAdGroupKey === adGroupKey}
        disabled={generateDisabled && generatingAdGroupKey !== adGroupKey}
        onClick={() => onGenerateAdGroup(agIndex)}
      />
    );
  };

  const adGroupDeleteDisabled =
    adCopyReadOnly ||
    (campaign ? campaign.adGroups.length <= PPC_AD_GROUP_COUNT_MIN : adGroupKeywords.length <= PPC_AD_GROUP_COUNT_MIN);

  const handleDeleteAdGroup = (agIndex: number) => {
    if (adGroupDeleteDisabled) return;

    if (campaign) {
      onUpdateCampaign({
        campaign: {
          ...campaign,
          adGroups: campaign.adGroups.filter((_, index) => index !== agIndex),
        },
      });
      return;
    }

    const next = adGroupKeywords.filter((_, index) => index !== agIndex);
    while (next.length < adGroupKeywords.length) next.push("");
    onUpdateCampaign({ adGroupKeywords: next });
  };

  return (
    <div id={panelId} className={contentOptimizerRowStripeClass(stripeIndex)}>
      <GoogleAdsCampaignRowCompact
        row={row}
        isExpanded
        embedded
        stripeIndex={stripeIndex}
        panelId={panelId}
        deleteDisabled={deleteDisabled}
        nameReadOnly={nameReadOnly}
        keywordReadOnly={keywordReadOnly}
        landingPageReadOnly={landingPageReadOnly}
        wpPages={wpPages}
        wpPagesLoading={wpPagesLoading}
        onToggle={onCollapse}
        onDelete={onDelete}
        onNameChange={handleNameChange}
        onKeywordChange={onKeywordChange}
        onLandingPageChange={onLandingPageChange}
        onLoadWpPages={onLoadWpPages}
        generateDisabled={generateDisabled}
        isRowGenerating={isRowGenerating}
        onGenerate={onGenerate}
      />

      {row.errorMessage || campaign || row.status === "generating" || showIdleAdGroups ? (
        <div className="space-y-2 pb-2 pt-1">
          {row.errorMessage ? (
            <p className="text-base text-destructive">{row.errorMessage}</p>
          ) : null}

          {row.status === "generating" && !campaign && !row.errorMessage ? (
            <p className="text-base text-muted-foreground">Generating campaign…</p>
          ) : null}

          {showIdleAdGroups ? (
            <div className={PPC_DETAILS_ACCORDION_STACK} role="region" aria-label="Ad groups">
              {adGroupKeywords.map((keyword, agIndex) => (
                <div key={`${row.id}-idle-ag-${agIndex}`} className={PPC_DETAILS_TRIGGER}>
                  <div className={PPC_ROW_CONTENT_SPAN_CLASS}>
                    <span className="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4">
                      <LayoutGrid aria-hidden />
                    </span>
                    <span className="shrink-0 text-base font-medium text-white">{`Ad group ${agIndex + 1}:`}</span>
                    <Input
                      value={keyword}
                      readOnly={keywordReadOnly}
                      placeholder="Ad group title"
                      className={cn(PPC_DETAIL_INPUT_CLASS, "h-9 min-w-0 flex-1 text-zinc-100")}
                      aria-label={`Ad group ${agIndex + 1} title`}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onChange={(e) => onAdGroupKeywordChange?.(agIndex, e.target.value)}
                    />
                  </div>
                  <GoogleAdsRowEndRail
                    generate={renderAdGroupGenerateButton(agIndex)}
                    onDelete={() => handleDeleteAdGroup(agIndex)}
                    deleteDisabled={adGroupDeleteDisabled}
                    deleteLabel={`Delete ad group ${agIndex + 1}`}
                    chevron={
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </span>
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          {campaign ? (
            <div className={PPC_DETAILS_ACCORDION_STACK} role="region" aria-label="Ad groups">
              {campaign.adGroups.map((adGroup, agIndex) => (
                <GoogleAdsDetailsSection
                  key={adGroup.id}
                  icon={<LayoutGrid aria-hidden />}
                  title={`Ad group ${agIndex + 1}: ${adGroup.name}`}
                  titlePrefix={`Ad group ${agIndex + 1}:`}
                  titleField={{
                    value: adGroup.name,
                    readOnly: nameReadOnly,
                    placeholder: "Ad group title",
                    ariaLabel: `Ad group ${agIndex + 1} title`,
                    onChange: (name) => handleAdGroupNameChange(agIndex, name),
                  }}
                  defaultOpen={false}
                  headerAction={renderAdGroupGenerateButton(agIndex)}
                  onDelete={() => handleDeleteAdGroup(agIndex)}
                  deleteDisabled={adGroupDeleteDisabled}
                  deleteLabel={`Delete ad group ${agIndex + 1}`}
                >
                  <PpcCountedInputField
                    label="Landing page"
                    value={adGroup.landingPageUrl}
                    max={GOOGLE_ADS_FINAL_URL_MAX}
                    readOnly={adCopyReadOnly}
                    onChange={(landingPageUrl) => handleAdGroupLandingPageChange(agIndex, landingPageUrl)}
                  />

                  <PpcInlineField label="Keywords">
                    <Textarea
                      value={adGroup.keywords.join("\n")}
                      readOnly={adCopyReadOnly}
                      rows={Math.min(8, Math.max(3, adGroup.keywords.length))}
                      className={PPC_DETAIL_TEXTAREA_CLASS}
                      onChange={(e) => handleAdGroupKeywordsChange(agIndex, e.target.value)}
                    />
                  </PpcInlineField>

                  <div className={PPC_DETAILS_ACCORDION_STACK}>
                    {adGroup.ads.map((ad, adIndex) => (
                      <GoogleAdsDetailsSection
                        key={ad.id}
                        nested
                        icon={<Megaphone aria-hidden />}
                        title={`Responsive search ad ${adIndex + 1}`}
                        badge={ad.headlines.length.toLocaleString()}
                        defaultOpen={false}
                      >
                        <GoogleAdsDetailsSection
                          nested
                          icon={<Heading2 aria-hidden />}
                          title="Headlines"
                          badge={ad.headlines.length.toLocaleString()}
                          defaultOpen={false}
                        >
                          {ad.headlines.map((headline, headlineIndex) => (
                            <PpcCountedInputField
                              key={`${ad.id}-headline-${headlineIndex}`}
                              label={`Headline ${headlineIndex + 1}`}
                              value={headline}
                              max={GOOGLE_ADS_RSA_HEADLINE_MAX}
                              readOnly={adCopyReadOnly}
                              onChange={(value) => {
                                const headlines = [...ad.headlines];
                                headlines[headlineIndex] = value;
                                updateAdAt(agIndex, adIndex, { headlines });
                              }}
                            />
                          ))}
                        </GoogleAdsDetailsSection>

                        <GoogleAdsDetailsSection
                          nested
                          icon={<AlignLeft aria-hidden />}
                          title="Descriptions"
                          badge={ad.descriptions.length.toLocaleString()}
                          defaultOpen={false}
                        >
                          {ad.descriptions.map((description, descriptionIndex) => (
                            <PpcCountedInputField
                              key={`${ad.id}-description-${descriptionIndex}`}
                              label={`Description ${descriptionIndex + 1}`}
                              value={description}
                              max={GOOGLE_ADS_RSA_DESCRIPTION_MAX}
                              readOnly={adCopyReadOnly}
                              onChange={(value) => {
                                const descriptions = [...ad.descriptions];
                                descriptions[descriptionIndex] = value;
                                updateAdAt(agIndex, adIndex, { descriptions });
                              }}
                            />
                          ))}
                        </GoogleAdsDetailsSection>

                        <GoogleAdsDetailsSection
                          nested
                          icon={<Link aria-hidden />}
                          title="URL"
                          badge={[ad.finalUrl, ad.path1, ad.path2].filter(Boolean).length}
                          defaultOpen={false}
                        >
                          <PpcCountedInputField
                            label="Final URL"
                            value={ad.finalUrl}
                            max={GOOGLE_ADS_FINAL_URL_MAX}
                            readOnly={adCopyReadOnly}
                            onChange={(finalUrl) => updateAdAt(agIndex, adIndex, { finalUrl })}
                          />
                          <PpcCountedInputField
                            label="Path 1"
                            value={ad.path1 ?? ""}
                            max={GOOGLE_ADS_RSA_PATH_MAX}
                            readOnly={adCopyReadOnly}
                            onChange={(path1) =>
                              updateAdAt(agIndex, adIndex, { path1: path1.trim() || undefined })
                            }
                          />
                          <PpcCountedInputField
                            label="Path 2"
                            value={ad.path2 ?? ""}
                            max={GOOGLE_ADS_RSA_PATH_MAX}
                            readOnly={adCopyReadOnly}
                            onChange={(path2) =>
                              updateAdAt(agIndex, adIndex, { path2: path2.trim() || undefined })
                            }
                          />
                        </GoogleAdsDetailsSection>
                      </GoogleAdsDetailsSection>
                    ))}
                  </div>
                </GoogleAdsDetailsSection>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
