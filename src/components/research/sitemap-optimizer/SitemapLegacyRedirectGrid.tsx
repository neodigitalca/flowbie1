import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  legacyRedirectGridDisplayPath,
  legacyRedirectGridPageCount,
  LEGACY_REDIRECT_GRID_PAGE_SIZE,
  sliceLegacyRedirectGridPage,
} from "@/lib/sitemap-optimizer/legacy-redirect-grid-rows";
import type { LegacyRedirectGridRow } from "@/lib/sitemap-optimizer/types";
import { WorkspaceEmptyRowStripes } from "@/components/shared/WorkspaceEmptyRowStripes";

type Props = {
  rows: LegacyRedirectGridRow[];
  page: number;
  onPageChange: (page: number) => void;
  running?: boolean;
};

export function SitemapLegacyRedirectGrid({ rows, page, onPageChange, running }: Props) {
  const totalPages = useMemo(() => legacyRedirectGridPageCount(rows.length), [rows.length]);
  const pageRows = useMemo(
    () => sliceLegacyRedirectGridPage(rows, page, LEGACY_REDIRECT_GRID_PAGE_SIZE),
    [rows, page],
  );

  const onFirstPage = page <= 1;
  const onLastPage = totalPages <= 0 || page >= totalPages;

  if (rows.length === 0) {
    return <WorkspaceEmptyRowStripes />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base tabular-nums text-muted-foreground">
          {rows.length} URL{rows.length === 1 ? "" : "s"}
          {running ? " · matching…" : ""}
        </p>
        {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-base"
                disabled={onFirstPage}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </Button>
              <span className="text-base tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-base"
                disabled={onLastPage}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60">
        <Table className="w-full text-base">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-1/2 px-2">Old path</TableHead>
              <TableHead className="w-1/2 px-2">New path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
              const oldPath = legacyRedirectGridDisplayPath(row.legacyUrl);
              const newPath = row.destinationUrl
                ? legacyRedirectGridDisplayPath(row.destinationUrl)
                : "";
              return (
                <TableRow key={`${row.uploadRow}-${row.legacyUrl}`} className="hover:bg-muted/30">
                  <TableCell className="px-2 py-1.5 align-top">
                    <a
                      href={row.legacyUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={oldPath}
                      className="block break-all text-foreground underline-offset-2 hover:underline"
                    >
                      {oldPath || "—"}
                    </a>
                  </TableCell>
                  <TableCell className="px-2 py-1.5 align-top">
                    {row.destinationUrl ? (
                      <a
                        href={row.destinationUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={newPath}
                        className="block break-all font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {newPath || "—"}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
