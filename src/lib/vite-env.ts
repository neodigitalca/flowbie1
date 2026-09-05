/** Safe Vite env reads for browser bundles and Node worker processes. */
export function readViteEnv(key: string): string {
  const env =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  if (env && env[key as keyof typeof env] != null) {
    const fromMeta = String(env[key as keyof typeof env]).trim();
    if (fromMeta !== "") return fromMeta;
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return String(process.env[key]).trim();
  }
  return "";
}

export function isViteDev(): boolean {
  const env =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  return Boolean(env?.DEV);
}
