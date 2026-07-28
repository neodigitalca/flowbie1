/**
 * Parse Flowbie Fields export JSON (ACF-compatible) into discovery result shape.
 */

/**
 * @param {unknown} field
 * @param {string} groupKey
 * @param {string} groupTitle
 * @param {unknown[]} out
 */
function flattenAcfExportFields(field, groupKey, groupTitle, out) {
  if (!field || typeof field !== 'object') return;
  const f = /** @type {Record<string, unknown>} */ (field);
  const name = typeof f.name === 'string' ? f.name.trim() : '';
  const type = typeof f.type === 'string' ? f.type : 'text';
  const layoutTypes = new Set(['tab', 'accordion', 'message', 'group', 'clone']);

  if (name && !layoutTypes.has(type)) {
    out.push({
      name,
      label: typeof f.label === 'string' && f.label.trim() ? f.label : name,
      type,
      groupId: groupKey,
      groupTitle,
      location: [],
    });
  }

  if (Array.isArray(f.sub_fields)) {
    for (const sub of f.sub_fields) {
      flattenAcfExportFields(sub, groupKey, groupTitle, out);
    }
  }
  if (Array.isArray(f.layouts)) {
    for (const layout of f.layouts) {
      if (layout && typeof layout === 'object' && Array.isArray(layout.sub_fields)) {
        for (const sub of layout.sub_fields) {
          flattenAcfExportFields(sub, groupKey, groupTitle, out);
        }
      }
    }
  }
}

/**
 * @param {string} jsonString
 * @returns {{ fieldGroups: unknown[]; fields: unknown[] } | null}
 */
function parseFlowbieFieldsExportJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') return null;
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const fieldGroups = [];
  const fields = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const group = /** @type {Record<string, unknown>} */ (item);
    if (!Array.isArray(group.fields)) continue;

    const groupKey = typeof group.key === 'string' ? group.key : '';
    const groupTitle = typeof group.title === 'string' ? group.title : groupKey || 'Field group';
    const groupFields = [];

    for (const field of group.fields) {
      flattenAcfExportFields(field, groupKey, groupTitle, groupFields);
    }

    fieldGroups.push({
      key: groupKey,
      title: groupTitle,
      fields: groupFields,
      location: Array.isArray(group.location) ? group.location : [],
    });
    fields.push(...groupFields);
  }

  return { fieldGroups, fields };
}

module.exports = {
  parseFlowbieFieldsExportJson,
  flattenAcfExportFields,
};
