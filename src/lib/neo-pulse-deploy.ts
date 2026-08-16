/**
 * True when building for https://neodigital.ca/neo-pulse/ (WP Engine headless deploy).
 */
export const NEO_PULSE_CA_DEPLOY =
  import.meta.env.VITE_BASE_PATH === "/neo-pulse/" || import.meta.env.VITE_NEO_PULSE === "1";
