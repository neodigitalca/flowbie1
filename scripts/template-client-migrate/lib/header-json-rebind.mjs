const MENU_WIDGETS = new Set(["nav-menu", "jet-mobile-menu", "jet-mega-menu"]);

/**
 * @param {{ from: string, to: string }[]} pairs
 */
export function sortPairs(pairs) {
  return [...pairs].sort((a, b) => b.from.length - a.from.length);
}

/**
 * @param {unknown} value
 * @param {{ from: string, to: string }[]} pairs
 */
export function replaceStrings(value, pairs) {
  const ordered = sortPairs(pairs);
  if (typeof value === "string") {
    let out = value;
    for (const pair of ordered) {
      if (pair.from && out.includes(pair.from)) {
        out = out.split(pair.from).join(pair.to);
      }
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceStrings(item, ordered));
  }
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = replaceStrings(item, ordered);
    }
    return next;
  }
  return value;
}

function walkElements(elements, visit) {
  if (!Array.isArray(elements)) return;
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    visit(el);
    if (Array.isArray(el.elements)) walkElements(el.elements, visit);
  }
}

function setMenuSettings(settings, menuId) {
  const id = String(menuId);
  settings.menu = id;
  if ("nav_menu" in settings) settings.nav_menu = id;
  if ("menu_id" in settings) settings.menu_id = id;
  if ("target_menu" in settings) settings.target_menu = id;
  if ("mobile_menu" in settings) settings.mobile_menu = id;
  if ("mobile-menu" in settings) settings["mobile-menu"] = id;
}

function setImage(settings, logo) {
  if (!logo?.id) return;
  const current = settings.image && typeof settings.image === "object" ? settings.image : {};
  settings.image = {
    ...current,
    id: logo.id,
    url: logo.url || current.url || "",
  };
}

function isLogoImage(el) {
  const url = String(el?.settings?.image?.url || "");
  const alt = String(el?.settings?.image?.alt || el?.settings?.image?.title || "");
  const blob = `${url} ${alt}`.toLowerCase();
  return blob.includes("logo") || blob.includes("blind") || blob.includes("drc");
}

/**
 * @param {unknown} tree
 * @param {{
 *   menuId: number,
 *   logo?: { id: number, url?: string },
 *   promotionsUrl?: string,
 *   replacements?: { from: string, to: string }[],
 * }} opts
 */
export function rebindHeaderJson(tree, opts) {
  if (!opts?.menuId) throw new Error("menuId is required");
  const cloned = structuredClone(tree);
  const elements = Array.isArray(cloned) ? cloned : cloned?.content || cloned?.elements;
  if (!Array.isArray(elements)) {
    throw new Error("header JSON must be an element array");
  }

  let logoSet = false;
  walkElements(elements, (el) => {
    const type = el.widgetType;
    if (!el.settings || typeof el.settings !== "object") el.settings = {};
    if (MENU_WIDGETS.has(type)) {
      setMenuSettings(el.settings, opts.menuId);
    }
    if (type === "image" && opts.logo && (isLogoImage(el) || !logoSet)) {
      setImage(el.settings, opts.logo);
      logoSet = true;
    }
    if (opts.promotionsUrl) {
      const text = String(el.settings.text || el.settings.title || el.settings.editor || "");
      if (typeof el.settings.link === "object" && (text.toLowerCase().includes("sale") || text.toLowerCase().includes("promotion"))) {
        el.settings.link = { ...el.settings.link, url: opts.promotionsUrl };
      }
      if (Array.isArray(el.settings.icon_list)) {
        for (const item of el.settings.icon_list) {
          const itemText = String(item?.text || "");
          if (item?.link && (itemText.toLowerCase().includes("sale") || itemText.toLowerCase().includes("promotion"))) {
            item.link = { ...item.link, url: opts.promotionsUrl };
          }
        }
      }
    }
  });

  const replacements = opts.replacements || [];
  const rebound = replaceStrings(elements, replacements);
  if (Array.isArray(cloned)) return rebound;
  if (cloned.content) {
    cloned.content = rebound;
    return cloned;
  }
  cloned.elements = rebound;
  return cloned;
}

export const BLIND_MAGIC_REPLACEMENTS = [
  { from: "blindswebsitet.wpenginepowered.com", to: "blindmagic.com" },
  { from: "https://pablaws.mysites.io/", to: "https://blindmagic.com/" },
  { from: "(772) 223-1212", to: "(780) 484-2390" },
  { from: "info@drcentre.ca", to: "hello@blindmagic.com" },
  { from: "(800) 610-0331 · (604) 322-7611", to: "(780) 484-2390" },
  { from: "(800) 610-0331", to: "(780) 484-2390" },
  { from: "800-610-0331", to: "780-484-2390" },
  { from: "+18006100331", to: "+17804842390" },
  { from: "Designer's Resource Centre", to: "Blind Magic" },
  { from: "Designer’s Resource Centre", to: "Blind Magic" },
];
