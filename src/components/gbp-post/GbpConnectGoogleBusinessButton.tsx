const CONNECT_BTN_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-none border-0 bg-black px-2.5 text-base font-medium text-white shadow-none hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Opens server OAuth flow (GET /api/gmb/authorize) in a new tab.
 */
export function GbpConnectGoogleBusinessButton({
  variant: _variant = "default",
}: {
  variant?: "default" | "toolbar" | "titleBar";
}) {
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
