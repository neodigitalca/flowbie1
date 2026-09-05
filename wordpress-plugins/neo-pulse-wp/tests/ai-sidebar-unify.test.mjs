import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readAsset(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

describe('ai-sidebar-unify assets', () => {
  it('unify script exists and exports tryMerge API', () => {
    const unifyPath = join(root, 'assets/shared/neo-pulse-ai-sidebar-unify.js');
    expect(existsSync(unifyPath)).toBe(true);
    const src = readAsset('assets/shared/neo-pulse-ai-sidebar-unify.js');
    expect(src).toContain('window.NeoPulseAiSidebarUnify');
    expect(src).toContain('tryMerge');
    expect(src).toContain('openTab');
    expect(src).toContain('setActiveTab');
  });

  it('shell exposes registerLauncher for multi-launcher unify', () => {
    const src = readAsset('assets/shared/neo-pulse-ai-sidebar-shell.js');
    expect(src).toContain('registerLauncher');
    expect(src).toContain('onBeforeOpen');
  });

  it('unify script hides duplicate shells and registers search launcher', () => {
    const src = readAsset('assets/shared/neo-pulse-ai-sidebar-unify.js');
    expect(src).toContain('hideDuplicateShell');
    expect(src).toContain('ensureChatSidebarStructure');
    expect(src).not.toContain('promoteBubbleChatToSidebar');
  });

  it('chat widget calls tryMerge and binds unified shell only', () => {
    const src = readAsset('assets/frontend/neo-pulse-chat-widget.js');
    expect(src).toContain('NeoPulseAiSidebarUnify.tryMerge');
    expect(src).toContain('getUnifiedShell');
    expect(src).toContain('bindUnifiedShell');
    expect(src).toContain('initStandaloneShell');
    expect(src).toContain('neo-pulse-chat--standalone-launcher');
  });

  it('search widget binds insights after unify and fills topics without discovery layout', () => {
    const src = readAsset('assets/search/neo-pulse-search.js');
    expect(src).toContain('resolveSearchScope');
    expect(src).toContain('neo-pulse-ai-sidebar-merged');
    expect(src).toContain("data-fai-tab=\"search\"");
    expect(src).toContain('renderTopicsGrid(overseerPages.slice(0, topicsLimit), topicsBlock)');
    expect(src).not.toContain('isDiscovery && showOverseer && overseerPages.length');
  });

  it('search php renders results under the search bar, then popular searches only', () => {
    const src = readAsset('includes/class-neo-pulse-wp-search.php');
    const fnAt = src.indexOf('private static function render_sidebar_layout_sections');
    const fn = src.slice(fnAt, src.indexOf('private static function normalize_sidebar_panel_layout'));
    const searchAt = fn.indexOf('fbs__sidebar-search');
    const resultsAt = fn.indexOf('fbs__sidebar-query-scroll');
    const insightsAt = fn.indexOf('fbs__sidebar-insights');
    expect(fn).toContain("$insight_sections = array( 'popular_terms' )");
    expect(fn).not.toContain('popular_topics');
    expect(searchAt).toBeGreaterThan(0);
    expect(resultsAt).toBeGreaterThan(searchAt);
    expect(insightsAt).toBeGreaterThan(resultsAt);
    expect(src).toContain("$show_heading = in_array( 'heading', $layout, true )");
  });

  it('elementor global settings do not replace sidebar suggestion layout', () => {
    const src = readAsset('includes/search/integrations/class-neo-pulse-wp-search-elementor-widget.php');
    expect(src).toContain("$use_global = ! isset( $settings['use_global_settings'] ) || $settings['use_global_settings'] === 'yes'");
    expect(src).toContain("if ( ! $use_global )");
    expect(src).toContain("$instance['sidebar_layout'] = $layout;");
  });

  it('search php registers unify assets', () => {
    const src = readAsset('includes/class-neo-pulse-wp-search.php');
    expect(src).toContain('neo-pulse-ai-sidebar-unify');
  });

  it('chat php enqueues unify assets when enabled', () => {
    const src = readAsset('includes/class-neo-pulse-wp-chat.php');
    expect(src).toContain('neo-pulse-ai-sidebar-unify');
  });

  it('chat config is a valid JS identifier so the launcher can boot', () => {
    const src = readAsset('includes/class-neo-pulse-wp-chat.php');
    expect(src).toContain("'neoPulseChatConfig'");
    expect(src).toContain('window.neoPulseChatConfig');
    expect(src).not.toContain('neo-pulseChatConfig');
  });
});
