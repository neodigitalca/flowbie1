import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MobilePushDeepLink } from "@/lib/mobile-push/types";

type MobilePushContextValue = {
  pendingDeepLink: MobilePushDeepLink | null;
  applyDeepLink: (link: MobilePushDeepLink) => void;
  consumeDeepLink: () => MobilePushDeepLink | null;
  pushReady: boolean;
  setPushReady: (ready: boolean) => void;
};

const MobilePushContext = createContext<MobilePushContextValue | null>(null);

export function MobilePushProvider({ children }: { children: ReactNode }) {
  const [pendingDeepLink, setPendingDeepLink] = useState<MobilePushDeepLink | null>(null);
  const [pushReady, setPushReady] = useState(false);

  const applyDeepLink = useCallback((link: MobilePushDeepLink) => {
    setPendingDeepLink(link);
  }, []);

  const consumeDeepLink = useCallback(() => {
    let next: MobilePushDeepLink | null = null;
    setPendingDeepLink((current) => {
      next = current;
      return null;
    });
    return next;
  }, []);

  const value = useMemo(
    () => ({
      pendingDeepLink,
      applyDeepLink,
      consumeDeepLink,
      pushReady,
      setPushReady,
    }),
    [applyDeepLink, consumeDeepLink, pendingDeepLink, pushReady],
  );

  return <MobilePushContext.Provider value={value}>{children}</MobilePushContext.Provider>;
}

export function useMobilePushContext(): MobilePushContextValue {
  const ctx = useContext(MobilePushContext);
  if (!ctx) {
    throw new Error("useMobilePushContext must be used within MobilePushProvider");
  }
  return ctx;
}
