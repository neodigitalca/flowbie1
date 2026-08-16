import { CheckCircle, Loader2 } from "lucide-react";
import { useGmbConnectionStatus } from "@/hooks/gbp-post/use-gmb-connection-status";

const CONNECT_SLOT_CLASS = "inline-flex h-8 min-w-[6.75rem] shrink-0 items-center justify-center";

const CONNECT_BTN_CLASS =
  `${CONNECT_SLOT_CLASS} gap-1.5 rounded-none border-0 bg-black px-2.5 text-base font-medium text-white shadow-none hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

const CONNECTED_BTN_CLASS =
  `${CONNECT_SLOT_CLASS} gap-1.5 rounded-none border-0 bg-zinc-900 px-2.5 text-base font-medium text-green-400 shadow-none cursor-default`;

/**
 * Opens server OAuth flow (GET /api/gmb/authorize) in a new tab when not connected.
 */
export function GbpConnectGoogleBusinessButton({
  variant: _variant = "default",
}: {
  variant?: "default" | "toolbar" | "titleBar";
}) {
  const { connected, loading } = useGmbConnectionStatus();

  if (loading) {
    return (
      <span className={CONNECTED_BTN_CLASS} aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </span>
    );
  }

  if (connected) {
    return (
      <span className={CONNECTED_BTN_CLASS} aria-live="polite">
        <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
        Connected
      </span>
    );
  }

  return (
    <button
      type="button"
      className={CONNECT_BTN_CLASS}
      onClick={() => {
        window.open("/api/gmb/authorize", "_blank", "noopener,noreferrer");
      }}
    >
      Connect
    </button>
  );
}
