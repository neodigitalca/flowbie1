import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  multiSiteSourceLabel,
  type MultiSiteUrlSource,
} from "@/lib/content-optimizer/multi-site-source-urls";
import { cn } from "@/lib/utils";

export const SITEMAP_MIXED_SENTINEL = "__ms_sitemap_mixed__" as const;

export type SitemapSelectValue = MultiSiteUrlSource | typeof SITEMAP_MIXED_SENTINEL;

export type MultiSiteSitemapModeSelectProps = {
  value: SitemapSelectValue;
  onSelect: (next: MultiSiteUrlSource) => void;
  /** When set, Entity / Both options respect post + entity sitemap presence (per-row). Omit for "all sites". */
  availability?: { post: boolean; entity: boolean };
  disabled?: boolean;
  id?: string;
  ariaLabel: string;
  triggerClassName?: string;
  showMixedSentinel: boolean;
  /** White label text and dark menu (sitemap + date black cluster on each row). */
  inDarkCluster?: boolean;
};

export function MultiSiteSitemapModeSelect({
  value,
  onSelect,
  availability,
  disabled,
  id,
  ariaLabel,
  triggerClassName,
  showMixedSentinel,
  inDarkCluster = false,
}: MultiSiteSitemapModeSelectProps) {
  const entityDisabled = availability ? !availability.entity : false;
  const bothDisabled = availability ? !availability.post || !availability.entity : false;

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === SITEMAP_MIXED_SENTINEL) return;
        onSelect(v as MultiSiteUrlSource);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          triggerClassName,
          inDarkCluster &&
            "disabled:!opacity-100 disabled:!text-white data-[placeholder]:!text-white/70",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="end"
        className={
          inDarkCluster
            ? "border border-white/30 bg-zinc-950/95 !text-white [&_svg]:!text-white"
            : undefined
        }
      >
        {showMixedSentinel && value === SITEMAP_MIXED_SENTINEL ? (
          <SelectItem
            value={SITEMAP_MIXED_SENTINEL}
            disabled
            className={
              inDarkCluster
                ? "!text-white/70 focus:bg-transparent focus:!text-white/70 data-[highlighted]:bg-transparent data-[highlighted]:!text-white/70 data-[disabled]:!opacity-100"
                : undefined
            }
          >
            Mixed (per site)
          </SelectItem>
        ) : null}
        <SelectItem
          value="post"
          className={
            inDarkCluster
              ? "!text-white focus:bg-white/10 focus:!text-white data-[highlighted]:bg-white/10 data-[highlighted]:!text-white [&_svg]:!text-white"
              : undefined
          }
        >
          {multiSiteSourceLabel("post")}
        </SelectItem>
        <SelectItem
          value="entity"
          disabled={entityDisabled}
          className={
            inDarkCluster
              ? "!text-white focus:bg-white/10 focus:!text-white data-[highlighted]:bg-white/10 data-[highlighted]:!text-white [&_svg]:!text-white data-[disabled]:!text-white/55 data-[disabled]:!opacity-100"
              : undefined
          }
        >
          {multiSiteSourceLabel("entity")}
        </SelectItem>
        <SelectItem
          value="both"
          disabled={bothDisabled}
          className={
            inDarkCluster
              ? "!text-white focus:bg-white/10 focus:!text-white data-[highlighted]:bg-white/10 data-[highlighted]:!text-white [&_svg]:!text-white data-[disabled]:!text-white/55 data-[disabled]:!opacity-100"
              : undefined
          }
        >
          {multiSiteSourceLabel("both")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
