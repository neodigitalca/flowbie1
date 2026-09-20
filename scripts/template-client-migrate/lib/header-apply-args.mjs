import path from "node:path";

/**
 * @param {string[]} argv
 */
export function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      flags[key.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return flags;
}

function pick(flags, env, flag, envKey, fallback) {
  const fromFlag = flags[flag];
  if (typeof fromFlag === "string" && fromFlag.trim()) return fromFlag.trim();
  const fromEnv = env[envKey];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return fallback;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} argv
 * @param {string} root
 */
export function parseHeaderApplyArgs(env, argv, root) {
  const flags = parseFlags(argv);
  const destSite = pick(flags, env, "dest-site", "HEADER_DEST_SITE", "blindmagic.com");
  const fromHost = pick(
    flags,
    env,
    "from-host",
    "HEADER_FROM_HOST",
    "blindswebsitet.wpenginepowered.com",
  );
  const headerId = Number(pick(flags, env, "header-id", "HEADER_POST_ID", "101"));
  const menuId = Number(pick(flags, env, "menu-id", "HEADER_MENU_ID", "39"));
  const logoId = Number(pick(flags, env, "logo-id", "HEADER_LOGO_ID", "4575"));
  if (!headerId || !menuId || !logoId) {
    throw new Error("header-id, menu-id, and logo-id must be positive numbers");
  }
  const sourcePath = pick(
    flags,
    env,
    "source",
    "HEADER_SOURCE_JSON",
    path.join(root, "var/template-client-migrate", fromHost, "header-source.json"),
  );
  const reboundPath = pick(
    flags,
    env,
    "rebound",
    "HEADER_REBOUND_JSON",
    path.join(root, "var/template-client-migrate", destSite, "header-rebound.json"),
  );
  const slug = destSite.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return {
    destSite,
    fromHost,
    headerId,
    menuId,
    logoId,
    logoUrl: pick(
      flags,
      env,
      "logo-url",
      "HEADER_LOGO_URL",
      `https://${destSite}/wp-content/uploads/2026/04/Blind-Magic-Logo-2022.png`,
    ),
    promotionsUrl: pick(
      flags,
      env,
      "promotions-url",
      "HEADER_PROMOTIONS_URL",
      `https://${destSite}/promotion/`,
    ),
    phone: pick(flags, env, "phone", "HEADER_PHONE", "(780) 484-2390"),
    email: pick(flags, env, "email", "HEADER_EMAIL", "hello@blindmagic.com"),
    sourcePath,
    reboundPath,
    slug,
    lockRel: `./wp-content/uploads/.tcm-${slug}-header-done`,
    remoteName: `tcm-${slug}-header-once.php`,
    triggerUrl: pick(flags, env, "trigger-url", "HEADER_TRIGGER_URL", `https://${destSite}/`),
  };
}
