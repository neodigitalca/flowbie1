/// <reference types="vite/client" />

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.php?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  /** Full git SHA when built on Render/Vercel (see vite.config.ts). */
  readonly VITE_DEPLOY_GIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
