/**
 * Semrush competitor row normalization (test + shared parse helpers).
 * Trimmed from legacy server/semrush/semrush-organic-competitors.js — no MCP deps.
 */

/**
 * @param {unknown} x
 * @returns {number|null}
 */
function parseSemrushMetricNumber(x) {
  if (x == null) return null;
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  let s = String(x).trim().replace(/,/g, '');
  s = s.replace(/[$€£]/g, '').replace(/%/g, '').trim();
  if (s === '' || s === '-' || /^n\/?a$/i.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, unknown>} r
 * @returns {Record<string, unknown>}
 */
function buildLowerLookup(r) {
  const lower = {};
  for (const [k, v] of Object.entries(r)) {
    const key = String(k).replace(/^\ufeff/, '').trim().toLowerCase();
    const set = (lk) => {
      if (!(lk in lower)) lower[lk] = v;
    };
    set(key);
    set(key.replace(/\s+/g, '_'));
    set(key.replace(/\s+/g, ''));
  }
  return lower;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function hostnameFromDomainField(raw) {
  const s = (raw || '').toString().trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).hostname.replace(/^www\./i, '');
    } catch {
      return s.replace(/^www\./i, '');
    }
  }
  const noPath = s.replace(/^www\./i, '').split('/')[0].trim();
  return noPath;
}

/**
 * @param {Record<string, unknown>} r
 * @returns {{ domain: string, competitionLevel: number|null, commonKeywords: number|null, organicTraffic: number|null, trafficCost: number|null, organicKeywords: number|null, adsKeywords: number|null } | null}
 */
function normalizeCompetitorRow(r) {
  if (!r || typeof r !== 'object') return null;
  const lower = buildLowerLookup(r);
  const pick = (...keys) => {
    for (const k of keys) {
      const kk = k.toLowerCase();
      const v =
        lower[kk] ??
        lower[kk.replace(/\s+/g, '_')] ??
        lower[kk.replace(/\s+/g, '')];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  };
  const num = (x) => parseSemrushMetricNumber(x);

  const dnRaw = pick('dn', 'domain');
  const dn = hostnameFromDomainField(dnRaw);
  if (!dn) return null;

  return {
    domain: dn,
    competitionLevel: num(pick('cr', 'competition', 'competition_level', 'competition level')),
    commonKeywords: num(pick('np', 'common_keywords', 'common_keywords_count', 'common keywords')),
    organicTraffic: num(
      pick(
        'or',
        'organic_traffic',
        'traffic',
        'organic_traffic_estimation',
        'organic traffic',
        'organictraffic',
      ),
    ),
    trafficCost: num(pick('ot', 'traffic_cost', 'traffic_value', 'cost', 'traffic value', 'trafficvalue')),
    organicKeywords: num(pick('oc', 'organic_keywords', 'organic_keywords_count', 'organic keywords')),
    adsKeywords: num(pick('ad', 'paid_keywords', 'ads_keywords', 'paid keywords')),
  };
}

module.exports = {
  parseSemrushMetricNumber,
  normalizeCompetitorRow,
};
