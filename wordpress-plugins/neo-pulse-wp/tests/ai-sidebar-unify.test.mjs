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

  it('search widget defers to unified shell for sidebar open', () => {
    const src = readAsset('assets/search/neo-pulse-search.js');
    expect(src).toContain('NeoPulseAiSidebarUnify.tryMerge');
    expect(src).toContain("openTab('search')");
  });

  it('search php registers unify assets', () => {
    const src = readAsset('includes/class-neo-pulse-wp-search.php');
    expect(src).toContain('neo-pulse-ai-sidebar-unify');
  });

  it('chat php enqueues unify assets when enabled', () => {
    const src = readAsset('includes/class-neo-pulse-wp-chat.php');
    expect(src).toContain('neo-pulse-ai-sidebar-unify');
  });
});
