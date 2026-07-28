import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PropertiesWorkspaceToolbarState = {
  sitesCount: number;
  siteSearchQuery: string;
  onSearchChange: (query: string) => void;
  selectAllChecked: boolean | "indeterminate";
  onSelectAll?: (selected: boolean) => void;
  selectedCount: number;
  onDeleteSelected?: () => void;
  showGbpBulk: boolean;
  isBulkGmbNamesBusy: boolean;
  onBulkApplyGmbDisplayNames: () => void;
  trailingActions: ReactNode;
};

type PropertiesDashboardChromeContextValue = {
  toolbarState: PropertiesWorkspaceToolbarState | null;
  setToolbarState: (state: PropertiesWorkspaceToolbarState | null) => void;
};

const PropertiesDashboardChromeContext = createContext<PropertiesDashboardChromeContextValue | null>(
  null,
);

export function PropertiesDashboardChromeProvider({ children }: { children: ReactNode }) {
  const [toolbarState, setToolbarState] = useState<PropertiesWorkspaceToolbarState | null>(null);
  const value = useMemo(
    () => ({
      toolbarState,
      setToolbarState,
    }),
    [toolbarState],
  );
  return (
    <PropertiesDashboardChromeContext.Provider value={value}>
      {children}
    </PropertiesDashboardChromeContext.Provider>
  );
}

export function usePropertiesDashboardToolbarState(): PropertiesWorkspaceToolbarState | null {
  const ctx = useContext(PropertiesDashboardChromeContext);
  return ctx?.toolbarState ?? null;
}

export function useRegisterPropertiesDashboardToolbar(state: PropertiesWorkspaceToolbarState | null) {
  const ctx = useContext(PropertiesDashboardChromeContext);
  const setToolbarState = ctx?.setToolbarState;

  useEffect(() => {
    if (!setToolbarState) return;
    setToolbarState(state);
    return () => setToolbarState(null);
  }, [setToolbarState, state]);
}
