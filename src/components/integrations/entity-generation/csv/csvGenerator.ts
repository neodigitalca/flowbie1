/**
 * CSV Generation Module
 * Generates CSV templates from entities
 */

import { notify } from "@/lib/app-notifications";
import { NOTIFY_NO_ENTITIES_TO_GENERATE_CSV_FROM, notifyCsvTemplateWithXEntitiesDownloaded } from "@/lib/notify-messages";
import { stripPipeBrandSuffixFromTitle } from "@/lib/sap-title-pipe-brand";
import type { WordPressSite } from "../../types";

/**
 * Replaces template variables in a string
 */
export function replaceTemplateVariables(
  template: string,
  entity: string,
  keyword: string = ''
): string {
  let result = template;
  result = result.replace(/{entity}/g, entity);
  result = result.replace(/{keyword}/g, keyword);
  return result;
}

export interface CSVRow {
  keyword: string;
  entity: string;
  title: string;
  modifier: string;
  featuredImage: string;
}

export interface CSVGenerationOptions {
  titleFormat: string;
  keyword: string;
  /** Maps to bulk CSV column `modifier` */
  optionalModifier: string;
  featuredImage: string;
}

/**
 * Generates CSV template from entities
 */
export function generateCSVTemplate(
  entities: string[],
  site: WordPressSite,
  options: CSVGenerationOptions
): void {
  if (entities.length === 0) {
    notify.error(NOTIFY_NO_ENTITIES_TO_GENERATE_CSV_FROM);
    return;
  }

  // Generate CSV rows
  const csvRows: CSVRow[] = entities.map((entity) => {
    let title = options.titleFormat
      ? replaceTemplateVariables(options.titleFormat, entity, options.keyword)
      : entity;
    title = stripPipeBrandSuffixFromTitle(title, site.name);

    return {
      keyword: options.keyword || '',
      entity: entity,
      title: title,
      modifier: options.optionalModifier || '',
      featuredImage: options.featuredImage
    };
  });

  // Convert to CSV (modifier column matches bulk-auto-generate-template.csv / parseCSV)
  const headers = ['keyword', 'entity', 'title', 'modifier', 'featuredImage'];
  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => [
      row.keyword ? `"${row.keyword.replace(/"/g, '""')}"` : '',
      `"${row.entity.replace(/"/g, '""')}"`,
      `"${row.title.replace(/"/g, '""')}"`,
      row.modifier ? `"${row.modifier.replace(/"/g, '""')}"` : '',
      row.featuredImage
    ].join(','))
  ].join('\n');

  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `entities-template-${site.name.replace(/\s+/g, '-')}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  notify.success(notifyCsvTemplateWithXEntitiesDownloaded(entities.length));
}
