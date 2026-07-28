/**
 * True when building for https://flowbie.ca/flowbie/ (WP Engine headless deploy).
 */
export const FLOWBIE_CA_DEPLOY =
  import.meta.env.VITE_BASE_PATH === "/flowbie/" || import.meta.env.VITE_FLOWBIE_CA === "1";
