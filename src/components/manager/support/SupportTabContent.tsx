import { SupportTicketsPanel } from "@/components/manager/support/SupportTicketsPanel";

export function SupportTabContent() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sans text-base">
      <SupportTicketsPanel />
    </div>
  );
}
