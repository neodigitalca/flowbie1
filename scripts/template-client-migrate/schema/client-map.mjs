const HEX7 = /^#[0-9A-Fa-f]{6}$/;

export function isHex7(value) {
  return typeof value === "string" && HEX7.test(value);
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

/**
 * @param {unknown} data
 */
export function validateClientMap(data) {
  if (!data || typeof data !== "object") {
    throw new Error("client map must be an object");
  }
  const map = data;
  const company = requireString(map.company, "company");
  const colors = map.colors;
  if (!colors || typeof colors !== "object") {
    throw new Error("colors must be an object");
  }
  for (const key of ["primary", "secondary", "text", "accent"]) {
    if (!isHex7(colors[key])) {
      throw new Error(`colors.${key} must be #RRGGBB`);
    }
  }
  const searchReplace = requireArray(map.searchReplace, "searchReplace").map((pair, i) => {
    if (!pair || typeof pair !== "object") {
      throw new Error(`searchReplace[${i}] must be an object`);
    }
    return {
      from: requireString(pair.from, `searchReplace[${i}].from`),
      to: requireString(pair.to, `searchReplace[${i}].to`),
    };
  });
  const team = requireArray(map.team ?? [], "team").map((row, i) => ({
    name: requireString(row?.name, `team[${i}].name`),
    role: typeof row?.role === "string" ? row.role.trim() : "",
  }));
  const locations = requireArray(map.locations ?? [], "locations").map((row, i) => ({
    name: requireString(row?.name, `locations[${i}].name`),
    address: typeof row?.address === "string" ? row.address.trim() : "",
  }));
  const products = requireArray(map.products ?? [], "products").map((row, i) => ({
    name: requireString(row?.name, `products[${i}].name`),
  }));
  const acf =
    map.acf && typeof map.acf === "object" && !Array.isArray(map.acf)
      ? Object.fromEntries(
          Object.entries(map.acf).map(([key, value]) => [key, value == null ? "" : String(value)]),
        )
      : {};
  return {
    company,
    description: typeof map.description === "string" ? map.description.trim() : "",
    phones: requireArray(map.phones ?? [], "phones").map((p, i) => requireString(p, `phones[${i}]`)),
    phoneLink: typeof map.phoneLink === "string" ? map.phoneLink.trim() : "",
    email: typeof map.email === "string" ? map.email.trim() : "",
    address: typeof map.address === "string" ? map.address.trim() : "",
    hours: map.hours && typeof map.hours === "object" ? map.hours : {},
    social: map.social && typeof map.social === "object" ? map.social : {},
    colors: {
      primary: String(colors.primary).toUpperCase(),
      secondary: String(colors.secondary).toUpperCase(),
      text: String(colors.text).toUpperCase(),
      accent: String(colors.accent).toUpperCase(),
    },
    team,
    locations,
    products,
    searchReplace,
    acf,
  };
}

const ASSET_ROLES = new Set(["logo_dark", "logo_white", "logo_icon", "person", "other"]);

/**
 * @param {unknown} data
 */
export function validateBrandAssetList(data) {
  const rows = requireArray(data, "assets");
  return rows.map((row, i) => {
    if (!row || typeof row !== "object") {
      throw new Error(`assets[${i}] must be an object`);
    }
    const role = requireString(row.role, `assets[${i}].role`);
    if (!ASSET_ROLES.has(role)) {
      throw new Error(`assets[${i}].role must be logo_dark, logo_white, logo_icon, person, or other`);
    }
    return {
      filename: requireString(row.filename, `assets[${i}].filename`),
      role,
      personName: typeof row.personName === "string" ? row.personName.trim() : "",
      alt: typeof row.alt === "string" ? row.alt.trim() : "",
      attachmentId: Number.isInteger(row.attachmentId) ? row.attachmentId : null,
    };
  });
}
