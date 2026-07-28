#!/usr/bin/env node
/**
 * Writes wordpress-plugins/flowbie-wp/includes/flowbie-wp-supabase-config.php
 * from server/data/flowbie-supabase-post-bank.json.
 *
 * Usage:
 *   node scripts/embed-wp-supabase-config.cjs
 *   SUPABASE_ANON_KEY=... node scripts/embed-wp-supabase-config.cjs
 *   node scripts/embed-wp-supabase-config.cjs --internal-build
 */

const fs = require('fs');
const path = require('path');

const internalBuild = process.argv.includes('--internal-build');
const ROOT = path.join(__dirname, '..');
const CRED = path.join(ROOT, 'server', 'data', 'flowbie-supabase-post-bank.json');
const OUT = path.join(
  ROOT,
  'wordpress-plugins',
  'flowbie-wp',
  'includes',
  'flowbie-wp-supabase-config.php',
);

function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function defineBlock(name, value) {
  if (!value) return '';
  return `
if ( ! defined( '${name}' ) ) {
\tdefine( '${name}', ${JSON.stringify(value)} );
}`;
}

function main() {
  const dotenv = loadDotEnv(path.join(ROOT, '.env'));
  let url = '';
  let anon = (process.env.SUPABASE_ANON_KEY || process.env.FLOWBIE_WP_SUPABASE_ANON_KEY || '').trim();
  if (fs.existsSync(CRED)) {
    const j = JSON.parse(fs.readFileSync(CRED, 'utf8'));
    if (j.supabaseUrl) url = String(j.supabaseUrl).trim();
    if (!anon && j.supabaseAnonKey) anon = String(j.supabaseAnonKey).trim();
    if (!anon && internalBuild && j.supabaseServiceRoleKey) {
      anon = String(j.supabaseServiceRoleKey).trim();
    }
  }
  if (!url) {
    console.error('Missing supabaseUrl in post-bank credentials file.');
    process.exit(1);
  }
  if (!anon) {
    console.error('Set SUPABASE_ANON_KEY, add supabaseAnonKey to post-bank JSON, or pass --internal-build.');
    process.exit(1);
  }
  const apiBase = (
    process.env.FLOWBIE_WP_DEFAULT_API_BASE ||
    (process.env.VITE_MCP_API_BASE || '').replace(/\/api\/mcp\/?$/, '') ||
    ''
  ).trim().replace(/\/$/, '');
  const dfsLogin = (
    process.env.FLOWBIE_WP_DATAFORSEO_LOGIN ||
    process.env.DATAFORSEO_API_LOGIN ||
    dotenv.FLOWBIE_WP_DATAFORSEO_LOGIN ||
    dotenv.DATAFORSEO_API_LOGIN ||
    ''
  ).trim();
  const dfsPassword = (
    process.env.FLOWBIE_WP_DATAFORSEO_PASSWORD ||
    process.env.DATAFORSEO_API_PASSWORD ||
    dotenv.FLOWBIE_WP_DATAFORSEO_PASSWORD ||
    dotenv.DATAFORSEO_API_PASSWORD ||
    ''
  ).trim();
  const semrushKey = (
    process.env.FLOWBIE_WP_SEMRUSH_API_KEY ||
    process.env.SEMRUSH_API_KEY ||
    dotenv.FLOWBIE_WP_SEMRUSH_API_KEY ||
    dotenv.SEMRUSH_API_KEY ||
    ''
  ).trim();
  const extraDefines =
    defineBlock('FLOWBIE_WP_DEFAULT_API_BASE', apiBase) +
    defineBlock('FLOWBIE_WP_DATAFORSEO_LOGIN', dfsLogin) +
    defineBlock('FLOWBIE_WP_DATAFORSEO_PASSWORD', dfsPassword) +
    defineBlock('FLOWBIE_WP_SEMRUSH_API_KEY', semrushKey);
  const php = `<?php
/**
 * Flowbie Supabase credentials (generated — do not edit by hand).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'FLOWBIE_WP_SUPABASE_URL' ) ) {
\tdefine( 'FLOWBIE_WP_SUPABASE_URL', ${JSON.stringify(url)} );
}
if ( ! defined( 'FLOWBIE_WP_SUPABASE_ANON_KEY' ) ) {
\tdefine( 'FLOWBIE_WP_SUPABASE_ANON_KEY', ${JSON.stringify(anon)} );
}${extraDefines}
`;
  fs.writeFileSync(OUT, php, 'utf8');
  console.log('Wrote', OUT);
}

main();
