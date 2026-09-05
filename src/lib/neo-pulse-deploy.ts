/**
 * True when building for https://neodigital.ca/neo-pulse/ (WP Engine headless deploy).
 */
const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;

export const NEO_PULSE_CA_DEPLOY =
  viteEnv?.VITE_BASE_PATH === "/neo-pulse/" || viteEnv?.VITE_NEO_PULSE === "1";
