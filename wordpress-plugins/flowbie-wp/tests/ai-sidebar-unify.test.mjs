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
    const unifyPath = join(root, 'assets/shared/flowbie-ai-sidebar-unify.js');
    expect(existsSync(unifyPath)).toBe(true);
    const src = readAsset('assets/shared/flowbie-ai-sidebar-unify.js');
    expect(src).toContain('window.FlowbieAiSidebarUnify');
    expect(src).toContain('tryMerge');
    expect(src).toContain('openTab');
    expect(src).toContain('setActiveTab');
  });

  it('shell exposes registerLauncher for multi-launcher unify', () => {
    const src = readAsset('assets/shared/flowbie-ai-sidebar-shell.js');
    expect(src).toContain('registerLauncher');
    expect(src).toContain('onBeforeOpen');
  });

  it('unify script hides duplicate shells and registers search launcher', () => {
    const src = readAsset('assets/shared/flowbie-ai-sidebar-unify.js');
    expect(src).toContain('hideDuplicateShell');
    expect(src).toContain('ensureChatSidebarStructure');
    expect(src).not.toContain('promoteBubbleChatToSidebar');
  });

  it('chat widget calls tryMerge and binds unified shell only', () => {
    const src = readAsset('assets/frontend/flowbie-chat-widget.js');
    expect(src).toContain('FlowbieAiSidebarUnify.tryMerge');
    expect(src).toContain('getUnifiedShell');
    expect(src).toContain('bindUnifiedShell');
    expect(src).toContain('initStandaloneShell');
    expect(src).toContain('flowbie-chat--standalone-launcher');
  });

  it('search widget defers to unified shell for sidebar open', () => {
    const src = readAsset('assets/search/flowbie-search.js');
    expect(src).toContain('FlowbieAiSidebarUnify.tryMerge');
    expect(src).toContain("openTab('search')");
  });

  it('search php registers unify assets', () => {
    const src = readAsset('includes/class-flowbie-wp-search.php');
    expect(src).toContain('flowbie-ai-sidebar-unify');
  });

  it('chat php enqueues unify assets when enabled', () => {
    const src = readAsset('includes/class-flowbie-wp-chat.php');
    expect(src).toContain('flowbie-ai-sidebar-unify');
  });
});
