#!/usr/bin/env node
/**
 * Template client migrate CLI. Password only from WPE_SFTP_PASS. Never write it to the job.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { collectArgs } from "./lib/args.mjs";
import { jobSlugFromTemplate, pointEmcpUrl } from "./lib/mcp-url.mjs";
import { extractClientMap } from "./lib/extract-client.mjs";
import { classifyBrandFolder } from "./lib/classify-assets.mjs";
import { buildHexPairs, buildIdentityPhp } from "./lib/apply-identity.mjs";
import { uploadMuPlugin } from "./lib/sftp-mu-plugin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
for (const file of [".env", ".env.local"]) {
  loadEnv({ path: path.join(root, file) });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJob(jobPath, job) {
  const safe = { ...job };
  delete safe.sftpPassword;
  delete safe.password;
  delete safe.WPE_SFTP_PASS;
  fs.mkdirSync(path.dirname(jobPath), { recursive: true });
  fs.writeFileSync(jobPath, `${JSON.stringify(safe, null, 2)}\n`);
}

function applyFromJob(job, password) {
  const hexPairs = buildHexPairs(job.leftoverIdentity?.colors || {}, job.client?.colors || {});
  const php = buildIdentityPhp({
    slug: job.slug,
    acf: job.acf || job.client?.acf || {},
    logoFields: job.logoFields || {},
    searchReplace: job.client?.searchReplace || [],
    colors: job.client.colors,
    hexPairs,
  });
  return uploadMuPlugin({
    host: job.sftpHost,
    port: Number(job.sftpPort || 2222),
    username: job.sftpUser,
    password,
    remoteName: `tcm-${job.slug}-once.php`,
    php,
  });
}

const argv = process.argv.slice(2);
const applyOnly = argv.includes("--apply-only");
const jobFlag = argv.findIndex((a) => a === "--job");
const jobFromFlag = jobFlag >= 0 ? argv[jobFlag + 1] : "";

if (applyOnly) {
  if (!jobFromFlag || !fs.existsSync(jobFromFlag)) {
    throw new Error("--apply-only requires --job <path> to an existing job.json");
  }
  const job = readJson(jobFromFlag);
  const password = process.env.WPE_SFTP_PASS || "";
  if (!password) throw new Error("WPE_SFTP_PASS is required");
  if (!job.client?.colors) throw new Error("job.client.colors is required");
  const remote = await applyFromJob(job, password);
  console.log("uploaded", remote);
  process.exit(0);
}

const args = await collectArgs(process.env, argv);
pointEmcpUrl(args.mcpJsonPath, args.emcpUrl);

const slug = jobSlugFromTemplate(args.templateSiteUrl);
const jobDir = path.join(root, "var", "template-client-migrate", slug);
const jobPath = path.join(jobDir, "job.json");

let leftoverIdentity = {};
if (args.leftoverPath) {
  leftoverIdentity = readJson(args.leftoverPath);
}

const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || "";
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required");
}

const client = await extractClientMap({
  clientUrl: args.clientSiteUrl,
  leftoverIdentity,
  apiKey,
});

let assets = [];
if (args.brandFolder) {
  assets = await classifyBrandFolder({
    folder: args.brandFolder,
    teamNames: client.team.map((t) => t.name),
    apiKey,
  });
}

const job = {
  templateSiteUrl: args.templateSiteUrl,
  clientSiteUrl: args.clientSiteUrl,
  emcpUrl: args.emcpUrl,
  sftpHost: args.sftpHost,
  sftpUser: args.sftpUser,
  sftpPort: args.sftpPort,
  brandFolder: args.brandFolder,
  slug,
  leftoverIdentity,
  client,
  assets,
  logoFields: {},
  acf: client.acf || {},
  createdAt: new Date().toISOString(),
};

writeJob(jobPath, job);
console.log("wrote", jobPath);
console.log("pointed EMCP", args.emcpUrl);

if (args.sftpPassword && args.sftpHost && args.sftpUser) {
  const remote = await applyFromJob(job, args.sftpPassword);
  console.log("uploaded", remote);
} else {
  console.log("skip apply (set WPE_SFTP_HOST, WPE_SFTP_USER, WPE_SFTP_PASS to upload)");
}
