/**
 * Write edmonton-seo-link-map.json and apply missing body links on neodigital.ca.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openProxiedSession } from "../firstrank-teardown/lib.mjs";
import { buildLinkMap, alreadyLinked, normPath, validateLinkMap } from "./link-map-rules.mjs";
import { runNeodigitalPhp } from "./sftp-oneshot.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "test-output");
const inventory = JSON.parse(readFileSync(join(outDir, "edmonton-seo-inventory.json"), "utf8"));
const classified = JSON.parse(readFileSync(join(outDir, "edmonton-seo-classified-posts.json"), "utf8"));
let cluster = {};
try {
  cluster = JSON.parse(readFileSync(join(outDir, "edmonton-seo-cluster-jobs.json"), "utf8"));
} catch {
  cluster = {};
}

const map = buildLinkMap(inventory, classified, cluster);
const errors = validateLinkMap(map, inventory);
if (errors.length) {
  console.error(errors.join("\n"));
  throw new Error(`link map failed ${errors.length} rule(s)`);
}

const byPath = new Map((inventory.items || []).map((i) => [normPath(i.path), i]));
const toApply = map.links.filter((link) => {
  const src = byPath.get(normPath(link.from));
  if (!src) throw new Error(`apply: missing source ${link.from}`);
  return !alreadyLinked(src, link.to);
});

mkdirSync(outDir, { recursive: true });
const dest = join(outDir, "edmonton-seo-link-map.json");
writeFileSync(
  dest,
  JSON.stringify({ ok: true, money: map.money, paths: map.paths, links: map.links, apply: toApply }, null, 2),
  "utf8",
);
console.log(JSON.stringify({ wrote: dest, links: map.links.length, apply: toApply.length }, null, 2));

const args = new Set(process.argv.slice(2));
if (args.has("--map-only")) process.exit(0);

function applyPhp(batch) {
  const mapJson = JSON.stringify(batch).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `
$map = json_decode( '${mapJson}', true );
if ( ! is_array( $map ) ) {
  echo wp_json_encode( array( 'error' => 'bad map json' ) );
  return;
}

function nd_already( $html, $to_url ) {
  if ( ! is_string( $html ) || $html === '' ) {
    return false;
  }
  if ( stripos( $html, $to_url ) !== false ) {
    return true;
  }
  $path = wp_parse_url( $to_url, PHP_URL_PATH );
  return $path && stripos( $html, $path ) !== false;
}

function nd_link_html( $row, $to_url ) {
  return '<a href="' . esc_url( $to_url ) . '">' . esc_html( $row['anchor'] ) . '</a>';
}

function nd_wrap_or_append( &$html, $row, $to_url ) {
  if ( nd_already( $html, $to_url ) ) {
    return 'exists';
  }
  if ( ( $row['placement'] ?? '' ) === 'existing_sentence' ) {
    $mention = $row['mention'] ?? '';
    if ( $mention === '' ) {
      return 'fail-mention';
    }
    $pos = stripos( $html, $mention );
    if ( $pos === false ) {
      return 'fail-mention';
    }
    $before = substr( $html, 0, $pos );
    $open   = strripos( $before, '<a' );
    $close  = strripos( $before, '</a>' );
    if ( $open !== false && ( $close === false || $open > $close ) ) {
      return 'fail-inside-anchor';
    }
    $actual = substr( $html, $pos, strlen( $mention ) );
    $html   = substr( $html, 0, $pos ) . '<a href="' . esc_url( $to_url ) . '">' . $actual . '</a>' . substr( $html, $pos + strlen( $mention ) );
    return 'wrapped';
  }
  $sentence = $row['sentence'] ?? '';
  if ( $sentence === '' ) {
    return 'fail-sentence';
  }
  $filled = str_replace( '{{link}}', nd_link_html( $row, $to_url ), $sentence );
  $html  .= ( str_contains( $html, '<' ) ? '<p>' . $filled . '</p>' : ' ' . $filled );
  return 'appended';
}

function nd_apply_settings( &$settings, $row, $to_url, $mode ) {
  if ( ! is_array( $settings ) ) {
    return '';
  }
  $skip = array( 'custom_css', '_css_classes', 'css_classes', 'custom_id', 'title', 'subtitle', 'heading' );
  foreach ( $settings as $key => &$val ) {
    if ( in_array( $key, $skip, true ) ) {
      continue;
    }
    if ( is_string( $val ) && $val !== '' ) {
      if ( $mode === 'append' && ( ! in_array( $key, array( 'editor', 'description', 'text', 'content' ), true ) || strlen( wp_strip_all_tags( $val ) ) < 40 ) ) {
        continue;
      }
      if ( $mode === 'wrap' && ( $row['mention'] ?? '' ) !== '' && stripos( $val, $row['mention'] ) === false ) {
        continue;
      }
      $result = nd_wrap_or_append( $val, $row, $to_url );
      if ( $result === 'wrapped' || $result === 'appended' || $result === 'exists' ) {
        return $result;
      }
    } elseif ( is_array( $val ) ) {
      $child = nd_apply_settings( $val, $row, $to_url, $mode );
      if ( $child !== '' ) {
        return $child;
      }
    }
  }
  return '';
}

function nd_apply_elementor( &$nodes, $row, $to_url, $mode ) {
  if ( ! is_array( $nodes ) ) {
    return '';
  }
  foreach ( $nodes as &$node ) {
    if ( isset( $node['settings'] ) && is_array( $node['settings'] ) ) {
      $hit = nd_apply_settings( $node['settings'], $row, $to_url, $mode );
      if ( $hit !== '' ) {
        return $hit;
      }
    }
    if ( ! empty( $node['elements'] ) ) {
      $child = nd_apply_elementor( $node['elements'], $row, $to_url, $mode );
      if ( $child !== '' ) {
        return $child;
      }
    }
  }
  return '';
}

function nd_apply_acf( $post_id, $row, $to_url ) {
  if ( ! function_exists( 'get_fields' ) || ! function_exists( 'update_field' ) ) {
    return '';
  }
  $fields = get_fields( $post_id );
  if ( ! is_array( $fields ) ) {
    return '';
  }
  foreach ( $fields as $key => $val ) {
    if ( ! is_string( $val ) || $val === '' ) {
      continue;
    }
    if ( ( $row['placement'] ?? '' ) === 'existing_sentence' && ( $row['mention'] ?? '' ) !== '' && stripos( $val, $row['mention'] ) === false ) {
      continue;
    }
    $copy   = $val;
    $result = nd_wrap_or_append( $copy, $row, $to_url );
    if ( $result === 'wrapped' || $result === 'appended' ) {
      update_field( $key, $copy, $post_id );
      return $result;
    }
    if ( $result === 'exists' ) {
      return 'exists';
    }
  }
  return '';
}

function nd_id_from_path( $path ) {
  if ( $path === '/' ) {
    return (int) get_option( 'page_on_front' );
  }
  $id = url_to_postid( home_url( trailingslashit( $path ) ) );
  if ( $id ) {
    return $id;
  }
  $id = url_to_postid( home_url( $path ) );
  if ( $id ) {
    return $id;
  }
  $slug = trim( $path, '/' );
  foreach ( get_post_types( array( 'public' => true ), 'names' ) as $type ) {
    $found = get_page_by_path( $slug, OBJECT, $type );
    if ( $found ) {
      return (int) $found->ID;
    }
  }
  return 0;
}

$results = array();
$cleared = false;
foreach ( $map as $row ) {
  $from_id = nd_id_from_path( $row['from'] );
  $to_id   = nd_id_from_path( $row['to'] );
  if ( ! $from_id ) {
    $results[] = array( 'from' => $row['from'], 'to' => $row['to'], 'status' => 'fail-from-404' );
    continue;
  }
  if ( ! $to_id ) {
    $results[] = array( 'from' => $row['from'], 'to' => $row['to'], 'status' => 'fail-to-404' );
    continue;
  }
  $to_url = $to_id ? get_permalink( $to_id ) : home_url( '/' );
  $post   = get_post( $from_id );
  $raw    = get_post_meta( $from_id, '_elementor_data', true );
  $status = '';
  if ( is_string( $raw ) && $raw !== '' ) {
    $data = json_decode( $raw, true );
    if ( is_array( $data ) ) {
      $mode   = ( $row['placement'] ?? '' ) === 'existing_sentence' ? 'wrap' : 'append';
      $status = nd_apply_elementor( $data, $row, $to_url, $mode );
      if ( $status === 'wrapped' || $status === 'appended' ) {
        update_post_meta( $from_id, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
        $cleared = true;
      }
    }
  }
  if ( $status === '' ) {
    $status = nd_apply_acf( $from_id, $row, $to_url );
  }
  if ( $status === '' && $post ) {
    $content = $post->post_content;
    $status  = nd_wrap_or_append( $content, $row, $to_url );
    if ( $status === 'wrapped' || $status === 'appended' ) {
      wp_update_post(
        array(
          'ID'           => $from_id,
          'post_content' => $content,
        )
      );
    }
  }
  if ( $status === '' ) {
    $status = 'fail-no-field';
  }
  $results[] = array(
    'from'   => $row['from'],
    'to'     => $row['to'],
    'status' => $status,
    'id'     => $from_id,
  );
}

if ( $cleared && class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::\$instance->files_manager->clear_cache();
}
$failed = array_values(
  array_filter(
    $results,
    function ( $r ) {
      return str_starts_with( $r['status'], 'fail' );
    }
  )
);
echo wp_json_encode(
  array(
    'ok'      => count( $failed ) === 0,
    'applied' => count( $results ),
    'failed'  => $failed,
    'results' => $results,
  )
);
`;
}

if (!args.has("--skip-apply")) {
  const allResults = [];
  const allFailed = [];
  for (let i = 0; i < toApply.length; i += 12) {
    const batch = toApply.slice(i, i + 12);
    const applied = await runNeodigitalPhp(applyPhp(batch), `nd-edmonton-apply-links-${i}`);
    allResults.push(...(applied.results || []));
    allFailed.push(...(applied.failed || []));
    console.log(JSON.stringify({ batch: i, applyOk: applied.ok, applied: applied.applied, failed: applied.failed }, null, 2));
    if (!applied.ok) {
      writeFileSync(join(outDir, "edmonton-seo-apply-result.json"), JSON.stringify({ ok: false, results: allResults, failed: allFailed }, null, 2), "utf8");
      throw new Error(`apply failed ${JSON.stringify(applied.failed)}`);
    }
  }
  writeFileSync(join(outDir, "edmonton-seo-apply-result.json"), JSON.stringify({ ok: true, applied: allResults.length, failed: allFailed, results: allResults }, null, 2), "utf8");
}

if (args.has("--skip-recrawl")) process.exit(0);

const moneyPath = map.money;
const recrawlPaths = [
  ...new Set([
    "/aiseo",
    "/website-design",
    "/our-work/blind-magic",
    moneyPath,
    ...map.links.filter((l) => normPath(l.to) === moneyPath).map((l) => normPath(l.from)),
  ]),
];

const session = await openProxiedSession();
const recrawlPages = [];
try {
  for (const path of recrawlPaths) {
    const url = new URL(path === "/" ? "/" : path, "https://neodigital.ca");
    url.searchParams.set("nonitro", "1");
    const res = await session.page.goto(url.href, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
      referer: "",
    });
    const status = res?.status() ?? 0;
    const hrefs = await session.page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => {
          try {
            const parsed = new URL(a.getAttribute("href"), location.origin);
            return parsed.origin === location.origin ? parsed.pathname : "";
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );
    recrawlPages.push({ path, status, hrefs: [...new Set(hrefs)] });
  }
} finally {
  await session.browser.close();
}
const recrawl = { ok: true, pages: recrawlPages };
writeFileSync(join(outDir, "edmonton-seo-recrawl.json"), JSON.stringify(recrawl, null, 2), "utf8");

const notOk = (recrawl.pages || []).filter((p) => p.status !== 200 && p.status !== 304);
const inbound = new Map();
for (const page of recrawl.pages || []) {
  for (const href of page.hrefs || []) {
    const n = normPath(href);
    inbound.set(n, (inbound.get(n) || 0) + 1);
  }
}
const orphans = (recrawl.pages || []).filter((p) => (inbound.get(normPath(p.path)) || 0) === 0);
const aiseo = (recrawl.pages || []).find((p) => normPath(p.path) === "/aiseo");
const design = (recrawl.pages || []).find((p) => normPath(p.path) === "/website-design");
const blind = (recrawl.pages || []).find((p) => normPath(p.path) === "/our-work/blind-magic");
const money = (recrawl.pages || []).find((p) => normPath(p.path) === moneyPath);
const checks = {
  notOk,
  orphans: orphans.map((o) => o.path),
  aiseoHasMoney: Boolean(aiseo?.hrefs?.some((h) => normPath(h) === moneyPath)),
  designHasMoney: Boolean(design?.hrefs?.some((h) => normPath(h) === moneyPath)),
  blindHasMoney: Boolean(blind?.hrefs?.some((h) => normPath(h) === moneyPath)),
  moneyHasDesign: Boolean(money?.hrefs?.some((h) => normPath(h) === "/website-design")),
  moneyHasAudit: Boolean(money?.hrefs?.some((h) => normPath(h) === "/aiseo/ai-seo-audit")),
  moneyHasBlind: Boolean(money?.hrefs?.some((h) => normPath(h) === "/our-work/blind-magic")),
  moneyHasContact: Boolean(money?.hrefs?.some((h) => normPath(h) === "/contact")),
  moneyInbound: inbound.get(moneyPath) || 0,
};
writeFileSync(join(outDir, "edmonton-seo-recrawl-checks.json"), JSON.stringify(checks, null, 2), "utf8");
console.log(JSON.stringify(checks, null, 2));
const required = new Set(["/aiseo", "/website-design", "/our-work/blind-magic", normPath(moneyPath)]);
const requiredDown = notOk.filter((p) => required.has(normPath(p.path)));
if (requiredDown.length) throw new Error(`recrawl non-200: ${JSON.stringify(requiredDown)}`);
if (!checks.aiseoHasMoney || !checks.designHasMoney || !checks.blindHasMoney) {
  throw new Error("recrawl missing money hrefs on aiseo/design/blind");
}
if (!checks.moneyHasDesign || !checks.moneyHasAudit || !checks.moneyHasBlind || !checks.moneyHasContact) {
  throw new Error("recrawl money outbound incomplete");
}
